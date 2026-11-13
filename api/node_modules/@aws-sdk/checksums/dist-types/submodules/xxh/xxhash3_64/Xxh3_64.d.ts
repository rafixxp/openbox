import type { Checksum } from "@smithy/types";
import { Xxh3 } from "../Xxh3";
/**
 * XXHASH3 64-bit.
 * @see https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md#xxh3-algorithm-overview
 * @internal
 */
export declare class Xxh3_64 extends Xxh3 implements Checksum {
    readonly digestLength = 8;
    constructor();
    digest(): Promise<Uint8Array>;
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
     * Handles inputs over 240 bytes via streaming accumulators.
     * Used in steps 2–5: accumulate through avalanche (streaming path).
     */
    private digestLarge;
}
