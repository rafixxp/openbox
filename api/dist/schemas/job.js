"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthSchema = exports.completeCallbackSchema = exports.statusCallbackSchema = exports.logEntrySchema = exports.cancelParamsSchema = exports.buildJobSchema = exports.manifestSchema = exports.httpUrlSchema = exports.panelInstallerSchema = exports.packageEntrySchema = exports.logLevelSchema = void 0;
const zod_1 = require("zod");
/**
 * Wire contract shared with Laravel's BuildAgentClient and the build manifest
 * factory. Validation happens here, at the process boundary; the runner only
 * ever receives already-validated values.
 */
exports.logLevelSchema = zod_1.z.enum(['debug', 'info', 'warning', 'error']);
exports.packageEntrySchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1)
        .max(200)
        .regex(/^[a-z0-9][a-z0-9+.-]*$/, 'Package names must be lowercase Debian package identifiers.'),
    version: zod_1.z.string().min(1).max(128),
    architecture: zod_1.z.string().min(1).max(32),
});
exports.panelInstallerSchema = zod_1.z.object({
    filename: zod_1.z
        .string()
        .min(1)
        .max(255)
        .regex(/^[A-Za-z0-9._-]+$/, 'Installer filenames must not contain path separators.'),
    sha256: zod_1.z.string().regex(/^[a-f0-9]{64}$/, 'Installer checksum must be a lowercase sha256 digest.'),
});
exports.httpUrlSchema = zod_1.z
    .string()
    .url()
    .max(2048)
    .refine((value) => /^https?:\/\//i.test(value), 'Only http(s) URLs are allowed.');
exports.manifestSchema = zod_1.z.object({
    schemaVersion: zod_1.z.number().int().min(1).max(99),
    channel: zod_1.z.enum(['stable', 'testing']),
    debian: zod_1.z.object({
        suite: zod_1.z.string().min(2).max(32).regex(/^[a-z][a-z0-9-]*$/),
        architecture: zod_1.z.enum(['amd64', 'arm64', 'i386']),
        mirror: exports.httpUrlSchema,
    }),
    packages: zod_1.z.array(exports.packageEntrySchema).max(500),
    includePanelInstaller: zod_1.z.boolean(),
    panelInstaller: exports.panelInstallerSchema.nullable().optional(),
    liveBuild: zod_1.z.object({
        isolatedWorkspace: zod_1.z.boolean(),
        clean: zod_1.z.boolean(),
        isoName: zod_1.z
            .string()
            .min(5)
            .max(255)
            .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.iso$/, 'ISO names must be a safe basename ending in .iso.'),
    }),
    requestedBy: zod_1.z.string().email().max(255).nullable().optional(),
    createdAt: zod_1.z.string().min(10).max(64),
    notes: zod_1.z.string().max(2000).optional(),
});
exports.buildJobSchema = zod_1.z.object({
    buildUuid: zod_1.z.string().uuid(),
    channel: zod_1.z.enum(['stable', 'testing']),
    manifest: exports.manifestSchema,
    callbackBaseUrl: exports.httpUrlSchema,
    includePanelInstaller: zod_1.z.boolean(),
});
exports.cancelParamsSchema = zod_1.z.object({
    uuid: zod_1.z.string().uuid(),
});
exports.logEntrySchema = zod_1.z.object({
    sequence: zod_1.z.number().int().min(1),
    level: exports.logLevelSchema,
    message: zod_1.z.string().min(1).max(32000),
    loggedAt: zod_1.z.string().datetime({ offset: true }),
});
exports.statusCallbackSchema = zod_1.z.object({
    status: zod_1.z.literal('running'),
    stage: zod_1.z.string().min(1).max(64).nullable().optional(),
    progress: zod_1.z.number().int().min(0).max(100).optional(),
});
exports.completeCallbackSchema = zod_1.z.object({
    status: zod_1.z.enum(['succeeded', 'failed', 'canceled']),
    exitCode: zod_1.z.number().int().min(-255).max(255).nullable(),
    error: zod_1.z.string().max(4000).nullable(),
    progress: zod_1.z.number().int().min(0).max(100),
    artifact: zod_1.z
        .object({
        disk: zod_1.z.enum(['s3', 'local']),
        path: zod_1.z.string().min(1).max(1024),
        size: zod_1.z.number().int().min(1),
        sha256: zod_1.z.string().regex(/^[a-f0-9]{64}$/),
    })
        .nullable()
        .optional(),
});
exports.healthSchema = zod_1.z.object({
    status: zod_1.z.literal('ok'),
    service: zod_1.z.literal('openbox-build-agent'),
    version: zod_1.z.string(),
    uptimeSeconds: zod_1.z.number().nonnegative(),
});
//# sourceMappingURL=job.js.map