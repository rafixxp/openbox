import type { Checksum } from "@smithy/types";
/**
 * @see https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md#xxh64-algorithm-description
 * @internal
 */
export declare class Xxh64 implements Checksum {
    readonly digestLength = 8;
    private byteCount;
    private mem;
    private stripeBuffer;
    private bufferIndex;
    constructor();
    update(chunk: Uint8Array): void;
    private _update;
    digest(): Promise<Uint8Array>;
    /**
     * Resets accumulators to their initial seeded state.
     * Used in step 1: initialize.
     */
    reset(): void;
    /**
     * Processes a 32-byte stripe through the four accumulators.
     * Used in step 2: accumulate.
     */
    private processStripe;
    /**
     * Merges an accumulator into the final hash value.
     * Used in step 3: merge.
     */
    private mergeAcc;
    /**
     * round: acc += (lane * P2); acc <<<= 31; acc *= P1;
     * Used in step 2: accumulate.
     */
    private roundAt;
    /**
     * Final bit mixing to ensure good distribution.
     * Used in step 4: avalanche.
     */
    private avalanche;
}
