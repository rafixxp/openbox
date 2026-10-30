import IORedis from 'ioredis';
import { loadConfig } from './config';
import { createLogger } from './lib/logger';
import { buildServer } from './server';
import { CallbackClient } from './services/callbacks';
import { BullJobQueue } from './services/queue';
import { BuildRunner } from './services/runner';
import { createUploader } from './services/s3';
import { BuildWorker } from './services/worker';
import { AGENT_VERSION } from './version';

async function main(): Promise<void> {
    const config = loadConfig();
    const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
    const workerRedis = config.workerEnabled ? redis.duplicate() : null;
    const logger = createLogger('build-agent');
    const queue = new BullJobQueue(config, redis);

    const app = await buildServer({
        config,
        queue,
        logger: { level: config.logLevel },
    });

    let worker: BuildWorker | null = null;

    if (config.workerEnabled && workerRedis !== null) {
        const runner = new BuildRunner({
            config,
            callbacks: new CallbackClient(config),
            uploader: createUploader(config),
            isCanceled: (buildUuid) => queue.isCancelRequested(buildUuid),
            logger,
        });

        worker = new BuildWorker({
            config,
            runner,
            queue,
            connection: workerRedis,
            logger,
        });
        worker.start();
        app.log.info('Embedded build worker started.');
    }

    const shutdown = async (signal: string): Promise<void> => {
        app.log.info({ signal }, 'Shutting down build agent.');

        await worker?.stop();
        await app.close();
        await queue.close();
        await workerRedis?.quit();
        await redis.quit();
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

    await app.listen({ host: config.host, port: config.port });
    app.log.info(
        {
            version: AGENT_VERSION,
            queue: config.queueName,
            workerEnabled: config.workerEnabled,
        },
        'Openbox build agent listening.',
    );
}

void main().catch((error: unknown) => {
    console.error('Build agent failed to start:', error instanceof Error ? error.message : error);
    process.exit(1);
});
