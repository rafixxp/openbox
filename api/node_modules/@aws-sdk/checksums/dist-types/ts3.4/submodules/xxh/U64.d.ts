export type u32 = number;
export type u64_l = u32;
export type u64_r = u32;
export type index = number;
export type distance = number;
export type size = number;
export declare const m8 = 255;
export declare const m16 = 65535;
export declare const m32 = 4294967295;
export declare class U64 extends Uint32Array {
  private constructor();
  static create(size: index): U64;
  write(i: index, v0: u64_l, v1: u64_r): U64;
  copy(source: index, target: index): U64;
  add(i: index, v0: u64_l, v1: u64_r): U64;
  multiply(i: index, v0: u64_l, v1: u64_r): U64;
  addProduct(i: index, a: u32, b: u32): U64;
  multiply128(i: index, j: index, t: index, u: index): U64;
  subtract(i: index, v0: u64_l, v1: u64_r): U64;
  left(i: index, places: distance): U64;
  rotateLeft(i: index, places: distance): U64;
  right(i: index, places: distance): U64;
  xor(i: index, v0: u64_l, v1: u64_r): U64;
  toBytes(i: index): Uint8Array;
  hi(i: index): u64_l;
  lo(i: index): u64_r;
}
