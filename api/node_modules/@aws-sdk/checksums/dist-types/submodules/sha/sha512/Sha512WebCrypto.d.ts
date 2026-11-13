import type { Checksum, SourceData } from "@smithy/types";
/**
 * SHA-512 using the Web Crypto API (crypto.subtle) when available,
 * falling back to the pure JS implementation.
 *
 * Caution: WebCrypto digest() needs the whole message at once, so data is
 * buffered until MAX_PENDING_BYTES, then streamed through Sha512Js instead.
 * @public
 */
export declare class Sha512WebCrypto implements Checksum {
    readonly digestLength: 64;
    private readonly secret?;
    private pending;
    private pendingBytes;
    private fallback?;
    private finished;
    constructor(secret?: SourceData);
    update(data: Uint8Array): void;
    digest(): Promise<Uint8Array>;
    reset(): void;
    private switchToFallback;
}
