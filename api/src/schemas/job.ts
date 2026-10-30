import { z } from 'zod';

/**
 * Wire contract shared with Laravel's BuildAgentClient and the build manifest
 * factory. Validation happens here, at the process boundary; the runner only
 * ever receives already-validated values.
 */

export const logLevelSchema = z.enum(['debug', 'info', 'warning', 'error']);

export const packageEntrySchema = z.object({
    name: z
        .string()
        .min(1)
        .max(200)
        .regex(/^[a-z0-9][a-z0-9+.-]*$/, 'Package names must be lowercase Debian package identifiers.'),
    version: z.string().min(1).max(128),
    architecture: z.string().min(1).max(32),
});

export const panelInstallerSchema = z.object({
    filename: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[A-Za-z0-9._-]+$/, 'Installer filenames must not contain path separators.'),
    sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Installer checksum must be a lowercase sha256 digest.'),
});

export const httpUrlSchema = z
    .string()
    .url()
    .max(2048)
    .refine((value) => /^https?:\/\//i.test(value), 'Only http(s) URLs are allowed.');

export const manifestSchema = z.object({
    schemaVersion: z.number().int().min(1).max(99),
    channel: z.enum(['stable', 'testing']),
    debian: z.object({
        suite: z.string().min(2).max(32).regex(/^[a-z][a-z0-9-]*$/),
        architecture: z.enum(['amd64', 'arm64', 'i386']),
        mirror: httpUrlSchema,
    }),
    packages: z.array(packageEntrySchema).max(500),
    includePanelInstaller: z.boolean(),
    panelInstaller: panelInstallerSchema.nullable().optional(),
    liveBuild: z.object({
        isolatedWorkspace: z.boolean(),
        clean: z.boolean(),
        isoName: z
            .string()
            .min(5)
            .max(255)
            .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.iso$/, 'ISO names must be a safe basename ending in .iso.'),
    }),
    requestedBy: z.string().email().max(255).nullable().optional(),
    createdAt: z.string().min(10).max(64),
    notes: z.string().max(2000).optional(),
});

export type BuildManifest = z.infer<typeof manifestSchema>;

export const buildJobSchema = z.object({
    buildUuid: z.string().uuid(),
    channel: z.enum(['stable', 'testing']),
    manifest: manifestSchema,
    callbackBaseUrl: httpUrlSchema,
    includePanelInstaller: z.boolean(),
});

export type BuildJob = z.infer<typeof buildJobSchema>;

export const cancelParamsSchema = z.object({
    uuid: z.string().uuid(),
});

export const logEntrySchema = z.object({
    sequence: z.number().int().min(1),
    level: logLevelSchema,
    message: z.string().min(1).max(32000),
    loggedAt: z.string().datetime({ offset: true }),
});

export type LogEntry = z.infer<typeof logEntrySchema>;

export const statusCallbackSchema = z.object({
    status: z.literal('running'),
    stage: z.string().min(1).max(64).nullable().optional(),
    progress: z.number().int().min(0).max(100).optional(),
});

export type StatusCallback = z.infer<typeof statusCallbackSchema>;

export const completeCallbackSchema = z.object({
    status: z.enum(['succeeded', 'failed', 'canceled']),
    exitCode: z.number().int().min(-255).max(255).nullable(),
    error: z.string().max(4000).nullable(),
    progress: z.number().int().min(0).max(100),
    artifact: z
        .object({
            disk: z.enum(['s3', 'local']),
            path: z.string().min(1).max(1024),
            size: z.number().int().min(1),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .nullable()
        .optional(),
});

export type CompleteCallback = z.infer<typeof completeCallbackSchema>;

export const healthSchema = z.object({
    status: z.literal('ok'),
    service: z.literal('openbox-build-agent'),
    version: z.string(),
    uptimeSeconds: z.number().nonnegative(),
});
