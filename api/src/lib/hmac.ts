import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export interface SignatureHeaders extends Record<string, string> {
    'x-agent-timestamp': string;
    'x-agent-nonce': string;
    'x-agent-signature': string;
    'x-agent-id': string;
}

export interface SignOptions {
    method: string;
    path: string;
    body: string;
    timestamp?: string;
    nonce?: string;
    agentId?: string;
}

export type HeaderBag = Record<string, string | string[] | undefined>;

export type VerifyResult =
    | { ok: true; agentId: string }
    | { ok: false; status: number; code: string; message: string };

export function sha256Hex(body: string | Buffer): string {
    return createHash('sha256').update(body).digest('hex');
}

/**
 * Canonical string shared with Laravel's VerifyAgentSignature middleware:
 *   timestamp \n nonce \n METHOD \n /path \n sha256(raw body)
 * The path must include the leading slash and exclude any query string.
 */
export function buildCanonicalString(input: {
    timestamp: string;
    nonce: string;
    method: string;
    path: string;
    body: string;
}): string {
    return [
        input.timestamp,
        input.nonce,
        input.method.toUpperCase(),
        input.path,
        sha256Hex(input.body),
    ].join('\n');
}

export function signPayload(secret: string, canonical: string): string {
    return createHmac('sha256', secret).update(canonical).digest('hex');
}

export function signRequest(secret: string, options: SignOptions): SignatureHeaders {
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000).toString();
    const nonce = options.nonce ?? randomUUID();
    const canonical = buildCanonicalString({
        timestamp,
        nonce,
        method: options.method,
        path: options.path,
        body: options.body,
    });

    return {
        'x-agent-timestamp': timestamp,
        'x-agent-nonce': nonce,
        'x-agent-signature': signPayload(secret, canonical),
        'x-agent-id': options.agentId ?? 'openbox-build-agent',
    };
}

function headerValue(headers: HeaderBag, name: string): string {
    const value = headers[name];

    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** Tracks used nonces for exactly as long as their timestamps remain valid. */
export class NonceStore {
    private readonly seen = new Map<string, number>();

    constructor(private readonly now: () => number = Date.now) {}

    use(nonce: string, expiresAtMs: number): boolean {
        this.prune();

        if (this.seen.has(nonce)) {
            return false;
        }

        this.seen.set(nonce, expiresAtMs);

        return true;
    }

    has(nonce: string): boolean {
        return this.seen.has(nonce);
    }

    clear(): void {
        this.seen.clear();
    }

    get size(): number {
        return this.seen.size;
    }

    private prune(): void {
        const now = this.now();

        for (const [nonce, expiresAt] of this.seen) {
            if (expiresAt <= now) {
                this.seen.delete(nonce);
            }
        }
    }
}

/**
 * Verify an inbound Laravel -> agent request. This authenticates the service,
 * never a panel user. Returns a discriminated result so callers can map it to
 * the response envelope without throwing stringly-typed errors.
 */
export function verifyInboundSignature(input: {
    secret: string;
    method: string;
    path: string;
    body: string;
    headers: HeaderBag;
    nonceStore: NonceStore;
    now?: number;
    clockSkewSeconds?: number;
}): VerifyResult {
    const timestamp = headerValue(input.headers, 'x-agent-timestamp');
    const nonce = headerValue(input.headers, 'x-agent-nonce');
    const signature = headerValue(input.headers, 'x-agent-signature');

    if (!/^\d{1,12}$/.test(timestamp) || nonce === '' || nonce.length > 128 || !/^[a-f0-9]{64}$/i.test(signature)) {
        return {
            ok: false,
            status: 401,
            code: 'invalid_signature',
            message: 'Missing or malformed signature headers.',
        };
    }

    const nowSeconds = input.now ?? Math.floor(Date.now() / 1000);
    const skew = input.clockSkewSeconds ?? 300;

    if (Math.abs(nowSeconds - Number(timestamp)) > skew) {
        return {
            ok: false,
            status: 401,
            code: 'stale_signature',
            message: 'Signature timestamp is outside the allowed window.',
        };
    }

    const canonical = buildCanonicalString({
        timestamp,
        nonce,
        method: input.method,
        path: input.path,
        body: input.body,
    });

    const expected = Buffer.from(signPayload(input.secret, canonical), 'hex');
    const provided = Buffer.from(signature.toLowerCase(), 'hex');

    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        return {
            ok: false,
            status: 401,
            code: 'invalid_signature',
            message: 'Signature verification failed.',
        };
    }

    if (!input.nonceStore.use(nonce, (nowSeconds + skew) * 1000)) {
        return {
            ok: false,
            status: 409,
            code: 'replayed_request',
            message: 'This nonce has already been used.',
        };
    }

    return { ok: true, agentId: headerValue(input.headers, 'x-agent-id') || 'build-agent' };
}
