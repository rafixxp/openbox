import { Checksum } from "@smithy/types";
import { Xxh3 } from "../Xxh3";
export declare class Xxh3_64 extends Xxh3 implements Checksum {
  readonly digestLength = 8;
  constructor();
  digest(): Promise<Uint8Array>;
  private digestSmall;
  private digestMedium;
  private digestLarge;
}
