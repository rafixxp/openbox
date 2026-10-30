import { EventEmitter, once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChildProcessLike, RunnerLogger, SpawnRequest } from '../src/services/runner';
import { BuildRunner } from '../src/services/runner';
import type { CallbackTarget, BuildCallbacks } from '../src/services/callbacks';
import type { ArtifactInput, ArtifactUploader, UploadedArtifact } from '../src/services/s3';
import type { CompleteCallback, LogEntry, StatusCallback } from '../src/schemas/job';
import { TEST_BUILD_UUID, testConfig, testJob, testManifest } from './helpers';

interface FakeBehavior {
    stdout?: string[];
    stderr?: string[];
    exitCode?: number;
    beforeClose?: () => Promise<void>;
    hangUntilKilled?: boolean;
}

class FakeChild implements ChildProcessLike {
    readonly stdout: Readable;
    readonly stderr: Readable;
    readonly killed: NodeJS.Signals[] = [];
    readonly pid = 4242;
    private readonly emitter = new EventEmitter();
    private closed = false;

    constructor(private readonly behavior: FakeBehavior) {
        this.stdout = Readable.from((behavior.stdout ?? []).map((line) => `${line}\n`));
        this.stderr = Readable.from((behavior.stderr ?? []).map((line) => `${line}\n`));
        void this.run();
    }

    private async run(): Promise<void> {
        const ended = Promise.all([once(this.stdout, 'end'), once(this.stderr, 'end')]);

        if (this.behavior.beforeClose !== undefined) {
            await this.behavior.beforeClose();
        }

        if (this.behavior.hangUntilKilled === true) {
            return;
        }

        await ended;
        setImmediate(() => this.finish(this.behavior.exitCode ?? 0));
    }

    kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
        this.killed.push(signal);

        if (this.behavior.hangUntilKilled === true) {
            setImmediate(() => this.finish(143));
        }

        return true;
    }

    on(event: 'error', listener: (error: Error) => void): this;
    on(
        event: 'close',
        listener: (code: number | null, signal: NodeJS.Signals | null) => void,
    ): this;
    on(event: string, listener: (...args: any[]) => void): this {
        this.emitter.on(event, listener);

        return this;
    }

    private finish(code: number): void {
        if (!this.closed) {
            this.closed = true;
            this.emitter.emit('close', code, null);
        }
    }
}

class FakeSpawn {
    readonly requests: SpawnRequest[] = [];
    readonly children: FakeChild[] = [];

    constructor(private readonly behavior: FakeBehavior) {}

    spawn = (request: SpawnRequest): ChildProcessLike => {
        this.requests.push(request);
        const child = new FakeChild(this.behavior);
        this.children.push(child);

        return child;
    };
}

class RecordingCallbacks implements BuildCallbacks {
    readonly batches: LogEntry[][] = [];
    readonly statuses: StatusCallback[] = [];
    readonly completions: CompleteCallback[] = [];

    async logs(target: CallbackTarget, entries: LogEntry[]): Promise<void> {
        expect(target.buildUuid).toBe(TEST_BUILD_UUID);
        this.batches.push(entries);
    }

    async status(target: CallbackTarget, payload: StatusCallback): Promise<void> {
        expect(target.buildUuid).toBe(TEST_BUILD_UUID);
        this.statuses.push(payload);
    }

    async complete(target: CallbackTarget, payload: CompleteCallback): Promise<void> {
        expect(target.buildUuid).toBe(TEST_BUILD_UUID);
        this.completions.push(payload);
    }
}

class RecordingUploader implements ArtifactUploader {
    readonly uploads: ArtifactInput[] = [];

    async upload(input: ArtifactInput): Promise<UploadedArtifact> {
        this.uploads.push(input);

        return {
            disk: 'local',
            path: input.filePath,
            size: 9,
            sha256: 'a'.repeat(64),
        };
    }
}

const silentLogger: RunnerLogger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

let workDir: string;

beforeEach(async () => {
    workDir = await mkdtemp('/tmp/opencode/openbox-agent-runner-');
});

afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
});

function runnerFor(
    fake: FakeSpawn,
    callbacks: RecordingCallbacks,
    uploader: RecordingUploader,
    options: {
        cancelPollIntervalMs?: number;
        isCanceled?: (buildUuid: string) => Promise<boolean>;
    } = {},
): BuildRunner {
    return new BuildRunner({
        config: testConfig({ workDir, logBatchSize: 50, statusThrottleMs: 0 }),
        callbacks,
        uploader,
        spawn: fake.spawn,
        isCanceled: options.isCanceled ?? (async () => false),
        logger: silentLogger,
        cancelPollIntervalMs: options.cancelPollIntervalMs ?? 1_000,
        now: () => 1_700_000_000_000,
    });
}

