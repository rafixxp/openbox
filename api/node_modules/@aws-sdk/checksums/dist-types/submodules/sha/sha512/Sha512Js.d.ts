import type { Checksum, SourceData } from "@smithy/types";
/**
 * Pure JS SHA-512 implementation with HMAC support.
 * 64-bit words are held as [hi, lo] u32 pairs; all arithmetic is split accordingly.
 * Non-destructive digest for plain hash — safe to call digest() multiple times.
 * @see https://csrc.nist.gov/pubs/fips/180-4/upd1/final
 * @public
 */
export declare class Sha512Js implements Checksum {
    readonly digestLength = 64;
    private state;
    private w?;
    private buffer;
    private bufferLength;
    private bytesHashed;
    private finished;
    private readonly key?;
    private inner?;
    private outer?;
    constructor(secret?: SourceData);
    update(data: Uint8Array): void;
    digest(): Promise<Uint8Array>;
    reset(): void;
    private initHmac;
    private digestSync;
    private static normalizeKey;
    private hashBuffer;
    private hashBufferWith;
}
