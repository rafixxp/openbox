import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { AppConfig } from '../config';
import { buildJobSchema } from '../schemas/job';
import type { BuildRunner, RunnerLogger } from './runner';
import type { JobQueue } from './queue';

export interface BuildWorkerOptions {
    config: AppConfig;
    runner: BuildRunner;
    queue: Pick<JobQueue, 'isCancelRequested' | 'clearCancel'>;
    connection: Redis;
    logger: RunnerLogger;
}

/**
 * BullMQ worker wrapper. Kept free of module-level side effects so tests and
 * the HTTP process can import it without opening Redis connections.
 */
export class BuildWorker {
    private worker: Worker | null = null;
    private stopping = false;

    constructor(private readonly options: BuildWorkerOptions) {}

    start(): void {
        if (this.worker !== null) {
            return;
        }

        const { config, runner, queue, connection, logger } = this.options;

        this.worker = new Worker(
            config.queueName,
            async (job) => {
                const parsed = buildJobSchema.safeParse(job.data);

                if (!parsed.success) {
                    throw new Error(`Rejected malformed build job: ${parsed.error.message}`);
                }

                logger.info('Build job started.', {
                    buildUuid: parsed.data.buildUuid,
                    attempt: job.attemptsMade + 1,
                });

                try {
                    const result = await runner.run(parsed.data);

                    logger.info('Build job finished.', {
                        buildUuid: parsed.data.buildUuid,
                        status: result.status,
                        exitCode: result.exitCode,
                    });
                } finally {
                    await queue.clearCancel(parsed.data.buildUuid);
                }
            },
            {
                connection,
                concurrency: config.concurrency,
                lockDuration: 60_000,
            },
        );

        this.worker.on('failed', (job, error) => {
            logger.error('Build job failed in the queue.', {
                buildUuid: job?.data?.buildUuid ?? 'unknown',
                error: error.message,
            });
        });

        this.worker.on('error', (error) => {
            logger.error('Build worker error.', { error: error.message });
        });
    }

    async stop(): Promise<void> {
        if (this.worker === null || this.stopping) {
            return;
        }

        this.stopping = true;
        await this.worker.close();
        this.worker = null;
    }
}
