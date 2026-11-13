import type { Checksum } from "@smithy/types";
import { Xxh3 } from "../Xxh3";
/**
 * XXHASH3 128-bit.
 * @see https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md#xxh3-algorithm-overview
 * @internal
 */
export declare class Xxh3_128 extends Xxh3 implements Checksum {
    readonly digestLength = 16;
    constructor();
    digest(): Promise<Uint8Array>;
    /**
     * Concatenates two 64-bit slots into a 128-bit result.
     * Used in step 4: merge.
     */
    private concat;
    /**
     * Handles inputs of 0–16 bytes.
     * Used in steps 2–5: accumulate through avalanche (single-shot path).
     */
    private digestSmall;
    /**
     * Handles inputs of 17–240 bytes.
     * Used in steps 2–5: accumulate through avalanche (single-shot path).
     */
    private digestMedium;
    /**
     * Mixes two 16-byte chunks from the input and accumulates into T0 and T1.
     * Used in step 2: accumulate (medium-length path, 17–240 bytes).
     */
    private mixTwoChunks;
    /**
     * Handles inputs over 240 bytes via streaming accumulators.
     * Used in steps 2–5: accumulate through avalanche (streaming path).
     */
    private digestLarge;
}
