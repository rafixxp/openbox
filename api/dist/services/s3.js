"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalArtifactUploader = exports.S3ArtifactUploader = void 0;
exports.hashFile = hashFile;
exports.createUploader = createUploader;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const client_s3_1 = require("@aws-sdk/client-s3");
async function hashFile(filePath) {
    const hash = (0, node_crypto_1.createHash)('sha256');
    for await (const chunk of (0, node_fs_1.createReadStream)(filePath)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
}
class S3ArtifactUploader {
    config;
    client;
    constructor(config) {
        this.config = config;
        this.client = new client_s3_1.S3Client({
            endpoint: config.s3.endpoint,
            region: config.s3.region,
            forcePathStyle: config.s3.forcePathStyle,
            credentials: {
                accessKeyId: config.s3.accessKeyId,
                secretAccessKey: config.s3.secretAccessKey,
            },
        });
    }
    async upload(input) {
        const info = await (0, promises_1.stat)(input.filePath);
        if (!info.isFile() || info.size < 1) {
            throw new Error(`Artifact is missing or empty: ${input.filename}`);
        }
        const sha256 = await hashFile(input.filePath);
        const key = `builds/${input.buildUuid}/${input.filename}`;
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.config.s3.bucket,
            Key: key,
            Body: (0, node_fs_1.createReadStream)(input.filePath),
            ContentLength: info.size,
            ContentType: 'application/x-iso9660-image',
            Metadata: {
                'build-uuid': input.buildUuid,
                sha256,
            },
        }));
        return {
            disk: 's3',
            path: key,
            size: info.size,
            sha256,
        };
    }
}
exports.S3ArtifactUploader = S3ArtifactUploader;
/**
 * Local artifacts stay on the build host. The panel stores the absolute path
 * and streams the download only when its own filesystem can reach it.
 */
class LocalArtifactUploader {
    async upload(input) {
        const info = await (0, promises_1.stat)(input.filePath);
        if (!info.isFile() || info.size < 1) {
            throw new Error(`Artifact is missing or empty: ${input.filename}`);
        }
        return {
            disk: 'local',
            path: input.filePath,
            size: info.size,
            sha256: await hashFile(input.filePath),
        };
    }
}
exports.LocalArtifactUploader = LocalArtifactUploader;
function createUploader(config) {
    return config.artifactDisk === 's3' ? new S3ArtifactUploader(config) : new LocalArtifactUploader();
}
//# sourceMappingURL=s3.js.map