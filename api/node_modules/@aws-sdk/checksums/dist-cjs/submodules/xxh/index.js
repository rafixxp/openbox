const l16 = 0b1_0000_0000_0000_0000;
const m8 = 0b1111_1111;
const m16 = 0b1111_1111_1111_1111;
const m32 = 0b11111111_11111111_11111111_11111111;
class U64 extends Uint32Array {
    constructor(buffer) {
        super(buffer);
    }
    static create(size) {
        return new U64(new ArrayBuffer(size * 2 * 4));
    }
    write(i, v0, v1) {
        i *= 2;
        this[i] = v0;
        this[i + 1] = v1;
        return this;
    }
    copy(source, target) {
        source *= 2;
        target *= 2;
        this[target] = this[source];
        this[target + 1] = this[source + 1];
        return this;
    }
    add(i, v0, v1) {
        i *= 2;
        const j = i + 1;
        const j0 = this[j];
        const j1 = (j0 + v1) >>> 0;
        this[i] = (this[i] + v0 + (j1 < j0 ? 1 : 0)) >>> 0;
        this[j] = j1;
        return this;
    }
    multiply(i, v0, v1) {
        i *= 2;
        const i0 = this[i];
        const i1 = this[i + 1];
        const a0 = i1 & m16;
        const a1 = i1 >>> 16;
        const a2 = i0 & m16;
        const a3 = i0 >>> 16;
        const b0 = v1 & m16;
        const b1 = v1 >>> 16;
        const b2 = v0 & m16;
        const b3 = v0 >>> 16;
        const c0 = a0 * b0;
        const c1 = ((c0 / l16) | 0) + a1 * b0 + a0 * b1;
        const c2 = ((c1 / l16) | 0) + a2 * b0 + a1 * b1 + a0 * b2;
        const c3 = ((c2 / l16) | 0) + a3 * b0 + a2 * b1 + a1 * b2 + a0 * b3;
        this[i] = (((c3 & m16) << 16) | (c2 & m16)) >>> 0;
        this[i + 1] = (((c1 & m16) << 16) | (c0 & m16)) >>> 0;
        return this;
    }
    addProduct(i, a, b) {
        i *= 2;
        const a0 = b & m16;
        const a1 = b >>> 16;
        const b0 = a & m16;
        const b1 = a >>> 16;
        const c0 = a0 * b0;
        const c1 = ((c0 / l16) | 0) + a1 * b0 + a0 * b1;
        const c2 = ((c1 / l16) | 0) + a1 * b1;
        const lo = (((c1 & m16) << 16) | (c0 & m16)) >>> 0;
        const hi = c2 >>> 0;
        const prev = this[i + 1];
        const newLo = (prev + lo) >>> 0;
        this[i] = (this[i] + hi + (newLo < prev ? 1 : 0)) >>> 0;
        this[i + 1] = newLo;
        return this;
    }
    multiply128(i, j, t, u) {
        i *= 2;
        j *= 2;
        t *= 2;
        u *= 2;
        const a0 = this[i + 1] & m16;
        const a1 = this[i + 1] >>> 16;
        const a2 = this[i] & m16;
        const a3 = this[i] >>> 16;
        const b0 = this[j + 1] & m16;
        const b1 = this[j + 1] >>> 16;
        const b2 = this[j] & m16;
        const b3 = this[j] >>> 16;
        const c0 = a0 * b0;
        const c1 = ((c0 / l16) | 0) + a1 * b0 + a0 * b1;
        const c2 = ((c1 / l16) | 0) + a2 * b0 + a1 * b1 + a0 * b2;
        const c3 = ((c2 / l16) | 0) + a3 * b0 + a2 * b1 + a1 * b2 + a0 * b3;
        const c4 = ((c3 / l16) | 0) + a3 * b1 + a2 * b2 + a1 * b3;
        const c5 = ((c4 / l16) | 0) + a3 * b2 + a2 * b3;
        const c6 = ((c5 / l16) | 0) + a3 * b3;
        const c7 = (c6 / l16) | 0;
        this[u] = (((c3 & m16) << 16) | (c2 & m16)) >>> 0;
        this[u + 1] = (((c1 & m16) << 16) | (c0 & m16)) >>> 0;
        this[t] = (((c7 & m16) << 16) | (c6 & m16)) >>> 0;
        this[t + 1] = (((c5 & m16) << 16) | (c4 & m16)) >>> 0;
        return this;
    }
    subtract(i, v0, v1) {
        i *= 2;
        const i1 = this[i + 1];
        this[i] = (this[i] - v0 - (i1 < v1 ? 1 : 0)) >>> 0;
        this[i + 1] = (i1 - v1) >>> 0;
        return this;
    }
    left(i, places) {
        i *= 2;
        if (places <= 0) ;
        else if (places < 32) {
            const v0 = this[i];
            this[i] = ((v0 << places) >>> 0) | (this[i + 1] >>> (32 - places));
            this[i + 1] = (this[i + 1] << places) >>> 0;
        }
        else if (places === 32) {
            this[i] = this[i + 1];
            this[i + 1] = 0;
        }
        else if (places > 32) {
            this[i] = (this[i + 1] << (places - 32)) >>> 0;
            this[i + 1] = 0;
        }
        return this;
    }
    rotateLeft(i, places) {
        i *= 2;
        const i0 = this[i];
        const i1 = this[i + 1];
        if (places === 0 || places === 64) ;
        else if (places < 32) {
            this[i] = ((i0 << places) >>> 0) | (i1 >>> (32 - places));
            this[i + 1] = ((i1 << places) >>> 0) | (i0 >>> (32 - places));
        }
        else if (places === 32) {
            this[i] = i1;
            this[i + 1] = i0;
        }
        else {
            const p = places - 32;
            this[i] = ((i1 << p) >>> 0) | (i0 >>> (32 - p));
            this[i + 1] = ((i0 << p) >>> 0) | (i1 >>> (32 - p));
        }
        return this;
    }
    right(i, places) {
        i *= 2;
        if (places <= 0) ;
        else if (places < 32) {
            this[i + 1] = (this[i + 1] >>> places) | ((this[i] << (32 - places)) >>> 0);
            this[i] = this[i] >>> places;
        }
        else if (places === 32) {
            this[i + 1] = this[i];
            this[i] = 0;
        }
        else if (places > 32) {
            this[i + 1] = this[i] >>> (places - 32);
            this[i] = 0;
        }
        return this;
    }
    xor(i, v0, v1) {
        i *= 2;
        this[i] ^= v0;
        this[i + 1] ^= v1;
        return this;
    }
    toBytes(i) {
        i *= 2;
        const i0 = this[i];
        const i1 = this[i + 1];
        return new Uint8Array([
            i0 >>> 24,
            (i0 >>> 16) & m8,
            (i0 >>> 8) & m8,
            i0 & m8,
            i1 >>> 24,
            (i1 >>> 16) & m8,
            (i1 >>> 8) & m8,
            i1 & m8,
        ]);
    }
    hi(i) {
        return this[i * 2];
    }
    lo(i) {
        return this[i * 2 + 1];
    }
}

