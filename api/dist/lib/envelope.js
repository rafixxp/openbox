"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.failure = failure;
function success(data, meta = {}) {
    return {
        success: true,
        data,
        error: null,
        meta,
    };
}
function failure(code, message, meta = {}, details) {
    return {
        success: false,
        data: null,
        error: details === undefined ? { code, message } : { code, message, details },
        meta,
    };
}
//# sourceMappingURL=envelope.js.map