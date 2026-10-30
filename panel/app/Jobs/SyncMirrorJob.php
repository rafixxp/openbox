<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Mirror;
use App\Models\MirrorSync;
use App\Models\Release;
use App\Services\Audit\AuditLogger;
use App\Services\Mirror\MirrorSyncer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class SyncMirrorJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 3600;

    public function __construct(public Mirror $mirror, public ?Release $release = null)
    {
        $this->onQueue('default');
    }

    public function handle(MirrorSyncer $syncer, AuditLogger $audit): void
    {
        $sync = MirrorSync::query()->create([
            'mirror_id' => $this->mirror->id,
            'release_id' => $this->release?->id,
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            $bytes = $syncer->sync($this->mirror, $this->release);

            $sync->update([
                'status' => 'succeeded',
                'bytes_synced' => $bytes,
                'finished_at' => now(),
            ]);

            $this->mirror->update([
                'status' => 'online',
                'last_synced_at' => now(),
                'last_error' => null,
            ]);

            $audit->log('mirror.synced', $this->mirror, after: [
                'release' => $this->release?->version,
                'status' => 'succeeded',
            ]);
        } catch (Throwable $exception) {
            report($exception);

            $sync->update([
                'status' => 'failed',
                'error' => mb_substr($exception->getMessage(), 0, 4000),
                'finished_at' => now(),
            ]);

            $this->mirror->update([
                'status' => 'degraded',
                'last_error' => mb_substr($exception->getMessage(), 0, 2000),
            ]);

            $audit->log('mirror.sync_failed', $this->mirror, metadata: [
                'error' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }
}
