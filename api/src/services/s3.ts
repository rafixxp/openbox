import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../config';

export interface ArtifactInput {
    buildUuid: string;
    filePath: string;
    filename: string;
}

export interface UploadedArtifact {
    disk: 's3' | 'local';
    path: string;
    size: number;
    sha256: string;
}

export interface ArtifactUploader {
    upload(input: ArtifactInput): Promise<UploadedArtifact>;
}

export async function hashFile(filePath: string): Promise<string> {
    const hash = createHash('sha256');

    for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk as Buffer);
    }

    return hash.digest('hex');
}

export class S3ArtifactUploader implements ArtifactUploader {
    private readonly client: S3Client;

    constructor(private readonly config: AppConfig) {
        this.client = new S3Client({
            endpoint: config.s3.endpoint,
            region: config.s3.region,
            forcePathStyle: config.s3.forcePathStyle,
            credentials: {
                accessKeyId: config.s3.accessKeyId,
                secretAccessKey: config.s3.secretAccessKey,
            },
        });
    }

    async upload(input: ArtifactInput): Promise<UploadedArtifact> {
        const info = await stat(input.filePath);

        if (!info.isFile() || info.size < 1) {
            throw new Error(`Artifact is missing or empty: ${input.filename}`);
        }

        const sha256 = await hashFile(input.filePath);
        const key = `builds/${input.buildUuid}/${input.filename}`;

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.config.s3.bucket,
                Key: key,
                Body: createReadStream(input.filePath),
                ContentLength: info.size,
                ContentType: 'application/x-iso9660-image',
                Metadata: {
                    'build-uuid': input.buildUuid,
                    sha256,
                },
            }),
        );

        return {
            disk: 's3',
            path: key,
            size: info.size,
            sha256,
        };
    }
}

/**
 * Local artifacts stay on the build host. The panel stores the absolute path
 * and streams the download only when its own filesystem can reach it.
 */
export class LocalArtifactUploader implements ArtifactUploader {
    async upload(input: ArtifactInput): Promise<UploadedArtifact> {
        const info = await stat(input.filePath);

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

export function createUploader(config: AppConfig): ArtifactUploader {
    return config.artifactDisk === 's3' ? new S3ArtifactUploader(config) : new LocalArtifactUploader();
}
