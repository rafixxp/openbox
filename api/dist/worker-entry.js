"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config");
const logger_1 = require("./lib/logger");
const callbacks_1 = require("./services/callbacks");
const queue_1 = require("./services/queue");
const runner_1 = require("./services/runner");
const s3_1 = require("./services/s3");
const worker_1 = require("./services/worker");
async function main() {
    const config = (0, config_1.loadConfig)();
    const logger = (0, logger_1.createLogger)('build-worker');
    const queueRedis = new ioredis_1.default(config.redisUrl, { maxRetriesPerRequest: null });
    const workerRedis = new ioredis_1.default(config.redisUrl, { maxRetriesPerRequest: null });
    const queue = new queue_1.BullJobQueue(config, queueRedis);
    const runner = new runner_1.BuildRunner({
        config,
        callbacks: new callbacks_1.CallbackClient(config),
        uploader: (0, s3_1.createUploader)(config),
        isCanceled: (buildUuid) => queue.isCancelRequested(buildUuid),
        logger,
    });
    const worker = new worker_1.BuildWorker({
        config,
        runner,
        queue,
        connection: workerRedis,
        logger,
    });
    worker.start();
    logger.info('Build worker started.', {
        queue: config.queueName,
        concurrency: config.concurrency,
    });
    const shutdown = async (signal) => {
        logger.info('Shutting down build worker.', { signal });
        await worker.stop();
        await queue.close();
        await queueRedis.quit();
        await workerRedis.quit();
    };
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.once(signal, () => {
            void shutdown(signal)
                .then(() => process.exit(0))
                .catch((error) => {
                console.error('Graceful shutdown failed:', error);
                process.exit(1);
            });
        });
    }
}
void main().catch((error) => {
    console.error('Build worker failed to start:', error instanceof Error ? error.message : error);
    process.exit(1);
});
//# sourceMappingURL=worker-entry.js.map