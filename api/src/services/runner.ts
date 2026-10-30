import { spawn as nodeSpawn } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import type { AppConfig } from '../config';
import type { BuildJob, CompleteCallback, LogEntry, StatusCallback } from '../schemas/job';
import type { BuildCallbacks } from './callbacks';
import type { ArtifactUploader, UploadedArtifact } from './s3';

export interface ChildProcessLike {
    stdout: Readable | null;
    stderr: Readable | null;
    pid?: number | undefined;
    kill(signal?: NodeJS.Signals): boolean;
    on(event: 'error', listener: (error: Error) => void): this;
    on(
        event: 'close',
        listener: (code: number | null, signal: NodeJS.Signals | null) => void,
    ): this;
}

export interface SpawnRequest {
    command: string;
    args: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
}

export type SpawnFn = (request: SpawnRequest) => ChildProcessLike;

export interface RunnerLogger {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
}

export interface RunResult {
    status: 'succeeded' | 'failed' | 'canceled';
    exitCode: number | null;
    error: string | null;
    artifact: UploadedArtifact | null;
}

export interface RunnerOptions {
    config: AppConfig;
    callbacks: BuildCallbacks;
    uploader: ArtifactUploader;
    spawn?: SpawnFn;
    isCanceled?: (buildUuid: string) => Promise<boolean>;
    logger?: RunnerLogger;
    now?: () => number;
    /** Cancellation poll interval; overridable for tests. */
    cancelPollIntervalMs?: number;
}

const defaultLogger: RunnerLogger = {
    info: (message, context) => console.info(message, context ?? ''),
    warn: (message, context) => console.warn(message, context ?? ''),
    error: (message, context) => console.error(message, context ?? ''),
};

const STAGE_PATTERN = /\[openbox\]\s+stage=([a-z0-9_-]+)(?:\s+progress=(\d{1,3}))?/i;
const MAX_PENDING_LINES = 5_000;

function sanitizeLine(line: string): string {
    const withoutAnsi = line.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
    const withoutControl = withoutAnsi.replace(/[^\P{C}\n\t]/gu, '');

    return withoutControl.slice(0, 32_000);
}

function inferLevel(line: string): LogEntry['level'] {
    if (/^\s*(error|fatal)\b/i.test(line)) {
        return 'error';
    }

    if (/^\s*warn(ing)?\b/i.test(line)) {
        return 'warning';
    }

    return 'info';
}

/** Serializes log uploads and keeps sequence numbers monotonic. */
class LogBatcher {
    private pending: LogEntry[] = [];
    private sequence = 0;
    private timer: NodeJS.Timeout | null = null;
    private chain: Promise<void> = Promise.resolve();

    constructor(
        private readonly send: (entries: LogEntry[]) => Promise<void>,
        private readonly batchSize: number,
        private readonly intervalMs: number,
        private readonly logger: RunnerLogger,
    ) {}

    push(level: LogEntry['level'], message: string): void {
        if (this.pending.length >= MAX_PENDING_LINES) {
            this.pending.shift();
        }

        this.pending.push({
            sequence: (this.sequence += 1),
            level,
            message: sanitizeLine(message),
            loggedAt: new Date().toISOString(),
        });

        if (this.pending.length >= this.batchSize) {
            void this.flush();
        } else {
            this.schedule();
        }
    }

    async stop(): Promise<void> {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        while (this.pending.length > 0) {
            await this.flush();
        }

        await this.chain;
    }

    flush(): Promise<void> {
        if (this.pending.length === 0) {
            return this.chain;
        }

        const entries = this.pending.splice(0, this.batchSize);

        this.chain = this.chain.then(async () => {
            try {
                await this.send(entries);
            } catch (error) {
                // Dropping a failed batch must never abort the build itself.
                this.logger.error('Failed to deliver build log batch.', {
                    entries: entries.length,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });

        if (this.pending.length >= this.batchSize) {
            return this.flush();
        }

        return this.chain;
    }

    private schedule(): void {
        if (this.timer !== null) {
            return;
        }

        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
        }, this.intervalMs);
        this.timer.unref();
    }
}

/** Serializes status callbacks and applies the configured throttle. */
class StatusReporter {
    private chain: Promise<void> = Promise.resolve();
    private lastSentAt = 0;
    private lastStage: string | null = null;
    private lastProgress = -1;

