import { S3ExpressIdentityCache } from "./S3ExpressIdentityCache";
import { S3ExpressIdentityCacheEntry } from "./S3ExpressIdentityCacheEntry";
export class S3ExpressIdentityProviderImpl {
    createSessionFn;
    cache;
    static REFRESH_WINDOW_MS = 60_000;
    accessKeyId;
    cacheGeneration = 0;
    constructor(createSessionFn, cache = new S3ExpressIdentityCache()) {
        this.createSessionFn = createSessionFn;
        this.cache = cache;
    }
    async getS3ExpressIdentity(awsIdentity, identityProperties) {
        const bucket = identityProperties.Bucket;
        const { cache } = this;
        if (awsIdentity.accessKeyId !== this.accessKeyId) {
            this.accessKeyId = awsIdentity.accessKeyId;
            this.cacheGeneration++;
            cache.clear();
        }
        const cacheGeneration = this.cacheGeneration;
        const entry = cache.get(bucket);
        if (entry) {
            return entry.identity.then((identity) => {
                const isExpired = (identity.expiration?.getTime() ?? 0) < Date.now();
                if (isExpired) {
                    return cache.set(bucket, new S3ExpressIdentityCacheEntry(this.getIdentity(bucket))).identity;
                }
                const isExpiringSoon = (identity.expiration?.getTime() ?? 0) < Date.now() + S3ExpressIdentityProviderImpl.REFRESH_WINDOW_MS;
                if (isExpiringSoon && !entry.isRefreshing) {
                    entry.isRefreshing = true;
                    this.getIdentity(bucket).then((id) => {
                        if (cacheGeneration === this.cacheGeneration) {
                            cache.set(bucket, new S3ExpressIdentityCacheEntry(Promise.resolve(id)));
                        }
                    });
                }
                return identity;
            });
        }
        return cache.set(bucket, new S3ExpressIdentityCacheEntry(this.getIdentity(bucket))).identity;
    }
    async getIdentity(bucket) {
        await this.cache.purgeExpired().catch((error) => {
            console.warn("Error while clearing expired entries in S3ExpressIdentityCache: \n" + error);
        });
        const session = await this.createSessionFn(bucket);
        if (!session.Credentials?.AccessKeyId || !session.Credentials?.SecretAccessKey) {
            throw new Error("s3#createSession response credential missing AccessKeyId or SecretAccessKey.");
        }
        const identity = {
            accessKeyId: session.Credentials.AccessKeyId,
            secretAccessKey: session.Credentials.SecretAccessKey,
            sessionToken: session.Credentials.SessionToken,
            expiration: session.Credentials.Expiration ? new Date(session.Credentials.Expiration) : undefined,
        };
        return identity;
    }
}
