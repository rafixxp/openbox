import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/core/client";
import { IntelligentTieringAccessTier, StorageClass } from "./enums";
import { S3ServiceException as __BaseException } from "./S3ServiceException";
export declare class NoSuchUpload extends __BaseException {
  static readonly shapeId: string;
  readonly name: "NoSuchUpload";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<NoSuchUpload, __BaseException>);
}
export declare class AccessDenied extends __BaseException {
  static readonly shapeId: string;
  readonly name: "AccessDenied";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<AccessDenied, __BaseException>);
}
export declare class ObjectNotInActiveTierError extends __BaseException {
  static readonly shapeId: string;
  readonly name: "ObjectNotInActiveTierError";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<ObjectNotInActiveTierError, __BaseException>);
}
export declare class BucketAlreadyExists extends __BaseException {
  static readonly shapeId: string;
  readonly name: "BucketAlreadyExists";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<BucketAlreadyExists, __BaseException>);
}
export declare class BucketAlreadyOwnedByYou extends __BaseException {
  static readonly shapeId: string;
  readonly name: "BucketAlreadyOwnedByYou";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<BucketAlreadyOwnedByYou, __BaseException>);
}
export declare class NoSuchBucket extends __BaseException {
  static readonly shapeId: string;
  readonly name: "NoSuchBucket";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<NoSuchBucket, __BaseException>);
}
export declare class NoSuchKey extends __BaseException {
  static readonly shapeId: string;
  readonly name: "NoSuchKey";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<NoSuchKey, __BaseException>);
}
export declare class InvalidObjectState extends __BaseException {
  static readonly shapeId: string;
  readonly name: "InvalidObjectState";
  readonly $fault: "client";
  StorageClass?: StorageClass | undefined;
  AccessTier?: IntelligentTieringAccessTier | undefined;
  constructor(opts: __ExceptionOptionType<InvalidObjectState, __BaseException>);
}
export declare class NoSuchAnnotation extends __BaseException {
  static readonly shapeId: string;
  readonly name: "NoSuchAnnotation";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<NoSuchAnnotation, __BaseException>);
}
export declare class NotFound extends __BaseException {
  static readonly shapeId: string;
  readonly name: "NotFound";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<NotFound, __BaseException>);
}
export declare class InvalidPrefix extends __BaseException {
  static readonly shapeId: string;
  readonly name: "InvalidPrefix";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidPrefix, __BaseException>);
}
export declare class EncryptionTypeMismatch extends __BaseException {
  static readonly shapeId: string;
  readonly name: "EncryptionTypeMismatch";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<EncryptionTypeMismatch, __BaseException>);
}
export declare class InvalidRequest extends __BaseException {
  static readonly shapeId: string;
  readonly name: "InvalidRequest";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidRequest, __BaseException>);
}
export declare class InvalidWriteOffset extends __BaseException {
  static readonly shapeId: string;
  readonly name: "InvalidWriteOffset";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidWriteOffset, __BaseException>);
}
export declare class TooManyParts extends __BaseException {
  static readonly shapeId: string;
  readonly name: "TooManyParts";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<TooManyParts, __BaseException>);
}
export declare class AnnotationLimitExceeded extends __BaseException {
  static readonly shapeId: string;
  readonly name: "AnnotationLimitExceeded";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<AnnotationLimitExceeded, __BaseException>);
}
export declare class AnnotationNameTooLong extends __BaseException {
  static readonly shapeId: string;
  readonly name: "AnnotationNameTooLong";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<AnnotationNameTooLong, __BaseException>);
}
export declare class InvalidAnnotationName extends __BaseException {
  static readonly shapeId: string;
  readonly name: "InvalidAnnotationName";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidAnnotationName, __BaseException>);
}
export declare class UnsupportedMediaType extends __BaseException {
  static readonly shapeId: string;
  readonly name: "UnsupportedMediaType";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<UnsupportedMediaType, __BaseException>);
}
export declare class IdempotencyParameterMismatch extends __BaseException {
  static readonly shapeId: string;
  readonly name: "IdempotencyParameterMismatch";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<IdempotencyParameterMismatch, __BaseException>);
}
export declare class ObjectAlreadyInActiveTierError extends __BaseException {
  static readonly shapeId: string;
  readonly name: "ObjectAlreadyInActiveTierError";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<ObjectAlreadyInActiveTierError, __BaseException>);
}
