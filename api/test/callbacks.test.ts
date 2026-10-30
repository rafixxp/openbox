import { describe, expect, it } from 'vitest';
import { CallbackClient, CallbackError, type CallbackTarget, type FetchLike, type ResponseLike } from '../src/services/callbacks';
import { NonceStore, verifyInboundSignature } from '../src/lib/hmac';
import { TEST_BUILD_UUID, testConfig } from './helpers';

const target: CallbackTarget = {
    buildUuid: TEST_BUILD_UUID,
    baseUrl: 'https://panel.example.com/',
};

function response(status: number, body = ''): ResponseLike {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => body,
    };
}

describe('CallbackClient', () => {
    it('signs callbacks with the shared canonical string', async () => {
        const config = testConfig();
        const calls: Array<{ url: string; init: RequestInit }> = [];
        const fetchImpl: FetchLike = async (url, init) => {
            calls.push({ url, init: init ?? {} });

            return response(200);
        };

        const client = new CallbackClient(config, fetchImpl, async () => undefined);
        await client.status(target, { status: 'running', stage: 'chroot', progress: 42 });

        expect(calls).toHaveLength(1);

        const call = calls[0]!;
        const path = new URL(call.url).pathname;
        const body = call.init.body as string;
        const headers = call.init.headers as Record<string, string>;

        expect(call.url).toBe(
            `https://panel.example.com/api/v1/internal/builds/${TEST_BUILD_UUID}/status`,
        );
        expect(path).toBe(`/api/v1/internal/builds/${TEST_BUILD_UUID}/status`);
        expect(JSON.parse(body)).toEqual({ status: 'running', stage: 'chroot', progress: 42 });

        const verified = verifyInboundSignature({
            secret: config.secret,
            method: 'POST',
            path,
            body,
            headers,
            nonceStore: new NonceStore(),
        });

        expect(verified).toMatchObject({ ok: true });
    });

    it('batches log entries and never exceeds 200 per request', async () => {
        const config = testConfig();
        const bodies: unknown[] = [];
        const fetchImpl: FetchLike = async (_url, init) => {
            bodies.push(JSON.parse(String(init?.body ?? '{}')));

            return response(200);
        };

        const client = new CallbackClient(config, fetchImpl, async () => undefined);
        const entries = Array.from({ length: 250 }, (_, index) => ({
            sequence: index + 1,
            level: 'info' as const,
            message: `line ${index + 1}`,
            loggedAt: '2026-10-30T12:00:00.000Z',
        }));

        await client.logs(target, entries);

        expect(bodies).toHaveLength(1);
        expect((bodies[0] as { entries: unknown[] }).entries).toHaveLength(200);
    });

    it('retries transient failures with backoff', async () => {
        const config = testConfig({ callbackMaxAttempts: 3 });
        let attempts = 0;
        const delays: number[] = [];
        const fetchImpl: FetchLike = async () => {
            attempts += 1;

            return attempts < 3 ? response(503, 'unavailable') : response(200);
        };

        const client = new CallbackClient(config, fetchImpl, async (milliseconds) => {
            delays.push(milliseconds);
        });

        await client.complete(target, {
            status: 'canceled',
            exitCode: 143,
            error: 'Canceled by user.',
            progress: 10,
            artifact: null,
        });

        expect(attempts).toBe(3);
        expect(delays).toEqual([250, 500]);
    });

    it('signs every retry attempt with a fresh nonce', async () => {
        const config = testConfig({ callbackMaxAttempts: 3 });
        const nonceStore = new NonceStore();
        const calls: Array<{ url: string; init: RequestInit }> = [];
        let attempts = 0;

        const fetchImpl: FetchLike = async (url, init) => {
            attempts += 1;
            calls.push({ url, init: init ?? {} });

            return attempts < 3 ? response(503, 'unavailable') : response(200);
        };

        const client = new CallbackClient(config, fetchImpl, async () => undefined);

        await client.status(target, { status: 'running', stage: 'chroot', progress: 42 });

        expect(calls).toHaveLength(3);

        const nonces = calls.map(({ init }) => {
            const headers = init.headers as Record<string, string>;
            const body = init.body as string;
            const path = new URL(String(calls[0]!.url)).pathname;

            expect(verifyInboundSignature({
                secret: config.secret,
                method: 'POST',
                path,
                body,
                headers,
                nonceStore,
            })).toMatchObject({ ok: true });

            return headers['X-Agent-Nonce'] ?? headers['x-agent-nonce'];
        });

        expect(new Set(nonces).size).toBe(3);
    });

    it('does not retry non-retryable client errors', async () => {
        const config = testConfig({ callbackMaxAttempts: 3 });
        let attempts = 0;
        const fetchImpl: FetchLike = async () => {
            attempts += 1;

            return response(422, 'invalid payload');
        };

        const client = new CallbackClient(config, fetchImpl, async () => undefined);

        await expect(
            client.status(target, { status: 'running', progress: 5 }),
        ).rejects.toBeInstanceOf(CallbackError);
        expect(attempts).toBe(1);
    });
});
