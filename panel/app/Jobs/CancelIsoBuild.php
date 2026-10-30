<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\BuildStatus;
use App\Models\Build;
use App\Services\Build\BuildAgentClient;
use App\Services\Build\BuildLifecycleService;
use App\Services\Build\BuildLogService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class CancelIsoBuild implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public Build $build)
    {
        $this->onQueue((string) config('build.queue', 'builds'));
    }

    public function handle(
        BuildLifecycleService $lifecycle,
        BuildLogService $logs,
        BuildAgentClient $agent,
    ): void {
        $build = $this->build->fresh();

        if (! $build instanceof Build || $build->status->isTerminal()) {
            return;
        }

        if ($build->status === BuildStatus::Queued) {
            $logs->append($build, 'Build canceled before dispatch.', 'warning');
            $lifecycle->cancelQueued($build);

            return;
        }

        if ((string) config('build.driver') === 'agent') {
            try {
                $agent->cancel($build);
            } catch (\Throwable $exception) {
                report($exception);
                $logs->append($build, 'Agent cancel request failed: '.$exception->getMessage(), 'error');
            }

            $logs->append($build, 'Cancel forwarded to build agent.', 'warning');
            $lifecycle->finish($build, BuildStatus::Canceled, error: 'Canceled by user.');

            return;
        }

        Cache::put('build:cancel:'.$build->uuid, true, now()->addHours(2));
        $logs->append($build, 'Cancel flag set; stopping live-build after the current line.', 'warning');
    }
}
