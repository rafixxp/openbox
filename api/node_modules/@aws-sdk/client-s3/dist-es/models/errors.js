import { S3ServiceException as __BaseException } from "./S3ServiceException";
export class NoSuchUpload extends __BaseException {
    static shapeId = "com.amazonaws.s3#NoSuchUpload";
    name = "NoSuchUpload";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NoSuchUpload",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NoSuchUpload.prototype);
    }
}
export class AccessDenied extends __BaseException {
    static shapeId = "com.amazonaws.s3#AccessDenied";
    name = "AccessDenied";
    $fault = "client";
    constructor(opts) {
        super({
            name: "AccessDenied",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, AccessDenied.prototype);
    }
}
export class ObjectNotInActiveTierError extends __BaseException {
    static shapeId = "com.amazonaws.s3#ObjectNotInActiveTierError";
    name = "ObjectNotInActiveTierError";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ObjectNotInActiveTierError",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ObjectNotInActiveTierError.prototype);
    }
}
export class BucketAlreadyExists extends __BaseException {
    static shapeId = "com.amazonaws.s3#BucketAlreadyExists";
    name = "BucketAlreadyExists";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BucketAlreadyExists",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BucketAlreadyExists.prototype);
    }
}
export class BucketAlreadyOwnedByYou extends __BaseException {
    static shapeId = "com.amazonaws.s3#BucketAlreadyOwnedByYou";
    name = "BucketAlreadyOwnedByYou";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BucketAlreadyOwnedByYou",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BucketAlreadyOwnedByYou.prototype);
    }
}
export class NoSuchBucket extends __BaseException {
    static shapeId = "com.amazonaws.s3#NoSuchBucket";
    name = "NoSuchBucket";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NoSuchBucket",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NoSuchBucket.prototype);
    }
}
export class NoSuchKey extends __BaseException {
    static shapeId = "com.amazonaws.s3#NoSuchKey";
    name = "NoSuchKey";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NoSuchKey",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NoSuchKey.prototype);
    }
}
export class InvalidObjectState extends __BaseException {
    static shapeId = "com.amazonaws.s3#InvalidObjectState";
    name = "InvalidObjectState";
    $fault = "client";
    StorageClass;
    AccessTier;
    constructor(opts) {
        super({
            name: "InvalidObjectState",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidObjectState.prototype);
        this.StorageClass = opts.StorageClass;
        this.AccessTier = opts.AccessTier;
    }
}
export class NoSuchAnnotation extends __BaseException {
    static shapeId = "com.amazonaws.s3#NoSuchAnnotation";
    name = "NoSuchAnnotation";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NoSuchAnnotation",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NoSuchAnnotation.prototype);
    }
}
export class NotFound extends __BaseException {
    static shapeId = "com.amazonaws.s3#NotFound";
    name = "NotFound";
    $fault = "client";
    constructor(opts) {
        super({
            name: "NotFound",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, NotFound.prototype);
    }
}
export class InvalidPrefix extends __BaseException {
    static shapeId = "com.amazonaws.s3#InvalidPrefix";
    name = "InvalidPrefix";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidPrefix",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidPrefix.prototype);
    }
}
export class EncryptionTypeMismatch extends __BaseException {
    static shapeId = "com.amazonaws.s3#EncryptionTypeMismatch";
    name = "EncryptionTypeMismatch";
    $fault = "client";
    constructor(opts) {
        super({
            name: "EncryptionTypeMismatch",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, EncryptionTypeMismatch.prototype);
    }
}
export class InvalidRequest extends __BaseException {
    static shapeId = "com.amazonaws.s3#InvalidRequest";
    name = "InvalidRequest";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidRequest",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidRequest.prototype);
    }
}
export class InvalidWriteOffset extends __BaseException {
    static shapeId = "com.amazonaws.s3#InvalidWriteOffset";
    name = "InvalidWriteOffset";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidWriteOffset",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidWriteOffset.prototype);
    }
}
export class TooManyParts extends __BaseException {
    static shapeId = "com.amazonaws.s3#TooManyParts";
    name = "TooManyParts";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TooManyParts",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TooManyParts.prototype);
    }
}
export class AnnotationLimitExceeded extends __BaseException {
    static shapeId = "com.amazonaws.s3#AnnotationLimitExceeded";
    name = "AnnotationLimitExceeded";
    $fault = "client";
    constructor(opts) {
        super({
            name: "AnnotationLimitExceeded",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, AnnotationLimitExceeded.prototype);
    }
}
export class AnnotationNameTooLong extends __BaseException {
    static shapeId = "com.amazonaws.s3#AnnotationNameTooLong";
    name = "AnnotationNameTooLong";
    $fault = "client";
    constructor(opts) {
        super({
            name: "AnnotationNameTooLong",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, AnnotationNameTooLong.prototype);
    }
}
export class InvalidAnnotationName extends __BaseException {
    static shapeId = "com.amazonaws.s3#InvalidAnnotationName";
    name = "InvalidAnnotationName";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidAnnotationName",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidAnnotationName.prototype);
    }
}
export class UnsupportedMediaType extends __BaseException {
    static shapeId = "com.amazonaws.s3#UnsupportedMediaType";
    name = "UnsupportedMediaType";
    $fault = "client";
    constructor(opts) {
        super({
            name: "UnsupportedMediaType",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, UnsupportedMediaType.prototype);
    }
}
export class IdempotencyParameterMismatch extends __BaseException {
    static shapeId = "com.amazonaws.s3#IdempotencyParameterMismatch";
    name = "IdempotencyParameterMismatch";
    $fault = "client";
    constructor(opts) {
        super({
            name: "IdempotencyParameterMismatch",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, IdempotencyParameterMismatch.prototype);
    }
}
export class ObjectAlreadyInActiveTierError extends __BaseException {
    static shapeId = "com.amazonaws.s3#ObjectAlreadyInActiveTierError";
    name = "ObjectAlreadyInActiveTierError";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ObjectAlreadyInActiveTierError",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ObjectAlreadyInActiveTierError.prototype);
    }
}
