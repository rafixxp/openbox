import { ServiceException as __ServiceException, } from "@smithy/core/client";
export { __ServiceException };
export class S3ServiceException extends __ServiceException {
    static shapeId = "smithy.ts.sdk.synthetic.com.amazonaws.s3#S3ServiceException";
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, S3ServiceException.prototype);
    }
}