const P = U64.create(6)
    .write(0, 0b10011110001101110111100110110001, 0b10000101111010111100101010000111)
    .write(1, 0b11000010101100101010111000111101, 0b00100111110101001110101101001111)
    .write(3, 0b00010110010101100110011110110001, 0b10011110001101110111100111111001)
    .write(4, 0b10000101111010111100101001110111, 0b11000010101100101010111001100011)
    .write(5, 0b00100111110101001110101100101111, 0b00010110010101100110011111000101);
P.copy(0, 2).add(2, P.hi(1), P.lo(1));
const P1 = 0;
const P2 = 1;
const P1_2 = 2;
const P3 = 3;
const P4 = 4;
const P5 = 5;
const SEED$1 = 0;
const ACC0 = 1;
const ACC1 = 2;
const ACC2 = 3;
const ACC3 = 4;
const T0$1 = 5;
const T1$1 = 6;
const T2$1 = 7;
class Xxh64 {
    digestLength = 8;
    byteCount = 0;
    mem = U64.create(8);
    stripeBuffer = new Uint8Array(32);
    bufferIndex = 0;
    constructor() {
        this.mem.write(SEED$1, 0, 0);
        this.reset();
    }
    update(chunk) {
        this.byteCount += chunk.byteLength;
        this._update(chunk);
    }
    _update(chunk) {
        if (this.bufferIndex !== 0 && this.bufferIndex + chunk.byteLength >= 32) {
            const bytesFilled = 32 - this.bufferIndex;
            for (let i = 0; i < bytesFilled; ++i) {
                this.stripeBuffer[this.bufferIndex++] = chunk[i];
            }
            this.processStripe(this.stripeBuffer);
            this.bufferIndex = 0;
            return this._update(chunk.subarray(bytesFilled));
        }
        if (chunk.byteLength < 32) {
            for (let i = 0; i < chunk.byteLength; ++i) {
                this.stripeBuffer[this.bufferIndex++] = chunk[i];
                if (this.bufferIndex === this.stripeBuffer.byteLength) {
                    this.bufferIndex = 0;
                    this.processStripe(this.stripeBuffer);
                }
            }
        }
        else {
            for (let i = 0; i < chunk.byteLength; i += 32) {
                const chunkLen = Math.min(i + 32, chunk.byteLength) - i;
                const subchunk = chunk.subarray(i, i + chunkLen);
                if (chunkLen < 32) {
                    return this._update(subchunk);
                }
                this.processStripe(subchunk);
            }
        }
    }
    async digest() {
        const { mem, byteCount } = this;
        const m = T0$1;
        if (byteCount < 32) {
            mem.copy(SEED$1, m).add(m, P.hi(P5), P.lo(P5));
        }
        else {
            mem.copy(ACC0, T1$1).rotateLeft(T1$1, 1);
            mem.write(m, mem.hi(T1$1), mem.lo(T1$1));
            mem.copy(ACC1, T1$1).rotateLeft(T1$1, 7);
            mem.add(m, mem.hi(T1$1), mem.lo(T1$1));
            mem.copy(ACC2, T1$1).rotateLeft(T1$1, 12);
            mem.add(m, mem.hi(T1$1), mem.lo(T1$1));
            mem.copy(ACC3, T1$1).rotateLeft(T1$1, 18);
            mem.add(m, mem.hi(T1$1), mem.lo(T1$1));
            this.mergeAcc(m, ACC0);
            this.mergeAcc(m, ACC1);
            this.mergeAcc(m, ACC2);
            this.mergeAcc(m, ACC3);
        }
        mem.add(m, Math.floor(byteCount / m32), byteCount & m32);
        let rem = this.bufferIndex;
        let ptr = 0;
        const b = this.stripeBuffer;
        while (rem >= 8) {
            const v1 = b[ptr++] | (b[ptr++] << 8) | (b[ptr++] << 16) | ((b[ptr++] << 24) >>> 0);
            const v0 = b[ptr++] | (b[ptr++] << 8) | (b[ptr++] << 16) | ((b[ptr++] << 24) >>> 0);
            mem.write(T1$1, 0, 0);
            this.roundAt(T1$1, v0, v1);
            mem.xor(m, mem.hi(T1$1), mem.lo(T1$1)).rotateLeft(m, 27).multiply(m, P.hi(P1), P.lo(P1)).add(m, P.hi(P4), P.lo(P4));
            rem -= 8;
        }
        while (rem >= 4) {
            const lo = b[ptr++] | (b[ptr++] << 8) | (b[ptr++] << 16) | ((b[ptr++] << 24) >>> 0);
            mem.write(T1$1, 0, lo).multiply(T1$1, P.hi(P1), P.lo(P1));
            mem.xor(m, mem.hi(T1$1), mem.lo(T1$1)).rotateLeft(m, 23).multiply(m, P.hi(P2), P.lo(P2)).add(m, P.hi(P3), P.lo(P3));
            rem -= 4;
        }
        while (rem >= 1) {
            mem.write(T1$1, 0, b[ptr++]).multiply(T1$1, P.hi(P5), P.lo(P5));
            mem.xor(m, mem.hi(T1$1), mem.lo(T1$1)).rotateLeft(m, 11).multiply(m, P.hi(P1), P.lo(P1));
            rem -= 1;
        }
        this.avalanche(m);
        return mem.toBytes(m);
    }
    reset() {
        const { mem } = this;
        this.byteCount = 0;
        this.bufferIndex = 0;
        mem.copy(SEED$1, ACC0).add(ACC0, P.hi(P1_2), P.lo(P1_2));
        mem.copy(SEED$1, ACC1).add(ACC1, P.hi(P2), P.lo(P2));
        mem.copy(SEED$1, ACC2);
        mem.copy(SEED$1, ACC3).subtract(ACC3, P.hi(P1), P.lo(P1));
    }
    processStripe(stripe) {
        for (let i = 0; i < 4; ++i) {
            const ix = i * 8;
            const v1 = stripe[ix] | (stripe[ix + 1] << 8) | (stripe[ix + 2] << 16) | ((stripe[ix + 3] << 24) >>> 0);
            const v0 = stripe[ix + 4] | (stripe[ix + 5] << 8) | (stripe[ix + 6] << 16) | ((stripe[ix + 7] << 24) >>> 0);
            this.roundAt(ACC0 + i, v0, v1);
        }
    }
    mergeAcc(m, acc) {
        const { mem } = this;
        mem.write(T1$1, 0, 0);
        this.roundAt(T1$1, mem.hi(acc), mem.lo(acc));
        mem.xor(m, mem.hi(T1$1), mem.lo(T1$1)).multiply(m, P.hi(P1), P.lo(P1)).add(m, P.hi(P4), P.lo(P4));
    }
    roundAt(i, v0, v1) {
        const { mem } = this;
        mem.write(T2$1, v0, v1).multiply(T2$1, P.hi(P2), P.lo(P2));
        mem.add(i, mem.hi(T2$1), mem.lo(T2$1)).rotateLeft(i, 31).multiply(i, P.hi(P1), P.lo(P1));
    }
    avalanche(i) {
        const { mem } = this;
        mem.copy(i, T1$1).right(T1$1, 33);
        mem.xor(i, mem.hi(T1$1), mem.lo(T1$1)).multiply(i, P.hi(P2), P.lo(P2));
        mem.copy(i, T1$1).right(T1$1, 29);
        mem.xor(i, mem.hi(T1$1), mem.lo(T1$1)).multiply(i, P.hi(P3), P.lo(P3));
        mem.copy(i, T1$1).right(T1$1, 32);
        mem.xor(i, mem.hi(T1$1), mem.lo(T1$1));
    }
}

