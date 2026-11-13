"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryJobQueue = exports.BullJobQueue = void 0;
exports.cancelKey = cancelKey;
const bullmq_1 = require("bullmq");
const CANCEL_KEY_PREFIX = 'openbox:build:cancel:';
const CANCEL_TTL_SECONDS = 86_400;
function cancelKey(buildUuid) {
    return `${CANCEL_KEY_PREFIX}${buildUuid}`;
}
class BullJobQueue {
    redis;
    queue;
    constructor(config, redis) {
        this.redis = redis;
        this.queue = new bullmq_1.Queue(config.queueName, { connection: redis });
    }
    async enqueue(job) {
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
    async requestCancel(buildUuid) {
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
    async isCancelRequested(buildUuid) {
        return (await this.redis.exists(cancelKey(buildUuid))) === 1;
    }
    async clearCancel(buildUuid) {
        await this.redis.del(cancelKey(buildUuid));
    }
    async close() {
        await this.queue.close();
    }
}
exports.BullJobQueue = BullJobQueue;
/** Deterministic queue used by tests and local single-process runs. */
class InMemoryJobQueue {
    jobs = new Map();
    cancelled = new Set();
    async enqueue(job) {
        if (this.jobs.has(job.buildUuid)) {
            return { accepted: true, created: false };
        }
        this.jobs.set(job.buildUuid, job);
        return { accepted: true, created: true };
    }
    async requestCancel(buildUuid) {
        if (!this.jobs.has(buildUuid)) {
            return 'not_found';
        }
        this.cancelled.add(buildUuid);
        this.jobs.delete(buildUuid);
        return 'accepted';
    }
    async isCancelRequested(buildUuid) {
        return this.cancelled.has(buildUuid);
    }
    async clearCancel(buildUuid) {
        this.cancelled.delete(buildUuid);
    }
    async close() {
        this.jobs.clear();
        this.cancelled.clear();
    }
    /** Test helper: complete a job and forget its state. */
    finish(buildUuid) {
        this.jobs.delete(buildUuid);
        this.cancelled.delete(buildUuid);
    }
    get size() {
        return this.jobs.size;
    }
}
exports.InMemoryJobQueue = InMemoryJobQueue;
//# sourceMappingURL=queue.js.map