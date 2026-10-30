import type { AppConfig } from '../config';
import { signRequest } from '../lib/hmac';
import type { CompleteCallback, LogEntry, StatusCallback } from '../schemas/job';

export interface ResponseLike {
    ok: boolean;
    status: number;
    text(): Promise<string>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<ResponseLike>;

export type SleepFn = (milliseconds: number) => Promise<void>;

/** Per-build callback destination supplied by the dispatched job. */
export interface CallbackTarget {
    buildUuid: string;
    baseUrl: string;
}

export class CallbackError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly path: string,
    ) {
        super(message);
        this.name = 'CallbackError';
    }
}

/** The subset of runner dependencies implemented by CallbackClient. */
export interface BuildCallbacks {
    logs(target: CallbackTarget, entries: LogEntry[]): Promise<void>;
    status(target: CallbackTarget, payload: StatusCallback): Promise<void>;
    complete(target: CallbackTarget, payload: CompleteCallback): Promise<void>;
}

const sleep: SleepFn = (milliseconds) =>
    new Promise((resolve) => {
        setTimeout(resolve, milliseconds).unref();
    });

/**
 * Signed HTTP client used by the agent to report progress back to Laravel.
 * Every request carries the same HMAC headers the panel middleware verifies.
 */
export class CallbackClient implements BuildCallbacks {
    constructor(
        private readonly config: AppConfig,
        private readonly fetchImpl: FetchLike = fetch,
        private readonly sleepFn: SleepFn = sleep,
    ) {}

    async logs(target: CallbackTarget, entries: LogEntry[]): Promise<void> {
        if (entries.length === 0) {
            return;
        }

        // Laravel accepts at most 200 entries per callback.
        await this.post(target, 'logs', { entries: entries.slice(0, 200) });
    }

    async status(target: CallbackTarget, payload: StatusCallback): Promise<void> {
        await this.post(target, 'status', payload);
    }

    async complete(target: CallbackTarget, payload: CompleteCallback): Promise<void> {
        await this.post(target, 'complete', payload);
    }

    /** Appends the panel's internal callback path to the job's base URL. */
    urlFor(target: CallbackTarget, endpoint: 'logs' | 'status' | 'complete'): string {
        const root = target.baseUrl.replace(/\/+$/, '');

        return `${root}/api/v1/internal/builds/${encodeURIComponent(target.buildUuid)}/${endpoint}`;
    }

    private async post(
        target: CallbackTarget,
        endpoint: 'logs' | 'status' | 'complete',
        payload: unknown,
    ): Promise<void> {
        const url = this.urlFor(target, endpoint);
        const path = new URL(url).pathname;
        const body = JSON.stringify(payload);

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.callbackMaxAttempts; attempt += 1) {
            // Sign every attempt separately: the panel consumes each nonce, so
            // reusing headers after a transient failure would be rejected as a
            // replay even though the first request may never have been applied.
            const headers = signRequest(this.config.secret, {
                method: 'POST',
                path,
                body,
                agentId: 'openbox-build-agent',
            });

            try {
                const response = await this.send(url, body, headers);

                if (response.ok) {
                    return;
                }

                const text = (await response.text()).slice(0, 500);
                const error = new CallbackError(
                    `Callback ${path} failed with HTTP ${response.status}: ${text}`,
                    response.status,
                    path,
                );

                if (!isRetryable(response.status) || attempt === this.config.callbackMaxAttempts) {
                    throw error;
                }

                lastError = error;
            } catch (error) {
                if (error instanceof CallbackError && !isRetryable(error.status)) {
                    throw error;
                }

                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt === this.config.callbackMaxAttempts) {
                    throw lastError;
                }
            }

            await this.sleepFn(250 * 2 ** (attempt - 1));
        }

        throw lastError ?? new CallbackError(`Callback ${path} failed.`, 0, path);
    }

    private async send(
        url: string,
        body: string,
        headers: Record<string, string>,
    ): Promise<ResponseLike> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.callbackTimeoutMs);
        timer.unref();

        try {
            return await this.fetchImpl(url, {
                method: 'POST',
                headers: {
                    ...headers,
                    'content-type': 'application/json',
                    accept: 'application/json',
                },
                body,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }
    }
}

function isRetryable(status: number): boolean {
    return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}
