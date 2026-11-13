import { U64 } from "./U64";
export const PRIME32_1 = 0x9e3779b1;
export const PRIME32_2 = 0x85ebca77;
export const PRIME32_3 = 0xc2b2ae3d;
export const PRIME64_1_0 = 0x9e3779b1;
export const PRIME64_1_1 = 0x85ebca87;
export const PRIME64_2_0 = 0xc2b2ae3d;
export const PRIME64_2_1 = 0x27d4eb4f;
export const PRIME64_3_0 = 0x165667b1;
export const PRIME64_3_1 = 0x9e3779f9;
export const PRIME64_4_0 = 0x85ebca77;
export const PRIME64_4_1 = 0xc2b2ae63;
export const PRIME64_5_0 = 0x27d4eb2f;
export const PRIME64_5_1 = 0x165667c5;
export const PRIME_MX1_0 = 0x16566791;
export const PRIME_MX1_1 = 0x9e3779f9;
export const PRIME_MX2_0 = 0x9fb21c65;
export const PRIME_MX2_1 = 0x1e98df25;
export const DEFAULT_SECRET = new Uint8Array([
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
export const SEED = 0;
export const ACC = 1;
export const T0 = 9;
export const T1 = 10;
export const T2 = 11;
export const T3 = 12;
export const T4 = 13;
export const T5 = 14;
export const T6 = 15;
export const SECRET_LENGTH = 192;
export const STRIPES_PER_BLOCK = (SECRET_LENGTH - 64) / 8;
export const BLOCK_SIZE = 64 * STRIPES_PER_BLOCK;
export function readU32LE(b, offset) {
    const o = offset;
    return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | ((b[o + 3] << 24) >>> 0)) >>> 0;
}
export function readU64LE(b, offset) {
    const o = offset;
    const r1 = (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | ((b[o + 3] << 24) >>> 0)) >>> 0;
    const r0 = (b[o + 4] | (b[o + 5] << 8) | (b[o + 6] << 16) | ((b[o + 7] << 24) >>> 0)) >>> 0;
    return [r0, r1];
}
export function bswap32(x) {
    return (((x & 0xff) << 24) | (((x >>> 8) & 0xff) << 16) | (((x >>> 16) & 0xff) << 8) | ((x >>> 24) & 0xff)) >>> 0;
}
export class Xxh3 {
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
