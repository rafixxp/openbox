import { describe, expect, it } from 'vitest';
import {
    buildCanonicalString,
    NonceStore,
    signRequest,
    verifyInboundSignature,
} from '../src/lib/hmac';
import { testConfig } from './helpers';

const secret = testConfig().secret;

describe('HMAC request signing', () => {
    it('builds the canonical string documented for Laravel', () => {
        const canonical = buildCanonicalString({
            timestamp: '1700000000',
            nonce: 'nonce-1',
            method: 'post',
            path: '/v1/jobs',
            body: '{"buildUuid":"x"}',
        });

        const parts = canonical.split('\n');

        expect(parts).toHaveLength(5);
        expect(parts[0]).toBe('1700000000');
        expect(parts[1]).toBe('nonce-1');
        expect(parts[2]).toBe('POST');
        expect(parts[3]).toBe('/v1/jobs');
        expect(parts[4]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('accepts a correctly signed request once', () => {
        const body = '{"buildUuid":"x"}';
        const headers = signRequest(secret, {
            method: 'POST',
            path: '/v1/jobs',
            body,
            timestamp: '1700000000',
            nonce: 'nonce-1',
        });

        const result = verifyInboundSignature({
            secret,
            method: 'POST',
            path: '/v1/jobs',
            body,
            headers,
            nonceStore: new NonceStore(() => 1700000000 * 1000),
            now: 1700000000,
        });

        expect(result).toEqual({ ok: true, agentId: 'openbox-build-agent' });
    });

    it('rejects a tampered body', () => {
        const headers = signRequest(secret, {
            method: 'POST',
            path: '/v1/jobs',
            body: '{"safe":true}',
            timestamp: '1700000000',
            nonce: 'nonce-tamper',
        });

        const result = verifyInboundSignature({
            secret,
            method: 'POST',
            path: '/v1/jobs',
            body: '{"safe":false}',
            headers,
            nonceStore: new NonceStore(),
            now: 1700000000,
        });

        expect(result).toMatchObject({ ok: false, status: 401, code: 'invalid_signature' });
    });

    it('rejects a path mismatch', () => {
        const headers = signRequest(secret, {
            method: 'POST',
            path: '/v1/jobs',
            body: '{}',
            timestamp: '1700000000',
            nonce: 'nonce-path',
        });

        const result = verifyInboundSignature({
            secret,
            method: 'POST',
            path: '/v1/jobs/other/cancel',
            body: '{}',
            headers,
            nonceStore: new NonceStore(),
            now: 1700000000,
        });

        expect(result).toMatchObject({ ok: false, status: 401, code: 'invalid_signature' });
    });

    it('rejects a stale timestamp outside the skew window', () => {
        const body = '{}';
        const headers = signRequest(secret, {
            method: 'POST',
            path: '/v1/jobs',
            body,
            timestamp: '1700000000',
            nonce: 'nonce-stale',
        });

        const result = verifyInboundSignature({
            secret,
            method: 'POST',
            path: '/v1/jobs',
            body,
            headers,
            nonceStore: new NonceStore(),
            now: 1700000000 + 301,
        });

        expect(result).toMatchObject({ ok: false, status: 401, code: 'stale_signature' });
    });

    it('rejects replayed nonces', () => {
        const body = '{}';
        const headers = signRequest(secret, {
            method: 'POST',
            path: '/v1/jobs',
            body,
            timestamp: '1700000000',
            nonce: 'nonce-replay',
        });
        const nonceStore = new NonceStore(() => 1700000000 * 1000);
        const input = {
            secret,
            method: 'POST',
            path: '/v1/jobs',
            body,
            headers,
            nonceStore,
            now: 1700000000,
        };

        expect(verifyInboundSignature(input)).toMatchObject({ ok: true });
        expect(verifyInboundSignature(input)).toMatchObject({
            ok: false,
            status: 409,
            code: 'replayed_request',
        });
    });

    it('rejects malformed signature headers', () => {
        const result = verifyInboundSignature({
            secret,
            method: 'POST',
            path: '/v1/jobs',
            body: '',
            headers: { 'x-agent-timestamp': 'abc' },
            nonceStore: new NonceStore(),
        });

        expect(result).toMatchObject({ ok: false, status: 401, code: 'invalid_signature' });
    });
});
