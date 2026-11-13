"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildRunner = void 0;
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_readline_1 = require("node:readline");
const defaultLogger = {
    info: (message, context) => console.info(message, context ?? ''),
    warn: (message, context) => console.warn(message, context ?? ''),
    error: (message, context) => console.error(message, context ?? ''),
};
const STAGE_PATTERN = /\[openbox\]\s+stage=([a-z0-9_-]+)(?:\s+progress=(\d{1,3}))?/i;
const MAX_PENDING_LINES = 5_000;
function sanitizeLine(line) {
    const withoutAnsi = line.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
    const withoutControl = withoutAnsi.replace(/[^\P{C}\n\t]/gu, '');
    return withoutControl.slice(0, 32_000);
}
function inferLevel(line) {
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
    send;
    batchSize;
    intervalMs;
    logger;
    pending = [];
    sequence = 0;
    timer = null;
    chain = Promise.resolve();
    constructor(send, batchSize, intervalMs, logger) {
        this.send = send;
        this.batchSize = batchSize;
        this.intervalMs = intervalMs;
        this.logger = logger;
    }
    push(level, message) {
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
        }
        else {
            this.schedule();
        }
    }
    async stop() {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        while (this.pending.length > 0) {
            await this.flush();
        }
        await this.chain;
    }
    flush() {
        if (this.pending.length === 0) {
            return this.chain;
        }
        const entries = this.pending.splice(0, this.batchSize);
        this.chain = this.chain.then(async () => {
            try {
                await this.send(entries);
            }
            catch (error) {
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
    schedule() {
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
    send;
    throttleMs;
    logger;
    now;
    chain = Promise.resolve();
    lastSentAt = 0;
    lastStage = null;
    lastProgress = -1;
    constructor(send, throttleMs, logger, now) {
        this.send = send;
        this.throttleMs = throttleMs;
        this.logger = logger;
        this.now = now;
    }
    report(stage, progress, force = false) {
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
    async drain() {
        await this.chain;
    }
    enqueue(payload) {
        this.chain = this.chain.then(async () => {
            try {
                await this.send(payload);
            }
            catch (error) {
                this.logger.warn('Failed to deliver build status.', {
                    stage: payload.stage,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
}
class BuildRunner {
    options;
    spawnFn;
    logger;
    now;
    constructor(options) {
        this.options = options;
        this.spawnFn =
            options.spawn ??
                ((request) => (0, node_child_process_1.spawn)(request.command, request.args, {
                    cwd: request.cwd,
                    env: request.env,
                    stdio: ['ignore', 'pipe', 'pipe'],
                }));
        this.logger = options.logger ?? defaultLogger;
        this.now = options.now ?? Date.now;
    }
    async run(job) {
        const { config, callbacks } = this.options;
        const target = { buildUuid: job.buildUuid, baseUrl: job.callbackBaseUrl };
        const workspace = (0, node_path_1.join)(config.workDir, job.buildUuid);
        const outputDir = (0, node_path_1.join)(workspace, 'output');
        const isoName = job.manifest.liveBuild.isoName;
        const artifactPath = (0, node_path_1.join)(outputDir, (0, node_path_1.basename)(isoName));
        await (0, promises_1.rm)(workspace, { recursive: true, force: true });
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        const manifestPath = (0, node_path_1.join)(workspace, 'manifest.json');
        const packagesPath = (0, node_path_1.join)(workspace, 'packages.txt');
        await (0, promises_1.writeFile)(manifestPath, JSON.stringify(job.manifest, null, 2), { mode: 0o600 });
        await (0, promises_1.writeFile)(packagesPath, `${job.manifest.packages.map((entry) => entry.name).join('\n')}\n`, { mode: 0o600 });
        const batcher = new LogBatcher((entries) => callbacks.logs(target, entries), config.logBatchSize, config.logBatchIntervalMs, this.logger);
        const status = new StatusReporter((payload) => callbacks.status(target, payload), config.statusThrottleMs, this.logger, this.now);
        const push = (level, message) => {
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
        let exitCode = null;
        let lastStage = 'starting';
        let lastProgress = 3;
        const stderrTail = [];
        const stopSignals = () => {
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
        let cancelPoll = null;
        let timeoutTimer = null;
        let killTimer = null;
        const terminate = (reason) => {
            if (reason === 'canceled' && canceled) {
                return;
            }
            if (reason === 'timeout' && timedOut) {
                return;
            }
            if (reason === 'canceled') {
                canceled = true;
                push('warning', '[agent] cancellation requested; terminating build process.');
            }
            else {
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
        const onLine = (line) => {
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
            (0, node_readline_1.createInterface)({ input: child.stdout, crlfDelay: Infinity }).on('line', onLine);
        }
        if (child.stderr !== null) {
            (0, node_readline_1.createInterface)({ input: child.stderr, crlfDelay: Infinity }).on('line', (line) => {
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
                }
                catch (error) {
                    this.logger.warn('Cancellation check failed.', {
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            })();
        }, this.options.cancelPollIntervalMs ?? 1_000);
        cancelPoll.unref();
        timeoutTimer = setTimeout(() => terminate('timeout'), config.buildTimeoutSeconds * 1_000);
        timeoutTimer.unref();
        const closed = new Promise((resolve) => {
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
        }
        else {
            push('info', `[agent] process exited with code ${String(exitCode)}`);
        }
        lastStage = canceled ? 'canceled' : timedOut ? 'timeout' : exitCode === 0 ? 'uploading' : 'failed';
        lastProgress = canceled ? lastProgress : exitCode === 0 ? 95 : lastProgress;
        status.report(lastStage, lastProgress, true);
        await batcher.stop();
        await status.drain();
        let result;
        if (canceled) {
            result = {
                status: 'canceled',
                exitCode,
                error: 'Canceled by user.',
                artifact: null,
            };
        }
        else if (timedOut) {
            result = {
                status: 'failed',
                exitCode,
                error: `Build timed out after ${config.buildTimeoutSeconds} seconds.`,
                artifact: null,
            };
        }
        else if (outcome.spawnError !== null) {
            result = {
                status: 'failed',
                exitCode: null,
                error: `Build process failed to start: ${outcome.spawnError.message}`,
                artifact: null,
            };
        }
        else if (exitCode !== 0) {
            result = {
                status: 'failed',
                exitCode,
                error: buildFailureMessage(stderrTail, exitCode),
                artifact: null,
            };
        }
        else {
            result = await this.collectArtifact(job.buildUuid, artifactPath, isoName, exitCode, push);
        }
        const payload = result.status === 'succeeded' && result.artifact !== null
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
        }
        catch (error) {
            this.logger.error('Failed to deliver completion callback.', {
                buildUuid: job.buildUuid,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return result;
    }
    async collectArtifact(buildUuid, artifactPath, isoName, exitCode, push) {
        try {
            const info = await (0, promises_1.stat)(artifactPath);
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                status: 'failed',
                exitCode,
                error: `Artifact collection failed: ${message}`,
                artifact: null,
            };
        }
    }
    async isCanceled(buildUuid) {
        return this.options.isCanceled === undefined ? false : this.options.isCanceled(buildUuid);
    }
}
exports.BuildRunner = BuildRunner;
function buildFailureMessage(stderrTail, exitCode) {
    const tail = stderrTail
        .filter((line) => line.trim() !== '')
        .slice(-12)
        .join('\n')
        .slice(-3_800);
    return tail === '' ? `Build process exited with code ${String(exitCode)}.` : tail;
}
//# sourceMappingURL=runner.js.map