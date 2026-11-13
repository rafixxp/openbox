"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonceStore = void 0;
exports.sha256Hex = sha256Hex;
exports.buildCanonicalString = buildCanonicalString;
exports.signPayload = signPayload;
exports.signRequest = signRequest;
exports.verifyInboundSignature = verifyInboundSignature;
const node_crypto_1 = require("node:crypto");
function sha256Hex(body) {
    return (0, node_crypto_1.createHash)('sha256').update(body).digest('hex');
}
/**
 * Canonical string shared with Laravel's VerifyAgentSignature middleware:
 *   timestamp \n nonce \n METHOD \n /path \n sha256(raw body)
 * The path must include the leading slash and exclude any query string.
 */
function buildCanonicalString(input) {
    return [
        input.timestamp,
        input.nonce,
        input.method.toUpperCase(),
        input.path,
        sha256Hex(input.body),
    ].join('\n');
}
function signPayload(secret, canonical) {
    return (0, node_crypto_1.createHmac)('sha256', secret).update(canonical).digest('hex');
}
function signRequest(secret, options) {
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000).toString();
    const nonce = options.nonce ?? (0, node_crypto_1.randomUUID)();
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
function headerValue(headers, name) {
    const value = headers[name];
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
/** Tracks used nonces for exactly as long as their timestamps remain valid. */
class NonceStore {
    now;
    seen = new Map();
    constructor(now = Date.now) {
        this.now = now;
    }
    use(nonce, expiresAtMs) {
        this.prune();
        if (this.seen.has(nonce)) {
            return false;
        }
        this.seen.set(nonce, expiresAtMs);
        return true;
    }
    has(nonce) {
        return this.seen.has(nonce);
    }
    clear() {
        this.seen.clear();
    }
    get size() {
        return this.seen.size;
    }
    prune() {
        const now = this.now();
        for (const [nonce, expiresAt] of this.seen) {
            if (expiresAt <= now) {
                this.seen.delete(nonce);
            }
        }
    }
}
exports.NonceStore = NonceStore;
/**
 * Verify an inbound Laravel -> agent request. This authenticates the service,
 * never a panel user. Returns a discriminated result so callers can map it to
 * the response envelope without throwing stringly-typed errors.
 */
function verifyInboundSignature(input) {
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
    if (expected.length !== provided.length || !(0, node_crypto_1.timingSafeEqual)(expected, provided)) {
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
//# sourceMappingURL=hmac.js.map