const PRIME32_1 = 0x9e3779b1;
const PRIME32_2 = 0x85ebca77;
const PRIME32_3 = 0xc2b2ae3d;
const PRIME64_1_0 = 0x9e3779b1;
const PRIME64_1_1 = 0x85ebca87;
const PRIME64_2_0 = 0xc2b2ae3d;
const PRIME64_2_1 = 0x27d4eb4f;
const PRIME64_3_0 = 0x165667b1;
const PRIME64_3_1 = 0x9e3779f9;
const PRIME64_4_0 = 0x85ebca77;
const PRIME64_4_1 = 0xc2b2ae63;
const PRIME64_5_0 = 0x27d4eb2f;
const PRIME64_5_1 = 0x165667c5;
const PRIME_MX1_0 = 0x16566791;
const PRIME_MX1_1 = 0x9e3779f9;
const PRIME_MX2_0 = 0x9fb21c65;
const PRIME_MX2_1 = 0x1e98df25;
const DEFAULT_SECRET = new Uint8Array([
    0xb8, 0xfe, 0x6c, 0x39, 0x23, 0xa4, 0x4b, 0xbe, 0x7c, 0x01, 0x81, 0x2c, 0xf7, 0x21, 0xad, 0x1c, 0xde, 0xd4, 0x6d,
    0xe9, 0x83, 0x90, 0x97, 0xdb, 0x72, 0x40, 0xa4, 0xa4, 0xb7, 0xb3, 0x67, 0x1f, 0xcb, 0x79, 0xe6, 0x4e, 0xcc, 0xc0,
    0xe5, 0x78, 0x82, 0x5a, 0xd0, 0x7d, 0xcc, 0xff, 0x72, 0x21, 0xb8, 0x08, 0x46, 0x74, 0xf7, 0x43, 0x24, 0x8e, 0xe0,
    0x35, 0x90, 0xe6, 0x81, 0x3a, 0x26, 0x4c, 0x3c, 0x28, 0x52, 0xbb, 0x91, 0xc3, 0x00, 0xcb, 0x88, 0xd0, 0x65, 0x8b,
    0x1b, 0x53, 0x2e, 0xa3, 0x71, 0x64, 0x48, 0x97, 0xa2, 0x0d, 0xf9, 0x4e, 0x38, 0x19, 0xef, 0x46, 0xa9, 0xde, 0xac,
    0xd8, 0xa8, 0xfa, 0x76, 0x3f, 0xe3, 0x9c, 0x34, 0x3f, 0xf9, 0xdc, 0xbb, 0xc7, 0xc7, 0x0b, 0x4f, 0x1d, 0x8a, 0x51,
    0xe0, 0x4b, 0xcd, 0xb4, 0x59, 0x31, 0xc8, 0x9f, 0x7e, 0xc9, 0xd9, 0x78, 0x73, 0x64, 0xea, 0xc5, 0xac, 0x83, 0x34,
    0xd3, 0xeb, 0xc3, 0xc5, 0x81, 0xa0, 0xff, 0xfa, 0x13, 0x63, 0xeb, 0x17, 0x0d, 0xdd, 0x51, 0xb7, 0xf0, 0xda, 0x49,
    0xd3, 0x16, 0x55, 0x26, 0x29, 0xd4, 0x68, 0x9e, 0x2b, 0x16, 0xbe, 0x58, 0x7d, 0x47, 0xa1, 0xfc, 0x8f, 0xf8, 0xb8,
    0xd1, 0x7a, 0xd0, 0x31, 0xce, 0x45, 0xcb, 0x3a, 0x8f, 0x95, 0x16, 0x04, 0x28, 0xaf, 0xd7, 0xfb, 0xca, 0xbb, 0x4b,
    0x40, 0x7e,
]);
const SEED = 0;
const ACC = 1;
const T0 = 9;
const T1 = 10;
const T2 = 11;
const T3 = 12;
const T4 = 13;
const T5 = 14;
const T6 = 15;
const SECRET_LENGTH = 192;
const STRIPES_PER_BLOCK = (SECRET_LENGTH - 64) / 8;
const BLOCK_SIZE = 64 * STRIPES_PER_BLOCK;
function readU32LE(b, offset) {
    const o = offset;
    return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | ((b[o + 3] << 24) >>> 0)) >>> 0;
}
function readU64LE(b, offset) {
    const o = offset;
    const r1 = (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | ((b[o + 3] << 24) >>> 0)) >>> 0;
    const r0 = (b[o + 4] | (b[o + 5] << 8) | (b[o + 6] << 16) | ((b[o + 7] << 24) >>> 0)) >>> 0;
    return [r0, r1];
}
function bswap32(x) {
    return (((x & 0xff) << 24) | (((x >>> 8) & 0xff) << 16) | (((x >>> 16) & 0xff) << 8) | ((x >>> 24) & 0xff)) >>> 0;
}
class Xxh3 {
    mem;
    seed0 = 0;
    seed1 = 0;
    secret = DEFAULT_SECRET;
    dvBuffer = null;
    dataView = null;
    blockBuffer = new Uint8Array(BLOCK_SIZE);
    bufferIndex = 0;
    byteCount = 0;
    prevTail = new Uint8Array(64);
    hasPrevTail = false;
    streaming = false;
    constructor(slots, seed0 = 0, seed1 = 0) {
        this.mem = U64.create(slots);
        this.seed0 = seed0;
        this.seed1 = seed1;
        this.mem.write(SEED, seed0, seed1);
        if (seed0 !== 0 || seed1 !== 0) {
            this.secret = this.deriveSecret();
        }
    }
    update(chunk) {
        if (chunk.byteLength === 0) {
            return;
        }
        this.byteCount += chunk.byteLength;
        let offset = 0;
        const space = BLOCK_SIZE - this.bufferIndex;
        if (chunk.byteLength <= space) {
            this.blockBuffer.set(chunk, this.bufferIndex);
            this.bufferIndex += chunk.byteLength;
            return;
        }
        if (this.bufferIndex > 0) {
            this.blockBuffer.set(chunk.subarray(0, space), this.bufferIndex);
            this.processFullBlock(this.blockBuffer);
            this.bufferIndex = 0;
            offset = space;
        }
        while (offset + BLOCK_SIZE < chunk.byteLength) {
            this.processFullBlock(chunk.subarray(offset, offset + BLOCK_SIZE));
            offset += BLOCK_SIZE;
        }
        const remaining = chunk.byteLength - offset;
        if (remaining > 0) {
            this.blockBuffer.set(chunk.subarray(offset), 0);
            this.bufferIndex = remaining;
        }
    }
    reset() {
        this.byteCount = 0;
        this.bufferIndex = 0;
        this.streaming = false;
        this.hasPrevTail = false;
        this.dvBuffer = null;
        this.dataView = null;
    }
    getBufferedInput() {
        return this.blockBuffer.subarray(0, this.bufferIndex);
    }
    finalizeLargeAccumulators() {
        if (!this.streaming) {
            this.initAccumulators();
            this.processLastBlock(this.blockBuffer, this.bufferIndex);
            return;
        }
        this.processLastBlock(this.blockBuffer, this.bufferIndex);
    }
    initAccumulators() {
        const { mem } = this;
        mem.write(ACC + 0, 0, PRIME32_3);
        mem.write(ACC + 1, PRIME64_1_0, PRIME64_1_1);
        mem.write(ACC + 2, PRIME64_2_0, PRIME64_2_1);
        mem.write(ACC + 3, PRIME64_3_0, PRIME64_3_1);
        mem.write(ACC + 4, PRIME64_4_0, PRIME64_4_1);
        mem.write(ACC + 5, 0, PRIME32_2);
        mem.write(ACC + 6, PRIME64_5_0, PRIME64_5_1);
        mem.write(ACC + 7, 0, PRIME32_1);
    }
    accumulateStripe(input, stripeOffset, secretOffset) {
        const { mem } = this;
        const secret = this.secret;
        const idv = this.view(input);
        const sdv = this.view(secret);
        for (let i = 0; i < 8; i++) {
            const off = i * 8;
            const d1 = idv.getUint32(stripeOffset + off, true);
            const d0 = idv.getUint32(stripeOffset + off + 4, true);
            const s1 = sdv.getUint32(secretOffset + off, true);
            const s0 = sdv.getUint32(secretOffset + off + 4, true);
            const val0 = (d0 ^ s0) >>> 0;
            const val1 = (d1 ^ s1) >>> 0;
            mem.add(ACC + (i ^ 1), d0, d1);
            mem.addProduct(ACC + i, val0, val1);
        }
    }
    roundScramble() {
        const { mem } = this;
        const secret = this.secret;
        const view = this.view(secret);
        for (let i = 0; i < 8; i++) {
            const off = SECRET_LENGTH - 64 + i * 8;
            const s1 = view.getUint32(off, true);
            const s0 = view.getUint32(off + 4, true);
            mem.copy(ACC + i, T1).right(T1, 47);
            mem.xor(ACC + i, mem.hi(T1), mem.lo(T1));
            mem.xor(ACC + i, s0, s1);
            mem.multiply(ACC + i, 0, PRIME32_1);
        }
    }
    finalMerge(init0, init1, secretOffset) {
        const { mem } = this;
        const secret = this.secret;
        mem.write(T0, init0, init1);
        for (let i = 0; i < 4; i++) {
            const [s00, s01] = readU64LE(secret, secretOffset + i * 16);
            const [s10, s11] = readU64LE(secret, secretOffset + i * 16 + 8);
            mem.copy(ACC + i * 2, T1).xor(T1, s00, s01);
            mem.copy(ACC + i * 2 + 1, T2).xor(T2, s10, s11);
            mem.multiply128(T1, T2, T4, T3);
            mem.xor(T3, mem.hi(T4), mem.lo(T4));
            mem.add(T0, mem.hi(T3), mem.lo(T3));
        }
        this.avalanche(T0, mem.hi(T0), mem.lo(T0));
        return mem.toBytes(T0);
    }
    mix(data, dataOffset, secretOffset) {
        const { mem } = this;
        const secret = this.secret;
        const [d00, d01] = readU64LE(data, dataOffset);
        const [d10, d11] = readU64LE(data, dataOffset + 8);
        const [s00, s01] = readU64LE(secret, secretOffset);
        const [s10, s11] = readU64LE(secret, secretOffset + 8);
        mem.write(T5, s00, s01).add(T5, this.seed0, this.seed1);
        mem.write(T6, s10, s11).subtract(T6, this.seed0, this.seed1);
        mem.write(T5, (d00 ^ mem.hi(T5)) >>> 0, (d01 ^ mem.lo(T5)) >>> 0);
        mem.write(T6, (d10 ^ mem.hi(T6)) >>> 0, (d11 ^ mem.lo(T6)) >>> 0);
        mem.multiply128(T5, T6, T4, T3);
        mem.xor(T3, mem.hi(T4), mem.lo(T4));
        return T3;
    }
    avalanche(i, v0, v1) {
        const { mem } = this;
        mem.write(i, v0, v1);
        mem.copy(i, T3).right(T3, 37);
        mem.xor(i, mem.hi(T3), mem.lo(T3));
        mem.multiply(i, PRIME_MX1_0, PRIME_MX1_1);
        mem.copy(i, T3).right(T3, 32);
        mem.xor(i, mem.hi(T3), mem.lo(T3));
    }
    avalanche64(i, v0, v1) {
        const { mem } = this;
        mem.write(i, v0, v1);
        mem.copy(i, T3).right(T3, 33);
        mem.xor(i, mem.hi(T3), mem.lo(T3));
        mem.multiply(i, PRIME64_2_0, PRIME64_2_1);
        mem.copy(i, T3).right(T3, 29);
        mem.xor(i, mem.hi(T3), mem.lo(T3));
        mem.multiply(i, PRIME64_3_0, PRIME64_3_1);
        mem.copy(i, T3).right(T3, 32);
        mem.xor(i, mem.hi(T3), mem.lo(T3));
    }
    deriveSecret() {
        const { mem } = this;
        const derived = new Uint8Array(DEFAULT_SECRET);
        const dv = new DataView(derived.buffer);
        for (let i = 0; i < 12; i++) {
            const off = i * 16;
            const v1 = dv.getUint32(off, true);
            const v0 = dv.getUint32(off + 4, true);
            mem.write(T0, v0, v1).add(T0, this.seed0, this.seed1);
            dv.setUint32(off, mem.lo(T0), true);
            dv.setUint32(off + 4, mem.hi(T0), true);
            const w1 = dv.getUint32(off + 8, true);
            const w0 = dv.getUint32(off + 12, true);
            mem.write(T0, w0, w1).subtract(T0, this.seed0, this.seed1);
            dv.setUint32(off + 8, mem.lo(T0), true);
            dv.setUint32(off + 12, mem.hi(T0), true);
        }
        return derived;
    }
    view(b) {
        if (b.buffer !== this.dvBuffer) {
            this.dvBuffer = b.buffer;
            this.dataView = new DataView(b.buffer, b.byteOffset, b.byteLength);
        }
        return this.dataView;
    }
    processFullBlock(block) {
        if (!this.streaming) {
            this.streaming = true;
            this.initAccumulators();
        }
        for (let n = 0; n < STRIPES_PER_BLOCK; n++) {
            this.accumulateStripe(block, n * 64, n * 8);
        }
        this.roundScramble();
        this.prevTail.set(block.subarray(BLOCK_SIZE - 64, BLOCK_SIZE));
        this.hasPrevTail = true;
    }
    processLastBlock(data, len) {
        const nFullStripes = Math.floor((len - 1) / 64);
        for (let n = 0; n < nFullStripes; ++n) {
            this.accumulateStripe(data, n * 64, n * 8);
        }
        if (len < 64 && this.hasPrevTail) {
            const window = new Uint8Array(64);
            const fromPrev = 64 - len;
            window.set(this.prevTail.subarray(64 - fromPrev), 0);
            window.set(data.subarray(0, len), fromPrev);
            this.accumulateStripe(window, 0, SECRET_LENGTH - 71);
        }
        else {
            this.accumulateStripe(data, len - 64, SECRET_LENGTH - 71);
        }
    }
}

