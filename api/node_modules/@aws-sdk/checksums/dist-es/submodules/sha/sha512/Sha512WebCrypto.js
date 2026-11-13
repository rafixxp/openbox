import { concatBytes, toUint8Array } from "@smithy/core/serde";
import { Sha512Js } from "./Sha512Js";
const { digest, sign, importKey } = globalThis?.crypto?.subtle ?? {};
const subtle = typeof digest === "function" && typeof sign === "function" && typeof importKey === "function"
    ? globalThis.crypto.subtle
    : undefined;
const MAX_PENDING_BYTES = 8 * 1024 * 1024;
const BLOCK_SIZE = 128;
export class Sha512WebCrypto {
    digestLength = 64;
    secret;
    pending = [];
    pendingBytes = 0;
    fallback;
    finished = false;
    constructor(secret) {
        if (secret !== undefined) {
            const key = toUint8Array(secret);
            this.secret = key.byteLength === 0 ? new Uint8Array(BLOCK_SIZE) : key;
        }
        if (!subtle) {
            this.fallback = new Sha512Js(secret);
        }
    }
    update(data) {
        if (this.finished) {
            throw new Error("Attempted to update an already finished HMAC.");
        }
        if (this.fallback) {
            this.fallback.update(data);
            return;
        }
        this.pending.push(data.slice());
        this.pendingBytes += data.byteLength;
        if (this.pendingBytes >= MAX_PENDING_BYTES) {
            this.switchToFallback();
        }
    }
    async digest() {
        if (this.fallback) {
            return this.fallback.digest();
        }
        if (this.secret && this.finished) {
            throw new Error("Attempted to digest an already finished HMAC.");
        }
        const data = concatBytes(this.pending);
        if (this.secret) {
            this.finished = true;
            const key = await subtle.importKey("raw", this.secret, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
            const sig = await subtle.sign("HMAC", key, data);
            return new Uint8Array(sig);
        }
        const hash = await subtle.digest("SHA-512", data);
        return new Uint8Array(hash);
    }
    reset() {
        this.pending = [];
        this.pendingBytes = 0;
        this.finished = false;
        if (subtle) {
            this.fallback = undefined;
        }
        else {
            this.fallback = new Sha512Js(this.secret);
        }
    }
    switchToFallback() {
        const sha512Js = new Sha512Js(this.secret);
        for (const chunk of this.pending) {
            sha512Js.update(chunk);
        }
        this.fallback = sha512Js;
        this.pending = [];
        this.pendingBytes = 0;
    }
}
