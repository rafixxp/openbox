export interface User {
    id: number;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    twoFactorEnabled: boolean;
}

export interface SharedProps {
    appName: string;
    auth: {
        user: User | null;
    };
    flash: {
        success?: string | null;
        error?: string | null;
        recoveryCodes?: string[] | null;
    };
    notifications?: {
        unread: number;
    };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export interface BuildLogEntry {
    sequence: number;
    level: 'debug' | 'info' | 'warning' | 'error' | string;
    message: string;
    loggedAt?: string | null;
}

export interface BuildArtifact {
    disk: string;
    size: number | null;
    sha256: string | null;
    downloadUrl: string;
}

export interface Build {
    uuid: string;
    status: string;
    channel: string;
    stage: string | null;
    progress: number;
    manifest: Record<string, unknown>;
    exitCode: number | null;
    errorMessage: string | null;
    agent: string | null;
    retryOf: number | null;
    artifact: BuildArtifact | null;
    requestedBy: { id: number; name: string } | null;
    logs?: BuildLogEntry[];
    can: {
        cancel: boolean;
        retry: boolean;
        download: boolean;
    };
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string | null;
}

export interface BuildStatusEvent {
    uuid: string;
    status: string;
    stage: string | null;
    progress: number;
    exitCode: number | null;
    errorMessage: string | null;
    artifactSize: number | null;
    artifactSha256: string | null;
    finishedAt: string | null;
}

export interface Package {
    id: number;
    name: string;
    version: string;
    architecture: string;
    channel: string;
    component: string;
    section: string | null;
    description: string | null;
    depends: string[];
    size: number;
    sha256: string;
    status: string;
    gpgKeyId: string | null;
    uploadedBy: { id: number; name: string } | null;
    createdAt: string | null;
}

export interface Release {
    id: number;
    version: string;
    channel: string;
    codename: string | null;
    status: string;
    notes: string | null;
    checksums: Record<string, string | number | null>;
    build: { uuid: string; status: string } | null;
    publishedAt: string | null;
    createdAt: string | null;
}

export interface Mirror {
    id: number;
    name: string;
    baseUrl: string;
    syncTarget: string | null;
    region: string | null;
    status: string;
    isPrimary: boolean;
    latencyMs: number | null;
    lastError: string | null;
    lastSyncedAt: string | null;
    createdAt: string | null;
}

export interface AuditLogEntry {
    id: number;
    actorName: string | null;
    action: string;
    subjectType: string | null;
    subjectId: string | null;
    metadata: Record<string, unknown>;
    ipAddress: string | null;
    hash: string;
    createdAt: string | null;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface Paginated<T> {
    data: T[];
    links: PaginationLink[];
    meta?: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        [key: string]: unknown;
    };
}

export interface SelectOption {
    value: string;
    label: string;
}
