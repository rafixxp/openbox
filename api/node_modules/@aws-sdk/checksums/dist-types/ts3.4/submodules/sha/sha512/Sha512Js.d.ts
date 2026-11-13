import { Checksum, SourceData } from "@smithy/types";
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
