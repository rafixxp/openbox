import type { index, size, u32, u64_l, u64_r } from "./U64";
import { U64 } from "./U64";
export declare const PRIME32_1 = 2654435761;
export declare const PRIME32_2 = 2246822519;
export declare const PRIME32_3 = 3266489917;
export declare const PRIME64_1_0 = 2654435761;
export declare const PRIME64_1_1 = 2246822535;
export declare const PRIME64_2_0 = 3266489917;
export declare const PRIME64_2_1 = 668265295;
export declare const PRIME64_3_0 = 374761393;
export declare const PRIME64_3_1 = 2654435833;
export declare const PRIME64_4_0 = 2246822519;
export declare const PRIME64_4_1 = 3266489955;
export declare const PRIME64_5_0 = 668265263;
export declare const PRIME64_5_1 = 374761413;
export declare const PRIME_MX1_0 = 374761361;
export declare const PRIME_MX1_1 = 2654435833;
export declare const PRIME_MX2_0 = 2679250021;
export declare const PRIME_MX2_1 = 513335077;
export declare const DEFAULT_SECRET: Uint8Array;
/** Slot layout: 0=seed, 1..8=acc[0..7], 9..16=scratch temps */
export declare const SEED = 0;
export declare const ACC = 1;
export declare const T0 = 9;
export declare const T1 = 10;
export declare const T2 = 11;
export declare const T3 = 12;
export declare const T4 = 13;
export declare const T5 = 14;
export declare const T6 = 15;
export declare const SECRET_LENGTH = 192;
export declare const STRIPES_PER_BLOCK: number;
export declare const BLOCK_SIZE: number;
/**
 * Reads a 32-bit unsigned integer from a byte array in little-endian order.
 * @internal
 */
export declare function readU32LE(b: Uint8Array, offset: index): u32;
/**
 * Reads a 64-bit unsigned integer from a byte array in little-endian order.
 * @internal
 */
export declare function readU64LE(b: Uint8Array, offset: index): [u64_l, u64_r];
/**
 * Reverses the bytes in [x].
 * @internal
 */
export declare function bswap32(x: u32): u32;
/**
 * @internal
 */
export declare abstract class Xxh3 {
    protected mem: U64;
    protected seed0: u64_l;
    protected seed1: u64_r;
    protected secret: Uint8Array;
    private dvBuffer;
    private dataView;
    /**
     * Fixed-size buffer (BLOCK_SIZE = 1024 bytes).
     * For inputs lte 240 bytes, holds the entire input for small/medium paths.
     * In streaming mode, buffers the latest block. Complete blocks
     * are processed immediately. The partial tail is kept for finalization
     * during digest.
     */
    protected blockBuffer: Uint8Array;
    protected bufferIndex: number;
    protected byteCount: number;
    private prevTail;
    private hasPrevTail;
    /**
     * This mode can be entered but not exited.
     */
    protected streaming: boolean;
    protected constructor(slots: size, seed0?: number, seed1?: number);
    update(chunk: Uint8Array): void;
    reset(): void;
    /**
     * Returns the buffered input for small/medium paths (byteCount lte 240).
     * Only valid when not entered into streaming mode.
     */
    protected getBufferedInput(): Uint8Array;
    /**
     * Finalizes the large (over 240 bytes) streaming path.
     * Processes the remaining buffered data as the last (partial) block.
     */
    protected finalizeLargeAccumulators(): void;
    /**
     * Used in step 1: initialize.
     */
    protected initAccumulators(): void;
    /**
     * Used in step 2: accumulate.
     */
    protected accumulateStripe(input: Uint8Array, stripeOffset: index, secretOffset: index): void;
    /**
     * Used in step 3: scramble.
     */
    protected roundScramble(): void;
    /**
     * Used in step 4: merge.
     */
    protected finalMerge(init0: u64_l, init1: u64_r, secretOffset: index): Uint8Array;
    /**
     * Mixes two 64-bit input lanes with secret-derived keys.
     * Used in step 2: accumulate (medium-length path, 17–240 bytes).
     */
    protected mix(data: Uint8Array, dataOffset: index, secretOffset: index): index;
    /**
     * avalanche(x): x ^= x >> 37; x *= PRIME_MX1; x ^= x >> 32; Result in `i`.
     * Used in step 5: avalanche.
     */
    protected avalanche(i: index, v0: u64_l, v1: u64_r): void;
    /**
     * avalanche_XXH64(x): x ^= x>>33; x *= P2; x ^= x>>29; x *= P3; x ^= x>>32; Result in `i`.
     * Used in step 5: avalanche.
     */
    protected avalanche64(i: index, v0: u64_l, v1: u64_r): void;
    /**
     * Derives a custom secret from the default secret and the seed.
     * Used in step 1: initialize.
     */
    protected deriveSecret(): Uint8Array;
    /**
     * Returns a cached DataView for the given Uint8Array's buffer.
     * Used in step 2: accumulate.
     */
    protected view(b: Uint8Array): DataView;
    /**
     * Processes a complete block of BLOCK_SIZE bytes through accumulation and scrambling.
     * Used in step 2: accumulate, and step 3: scramble.
     */
    private processFullBlock;
    /**
     * Processes the last (possibly partial) block.
     * Used in step 2: accumulate.
     */
    private processLastBlock;
}
