<?php

declare(strict_types=1);

namespace App\Services\Build;

use App\Models\Build;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

final class ArtifactStore
{
    /**
     * Stream the ISO to the S3/MinIO artifact disk without loading it in memory.
     *
     * @return array{disk:string,path:string,size:int,sha256:string}
     */
    public function store(Build $build, string $path, string $disk = 's3'): array
    {
        if (! is_file($path)) {
            throw new RuntimeException('Build artifact does not exist: '.$path);
        }

        $key = sprintf(
            'iso/%s/%s/%s',
            $build->channel->value,
            $build->uuid,
            basename($path),
        );

        $stream = fopen($path, 'rb');

        if ($stream === false) {
            throw new RuntimeException('Build artifact cannot be opened.');
        }

        try {
            $stored = Storage::disk($disk)->put($key, $stream, [
                'visibility' => 'private',
                'ContentType' => 'application/x-iso9660-image',
            ]);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        if ($stored === false) {
            throw new RuntimeException('Build artifact upload failed.');
        }

        return [
            'disk' => $disk,
            'path' => $key,
            'size' => (int) filesize($path),
            'sha256' => (string) hash_file('sha256', $path),
        ];
    }

    /**
     * Resolve a local artifact path, but only inside the configured build
     * workspace. The path is supplied by the agent callback, so never trust it
     * to point outside the directory the panel owns.
     */
    public function localFile(Build $build): ?string
    {
        if ($build->artifact_disk !== 'local' || ! is_string($build->artifact_path) || $build->artifact_path === '') {
            return null;
        }

        $root = realpath((string) config('build.work_dir'));

        if ($root === false) {
            return null;
        }

        $path = realpath($build->artifact_path);

        if ($path === false || ! is_file($path)) {
            return null;
        }

        return str_starts_with($path, rtrim($root, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR) ? $path : null;
    }

    public function temporaryUrl(Build $build, int $minutes = 15): string
    {
        if (! $build->artifact_path) {
            throw new RuntimeException('This build has no artifact.');
        }

        $diskName = $build->artifact_disk ?: 's3';

        // Sign against a browser-reachable endpoint when one is configured.
        // AWS_PUBLIC_ENDPOINT is only needed when the internal S3 hostname is
        // not resolvable from the browser (for example MinIO in Compose).
        if ($diskName === 's3') {
            $diskName = 's3_public';
        }

        $disk = Storage::disk($diskName);

        try {
            return $disk->temporaryUrl($build->artifact_path, now()->addMinutes($minutes));
        } catch (\Throwable) {
            return $disk->url($build->artifact_path);
        }
    }
}
