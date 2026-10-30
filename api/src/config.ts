import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8090),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    /** Shared HMAC secret with Laravel. Never exposed to browsers. */
    BUILD_AGENT_SECRET: z.string().min(16),
    HMAC_CLOCK_SKEW_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),

    REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
    BUILD_QUEUE: z.string().min(1).default('builds'),
    BUILD_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(1),

    BUILD_SCRIPT: z.string().min(1).default('/opt/openbox/docker/scripts/build-iso.sh'),
    BUILD_SOURCE_ROOT: z.string().min(1).default('/workspace/source'),
    BUILD_WORK_DIR: z.string().min(1).default('/var/lib/openbox-build'),
    BUILD_ISO_NAME: z.string().min(1).default('openbox-image-amd64.hybrid.iso'),
    BUILD_TIMEOUT_SECONDS: z.coerce.number().int().min(60).max(86400).default(7200),
    PANEL_INSTALLER_PATH: z.string().min(1).default('/workspace/source/install_panel_en.sh'),

    CALLBACK_TIMEOUT_MS: z.coerce.number().int().min(500).max(60000).default(10000),
    CALLBACK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    LOG_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(25),
    LOG_BATCH_INTERVAL_MS: z.coerce.number().int().min(200).max(30000).default(1500),
    STATUS_THROTTLE_MS: z.coerce.number().int().min(250).max(60000).default(2500),

    ARTIFACT_DISK: z.enum(['s3', 'local']).default('s3'),
    S3_ENDPOINT: z.string().min(1).default('http://minio:9000'),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_BUCKET: z.string().min(1).default('openbox-artifacts'),
    S3_ACCESS_KEY_ID: z.string().default(''),
    S3_SECRET_ACCESS_KEY: z.string().default(''),
    S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),

    WORKER_ENABLED: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
});

export interface S3Config {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
}

export interface AppConfig {
    nodeEnv: 'development' | 'test' | 'production';
    host: string;
    port: number;
    logLevel: string;
    secret: string;
    clockSkewSeconds: number;
    redisUrl: string;
    queueName: string;
    concurrency: number;
    buildScript: string;
    sourceRoot: string;
    workDir: string;
    isoName: string;
    buildTimeoutSeconds: number;
    panelInstallerPath: string;
    callbackTimeoutMs: number;
    callbackMaxAttempts: number;
    logBatchSize: number;
    logBatchIntervalMs: number;
    statusThrottleMs: number;
    artifactDisk: 's3' | 'local';
    s3: S3Config;
    workerEnabled: boolean;
}

/**
 * Parse configuration at the process boundary. Every other module receives a
 * validated AppConfig, so no route or worker reads process.env directly.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const parsed = envSchema.safeParse(env);

    if (!parsed.success) {
        const details = parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');

        throw new Error(`Invalid build agent configuration: ${details}`);
    }

    const value = parsed.data;

    return {
        nodeEnv: value.NODE_ENV,
        host: value.HOST,
        port: value.PORT,
        logLevel: value.LOG_LEVEL,
        secret: value.BUILD_AGENT_SECRET,
        clockSkewSeconds: value.HMAC_CLOCK_SKEW_SECONDS,
        redisUrl: value.REDIS_URL,
        queueName: value.BUILD_QUEUE,
        concurrency: value.BUILD_CONCURRENCY,
        buildScript: value.BUILD_SCRIPT,
        sourceRoot: value.BUILD_SOURCE_ROOT,
        workDir: value.BUILD_WORK_DIR,
        isoName: value.BUILD_ISO_NAME,
        buildTimeoutSeconds: value.BUILD_TIMEOUT_SECONDS,
        panelInstallerPath: value.PANEL_INSTALLER_PATH,
        callbackTimeoutMs: value.CALLBACK_TIMEOUT_MS,
        callbackMaxAttempts: value.CALLBACK_MAX_ATTEMPTS,
        logBatchSize: value.LOG_BATCH_SIZE,
        logBatchIntervalMs: value.LOG_BATCH_INTERVAL_MS,
        statusThrottleMs: value.STATUS_THROTTLE_MS,
        artifactDisk: value.ARTIFACT_DISK,
        s3: {
            endpoint: value.S3_ENDPOINT,
            region: value.S3_REGION,
            bucket: value.S3_BUCKET,
            accessKeyId: value.S3_ACCESS_KEY_ID,
            secretAccessKey: value.S3_SECRET_ACCESS_KEY,
            forcePathStyle: value.S3_FORCE_PATH_STYLE,
        },
        workerEnabled: value.WORKER_ENABLED,
    };
}
