import type { AppConfig } from '../src/config';
import type { BuildJob, BuildManifest } from '../src/schemas/job';

export const TEST_BUILD_UUID = '2f6d3a9e-4b1c-4f7a-9d2e-8c5b6a7f0e11';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
    return {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 8090,
        logLevel: 'silent',
        secret: 'test-agent-secret-value-1234',
        clockSkewSeconds: 300,
        redisUrl: 'redis://127.0.0.1:6379',
        queueName: 'builds',
        concurrency: 1,
        buildScript: '/bin/true',
        sourceRoot: '/workspace/source',
        workDir: '/tmp/opencode/openbox-agent-tests',
        isoName: 'openbox-image-amd64.hybrid.iso',
        buildTimeoutSeconds: 60,
        panelInstallerPath: '/workspace/source/install_panel_en.sh',
        callbackTimeoutMs: 1000,
        callbackMaxAttempts: 2,
        logBatchSize: 25,
        logBatchIntervalMs: 1000,
        statusThrottleMs: 1000,
        artifactDisk: 'local',
        s3: {
            endpoint: 'http://minio:9000',
            region: 'us-east-1',
            bucket: 'openbox-artifacts',
            accessKeyId: 'test',
            secretAccessKey: 'test-secret',
            forcePathStyle: true,
        },
        workerEnabled: false,
        ...overrides,
    };
}

export function testManifest(overrides: Partial<BuildManifest> = {}): BuildManifest {
    return {
        schemaVersion: 1,
        channel: 'stable',
        debian: {
            suite: 'bookworm',
            architecture: 'amd64',
            mirror: 'http://deb.debian.org/debian',
        },
        packages: [
            { name: 'openbox', version: '3.6.1-10', architecture: 'amd64' },
            { name: 'lightdm', version: '1.32.0-4', architecture: 'amd64' },
        ],
        includePanelInstaller: false,
        panelInstaller: null,
        liveBuild: {
            isolatedWorkspace: true,
            clean: false,
            isoName: 'openbox-image-amd64.hybrid.iso',
        },
        requestedBy: 'ops@example.com',
        createdAt: '2026-10-30T12:00:00+00:00',
        ...overrides,
    };
}

export function testJob(overrides: Partial<BuildJob> = {}): BuildJob {
    return {
        buildUuid: TEST_BUILD_UUID,
        channel: 'stable',
        manifest: testManifest(),
        callbackBaseUrl: 'https://panel.example.com',
        includePanelInstaller: false,
        ...overrides,
    };
}
