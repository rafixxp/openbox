import IORedis from 'ioredis';
import { loadConfig } from './config';
import { createLogger } from './lib/logger';
import { CallbackClient } from './services/callbacks';
import { BullJobQueue } from './services/queue';
import { BuildRunner } from './services/runner';
import { createUploader } from './services/s3';
import { BuildWorker } from './services/worker';

async function main(): Promise<void> {
    const config = loadConfig();
    const logger = createLogger('build-worker');
    const queueRedis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
    const workerRedis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
    const queue = new BullJobQueue(config, queueRedis);

    const runner = new BuildRunner({
        config,
        callbacks: new CallbackClient(config),
        uploader: createUploader(config),
        isCanceled: (buildUuid) => queue.isCancelRequested(buildUuid),
        logger,
    });

    const worker = new BuildWorker({
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

    const shutdown = async (signal: string): Promise<void> => {
        logger.info('Shutting down build worker.', { signal });

        await worker.stop();
        await queue.close();
        await queueRedis.quit();
        await workerRedis.quit();
    };

    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.once(signal, () => {
            void shutdown(signal)
                .then(() => process.exit(0))
                .catch((error: unknown) => {
                    console.error('Graceful shutdown failed:', error);
                    process.exit(1);
                });
        });
    }
}

void main().catch((error: unknown) => {
    console.error('Build worker failed to start:', error instanceof Error ? error.message : error);
    process.exit(1);
});
