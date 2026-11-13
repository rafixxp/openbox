"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackClient = exports.CallbackError = void 0;
const hmac_1 = require("../lib/hmac");
class CallbackError extends Error {
    status;
    path;
    constructor(message, status, path) {
        super(message);
        this.status = status;
        this.path = path;
        this.name = 'CallbackError';
    }
}
exports.CallbackError = CallbackError;
const sleep = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds).unref();
});
/**
 * Signed HTTP client used by the agent to report progress back to Laravel.
 * Every request carries the same HMAC headers the panel middleware verifies.
 */
class CallbackClient {
    config;
    fetchImpl;
    sleepFn;
    constructor(config, fetchImpl = fetch, sleepFn = sleep) {
        this.config = config;
        this.fetchImpl = fetchImpl;
        this.sleepFn = sleepFn;
    }
    async logs(target, entries) {
        if (entries.length === 0) {
            return;
        }
        // Laravel accepts at most 200 entries per callback.
        await this.post(target, 'logs', { entries: entries.slice(0, 200) });
    }
    async status(target, payload) {
        await this.post(target, 'status', payload);
    }
    async complete(target, payload) {
        await this.post(target, 'complete', payload);
    }
    /** Appends the panel's internal callback path to the job's base URL. */
    urlFor(target, endpoint) {
        const root = target.baseUrl.replace(/\/+$/, '');
        return `${root}/api/v1/internal/builds/${encodeURIComponent(target.buildUuid)}/${endpoint}`;
    }
    async post(target, endpoint, payload) {
        const url = this.urlFor(target, endpoint);
        const path = new URL(url).pathname;
        const body = JSON.stringify(payload);
        const headers = (0, hmac_1.signRequest)(this.config.secret, {
            method: 'POST',
            path,
            body,
            agentId: 'openbox-build-agent',
        });
        let lastError = null;
        for (let attempt = 1; attempt <= this.config.callbackMaxAttempts; attempt += 1) {
            try {
                const response = await this.send(url, body, headers);
                if (response.ok) {
                    return;
                }
                const text = (await response.text()).slice(0, 500);
                const error = new CallbackError(`Callback ${path} failed with HTTP ${response.status}: ${text}`, response.status, path);
                if (!isRetryable(response.status) || attempt === this.config.callbackMaxAttempts) {
                    throw error;
                }
                lastError = error;
            }
            catch (error) {
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
    async send(url, body, headers) {
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
        }
        finally {
            clearTimeout(timer);
        }
    }
}
exports.CallbackClient = CallbackClient;
function isRetryable(status) {
    return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}
//# sourceMappingURL=callbacks.js.map