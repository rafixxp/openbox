import { createHash, createHmac } from "node:crypto";
import { Sha512Js } from "./Sha512Js";
let nativeSupported;
function detectNative() {
    if (nativeSupported === undefined) {
        try {
            createHash("sha512");
            nativeSupported = true;
        }
        catch {
            nativeSupported = false;
        }
    }
    return nativeSupported;
}
export class Sha512 extends Sha512Js {
    native;
    nativeSecret;
    nativeFinished = false;
    constructor(secret) {
        super(secret);
        this.nativeSecret = secret;
        if (detectNative()) {
            this.native = this.createNative();
        }
    }
    update(data) {
        if (!this.native) {
            super.update(data);
            return;
        }
        if (this.nativeFinished) {
            throw new Error("Attempted to update an already finished hash.");
        }
        this.native.update(data);
    }
    async digest() {
        if (!this.native) {
            return super.digest();
        }
        let buf;
        if (this.nativeSecret !== undefined) {
            this.nativeFinished = true;
            buf = this.native.digest();
        }
        else {
            buf = this.native.copy().digest();
        }
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    reset() {
        if (!this.native) {
            super.reset();
            return;
        }
        this.native = this.createNative();
        this.nativeFinished = false;
    }
    createNative() {
        return this.nativeSecret !== undefined ? createHmac("sha512", toBuffer(this.nativeSecret)) : createHash("sha512");
    }
}
function toBuffer(data) {
    if (typeof data === "string") {
        return data;
    }
    if (ArrayBuffer.isView(data)) {
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    return Buffer.from(data);
}
