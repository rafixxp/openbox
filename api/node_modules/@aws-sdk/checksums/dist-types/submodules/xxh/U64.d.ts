/**
 * @internal
 */
export type u32 = number;
/**
 * Larger (left) 32 bits of a u64.
 * @internal
 */
export type u64_l = u32;
/**
 * Low (right) 32 bits of a u64.
 * @internal
 */
export type u64_r = u32;
/**
 * @internal
 */
export type index = number;
/**
 * @internal
 */
export type distance = number;
/**
 * @internal
 */
export type size = number;
/**
 * 8-bit mask.
 * @internal
 */
export declare const m8 = 255;
/**
 * 16-bit mask.
 * @internal
 */
export declare const m16 = 65535;
/**
 * 32-bit mask.
 * @internal
 */
export declare const m32 = 4294967295;
/**
 * Fixed-length allocation of u64 values stored as pairs of u32 in a Uint32Array.
 * Slot i occupies indices [i*2, i*2+1] where [0]=high bits, [1]=low bits.
 *
 * @internal
 */
export declare class U64 extends Uint32Array {
    private constructor();
    /**
     * Creates a U64
     *
     * @param size - number of U32 pairs.
     */
    static create(size: index): U64;
    /**
     * Set pair at slot i.
     */
    write(i: index, v0: u64_l, v1: u64_r): U64;
    /**
     * Copy pair from slot source to target.
     */
    copy(source: index, target: index): U64;
    /**
     * Add in-place at [i].
     */
    add(i: index, v0: u64_l, v1: u64_r): U64;
    /**
     * Multiply in-place at [i].
     */
    multiply(i: index, v0: u64_l, v1: u64_r): U64;
    /**
     * [i] += a * b.
     */
    addProduct(i: index, a: u32, b: u32): U64;
    /**
     * 64×64→128-bit multiplication.
     * Multiplies slot `i` by slot `j`, stores high 64 bits in `t` and low 64 bits in `u`.
     */
    multiply128(i: index, j: index, t: index, u: index): U64;
    /**
     * Subtract in-place at [i].
     */
    subtract(i: index, v0: u64_l, v1: u64_r): U64;
    /**
     * Left shift in-place at [i].
     */
    left(i: index, places: distance): U64;
    /**
     * Rotate left (circular shift) at [i].
     */
    rotateLeft(i: index, places: distance): U64;
    /**
     * Right shift in-place at [i].
     */
    right(i: index, places: distance): U64;
    /**
     * XOR in-place at [i].
     */
    xor(i: index, v0: u64_l, v1: u64_r): U64;
    toBytes(i: index): Uint8Array;
    /**
     * Read the high 32 bits of slot i.
     */
    hi(i: index): u64_l;
    /**
     * Read the low 32 bits of slot i.
     */
    lo(i: index): u64_r;
}