    constructor(
        private readonly send: (payload: StatusCallback) => Promise<void>,
        private readonly throttleMs: number,
        private readonly logger: RunnerLogger,
        private readonly now: () => number,
    ) {}

    report(stage: string, progress: number, force = false): void {
        const at = this.now();
        const stageChanged = stage !== this.lastStage;
        const progressJump = progress - this.lastProgress >= 10;

        if (!force && !stageChanged && !progressJump && at - this.lastSentAt < this.throttleMs) {
            return;
        }

        this.lastSentAt = at;
        this.lastStage = stage;
        this.lastProgress = progress;

        this.enqueue({ status: 'running', stage, progress });
    }

    async drain(): Promise<void> {
        await this.chain;
    }

    private enqueue(payload: StatusCallback): void {
        this.chain = this.chain.then(async () => {
            try {
                await this.send(payload);
            } catch (error) {
                this.logger.warn('Failed to deliver build status.', {
                    stage: payload.stage,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
}

export class BuildRunner {
    private readonly spawnFn: SpawnFn;
    private readonly logger: RunnerLogger;
    private readonly now: () => number;

    constructor(private readonly options: RunnerOptions) {
        this.spawnFn =
            options.spawn ??
            ((request) =>
                nodeSpawn(request.command, request.args, {
                    cwd: request.cwd,
                    env: request.env,
                    stdio: ['ignore', 'pipe', 'pipe'],
                }) as unknown as ChildProcessLike);
        this.logger = options.logger ?? defaultLogger;
        this.now = options.now ?? Date.now;
    }

    async run(job: BuildJob): Promise<RunResult> {
        const { config, callbacks } = this.options;
        const target = { buildUuid: job.buildUuid, baseUrl: job.callbackBaseUrl };
        const workspace = join(config.workDir, job.buildUuid);
        const outputDir = join(workspace, 'output');
        const isoName = job.manifest.liveBuild.isoName;
        const artifactPath = join(outputDir, basename(isoName));

        await rm(workspace, { recursive: true, force: true });
        await mkdir(outputDir, { recursive: true });

        const manifestPath = join(workspace, 'manifest.json');
        const packagesPath = join(workspace, 'packages.txt');

        await writeFile(manifestPath, JSON.stringify(job.manifest, null, 2), { mode: 0o600 });
        await writeFile(
            packagesPath,
            `${job.manifest.packages.map((entry) => entry.name).join('\n')}\n`,
            { mode: 0o600 },
        );

        const batcher = new LogBatcher(
            (entries) => callbacks.logs(target, entries),
            config.logBatchSize,
            config.logBatchIntervalMs,
            this.logger,
        );
        const status = new StatusReporter(
            (payload) => callbacks.status(target, payload),
            config.statusThrottleMs,
            this.logger,
            this.now,
        );

        const push = (level: LogEntry['level'], message: string): void => {
            batcher.push(level, message);
        };

        push('info', `[agent] workspace ${workspace}`);
        push('info', `[agent] channel=${job.channel} suite=${job.manifest.debian.suite} arch=${job.manifest.debian.architecture}`);
        status.report('preparing', 1, true);

        const args = [
            '--manifest',
            manifestPath,
            '--workspace',
            workspace,
            '--output-dir',
            outputDir,
            '--source-root',
            config.sourceRoot,
            '--iso-name',
            isoName,
            '--suite',
            job.manifest.debian.suite,
            '--architecture',
            job.manifest.debian.architecture,
            '--mirror',
            job.manifest.debian.mirror,
            '--packages-file',
            packagesPath,
        ];

        if (job.manifest.liveBuild.clean) {
            args.push('--clean');
        }

        if (job.includePanelInstaller && job.manifest.panelInstaller != null) {
            args.push('--include-panel-installer', '--panel-installer', config.panelInstallerPath);
        }

        push('info', `[agent] executing ${config.buildScript} ${args.join(' ')}`);
        status.report('starting', 3, true);

        const child = this.spawnFn({
            command: config.buildScript,
            args,
            cwd: workspace,
            env: {
                PATH: process.env.PATH ?? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                HOME: workspace,
                LANG: 'C.UTF-8',
                LC_ALL: 'C.UTF-8',
                OPENBOX_BUILD_UUID: job.buildUuid,
                OPENBOX_BUILD_CHANNEL: job.channel,
                OPENBOX_BUILD_WORKSPACE: workspace,
                OPENBOX_BUILD_ISO_NAME: isoName,
                OPENBOX_BUILD_SOURCE_ROOT: config.sourceRoot,
            },
        });

        let canceled = false;
        let timedOut = false;
        let settled = false;
        let exitCode: number | null = null;
        let lastStage = 'starting';
        let lastProgress = 3;
        const stderrTail: string[] = [];

        const stopSignals = (): void => {
            if (cancelPoll !== null) {
                clearInterval(cancelPoll);
            }

            if (timeoutTimer !== null) {
                clearTimeout(timeoutTimer);
            }

            if (killTimer !== null) {
                clearTimeout(killTimer);
            }
        };

        let cancelPoll: NodeJS.Timeout | null = null;
        let timeoutTimer: NodeJS.Timeout | null = null;
        let killTimer: NodeJS.Timeout | null = null;

        const terminate = (reason: 'canceled' | 'timeout'): void => {
            if (reason === 'canceled' && canceled) {
                return;
            }

            if (reason === 'timeout' && timedOut) {
                return;
            }

            if (reason === 'canceled') {
                canceled = true;
                push('warning', '[agent] cancellation requested; terminating build process.');
            } else {
                timedOut = true;
                push('error', `[agent] build exceeded ${config.buildTimeoutSeconds}s; terminating.`);
            }

            child.kill('SIGTERM');

            killTimer = setTimeout(() => {
                push('warning', '[agent] process did not exit after SIGTERM; sending SIGKILL.');
                child.kill('SIGKILL');
            }, 10_000);
            killTimer.unref();
        };

        const onLine = (line: string): void => {
            const clean = sanitizeLine(line);

            push(inferLevel(clean), clean);

            const match = STAGE_PATTERN.exec(clean);

            if (match !== null) {
                lastStage = match[1] ?? lastStage;
                const parsed = match[2] === undefined ? lastProgress : Number(match[2]);
                lastProgress = Math.max(0, Math.min(100, Number.isFinite(parsed) ? parsed : lastProgress));
                status.report(lastStage, lastProgress, true);
            }
        };

        if (child.stdout !== null) {
            createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', onLine);
        }

        if (child.stderr !== null) {
            createInterface({ input: child.stderr, crlfDelay: Infinity }).on('line', (line) => {
                stderrTail.push(line);

                if (stderrTail.length > 40) {
                    stderrTail.shift();
                }

                onLine(line);
            });
        }

        cancelPoll = setInterval(() => {
            void (async () => {
                try {
                    if (!canceled && (await this.isCanceled(job.buildUuid))) {
                        terminate('canceled');
                    }
                } catch (error) {
                    this.logger.warn('Cancellation check failed.', {
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            })();
        }, this.options.cancelPollIntervalMs ?? 1_000);
        cancelPoll.unref();
        timeoutTimer = setTimeout(() => terminate('timeout'), config.buildTimeoutSeconds * 1_000);
        timeoutTimer.unref();

        const closed = new Promise<{ code: number | null; spawnError: Error | null }>((resolve) => {
            child.on('error', (error) => {
                if (!settled) {
                    settled = true;
                    resolve({ code: null, spawnError: error });
                }
            });

            child.on('close', (code) => {
                if (!settled) {
                    settled = true;
                    resolve({ code, spawnError: null });
                }
            });
        });

        const outcome = await closed;
        exitCode = outcome.code;
        stopSignals();

        if (outcome.spawnError !== null) {
            push('error', `[agent] failed to start build process: ${outcome.spawnError.message}`);
        } else {
            push('info', `[agent] process exited with code ${String(exitCode)}`);
        }

        lastStage = canceled ? 'canceled' : timedOut ? 'timeout' : exitCode === 0 ? 'uploading' : 'failed';
        lastProgress = canceled ? lastProgress : exitCode === 0 ? 95 : lastProgress;
        status.report(lastStage, lastProgress, true);

        let result: RunResult;

        if (canceled) {
            result = {
                status: 'canceled',
                exitCode,
                error: 'Canceled by user.',
                artifact: null,
            };
        } else if (timedOut) {
            result = {
                status: 'failed',
                exitCode,
                error: `Build timed out after ${config.buildTimeoutSeconds} seconds.`,
                artifact: null,
            };
        } else if (outcome.spawnError !== null) {
            result = {
                status: 'failed',
                exitCode: null,
                error: `Build process failed to start: ${outcome.spawnError.message}`,
                artifact: null,
            };
        } else if (exitCode !== 0) {
            result = {
                status: 'failed',
                exitCode,
                error: buildFailureMessage(stderrTail, exitCode),
                artifact: null,
            };
        } else {
            result = await this.collectArtifact(job.buildUuid, artifactPath, isoName, exitCode, push);
        }

        // Flush logs/status after artifact collection so the "uploading" and
        // "artifact stored" lines reach the panel before the terminal callback.
        await batcher.stop();
        await status.drain();

        const payload: CompleteCallback =
            result.status === 'succeeded' && result.artifact !== null
                ? {
                      status: 'succeeded',
                      exitCode,
                      error: null,
                      progress: 100,
                      artifact: result.artifact,
                  }
                : {
                      status: result.status,
                      exitCode: result.exitCode,
                      error: result.error,
                      progress: result.status === 'canceled' ? lastProgress : result.status === 'failed' ? 0 : 100,
                      artifact: null,
                  };

        try {
            await callbacks.complete(target, payload);
        } catch (error) {
            this.logger.error('Failed to deliver completion callback.', {
                buildUuid: job.buildUuid,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return result;
    }

    private async collectArtifact(
        buildUuid: string,
        artifactPath: string,
        isoName: string,
        exitCode: number | null,
        push: (level: LogEntry['level'], message: string) => void,
    ): Promise<RunResult> {
        try {
            const info = await stat(artifactPath);

            if (!info.isFile() || info.size < 1) {
                throw new Error('artifact file is empty');
            }

            push('info', `[agent] uploading ${isoName} (${info.size} bytes)`);

            const artifact = await this.options.uploader.upload({
                buildUuid,
                filePath: artifactPath,
                filename: isoName,
            });

            push('info', `[agent] artifact stored on ${artifact.disk} as ${artifact.path}`);

            return {
                status: 'succeeded',
                exitCode,
                error: null,
                artifact,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            return {
                status: 'failed',
                exitCode,
                error: `Artifact collection failed: ${message}`,
                artifact: null,
            };
        }
    }

    private async isCanceled(buildUuid: string): Promise<boolean> {
        return this.options.isCanceled === undefined ? false : this.options.isCanceled(buildUuid);
    }
}

function buildFailureMessage(stderrTail: string[], exitCode: number | null): string {
    const tail = stderrTail
        .filter((line) => line.trim() !== '')
        .slice(-12)
        .join('\n')
        .slice(-3_800);

    return tail === '' ? `Build process exited with code ${String(exitCode)}.` : tail;
}
