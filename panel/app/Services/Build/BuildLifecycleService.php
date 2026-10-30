<?php

declare(strict_types=1);

namespace App\Services\Build;

use App\Enums\BuildStatus;
use App\Events\BuildStatusChanged;
use App\Jobs\SendBuildNotification;
use App\Models\Build;
use Illuminate\Support\Facades\Cache;

final class BuildLifecycleService
{
    public function markDispatching(Build $build, string $driver): Build
    {
        $build->update([
            'status' => BuildStatus::Dispatching,
            'agent' => $driver,
            'started_at' => $build->started_at ?? now(),
        ]);

        return $this->broadcast($build);
    }

    public function markRunning(Build $build, ?string $stage = null): Build
    {
        $build->update([
            'status' => BuildStatus::Running,
            'stage' => $stage ?? 'starting',
            'started_at' => $build->started_at ?? now(),
        ]);

        return $this->broadcast($build);
    }

    public function progress(Build $build, int $progress, ?string $stage = null): Build
    {
        if ($build->status->isTerminal()) {
            return $build;
        }

        $build->update([
            'progress' => max(0, min(100, $progress)),
            'stage' => $stage ?? $build->stage,
        ]);

        return $this->broadcast($build);
    }

    /**
     * @param  array{disk:string,path:string,size:int,sha256:string}|null  $artifact
     */
    public function finish(
        Build $build,
        BuildStatus $status,
        ?int $exitCode = null,
        ?string $error = null,
        ?array $artifact = null,
        int $progress = 100,
    ): Build {
        if ($build->status->isTerminal()) {
            return $build;
        }

        if (! in_array($status, [BuildStatus::Succeeded, BuildStatus::Failed, BuildStatus::Canceled], true)) {
            throw new \InvalidArgumentException('finish() only accepts terminal statuses.');
        }

        $build->update([
            'status' => $status,
            'exit_code' => $exitCode,
            'error_message' => $error !== null ? mb_substr($error, 0, 4000) : null,
            'artifact_disk' => $artifact['disk'] ?? $build->artifact_disk,
            'artifact_path' => $artifact['path'] ?? $build->artifact_path,
            'artifact_size' => $artifact['size'] ?? $build->artifact_size,
            'artifact_sha256' => $artifact['sha256'] ?? $build->artifact_sha256,
            'progress' => $status === BuildStatus::Succeeded ? 100 : $progress,
            'finished_at' => now(),
            'canceled_at' => $status === BuildStatus::Canceled ? now() : $build->canceled_at,
        ]);

        Cache::forget('build:cancel:'.$build->uuid);

        $this->broadcast($build);
        SendBuildNotification::dispatch($build->fresh());

        return $build;
    }

    public function cancelQueued(Build $build): Build
    {
        return $this->finish($build, BuildStatus::Canceled, error: 'Canceled by user.');
    }

    private function broadcast(Build $build): Build
    {
        broadcast(new BuildStatusChanged($build->fresh()));

        return $build->fresh();
    }
}
