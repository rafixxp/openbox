<?php

declare(strict_types=1);

namespace App\Services\Mirror;

use App\Models\Mirror;
use App\Models\Release;
use Symfony\Component\Process\Process;

/**
 * Syncs published artifacts with rclone. Mirrors must define a sync_target
 * (for example: "mirror-eu:/srv/openbox" or "s3:mirror-bucket/openbox").
 */
final class RcloneMirrorSyncer implements MirrorSyncer
{
    public function sync(Mirror $mirror, ?Release $release = null): int
    {
        if (blank($mirror->sync_target)) {
            throw new \RuntimeException('Mirror has no sync_target configured.');
        }

        $source = (string) config('mirror.source');

        if ($source === '') {
            throw new \RuntimeException('MIRROR_SOURCE is not configured.');
        }

        if ($release !== null) {
            $source = rtrim($source, '/').'/'.$release->channel->value.'/'.$release->version;
        }

        $process = new Process([
            (string) config('mirror.rclone_binary', 'rclone'),
            'sync',
            $source,
            (string) $mirror->sync_target,
            '--stats-one-line',
            '--stats=10s',
        ]);

        $process->setTimeout((float) config('mirror.timeout', 3600));
        $process->mustRun();

        return 0;
    }
}
