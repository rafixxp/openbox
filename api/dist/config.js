"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    HOST: zod_1.z.string().min(1).default('0.0.0.0'),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(8090),
    LOG_LEVEL: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    /** Shared HMAC secret with Laravel. Never exposed to browsers. */
    BUILD_AGENT_SECRET: zod_1.z.string().min(16),
    HMAC_CLOCK_SKEW_SECONDS: zod_1.z.coerce.number().int().min(30).max(3600).default(300),
    REDIS_URL: zod_1.z.string().min(1).default('redis://127.0.0.1:6379'),
    BUILD_QUEUE: zod_1.z.string().min(1).default('builds'),
    BUILD_CONCURRENCY: zod_1.z.coerce.number().int().min(1).max(10).default(1),
    BUILD_SCRIPT: zod_1.z.string().min(1).default('/opt/openbox/docker/scripts/build-iso.sh'),
    BUILD_SOURCE_ROOT: zod_1.z.string().min(1).default('/workspace/source'),
    BUILD_WORK_DIR: zod_1.z.string().min(1).default('/var/lib/openbox-build'),
    BUILD_ISO_NAME: zod_1.z.string().min(1).default('openbox-image-amd64.hybrid.iso'),
    BUILD_TIMEOUT_SECONDS: zod_1.z.coerce.number().int().min(60).max(86400).default(7200),
    PANEL_INSTALLER_PATH: zod_1.z.string().min(1).default('/workspace/source/install_panel_en.sh'),
    CALLBACK_TIMEOUT_MS: zod_1.z.coerce.number().int().min(500).max(60000).default(10000),
    CALLBACK_MAX_ATTEMPTS: zod_1.z.coerce.number().int().min(1).max(10).default(3),
    LOG_BATCH_SIZE: zod_1.z.coerce.number().int().min(1).max(200).default(25),
    LOG_BATCH_INTERVAL_MS: zod_1.z.coerce.number().int().min(200).max(30000).default(1500),
    STATUS_THROTTLE_MS: zod_1.z.coerce.number().int().min(250).max(60000).default(2500),
    ARTIFACT_DISK: zod_1.z.enum(['s3', 'local']).default('s3'),
    S3_ENDPOINT: zod_1.z.string().min(1).default('http://minio:9000'),
    S3_REGION: zod_1.z.string().min(1).default('us-east-1'),
    S3_BUCKET: zod_1.z.string().min(1).default('openbox-artifacts'),
    S3_ACCESS_KEY_ID: zod_1.z.string().default(''),
    S3_SECRET_ACCESS_KEY: zod_1.z.string().default(''),
    S3_FORCE_PATH_STYLE: zod_1.z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
    WORKER_ENABLED: zod_1.z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
});
/**
 * Parse configuration at the process boundary. Every other module receives a
 * validated AppConfig, so no route or worker reads process.env directly.
 */
function loadConfig(env = process.env) {
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
//# sourceMappingURL=config.js.map