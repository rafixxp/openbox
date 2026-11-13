/**
 * Wire contracts shared by the Laravel panel, the Fastify build agent and the
 * Vue client. Field names follow the JSON payloads exactly (camelCase), while
 * database columns remain snake_case.
 *
 * The agent's zod schemas in `api/src/schemas/job.ts` are the executable source
 * of truth for inbound validation; these types keep the HTTP surface documented
 * for every consumer. Contract tests in `api/test/contract.test.ts` pin the two
 * representations together.
 */

export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}

export interface ApiEnvelope<T> {
    success: boolean;
    data: T | null;
    error: ApiError | null;
    meta: Record<string, unknown>;
}

export type ReleaseChannel = 'stable' | 'testing';

export type BuildStatus =
    | 'queued'
    | 'dispatching'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'canceled';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface ManifestPackage {
    name: string;
    version: string;
    architecture: string;
}

export interface PanelInstaller {
    filename: string;
    sha256: string;
}

export interface BuildManifest {
    schemaVersion: number;
    channel: ReleaseChannel;
    debian: {
        suite: string;
        architecture: 'amd64' | 'arm64' | 'i386';
        mirror: string;
    };
    packages: ManifestPackage[];
    includePanelInstaller: boolean;
    panelInstaller?: PanelInstaller | null;
    liveBuild: {
        isolatedWorkspace: boolean;
        clean: boolean;
        isoName: string;
    };
    requestedBy?: string | null;
    createdAt: string;
    notes?: string;
}

/** Laravel -> agent POST /v1/jobs body. */
export interface BuildJob {
    buildUuid: string;
    channel: ReleaseChannel;
    manifest: BuildManifest;
    /** Panel origin without `/api`; the agent appends the internal callback path. */
    callbackBaseUrl: string;
    includePanelInstaller: boolean;
}

export interface BuildLogEntry {
    sequence: number;
    level: LogLevel;
    message: string;
    loggedAt: string;
}

export interface BuildStatusCallback {
    status: 'running';
    stage?: string | null;
    progress?: number;
}

export interface BuildArtifact {
    disk: 's3' | 'local';
    path: string;
    size: number;
    sha256: string;
}

/** Agent -> panel POST /api/v1/internal/builds/{uuid}/complete body. */
export interface BuildCompletion {
    status: 'succeeded' | 'failed' | 'canceled';
    exitCode: number | null;
    error: string | null;
    progress: number;
    artifact?: BuildArtifact | null;
}

export interface JobAccepted {
    buildUuid: string;
    accepted: true;
    duplicate: boolean;
}

export interface CancelAccepted {
    buildUuid: string;
    canceling: true;
}

export interface AgentHealth {
    status: 'ok';
    service: 'openbox-build-agent';
    version: string;
    uptimeSeconds: number;
}