class Xxh3_64 extends Xxh3 {
    digestLength = 8;
    constructor() {
        super(17, 0, 0);
    }
    async digest() {
        const len = this.byteCount;
        if (len <= 240) {
            const input = this.getBufferedInput();
            if (len <= 16) {
                return this.digestSmall(input, len);
            }
            return this.digestMedium(input, len);
        }
        return this.digestLarge(len);
    }
    digestSmall(input, len) {
        const { mem } = this;
        const secret = this.secret;
        if (len === 0) {
            const [s00, s01] = readU64LE(secret, 56);
            const [s10, s11] = readU64LE(secret, 64);
            mem.write(T0, s00 ^ s10, (s01 ^ s11) >>> 0).xor(T0, this.seed0, this.seed1);
            this.avalanche64(T0, mem.hi(T0), mem.lo(T0));
            return mem.toBytes(T0);
        }
        if (len <= 3) {
            const combined = (input[len - 1] | (len << 8) | (input[0] << 16) | ((input[len >> 1] << 24) >>> 0)) >>> 0;
            const s0 = readU32LE(secret, 0);
            const s1 = readU32LE(secret, 4);
            mem
                .write(T0, 0, (s0 ^ s1) >>> 0)
                .add(T0, this.seed0, this.seed1)
                .xor(T0, 0, combined);
            this.avalanche64(T0, mem.hi(T0), mem.lo(T0));
            return mem.toBytes(T0);
        }
        if (len <= 8) {
            const inputFirst = readU32LE(input, 0);
            const inputLast = readU32LE(input, len - 4);
            const modSeed0 = (this.seed0 ^ bswap32(this.seed1)) >>> 0;
            const [s00, s01] = readU64LE(secret, 8);
            const [s10, s11] = readU64LE(secret, 16);
            mem
                .write(T0, (s00 ^ s10) >>> 0, (s01 ^ s11) >>> 0)
                .subtract(T0, modSeed0, this.seed1)
                .xor(T0, inputFirst, inputLast);
            mem.copy(T0, T1).rotateLeft(T1, 49);
            mem.copy(T0, T2).rotateLeft(T2, 24);
            mem.xor(T0, mem.hi(T1), mem.lo(T1)).xor(T0, mem.hi(T2), mem.lo(T2));
            mem.multiply(T0, PRIME_MX2_0, PRIME_MX2_1);
            mem.copy(T0, T1).right(T1, 35).add(T1, 0, len);
            mem.xor(T0, mem.hi(T1), mem.lo(T1));
            mem.multiply(T0, PRIME_MX2_0, PRIME_MX2_1);
            mem.copy(T0, T1).right(T1, 28);
            mem.xor(T0, mem.hi(T1), mem.lo(T1));
            return mem.toBytes(T0);
        }
        const [if0, if1] = readU64LE(input, 0);
        const [il0, il1] = readU64LE(input, len - 8);
        const [s00, s01] = readU64LE(secret, 24);
        const [s10, s11] = readU64LE(secret, 32);
        const [s20, s21] = readU64LE(secret, 40);
        const [s30, s31] = readU64LE(secret, 48);
        mem
            .write(T0, (s00 ^ s10) >>> 0, (s01 ^ s11) >>> 0)
            .add(T0, this.seed0, this.seed1)
            .xor(T0, if0, if1);
        mem
            .write(T1, (s20 ^ s30) >>> 0, (s21 ^ s31) >>> 0)
            .subtract(T1, this.seed0, this.seed1)
            .xor(T1, il0, il1);
        mem.multiply128(T0, T1, T3, T2);
        mem.write(T4, 0, len);
        mem.add(T4, bswap32(mem.lo(T0)), bswap32(mem.hi(T0))).add(T4, mem.hi(T1), mem.lo(T1));
        mem.copy(T2, T0).xor(T0, mem.hi(T3), mem.lo(T3));
        mem.add(T4, mem.hi(T0), mem.lo(T0));
        this.avalanche(T0, mem.hi(T4), mem.lo(T4));
        return mem.toBytes(T0);
    }
    digestMedium(input, len) {
        const { mem } = this;
        mem.write(T0, 0, len).multiply(T0, PRIME64_1_0, PRIME64_1_1);
        if (len <= 128) {
            const numRounds = ((len - 1) >> 5) + 1;
            for (let i = numRounds - 1; i >= 0; i--) {
                const ms1 = this.mix(input, i * 16, i * 32);
                mem.add(T0, mem.hi(ms1), mem.lo(ms1));
                const ms2 = this.mix(input, len - i * 16 - 16, i * 32 + 16);
                mem.add(T0, mem.hi(ms2), mem.lo(ms2));
            }
            this.avalanche(T0, mem.hi(T0), mem.lo(T0));
            return mem.toBytes(T0);
        }
        for (let i = 0; i < 8; i++) {
            const mix = this.mix(input, i * 16, i * 16);
            mem.add(T0, mem.hi(mix), mem.lo(mix));
        }
        this.avalanche(T0, mem.hi(T0), mem.lo(T0));
        const numChunks = len >> 4;
        for (let i = 8; i < numChunks; i++) {
            const ms = this.mix(input, i * 16, (i - 8) * 16 + 3);
            mem.add(T0, mem.hi(ms), mem.lo(ms));
        }
        const ms = this.mix(input, len - 16, 119);
        mem.add(T0, mem.hi(ms), mem.lo(ms));
        this.avalanche(T0, mem.hi(T0), mem.lo(T0));
        return mem.toBytes(T0);
    }
    digestLarge(len) {
        const { mem } = this;
        this.finalizeLargeAccumulators();
        mem.write(T0, 0, len).multiply(T0, PRIME64_1_0, PRIME64_1_1);
        return this.finalMerge(mem.hi(T0), mem.lo(T0), 11);
    }
}

