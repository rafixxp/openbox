import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { AppConfig } from '../config';
import type { BuildJob } from '../schemas/job';

export interface EnqueueResult {
    accepted: true;
    /** False when a job with the same build UUID was already queued. */
    created: boolean;
}

export type CancelResult = 'accepted' | 'not_found';

/**
 * Queue seam. Tests and the single-process dev server can swap in
 * InMemoryJobQueue without Redis, while production uses BullMQ.
 */
export interface JobQueue {
    enqueue(job: BuildJob): Promise<EnqueueResult>;
    requestCancel(buildUuid: string): Promise<CancelResult>;
    isCancelRequested(buildUuid: string): Promise<boolean>;
    clearCancel(buildUuid: string): Promise<void>;
    close(): Promise<void>;
}

const CANCEL_KEY_PREFIX = 'openbox:build:cancel:';
const CANCEL_TTL_SECONDS = 86_400;

export function cancelKey(buildUuid: string): string {
    return `${CANCEL_KEY_PREFIX}${buildUuid}`;
}

export class BullJobQueue implements JobQueue {
    private readonly queue: Queue<BuildJob>;

    constructor(
        config: AppConfig,
        private readonly redis: Redis,
    ) {
        this.queue = new Queue<BuildJob>(config.queueName, { connection: redis });
    }

    async enqueue(job: BuildJob): Promise<EnqueueResult> {
        const existing = await this.queue.getJob(job.buildUuid);

        if (existing !== undefined && existing !== null) {
            return { accepted: true, created: false };
        }

        await this.queue.add('build', job, {
            jobId: job.buildUuid,
            attempts: 1,
            removeOnComplete: { age: CANCEL_TTL_SECONDS, count: 200 },
            removeOnFail: { age: 7 * CANCEL_TTL_SECONDS, count: 500 },
        });

        return { accepted: true, created: true };
    }

    async requestCancel(buildUuid: string): Promise<CancelResult> {
        const job = await this.queue.getJob(buildUuid);

        if (job === undefined || job === null) {
            return 'not_found';
        }

        // Signal active workers through Redis; the runner polls this key.
        await this.redis.set(cancelKey(buildUuid), '1', 'EX', CANCEL_TTL_SECONDS);

        const state = await job.getState();

        if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
            await job.remove();
        }

        return 'accepted';
    }

    async isCancelRequested(buildUuid: string): Promise<boolean> {
        return (await this.redis.exists(cancelKey(buildUuid))) === 1;
    }

    async clearCancel(buildUuid: string): Promise<void> {
        await this.redis.del(cancelKey(buildUuid));
    }

    async close(): Promise<void> {
        await this.queue.close();
    }
}

/** Deterministic queue used by tests and local single-process runs. */
export class InMemoryJobQueue implements JobQueue {
    private readonly jobs = new Map<string, BuildJob>();
    private readonly cancelled = new Set<string>();

    async enqueue(job: BuildJob): Promise<EnqueueResult> {
        if (this.jobs.has(job.buildUuid)) {
            return { accepted: true, created: false };
        }

        this.jobs.set(job.buildUuid, job);

        return { accepted: true, created: true };
    }

    async requestCancel(buildUuid: string): Promise<CancelResult> {
        if (!this.jobs.has(buildUuid)) {
            return 'not_found';
        }

        this.cancelled.add(buildUuid);
        this.jobs.delete(buildUuid);

        return 'accepted';
    }

    async isCancelRequested(buildUuid: string): Promise<boolean> {
        return this.cancelled.has(buildUuid);
    }

    async clearCancel(buildUuid: string): Promise<void> {
        this.cancelled.delete(buildUuid);
    }

    async close(): Promise<void> {
        this.jobs.clear();
        this.cancelled.clear();
    }

    /** Test helper: complete a job and forget its state. */
    finish(buildUuid: string): void {
        this.jobs.delete(buildUuid);
        this.cancelled.delete(buildUuid);
    }

    get size(): number {
        return this.jobs.size;
    }
}
