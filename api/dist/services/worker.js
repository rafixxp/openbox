"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildWorker = void 0;
const bullmq_1 = require("bullmq");
const job_1 = require("../schemas/job");
/**
 * BullMQ worker wrapper. Kept free of module-level side effects so tests and
 * the HTTP process can import it without opening Redis connections.
 */
class BuildWorker {
    options;
    worker = null;
    stopping = false;
    constructor(options) {
        this.options = options;
    }
    start() {
        if (this.worker !== null) {
            return;
        }
        const { config, runner, queue, connection, logger } = this.options;
        this.worker = new bullmq_1.Worker(config.queueName, async (job) => {
            const parsed = job_1.buildJobSchema.safeParse(job.data);
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
            }
            finally {
                await queue.clearCancel(parsed.data.buildUuid);
            }
        }, {
            connection,
            concurrency: config.concurrency,
            lockDuration: 60_000,
        });
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
    async stop() {
        if (this.worker === null || this.stopping) {
            return;
        }
        this.stopping = true;
        await this.worker.close();
        this.worker = null;
    }
}
exports.BuildWorker = BuildWorker;
//# sourceMappingURL=worker.js.map