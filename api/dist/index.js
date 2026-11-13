"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config");
const logger_1 = require("./lib/logger");
const server_1 = require("./server");
const callbacks_1 = require("./services/callbacks");
const queue_1 = require("./services/queue");
const runner_1 = require("./services/runner");
const s3_1 = require("./services/s3");
const worker_1 = require("./services/worker");
const version_1 = require("./version");
async function main() {
    const config = (0, config_1.loadConfig)();
    const redis = new ioredis_1.default(config.redisUrl, { maxRetriesPerRequest: null });
    const workerRedis = config.workerEnabled ? redis.duplicate() : null;
    const logger = (0, logger_1.createLogger)('build-agent');
    const queue = new queue_1.BullJobQueue(config, redis);
    const app = await (0, server_1.buildServer)({
        config,
        queue,
        logger: { level: config.logLevel },
    });
    let worker = null;
    if (config.workerEnabled && workerRedis !== null) {
        const runner = new runner_1.BuildRunner({
            config,
            callbacks: new callbacks_1.CallbackClient(config),
            uploader: (0, s3_1.createUploader)(config),
            isCanceled: (buildUuid) => queue.isCancelRequested(buildUuid),
            logger,
        });
        worker = new worker_1.BuildWorker({
            config,
            runner,
            queue,
            connection: workerRedis,
            logger,
        });
        worker.start();
        app.log.info('Embedded build worker started.');
    }
    const shutdown = async (signal) => {
        app.log.info({ signal }, 'Shutting down build agent.');
        await worker?.stop();
        await app.close();
        await queue.close();
        await workerRedis?.quit();
        await redis.quit();
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
    await app.listen({ host: config.host, port: config.port });
    app.log.info({
        version: version_1.AGENT_VERSION,
        queue: config.queueName,
        workerEnabled: config.workerEnabled,
    }, 'Openbox build agent listening.');
}
void main().catch((error) => {
    console.error('Build agent failed to start:', error instanceof Error ? error.message : error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map