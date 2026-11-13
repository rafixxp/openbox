import { Checksum } from "@smithy/types";
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
  reset(): void;
  private processStripe;
  private mergeAcc;
  private roundAt;
  private avalanche;
}
