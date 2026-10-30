<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\MirrorStatus;
use App\Models\Mirror;
use App\Services\Audit\AuditLogger;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Throwable;

class CheckMirrorHealth implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(public Mirror $mirror)
    {
        $this->onQueue('default');
    }

    public function handle(AuditLogger $audit): void
    {
        $start = microtime(true);

        try {
            $response = Http::timeout(8)->connectTimeout(5)->head($this->mirror->base_url);
            $latency = (int) round((microtime(true) - $start) * 1000);

            $status = $response->status() < 500 ? MirrorStatus::Online : MirrorStatus::Degraded;

            if ($response->status() === 404) {
                // A 404 on the root is still a reachable HTTP mirror.
                $status = MirrorStatus::Online;
            }

            $this->mirror->update([
                'status' => $status,
                'latency_ms' => $latency,
                'last_error' => $status === MirrorStatus::Online ? null : 'HTTP '.$response->status(),
            ]);
        } catch (Throwable $exception) {
            $this->mirror->update([
                'status' => MirrorStatus::Offline,
                'latency_ms' => null,
                'last_error' => mb_substr($exception->getMessage(), 0, 2000),
            ]);
        }

        $audit->log('mirror.health_checked', $this->mirror, metadata: [
            'status' => $this->mirror->fresh()->status->value,
        ]);
    }
}