class Xxh3_128 extends Xxh3 {
    digestLength = 16;
    constructor() {
        super(17, 0, 0);
    }
    async digest() {
        const len = this.byteCount;
        if (len <= 240) {
            const input = this.getBufferedInput();
            if (len <= 16) {
                return this.digestSmall(input, len);
            }
            return this.digestMedium(input, len);
        }
        return this.digestLarge(len);
    }
    concat(i, j) {
        const result = new Uint8Array(16);
        result.set(this.mem.toBytes(i), 0);
        result.set(this.mem.toBytes(j), 8);
        return result;
    }
    digestSmall(input, len) {
        const { mem } = this;
        const secret = this.secret;
        if (len === 0) {
            const [s00, s01] = readU64LE(secret, 64);
            const [s10, s11] = readU64LE(secret, 72);
            const [s20, s21] = readU64LE(secret, 80);
            const [s30, s31] = readU64LE(secret, 88);
            this.avalanche64(T0, ((s00 ^ s10) >>> 0) ^ this.seed0, ((s01 ^ s11) >>> 0) ^ this.seed1);
            this.avalanche64(T1, ((s20 ^ s30) >>> 0) ^ this.seed0, ((s21 ^ s31) >>> 0) ^ this.seed1);
            return this.concat(T1, T0);
        }
        if (len <= 3) {
            const combined = (input[len - 1] | (len << 8) | (input[0] << 16) | ((input[len >> 1] << 24) >>> 0)) >>> 0;
            const s0 = readU32LE(secret, 0);
            const s1 = readU32LE(secret, 4);
            const s2 = readU32LE(secret, 8);
            const s3 = readU32LE(secret, 12);
            mem
                .write(T0, 0, (s0 ^ s1) >>> 0)
                .add(T0, this.seed0, this.seed1)
                .xor(T0, 0, combined);
            this.avalanche64(T0, mem.hi(T0), mem.lo(T0));
            const bsc = bswap32(combined);
            const rotated = ((bsc << 13) | (bsc >>> 19)) >>> 0;
            mem
                .write(T1, 0, (s2 ^ s3) >>> 0)
                .subtract(T1, this.seed0, this.seed1)
                .xor(T1, 0, rotated);
            this.avalanche64(T1, mem.hi(T1), mem.lo(T1));
            return this.concat(T1, T0);
        }
        if (len <= 8) {
            const inputFirst = readU32LE(input, 0);
            const inputLast = readU32LE(input, len - 4);
            const modSeed0 = (this.seed0 ^ bswap32(this.seed1)) >>> 0;
            const [s00, s01] = readU64LE(secret, 16);
            const [s10, s11] = readU64LE(secret, 24);
            mem
                .write(T0, (s00 ^ s10) >>> 0, (s01 ^ s11) >>> 0)
                .add(T0, modSeed0, this.seed1)
                .xor(T0, inputLast, inputFirst);
            mem.write(T1, PRIME64_1_0, PRIME64_1_1).add(T1, 0, len << 2);
            mem.multiply128(T0, T1, T3, T2);
            mem.copy(T2, T4).left(T4, 1);
            mem.copy(T3, T5).add(T5, mem.hi(T4), mem.lo(T4));
            mem.copy(T5, T4).right(T4, 3);
            mem.xor(T2, mem.hi(T4), mem.lo(T4));
            mem.copy(T2, T4).right(T4, 35);
            mem.xor(T2, mem.hi(T4), mem.lo(T4));
            mem.multiply(T2, PRIME_MX2_0, PRIME_MX2_1);
            mem.copy(T2, T4).right(T4, 28);
            mem.xor(T2, mem.hi(T4), mem.lo(T4));
            this.avalanche(T5, mem.hi(T5), mem.lo(T5));
            return this.concat(T5, T2);
        }
        const [if0, if1] = readU64LE(input, 0);
        const [il0, il1] = readU64LE(input, len - 8);
        const [s00, s01] = readU64LE(secret, 32);
        const [s10, s11] = readU64LE(secret, 40);
        const [s20, s21] = readU64LE(secret, 48);
        const [s30, s31] = readU64LE(secret, 56);
        mem
            .write(T0, (s00 ^ s10) >>> 0, (s01 ^ s11) >>> 0)
            .subtract(T0, this.seed0, this.seed1)
            .xor(T0, if0, if1)
            .xor(T0, il0, il1);
        mem
            .write(T1, (s20 ^ s30) >>> 0, (s21 ^ s31) >>> 0)
            .add(T1, this.seed0, this.seed1)
            .xor(T1, il0, il1);
        mem.write(T2, PRIME64_1_0, PRIME64_1_1);
        mem.multiply128(T0, T2, T4, T3);
        mem.add(T3, ((len - 1) << (54 - 32)) >>> 0, 0);
        mem.add(T4, mem.hi(T1), mem.lo(T1));
        mem.write(T5, 0, mem.lo(T1)).multiply(T5, 0, (PRIME32_2 - 1) >>> 0);
        mem.add(T4, mem.hi(T5), mem.lo(T5));
        mem.xor(T3, bswap32(mem.lo(T4)), bswap32(mem.hi(T4)));
        mem.write(T5, PRIME64_2_0, PRIME64_2_1);
        mem.multiply128(T3, T5, T6, T0);
        mem.multiply(T4, PRIME64_2_0, PRIME64_2_1);
        mem.add(T6, mem.hi(T4), mem.lo(T4));
        this.avalanche(T0, mem.hi(T0), mem.lo(T0));
        this.avalanche(T6, mem.hi(T6), mem.lo(T6));
        return this.concat(T6, T0);
    }
    digestMedium(input, len) {
        const { mem } = this;
        mem.write(T0, 0, len).multiply(T0, PRIME64_1_0, PRIME64_1_1);
        mem.write(T1, 0, 0);
        if (len <= 128) {
            const numRounds = ((len - 1) >> 5) + 1;
            for (let i = numRounds - 1; i >= 0; i--) {
                this.mixTwoChunks(input, i * 16, len - i * 16 - 16, i * 32);
            }
        }
        else {
            for (let i = 0; i < 4; i++) {
                this.mixTwoChunks(input, i * 32, i * 32 + 16, i * 32);
            }
            this.avalanche(T0, mem.hi(T0), mem.lo(T0));
            this.avalanche(T1, mem.hi(T1), mem.lo(T1));
            const numChunks = len >> 5;
            for (let i = 4; i < numChunks; i++) {
                this.mixTwoChunks(input, i * 32, i * 32 + 16, (i - 4) * 32 + 3);
            }
            const sv0 = this.seed0, sv1 = this.seed1;
            this.seed0 = (0 - sv0 - (sv1 > 0 ? 1 : 0)) >>> 0;
            this.seed1 = (0 - sv1) >>> 0;
            this.mixTwoChunks(input, len - 16, len - 32, 103);
            this.seed0 = sv0;
            this.seed1 = sv1;
        }
        const low0 = mem.hi(T0), low1 = mem.lo(T0);
        const high0 = mem.hi(T1), high1 = mem.lo(T1);
        mem.write(T2, low0, low1).add(T2, high0, high1);
        mem.write(T3, low0, low1).multiply(T3, PRIME64_1_0, PRIME64_1_1);
        mem.write(T4, high0, high1).multiply(T4, PRIME64_4_0, PRIME64_4_1);
        mem.add(T3, mem.hi(T4), mem.lo(T4));
        mem.write(T4, 0, len).subtract(T4, this.seed0, this.seed1).multiply(T4, PRIME64_2_0, PRIME64_2_1);
        mem.add(T3, mem.hi(T4), mem.lo(T4));
        const saved0 = mem.hi(T3), saved1 = mem.lo(T3);
        this.avalanche(T2, mem.hi(T2), mem.lo(T2));
        this.avalanche(T4, saved0, saved1);
        mem.write(T5, 0, 0).subtract(T5, mem.hi(T4), mem.lo(T4));
        return this.concat(T5, T2);
    }
    mixTwoChunks(data, offset0, offset1, secretOffset) {
        const { mem } = this;
        const [d100, d101] = readU64LE(data, offset0);
        const [d110, d111] = readU64LE(data, offset0 + 8);
        const [d200, d201] = readU64LE(data, offset1);
        const [d210, d211] = readU64LE(data, offset1 + 8);
        const ms1 = this.mix(data, offset0, secretOffset);
        mem.add(T0, mem.hi(ms1), mem.lo(ms1));
        const ms2 = this.mix(data, offset1, secretOffset + 16);
        mem.add(T1, mem.hi(ms2), mem.lo(ms2));
        mem.write(T5, d200, d201).add(T5, d210, d211);
        mem.xor(T0, mem.hi(T5), mem.lo(T5));
        mem.write(T5, d100, d101).add(T5, d110, d111);
        mem.xor(T1, mem.hi(T5), mem.lo(T5));
    }
    digestLarge(len) {
        const { mem } = this;
        this.finalizeLargeAccumulators();
        mem.write(T0, 0, len).multiply(T0, PRIME64_1_0, PRIME64_1_1);
        const lowBytes = this.finalMerge(mem.hi(T0), mem.lo(T0), 11);
        mem.write(T0, 0, len).multiply(T0, PRIME64_2_0, PRIME64_2_1);
        mem.write(T1, 0xffffffff, 0xffffffff).xor(T1, mem.hi(T0), mem.lo(T0));
        const highBytes = this.finalMerge(mem.hi(T1), mem.lo(T1), SECRET_LENGTH - 75);
        const result = new Uint8Array(16);
        result.set(highBytes, 0);
        result.set(lowBytes, 8);
        return result;
    }
}

exports.Xxh3_128 = Xxh3_128;
exports.Xxh3_128Js = Xxh3_128;
exports.Xxh3_64 = Xxh3_64;
exports.Xxh3_64Js = Xxh3_64;
exports.Xxh64 = Xxh64;
exports.Xxh64Js = Xxh64;
