const { toUint8Array, concatBytes } = require("@smithy/core/serde");
const { createHmac, createHash } = require("node:crypto");
const { Sha256, Sha256Js, Sha256Node } = require("@smithy/core/checksum");
exports.Sha256 = Sha256;
exports.Sha256Js = Sha256Js;
exports.Sha256Node = Sha256Node;

const BLOCK$1 = 64;
const DIGEST_LENGTH$1 = 20;
const INIT$1 = new Int32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
const K$1 = new Int32Array([0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6]);
class Sha1Js {
    digestLength = DIGEST_LENGTH$1;
    state = Int32Array.from(INIT$1);
    w;
    buffer = new Uint8Array(BLOCK$1);
    bufferLength = 0;
    bytesHashed = 0;
    finished = false;
    inner;
    outer;
    constructor(secret) {
        if (secret) {
            const key = Sha1Js.normalizeKey(secret);
            this.inner = new Sha1Js();
            this.outer = new Sha1Js();
            const pad = new Uint8Array(BLOCK$1 * 2);
            for (let i = 0; i < BLOCK$1; ++i) {
                pad[i] = 0x36 ^ key[i];
                pad[i + BLOCK$1] = 0x5c ^ key[i];
            }
            this.inner.update(pad.subarray(0, BLOCK$1));
            this.outer.update(pad.subarray(BLOCK$1));
        }
    }
    update(data) {
        if (this.finished) {
            throw new Error("Attempted to update an already finished HMAC.");
        }
        if (this.inner) {
            this.inner.update(data);
            return;
        }
        let pos = 0;
        let { length } = data;
        this.bytesHashed += length;
        if (this.bufferLength > 0) {
            while (length > 0 && this.bufferLength < BLOCK$1) {
                this.buffer[this.bufferLength++] = data[pos++];
                --length;
            }
            if (this.bufferLength === BLOCK$1) {
                this.hashBuffer(this.buffer, 0);
                this.bufferLength = 0;
            }
        }
        while (length >= BLOCK$1) {
            this.hashBuffer(data, pos);
            pos += BLOCK$1;
            length -= BLOCK$1;
        }
        while (length > 0) {
            this.buffer[this.bufferLength++] = data[pos++];
            --length;
        }
    }
    async digest() {
        if (this.inner && this.outer) {
            if (this.finished) {
                throw new Error("Attempted to digest an already finished HMAC.");
            }
            this.finished = true;
            const innerDigest = this.inner.digestSync();
            this.outer.update(innerDigest);
            return this.outer.digestSync();
        }
        return this.digestSync();
    }
    reset() {
        this.state = Int32Array.from(INIT$1);
        this.buffer = new Uint8Array(BLOCK$1);
        this.bufferLength = 0;
        this.bytesHashed = 0;
    }
    digestSync() {
        const state = this.state.slice();
        const buffer = this.buffer.slice();
        let bufferLength = this.bufferLength;
        const bitsHi = (this.bytesHashed / 0x20000000) | 0;
        const bitsLo = this.bytesHashed << 3;
        buffer[bufferLength++] = 0x80;
        if (bufferLength > BLOCK$1 - 8) {
            for (let i = bufferLength; i < BLOCK$1; ++i) {
                buffer[i] = 0;
            }
            this.hashBufferWith(state, buffer, 0);
            bufferLength = 0;
        }
        for (let i = bufferLength; i < BLOCK$1 - 8; ++i) {
            buffer[i] = 0;
        }
        const v = new DataView(buffer.buffer, buffer.byteOffset, BLOCK$1);
        v.setUint32(BLOCK$1 - 8, bitsHi, false);
        v.setUint32(BLOCK$1 - 4, bitsLo, false);
        this.hashBufferWith(state, buffer, 0);
        const out = new Uint8Array(DIGEST_LENGTH$1);
        out[0] = (state[0] >>> 24) & 0xff;
        out[1] = (state[0] >>> 16) & 0xff;
        out[2] = (state[0] >>> 8) & 0xff;
        out[3] = state[0] & 0xff;
        out[4] = (state[1] >>> 24) & 0xff;
        out[5] = (state[1] >>> 16) & 0xff;
        out[6] = (state[1] >>> 8) & 0xff;
        out[7] = state[1] & 0xff;
        out[8] = (state[2] >>> 24) & 0xff;
        out[9] = (state[2] >>> 16) & 0xff;
        out[10] = (state[2] >>> 8) & 0xff;
        out[11] = state[2] & 0xff;
        out[12] = (state[3] >>> 24) & 0xff;
        out[13] = (state[3] >>> 16) & 0xff;
        out[14] = (state[3] >>> 8) & 0xff;
        out[15] = state[3] & 0xff;
        out[16] = (state[4] >>> 24) & 0xff;
        out[17] = (state[4] >>> 16) & 0xff;
        out[18] = (state[4] >>> 8) & 0xff;
        out[19] = state[4] & 0xff;
        return out;
    }
    static normalizeKey(secret) {
        const key = toUint8Array(secret);
        if (key.byteLength > BLOCK$1) {
            const h = new Sha1Js();
            h.update(key);
            const digest = h.digestSync();
            const padded = new Uint8Array(BLOCK$1);
            padded.set(digest);
            return padded;
        }
        const padded = new Uint8Array(BLOCK$1);
        padded.set(key);
        return padded;
    }
    hashBuffer(data, offset) {
        this.hashBufferWith(this.state, data, offset);
    }
    hashBufferWith(state, data, offset) {
        const w = (this.w ??= new Int32Array(80));
        let s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3], s4 = state[4];
        for (let t = 0; t < 16; ++t) {
            w[t] =
                ((data[offset + t * 4] & 0xff) << 24) |
                    ((data[offset + t * 4 + 1] & 0xff) << 16) |
                    ((data[offset + t * 4 + 2] & 0xff) << 8) |
                    (data[offset + t * 4 + 3] & 0xff);
        }
        for (let t = 16; t < 80; ++t) {
            const x = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
            w[t] = (x << 1) | (x >>> 31);
        }
        for (let t = 0; t < 80; ++t) {
            const r = t < 20 ? 0 : t < 40 ? 1 : t < 60 ? 2 : 3;
            const temp = (((((s0 << 5) | (s0 >>> 27)) +
                (r === 0 ? (s1 & s2) ^ (~s1 & s3) : r === 2 ? (s1 & s2) ^ (s1 & s3) ^ (s2 & s3) : s1 ^ s2 ^ s3)) |
                0) +
                ((s4 + ((K$1[r] + w[t]) | 0)) | 0)) |
                0;
            s4 = s3;
            s3 = s2;
            s2 = (s1 << 30) | (s1 >>> 2);
            s1 = s0;
            s0 = temp;
        }
        state[0] = (state[0] + s0) | 0;
        state[1] = (state[1] + s1) | 0;
        state[2] = (state[2] + s2) | 0;
        state[3] = (state[3] + s3) | 0;
        state[4] = (state[4] + s4) | 0;
    }
}