describe('BuildRunner', () => {
    it('streams logs, reports stages and uploads the ISO on success', async () => {
        const artifactPath = join(workDir, TEST_BUILD_UUID, 'output', 'openbox-image-amd64.hybrid.iso');
        const fake = new FakeSpawn({
            stdout: [
                'lb build start',
                '[openbox] stage=chroot progress=42',
                'installing packages',
            ],
            stderr: ['warning: locale missing'],
            exitCode: 0,
            beforeClose: async () => {
                await mkdir(join(workDir, TEST_BUILD_UUID, 'output'), { recursive: true });
                await writeFile(artifactPath, 'iso-bytes');
            },
        });
        const callbacks = new RecordingCallbacks();
        const uploader = new RecordingUploader();

        const result = await runnerFor(fake, callbacks, uploader).run(testJob());

        expect(result.status).toBe('succeeded');
        expect(result.exitCode).toBe(0);
        expect(result.artifact).toMatchObject({ disk: 'local', sha256: 'a'.repeat(64) });
        expect(uploader.uploads).toHaveLength(1);
        expect(uploader.uploads[0]?.filePath).toBe(artifactPath);
        expect(fake.requests[0]?.command).toBe('/bin/true');
        expect(fake.requests[0]?.args).toContain('--manifest');
        expect(fake.requests[0]?.args).toContain('--packages-file');
        expect(fake.requests[0]?.args).not.toContain('--include-panel-installer');

        const messages = callbacks.batches.flat().map((entry) => entry.message);
        expect(messages).toContain('lb build start');
        expect(messages).toContain('installing packages');
        expect(messages).toContain('[agent] process exited with code 0');

        const sequences = callbacks.batches.flat().map((entry) => entry.sequence);
        expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
        expect(new Set(sequences).size).toBe(sequences.length);

        expect(callbacks.statuses).toContainEqual({
            status: 'running',
            stage: 'chroot',
            progress: 42,
        });
        expect(callbacks.completions).toHaveLength(1);
        expect(callbacks.completions[0]).toMatchObject({
            status: 'succeeded',
            progress: 100,
            error: null,
            artifact: { disk: 'local', size: 9 },
        });
    });

    it('adds the panel installer flags only when requested', async () => {
        const fake = new FakeSpawn({
            exitCode: 0,
            beforeClose: async () => {
                await mkdir(join(workDir, TEST_BUILD_UUID, 'output'), { recursive: true });
                await writeFile(
                    join(workDir, TEST_BUILD_UUID, 'output', 'openbox-image-amd64.hybrid.iso'),
                    'iso-bytes',
                );
            },
        });
        const callbacks = new RecordingCallbacks();
        const uploader = new RecordingUploader();
        const job = testJob({
            includePanelInstaller: true,
            manifest: testManifest({
                includePanelInstaller: true,
                panelInstaller: { filename: 'install_panel_en.sh', sha256: 'b'.repeat(64) },
            }),
        });

        await runnerFor(fake, callbacks, uploader).run(job);

        expect(fake.requests[0]?.args).toContain('--include-panel-installer');
        expect(fake.requests[0]?.args).toContain('--panel-installer');
    });

    it('reports failure with the stderr tail and does not upload', async () => {
        const fake = new FakeSpawn({
            stdout: ['[openbox] stage=bootstrap progress=10'],
            stderr: ['E: Unable to fetch some archives', 'E: build aborted'],
            exitCode: 2,
        });
        const callbacks = new RecordingCallbacks();
        const uploader = new RecordingUploader();

        const result = await runnerFor(fake, callbacks, uploader).run(testJob());

        expect(result.status).toBe('failed');
        expect(result.exitCode).toBe(2);
        expect(uploader.uploads).toHaveLength(0);
        expect(callbacks.completions[0]).toMatchObject({
            status: 'failed',
            exitCode: 2,
            progress: 0,
            artifact: null,
        });
        expect(callbacks.completions[0]?.error).toContain('E: build aborted');
    });

    it('fails when a successful script produces no artifact', async () => {
        const fake = new FakeSpawn({ exitCode: 0 });
        const callbacks = new RecordingCallbacks();
        const uploader = new RecordingUploader();

        const result = await runnerFor(fake, callbacks, uploader).run(testJob());

        expect(result.status).toBe('failed');
        expect(result.error).toContain('Artifact collection failed');
        expect(uploader.uploads).toHaveLength(0);
        expect(callbacks.completions[0]).toMatchObject({ status: 'failed', artifact: null });
    });

    it('terminates a running build when cancellation is requested', async () => {
        const fake = new FakeSpawn({ hangUntilKilled: true });
        const callbacks = new RecordingCallbacks();
        const uploader = new RecordingUploader();

        const result = await runnerFor(fake, callbacks, uploader, {
            cancelPollIntervalMs: 10,
            isCanceled: async () => true,
        }).run(testJob());

        expect(result.status).toBe('canceled');
        expect(fake.children[0]?.killed).toContain('SIGTERM');
        expect(callbacks.completions[0]).toMatchObject({
            status: 'canceled',
            error: 'Canceled by user.',
            artifact: null,
        });
    });
});
