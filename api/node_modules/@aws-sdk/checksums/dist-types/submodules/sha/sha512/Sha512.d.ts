import type { SourceData } from "@smithy/types";
import { Sha512Js } from "./Sha512Js";
/**
 * SHA-512, using Node.js native crypto when available and falling back to the
 * inherited pure-JS implementation otherwise.
 * @public
 */
export declare class Sha512 extends Sha512Js {
    private native?;
    private readonly nativeSecret?;
    private nativeFinished;
    constructor(secret?: SourceData);
    update(data: Uint8Array): void;
    digest(): Promise<Uint8Array>;
    reset(): void;
    private createNative;
}