const hasNativeCrypto = (() => {
    try {
        createHash("sha1");
        return true;
    }
    catch {
        return false;
    }
})();
const Sha1Node = hasNativeCrypto ? buildNativeClass() : Sha1Js;
function buildNativeClass() {
    return class Sha1Node {
        digestLength = 20;
        secret;
        hash;
        isHmac;
        finished = false;
        constructor(secret) {
            this.secret = secret;
            this.isHmac = !!secret;
            this.hash = this.createHash();
        }
        update(data) {
            if (this.finished) {
                throw new Error("Attempted to update an already finished hash.");
            }
            this.hash.update(data);
        }
        async digest() {
            let buf;
            if (this.isHmac) {
                this.finished = true;
                buf = this.hash.digest();
            }
            else {
                buf = this.hash.copy().digest();
            }
            return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        }
        reset() {
            this.hash = this.createHash();
            this.finished = false;
        }
        createHash() {
            return this.secret ? createHmac("sha1", toBuffer$1(this.secret)) : createHash("sha1");
        }
    };
}
function toBuffer$1(data) {
    if (typeof data === "string") {
        return data;
    }
    if (ArrayBuffer.isView(data)) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    return Buffer.from(data);
}

const { digest: digest$1, sign: sign$1, importKey: importKey$1 } = globalThis?.crypto?.subtle ?? {};
const subtle$1 = typeof digest$1 === "function" && typeof sign$1 === "function" && typeof importKey$1 === "function"
    ? globalThis.crypto.subtle
    : undefined;
