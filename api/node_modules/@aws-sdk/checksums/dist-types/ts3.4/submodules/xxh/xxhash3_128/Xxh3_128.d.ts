import { Checksum } from "@smithy/types";
import { Xxh3 } from "../Xxh3";
export declare class Xxh3_128 extends Xxh3 implements Checksum {
  readonly digestLength = 16;
  constructor();
  digest(): Promise<Uint8Array>;
  private concat;
  private digestSmall;
  private digestMedium;
  private mixTwoChunks;
  private digestLarge;
}
