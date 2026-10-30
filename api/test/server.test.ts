import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { signRequest } from '../src/lib/hmac';
import { InMemoryJobQueue } from '../src/services/queue';
import { TEST_BUILD_UUID, testConfig, testJob, testManifest } from './helpers';

const config = testConfig();

let app: FastifyInstance;
let queue: InMemoryJobQueue;

beforeEach(async () => {
    queue = new InMemoryJobQueue();
    app = await buildServer({ config, queue, logger: false });
});

afterEach(async () => {
    await app.close();
});

function headersFor(method: string, path: string, body: string): Record<string, string> {
    return {
        ...signRequest(config.secret, { method, path, body, agentId: 'openbox-panel' }),
        'content-type': 'application/json',
    };
}

function post(path: string, payload: unknown) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

    return app.inject({ method: 'POST', url: path, payload: body, headers: headersFor('POST', path, body) });
}

describe('agent HTTP surface', () => {
    it('serves health without authentication', async () => {
        const response = await app.inject({ method: 'GET', url: '/health' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            data: {
                status: 'ok',
                service: 'openbox-build-agent',
            },
        });
    });

    it('serves the OpenAPI document', async () => {
        const response = await app.inject({ method: 'GET', url: '/openapi.json' });
        const document = response.json() as { openapi: string; paths: Record<string, unknown> };

        expect(response.statusCode).toBe(200);
        expect(document.openapi).toBe('3.1.0');
        expect(document.paths).toHaveProperty('/v1/jobs');
        expect(document.paths).toHaveProperty('/v1/jobs/{uuid}/cancel');
    });

    it('rejects unsigned jobs with an envelope error', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/jobs',
            payload: JSON.stringify(testJob()),
            headers: { 'content-type': 'application/json' },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({
            success: false,
            data: null,
            error: { code: 'invalid_signature' },
        });
        expect(queue.size).toBe(0);
    });

    it('accepts a signed job and reports duplicates idempotently', async () => {
        const first = await post('/v1/jobs', testJob());

        expect(first.statusCode).toBe(202);
        expect(first.json()).toMatchObject({
            success: true,
            data: { buildUuid: TEST_BUILD_UUID, accepted: true, duplicate: false },
        });
        expect(queue.size).toBe(1);

        const second = await post('/v1/jobs', testJob());

        expect(second.statusCode).toBe(202);
        expect(second.json()).toMatchObject({
            success: true,
            data: { buildUuid: TEST_BUILD_UUID, accepted: true, duplicate: true },
        });
        expect(queue.size).toBe(1);
    });

    it('rejects a replayed nonce', async () => {
        const body = JSON.stringify(testJob());
        const headers = headersFor('POST', '/v1/jobs', body);
        const first = await app.inject({ method: 'POST', url: '/v1/jobs', payload: body, headers });
        const second = await app.inject({ method: 'POST', url: '/v1/jobs', payload: body, headers });

        expect(first.statusCode).toBe(202);
        expect(second.statusCode).toBe(409);
        expect(second.json()).toMatchObject({
            success: false,
            error: { code: 'replayed_request' },
        });
    });

    it('rejects a body that was modified after signing', async () => {
        const signedBody = JSON.stringify(testJob());
        const headers = headersFor('POST', '/v1/jobs', signedBody);
        const tampered = JSON.stringify(
            testJob({ manifest: testManifest({ notes: 'injected' }) }),
        );

        const response = await app.inject({
            method: 'POST',
            url: '/v1/jobs',
            payload: tampered,
            headers,
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ error: { code: 'invalid_signature' } });
    });

    it('rejects schema violations with details', async () => {
        const job = testJob({
            manifest: testManifest({
                liveBuild: {
                    isolatedWorkspace: true,
                    clean: false,
                    isoName: '../../escape.iso',
                },
            }),
        });

        const response = await post('/v1/jobs', job);

        expect(response.statusCode).toBe(422);
        expect(response.json()).toMatchObject({
            success: false,
            error: { code: 'validation_error' },
        });
        expect(response.json().error.details).toBeDefined();
    });

    it('rejects a channel mismatch between job and manifest', async () => {
        const response = await post('/v1/jobs', testJob({ channel: 'testing' }));

        expect(response.statusCode).toBe(422);
        expect(response.json()).toMatchObject({ error: { code: 'validation_error' } });
    });

    it('rejects an installer request without an installer checksum', async () => {
        const job = testJob({ includePanelInstaller: true });

        const response = await post('/v1/jobs', job);

        expect(response.statusCode).toBe(422);
        expect(response.json()).toMatchObject({ error: { code: 'panel_installer_missing' } });
    });

    it('returns 404 when cancelling an unknown build', async () => {
        const path = `/v1/jobs/${TEST_BUILD_UUID}/cancel`;
        const response = await post(path, '');

        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({ error: { code: 'job_not_found' } });
    });

    it('accepts cancellation of a queued build once', async () => {
        await post('/v1/jobs', testJob());

        const path = `/v1/jobs/${TEST_BUILD_UUID}/cancel`;
        const first = await post(path, '');
        const second = await post(path, '');

        expect(first.statusCode).toBe(202);
        expect(first.json()).toMatchObject({
            success: true,
            data: { buildUuid: TEST_BUILD_UUID, canceling: true },
        });
        expect(second.statusCode).toBe(404);
    });

    it('returns a 400 envelope for malformed JSON', async () => {
        const body = '{"broken":';
        const response = await app.inject({
            method: 'POST',
            url: '/v1/jobs',
            payload: body,
            headers: headersFor('POST', '/v1/jobs', body),
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
            success: false,
            error: { code: 'invalid_json' },
        });
    });

    it('returns an envelope 404 for unknown routes', async () => {
        const response = await app.inject({ method: 'GET', url: '/v1/nope' });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({ success: false, error: { code: 'not_found' } });
    });
});