const MAX_PENDING_BYTES$1 = 8 * 1024 * 1024;
class Sha1WebCrypto {
    digestLength = 20;
    secret;
    pending = [];
    pendingBytes = 0;
    fallback;
    finished = false;
    constructor(secret) {
        if (secret) {
            this.secret = toUint8Array(secret);
        }
    }
    update(data) {
        if (this.finished) {
            throw new Error("Attempted to update an already finished HMAC.");
        }
        if (this.fallback) {
            this.fallback.update(data);
            return;
        }
        this.pending.push(data.slice());
        this.pendingBytes += data.byteLength;
        if (this.pendingBytes >= MAX_PENDING_BYTES$1) {
            this.switchToFallback();
        }
    }
    async digest() {
        if (this.fallback) {
            return this.fallback.digest();
        }
        if (this.secret && this.finished) {
            throw new Error("Attempted to digest an already finished HMAC.");
        }
        const data = concatBytes(this.pending);
        if (subtle$1) {
            if (this.secret) {
                this.finished = true;
                const key = await subtle$1.importKey("raw", this.secret, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
                const sig = await subtle$1.sign("HMAC", key, data);
                return new Uint8Array(sig);
            }
            const hash = await subtle$1.digest("SHA-1", data);
            return new Uint8Array(hash);
        }
        const sha1 = new Sha1Js(this.secret);
        sha1.update(data);
        return sha1.digest();
    }
    reset() {
        this.pending = [];
        this.pendingBytes = 0;
        this.fallback = undefined;
        this.finished = false;
    }
    switchToFallback() {
        const sha1Js = new Sha1Js(this.secret);
        for (const chunk of this.pending) {
            sha1Js.update(chunk);
        }
        this.fallback = sha1Js;
        this.pending = [];
        this.pendingBytes = 0;
    }
}

const BLOCK = 128;
const DIGEST_LENGTH = 64;
const MAX_HASHABLE_LENGTH = 2 ** 53 - 1;
const INIT = new Uint32Array([
    0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1, 0x510e527f,
    0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179,
]);
const K = new Uint32Array([
    0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
    0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
    0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
    0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
    0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
    0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
    0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
    0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
    0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
    0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
    0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
    0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
    0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
    0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
    0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
    0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
    0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
    0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
    0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
    0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a, 0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817,
]);
class Sha512Js {
    digestLength = DIGEST_LENGTH;
    state = Uint32Array.from(INIT);
    w;
    buffer = new Uint8Array(BLOCK);
    bufferLength = 0;
    bytesHashed = 0;
    finished = false;
    key;
    inner;
    outer;
    constructor(secret) {
        if (secret !== undefined) {
            this.key = Sha512Js.normalizeKey(secret);
            this.initHmac();
        }
    }
    update(data) {
        if (this.finished) {
            throw new Error("Attempted to update an already finished HMAC.");
        }
        if (this.inner) {
            this.inner.update(data);
            return;
        }
        const chunk = toUint8Array(data);
        let position = 0;
        let { byteLength } = chunk;
        this.bytesHashed += byteLength;
        if (this.bytesHashed * 8 > MAX_HASHABLE_LENGTH) {
            throw new Error("Cannot hash more than 2^53 - 1 bits");
        }
        while (byteLength > 0) {
            this.buffer[this.bufferLength++] = chunk[position++];
            byteLength--;
            if (this.bufferLength === BLOCK) {
                this.hashBuffer();
                this.bufferLength = 0;
            }
        }
    }
    async digest() {
        if (this.inner && this.outer) {
            if (this.finished) {
                throw new Error("Attempted to digest an already finished HMAC.");
            }
            this.finished = true;
            const innerDigest = this.inner.digestSync();
            this.outer.update(innerDigest);
            return this.outer.digestSync();
        }
        return this.digestSync();
    }
    reset() {
        this.state = Uint32Array.from(INIT);
        this.buffer = new Uint8Array(BLOCK);
        this.bufferLength = 0;
        this.bytesHashed = 0;
        this.finished = false;
        if (this.key) {
            this.initHmac();
        }
    }
    initHmac() {
        const key = this.key;
        this.inner = new Sha512Js();
        this.outer = new Sha512Js();
        const pad = new Uint8Array(BLOCK * 2);
        for (let i = 0; i < BLOCK; ++i) {
            pad[i] = 0x36 ^ key[i];
            pad[i + BLOCK] = 0x5c ^ key[i];
        }
        this.inner.update(pad.subarray(0, BLOCK));
        this.outer.update(pad.subarray(BLOCK));
    }
    digestSync() {
        const state = this.state.slice();
        const buffer = this.buffer.slice();
        let bufferLength = this.bufferLength;
        const bitsHashed = this.bytesHashed * 8;
        const bitsHi = Math.floor(bitsHashed / 0x100000000);
        const bitsLo = bitsHashed >>> 0;
        buffer[bufferLength++] = 0x80;
        if (bufferLength > BLOCK - 16) {
            for (let i = bufferLength; i < BLOCK; ++i) {
                buffer[i] = 0;
            }
            this.hashBufferWith(state, buffer);
            bufferLength = 0;
        }
        for (let i = bufferLength; i < BLOCK - 8; ++i) {
            buffer[i] = 0;
        }
        const v = new DataView(buffer.buffer, buffer.byteOffset, BLOCK);
        v.setUint32(BLOCK - 8, bitsHi, false);
        v.setUint32(BLOCK - 4, bitsLo, false);
        this.hashBufferWith(state, buffer);
        const out = new Uint8Array(DIGEST_LENGTH);
        const dv = new DataView(out.buffer);
        for (let i = 0; i < 16; ++i) {
            dv.setUint32(i * 4, state[i], false);
        }
        return out;
    }
    static normalizeKey(secret) {
        const key = toUint8Array(secret);
        if (key.byteLength > BLOCK) {
            const h = new Sha512Js();
            h.update(key);
            const padded = new Uint8Array(BLOCK);
            padded.set(h.digestSync());
            return padded;
        }
        const padded = new Uint8Array(BLOCK);
        padded.set(key);
        return padded;
    }
    hashBuffer() {
        this.hashBufferWith(this.state, this.buffer);
    }
    hashBufferWith(state, buffer) {
        const w = (this.w ??= new Uint32Array(160));
        const v = new Uint32Array(16);
        for (let i = 0; i < 16; ++i) {
            v[i] = state[i];
        }
        for (let i = 0; i < 16; ++i) {
            const o = i * 8;
            w[i * 2] = ((buffer[o] << 24) | (buffer[o + 1] << 16) | (buffer[o + 2] << 8) | buffer[o + 3]) >>> 0;
            w[i * 2 + 1] = ((buffer[o + 4] << 24) | (buffer[o + 5] << 16) | (buffer[o + 6] << 8) | buffer[o + 7]) >>> 0;
        }
        for (let i = 16; i < 80; ++i) {
            const g15h = w[(i - 15) * 2];
            const g15l = w[(i - 15) * 2 + 1];
            const s0h = rotrH(g15h, g15l, 1) ^ rotrH(g15h, g15l, 8) ^ shrH(g15h, 7);
            const s0l = rotrL(g15h, g15l, 1) ^ rotrL(g15h, g15l, 8) ^ shrL(g15h, g15l, 7);
            const g2h = w[(i - 2) * 2];
            const g2l = w[(i - 2) * 2 + 1];
            const s1h = rotrH(g2h, g2l, 19) ^ rotrH(g2h, g2l, 61) ^ shrH(g2h, 6);
            const s1l = rotrL(g2h, g2l, 19) ^ rotrL(g2h, g2l, 61) ^ shrL(g2h, g2l, 6);
            const w7h = w[(i - 7) * 2];
            const w7l = w[(i - 7) * 2 + 1];
            const w16h = w[(i - 16) * 2];
            const w16l = w[(i - 16) * 2 + 1];
            let lo = (w16l >>> 0) + (s0l >>> 0);
            let hi = (w16h >>> 0) + (s0h >>> 0) + (lo > 0xffffffff ? 1 : 0);
            lo = (lo >>> 0) + (w7l >>> 0);
            hi = (hi >>> 0) + (w7h >>> 0) + (lo > 0xffffffff ? 1 : 0);
            lo = (lo >>> 0) + (s1l >>> 0);
            hi = (hi >>> 0) + (s1h >>> 0) + (lo > 0xffffffff ? 1 : 0);
            w[i * 2] = hi >>> 0;
            w[i * 2 + 1] = lo >>> 0;
        }
        let ah = v[0], al = v[1], bh = v[2], bl = v[3], ch = v[4], cl = v[5], dh = v[6], dl = v[7], eh = v[8], el = v[9], fh = v[10], fl = v[11], gh = v[12], gl = v[13], hh = v[14], hl = v[15];
        for (let i = 0; i < 80; ++i) {
            const s1h = rotrH(eh, el, 14) ^ rotrH(eh, el, 18) ^ rotrH(eh, el, 41);
            const s1l = rotrL(eh, el, 14) ^ rotrL(eh, el, 18) ^ rotrL(eh, el, 41);
            const chh = (eh & fh) ^ (~eh & gh);
            const chl = (el & fl) ^ (~el & gl);
            let t1l = (hl >>> 0) + (s1l >>> 0);
            let t1h = (hh >>> 0) + (s1h >>> 0) + (t1l > 0xffffffff ? 1 : 0);
            t1l = (t1l >>> 0) + (chl >>> 0);
            t1h = (t1h >>> 0) + (chh >>> 0) + (t1l > 0xffffffff ? 1 : 0);
            t1l = (t1l >>> 0) + (K[i * 2 + 1] >>> 0);
            t1h = (t1h >>> 0) + (K[i * 2] >>> 0) + (t1l > 0xffffffff ? 1 : 0);
            t1l = (t1l >>> 0) + (w[i * 2 + 1] >>> 0);
            t1h = (t1h >>> 0) + (w[i * 2] >>> 0) + (t1l > 0xffffffff ? 1 : 0);
            const s0h = rotrH(ah, al, 28) ^ rotrH(ah, al, 34) ^ rotrH(ah, al, 39);
            const s0l = rotrL(ah, al, 28) ^ rotrL(ah, al, 34) ^ rotrL(ah, al, 39);
            const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
            const majl = (al & bl) ^ (al & cl) ^ (bl & cl);
            let t2l = (s0l >>> 0) + (majl >>> 0);
            let t2h = (s0h >>> 0) + (majh >>> 0) + (t2l > 0xffffffff ? 1 : 0);
            t2l = t2l >>> 0;
            t2h = t2h >>> 0;
            hh = gh;
            hl = gl;
            gh = fh;
            gl = fl;
            fh = eh;
            fl = el;
            let el2 = (dl >>> 0) + (t1l >>> 0);
            let eh2 = (dh >>> 0) + (t1h >>> 0) + (el2 > 0xffffffff ? 1 : 0);
            eh = eh2 >>> 0;
            el = el2 >>> 0;
            dh = ch;
            dl = cl;
            ch = bh;
            cl = bl;
            bh = ah;
            bl = al;
            let al2 = (t1l >>> 0) + (t2l >>> 0);
            let ah2 = (t1h >>> 0) + (t2h >>> 0) + (al2 > 0xffffffff ? 1 : 0);
            ah = ah2 >>> 0;
            al = al2 >>> 0;
        }
        addInto(state, 0, ah, al);
        addInto(state, 1, bh, bl);
        addInto(state, 2, ch, cl);
        addInto(state, 3, dh, dl);
        addInto(state, 4, eh, el);
        addInto(state, 5, fh, fl);
        addInto(state, 6, gh, gl);
        addInto(state, 7, hh, hl);
    }
}
function addInto(state, slot, vh, vl) {
    const i = slot * 2;
    const lo = (state[i + 1] >>> 0) + (vl >>> 0);
    const hi = (state[i] >>> 0) + (vh >>> 0) + (lo > 0xffffffff ? 1 : 0);
    state[i] = hi >>> 0;
    state[i + 1] = lo >>> 0;
}
function rotrH(hi, lo, n) {
    if (n < 32) {
        return ((hi >>> n) | (lo << (32 - n))) >>> 0;
    }
    if (n === 32) {
        return lo >>> 0;
    }
    return ((lo >>> (n - 32)) | (hi << (64 - n))) >>> 0;
}
function rotrL(hi, lo, n) {
    if (n < 32) {
        return ((lo >>> n) | (hi << (32 - n))) >>> 0;
    }
    if (n === 32) {
        return hi >>> 0;
    }
    return ((hi >>> (n - 32)) | (lo << (64 - n))) >>> 0;
}
function shrH(hi, n) {
    if (n < 32) {
        return hi >>> n;
    }
    return 0;
}
function shrL(hi, lo, n) {
    if (n < 32) {
        return ((lo >>> n) | (hi << (32 - n))) >>> 0;
    }
    if (n === 32) {
        return hi >>> 0;
    }
    return hi >>> (n - 32);
}

let nativeSupported;
function detectNative() {
    if (nativeSupported === undefined) {
        try {
            createHash("sha512");
            nativeSupported = true;
        }
        catch {
            nativeSupported = false;
        }
    }
    return nativeSupported;
}
class Sha512 extends Sha512Js {
    native;
    nativeSecret;
    nativeFinished = false;
    constructor(secret) {
        super(secret);
        this.nativeSecret = secret;
        if (detectNative()) {
            this.native = this.createNative();
        }
    }
    update(data) {
        if (!this.native) {
            super.update(data);
            return;
        }
        if (this.nativeFinished) {
            throw new Error("Attempted to update an already finished hash.");
        }
        this.native.update(data);
    }
    async digest() {
        if (!this.native) {
            return super.digest();
        }
        let buf;
        if (this.nativeSecret !== undefined) {
            this.nativeFinished = true;
            buf = this.native.digest();
        }
        else {
            buf = this.native.copy().digest();
        }
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    reset() {
        if (!this.native) {
            super.reset();
            return;
        }
        this.native = this.createNative();
        this.nativeFinished = false;
    }
    createNative() {
        return this.nativeSecret !== undefined ? createHmac("sha512", toBuffer(this.nativeSecret)) : createHash("sha512");
    }
}
function toBuffer(data) {
    if (typeof data === "string") {
        return data;
    }
    if (ArrayBuffer.isView(data)) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    return Buffer.from(data);
}

const { digest, sign, importKey } = globalThis?.crypto?.subtle ?? {};
const subtle = typeof digest === "function" && typeof sign === "function" && typeof importKey === "function"
    ? globalThis.crypto.subtle
    : undefined;
const MAX_PENDING_BYTES = 8 * 1024 * 1024;
const BLOCK_SIZE = 128;
class Sha512WebCrypto {
    digestLength = 64;
    secret;
    pending = [];
    pendingBytes = 0;
    fallback;
    finished = false;
    constructor(secret) {
        if (secret !== undefined) {
            const key = toUint8Array(secret);
            this.secret = key.byteLength === 0 ? new Uint8Array(BLOCK_SIZE) : key;
        }
        if (!subtle) {
            this.fallback = new Sha512Js(secret);
        }
    }
    update(data) {
        if (this.finished) {
            throw new Error("Attempted to update an already finished HMAC.");
        }
        if (this.fallback) {
            this.fallback.update(data);
            return;
        }
        this.pending.push(data.slice());
        this.pendingBytes += data.byteLength;
        if (this.pendingBytes >= MAX_PENDING_BYTES) {
            this.switchToFallback();
        }
    }
    async digest() {
        if (this.fallback) {
            return this.fallback.digest();
        }
        if (this.secret && this.finished) {
            throw new Error("Attempted to digest an already finished HMAC.");
        }
        const data = concatBytes(this.pending);
        if (this.secret) {
            this.finished = true;
            const key = await subtle.importKey("raw", this.secret, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
            const sig = await subtle.sign("HMAC", key, data);
            return new Uint8Array(sig);
        }
        const hash = await subtle.digest("SHA-512", data);
        return new Uint8Array(hash);
    }
    reset() {
        this.pending = [];
        this.pendingBytes = 0;
        this.finished = false;
        if (subtle) {
            this.fallback = undefined;
        }
        else {
            this.fallback = new Sha512Js(this.secret);
        }
    }
    switchToFallback() {
        const sha512Js = new Sha512Js(this.secret);
        for (const chunk of this.pending) {
            sha512Js.update(chunk);
        }
        this.fallback = sha512Js;
        this.pending = [];
        this.pendingBytes = 0;
    }
}

exports.Sha1 = Sha1Node;
exports.Sha1Js = Sha1Js;
exports.Sha1Node = Sha1Node;
exports.Sha1WebCrypto = Sha1WebCrypto;
exports.Sha512 = Sha512;
exports.Sha512Js = Sha512Js;
exports.Sha512WebCrypto = Sha512WebCrypto;
