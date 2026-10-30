<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\BuildStatus;
use App\Models\Build;
use App\Services\Build\ArtifactStore;
use App\Services\Build\BuildAgentClient;
use App\Services\Build\BuildLifecycleService;
use App\Services\Build\BuildLogService;
use App\Services\Build\BuildScriptRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * The ONLY entry point that starts an ISO build. Controllers dispatch this job;
 * they never run live-build or install_panel_en.sh directly.
 */
class StartIsoBuild implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout;

    public bool $failOnTimeout = true;

    public function __construct(public Build $build)
    {
        $this->onQueue((string) config('build.queue', 'builds'));
        $this->timeout = (int) config('build.timeout', 7200) + 300;
    }

    public function handle(
        BuildLifecycleService $lifecycle,
        BuildLogService $logs,
        BuildAgentClient $agent,
        BuildScriptRunner $runner,
        ArtifactStore $artifacts,
    ): void {
        $build = $this->build->fresh();

        if (! $build instanceof Build || ! in_array($build->status, [BuildStatus::Queued, BuildStatus::Dispatching], true)) {
            return;
        }

        $driver = (string) config('build.driver', 'agent');
        $lifecycle->markDispatching($build, $driver);
        $logs->append($build, 'Build accepted by queue. Driver: '.$driver.'.');

        if ($driver === 'agent') {
            $agent->dispatch($build);
            $logs->append($build, 'Job handed to Fastify build agent. Waiting for callbacks.');

            return;
        }

        if ($driver !== 'local') {
            throw new \RuntimeException('Unsupported BUILD_DRIVER: '.$driver);
        }

        $this->runLocally($build, $lifecycle, $logs, $runner, $artifacts);
    }

    private function runLocally(
        Build $build,
        BuildLifecycleService $lifecycle,
        BuildLogService $logs,
        BuildScriptRunner $runner,
        ArtifactStore $artifacts,
    ): void {
        $lifecycle->markRunning($build, 'preparing');
        $logs->append($build, 'Starting live-build in an isolated workspace.');

        $buffer = [];

        $flush = function () use (&$buffer, $logs, $build): void {
            if ($buffer === []) {
                return;
            }

            $logs->append($build, implode("\n", $buffer));
            $buffer = [];
        };

        $result = $runner->run($build, function (string $line) use (&$buffer, $flush, $lifecycle, $build): void {
            if (preg_match('/^\[openbox\]\s+stage=(\S+)\s+progress=(\d+)/', $line, $matches) === 1) {
                $lifecycle->progress($build, (int) $matches[2], $matches[1]);
            }

            $buffer[] = $line;

            if (count($buffer) >= (int) config('build.log_chunk_lines', 25)) {
                $flush();
            }
        });

        $flush();

        if ($result->canceled) {
            $logs->append($build, 'Build canceled; live-build process stopped.', 'warning');
            $lifecycle->finish($build, BuildStatus::Canceled, exitCode: $result->exitCode, error: 'Canceled by user.');

            return;
        }

        if ($result->timedOut) {
            $logs->append($build, 'Build exceeded the configured timeout.', 'error');
            $lifecycle->finish($build, BuildStatus::Failed, exitCode: $result->exitCode, error: 'Build timed out.');

            return;
        }

        if ($result->exitCode !== 0 || $result->artifactPath === null) {
            $logs->append($build, 'live-build failed with exit code '.$result->exitCode.'.', 'error');
            $lifecycle->finish(
                $build,
                BuildStatus::Failed,
                exitCode: $result->exitCode,
                error: $result->outputTail !== '' ? $result->outputTail : 'live-build did not produce an ISO artifact.',
            );

            return;
        }

        $logs->append($build, 'Uploading ISO artifact to object storage.');

        try {
            $artifact = $artifacts->store($build, $result->artifactPath);
        } catch (Throwable $exception) {
            report($exception);
            $logs->append($build, 'Artifact upload failed: '.$exception->getMessage(), 'error');
            $lifecycle->finish($build, BuildStatus::Failed, exitCode: 0, error: 'Artifact upload failed.');

            return;
        }

        $logs->append($build, sprintf(
            'Build succeeded. ISO sha256=%s size=%d bytes.',
            $artifact['sha256'],
            $artifact['size'],
        ));

        $lifecycle->finish($build, BuildStatus::Succeeded, exitCode: 0, artifact: $artifact);
    }

    public function failed(?Throwable $exception): void
    {
        $build = $this->build->fresh();

        if (! $build instanceof Build || $build->status->isTerminal()) {
            return;
        }

        app(BuildLogService::class)->append(
            $build,
            'Build job failed: '.($exception?->getMessage() ?? 'unknown error'),
            'error',
        );

        app(BuildLifecycleService::class)->finish(
            $build,
            BuildStatus::Failed,
            error: $exception?->getMessage() ?? 'Build job failed.',
        );
    }
}
