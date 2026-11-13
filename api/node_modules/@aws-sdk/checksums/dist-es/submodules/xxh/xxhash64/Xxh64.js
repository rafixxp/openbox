import { m32, U64 } from "../U64";
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
const SEED = 0;
const ACC0 = 1;
const ACC1 = 2;
const ACC2 = 3;
const ACC3 = 4;
const T0 = 5;
const T1 = 6;
const T2 = 7;
export class Xxh64 {
    digestLength = 8;
    byteCount = 0;
    mem = U64.create(8);
    stripeBuffer = new Uint8Array(32);
    bufferIndex = 0;
    constructor() {
        this.mem.write(SEED, 0, 0);
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
        const m = T0;
        if (byteCount < 32) {
            mem.copy(SEED, m).add(m, P.hi(P5), P.lo(P5));
        }
        else {
            mem.copy(ACC0, T1).rotateLeft(T1, 1);
            mem.write(m, mem.hi(T1), mem.lo(T1));
            mem.copy(ACC1, T1).rotateLeft(T1, 7);
            mem.add(m, mem.hi(T1), mem.lo(T1));
            mem.copy(ACC2, T1).rotateLeft(T1, 12);
            mem.add(m, mem.hi(T1), mem.lo(T1));
            mem.copy(ACC3, T1).rotateLeft(T1, 18);
            mem.add(m, mem.hi(T1), mem.lo(T1));
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
            mem.write(T1, 0, 0);
            this.roundAt(T1, v0, v1);
            mem.xor(m, mem.hi(T1), mem.lo(T1)).rotateLeft(m, 27).multiply(m, P.hi(P1), P.lo(P1)).add(m, P.hi(P4), P.lo(P4));
            rem -= 8;
        }
        while (rem >= 4) {
            const lo = b[ptr++] | (b[ptr++] << 8) | (b[ptr++] << 16) | ((b[ptr++] << 24) >>> 0);
            mem.write(T1, 0, lo).multiply(T1, P.hi(P1), P.lo(P1));
            mem.xor(m, mem.hi(T1), mem.lo(T1)).rotateLeft(m, 23).multiply(m, P.hi(P2), P.lo(P2)).add(m, P.hi(P3), P.lo(P3));
            rem -= 4;
        }
        while (rem >= 1) {
            mem.write(T1, 0, b[ptr++]).multiply(T1, P.hi(P5), P.lo(P5));
            mem.xor(m, mem.hi(T1), mem.lo(T1)).rotateLeft(m, 11).multiply(m, P.hi(P1), P.lo(P1));
            rem -= 1;
        }
        this.avalanche(m);
        return mem.toBytes(m);
    }
    reset() {
        const { mem } = this;
        this.byteCount = 0;
        this.bufferIndex = 0;
        mem.copy(SEED, ACC0).add(ACC0, P.hi(P1_2), P.lo(P1_2));
        mem.copy(SEED, ACC1).add(ACC1, P.hi(P2), P.lo(P2));
        mem.copy(SEED, ACC2);
        mem.copy(SEED, ACC3).subtract(ACC3, P.hi(P1), P.lo(P1));
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
        mem.write(T1, 0, 0);
        this.roundAt(T1, mem.hi(acc), mem.lo(acc));
        mem.xor(m, mem.hi(T1), mem.lo(T1)).multiply(m, P.hi(P1), P.lo(P1)).add(m, P.hi(P4), P.lo(P4));
    }
    roundAt(i, v0, v1) {
        const { mem } = this;
        mem.write(T2, v0, v1).multiply(T2, P.hi(P2), P.lo(P2));
        mem.add(i, mem.hi(T2), mem.lo(T2)).rotateLeft(i, 31).multiply(i, P.hi(P1), P.lo(P1));
    }
    avalanche(i) {
        const { mem } = this;
        mem.copy(i, T1).right(T1, 33);
        mem.xor(i, mem.hi(T1), mem.lo(T1)).multiply(i, P.hi(P2), P.lo(P2));
        mem.copy(i, T1).right(T1, 29);
        mem.xor(i, mem.hi(T1), mem.lo(T1)).multiply(i, P.hi(P3), P.lo(P3));
        mem.copy(i, T1).right(T1, 32);
        mem.xor(i, mem.hi(T1), mem.lo(T1));
    }
}
