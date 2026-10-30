<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BuildStatus;
use App\Enums\ReleaseChannel;
use App\Http\Requests\Build\StoreBuildRequest;
use App\Http\Resources\BuildLogResource;
use App\Http\Resources\BuildResource;
use App\Jobs\CancelIsoBuild;
use App\Jobs\StartIsoBuild;
use App\Models\Build;
use App\Models\BuildLog;
use App\Services\Audit\AuditLogger;
use App\Services\Build\ArtifactStore;
use App\Services\Build\BuildManifestFactory;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response;

class BuildController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewAny', Build::class);

        $filters = $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', array_map(static fn (BuildStatus $s): string => $s->value, BuildStatus::cases()))],
            'channel' => ['nullable', 'string', 'in:'.implode(',', ReleaseChannel::values())],
        ]);

        $builds = Build::query()
            ->with('requestedBy')
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['channel'] ?? null, fn ($query, string $channel) => $query->where('channel', $channel))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Builds/Index', [
            'builds' => BuildResource::collection($builds),
            'filters' => $filters,
            'channels' => ReleaseChannel::values(),
            'statuses' => array_map(static fn (BuildStatus $status): string => $status->value, BuildStatus::cases()),
            'activeCount' => Build::query()->whereIn('status', ['queued', 'dispatching', 'running'])->count(),
            'canTrigger' => Gate::allows('create', Build::class),
        ]);
    }

    public function store(StoreBuildRequest $request, BuildManifestFactory $manifests, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();

        if (! empty($data['idempotency_key'])) {
            $existing = Build::query()->where('idempotency_key', $data['idempotency_key'])->first();

            if ($existing instanceof Build) {
                return redirect()->route('builds.show', $existing);
            }
        }

        $channel = ReleaseChannel::from($data['channel']);

        $manifest = $manifests->make($channel, [
            'clean' => (bool) ($data['clean'] ?? false),
            'includePanelInstaller' => (bool) ($data['include_panel_installer'] ?? false),
            'notes' => $data['notes'] ?? null,
        ], $request->user());

        $build = Build::query()->create([
            'uuid' => (string) Str::uuid(),
            'status' => BuildStatus::Queued,
            'channel' => $channel,
            'progress' => 0,
            'requested_by' => $request->user()->id,
            'manifest' => $manifest,
            'idempotency_key' => $data['idempotency_key'] ?? null,
        ]);

        $audit->log('build.triggered', $build, after: [
            'uuid' => $build->uuid,
            'channel' => $channel->value,
            'includePanelInstaller' => $manifest['includePanelInstaller'],
        ]);

        StartIsoBuild::dispatch($build);

        return redirect()
            ->route('builds.show', $build)
            ->with('success', 'Build queued. Logs will stream below.');
    }

    public function show(Request $request, Build $build): InertiaResponse
    {
        $this->authorize('view', $build);

        $build->load('requestedBy');

        $logs = $build->logs()
            ->latest('sequence')
            ->limit(500)
            ->get()
            ->sortBy('sequence')
            ->values();

        $build->setRelation('logs', $logs);

        return Inertia::render('Builds/Show', [
            'build' => (new BuildResource($build))->resolve($request),
            'channels' => ReleaseChannel::values(),
        ]);
    }

    public function retry(Request $request, Build $build, AuditLogger $audit): RedirectResponse
    {
        $this->authorize('retry', $build);

        if (! $build->isTerminal()) {
            return back()->with('error', 'Only finished builds can be retried.');
        }

        $retry = Build::query()->create([
            'uuid' => (string) Str::uuid(),
            'status' => BuildStatus::Queued,
            'channel' => $build->channel,
            'progress' => 0,
            'requested_by' => $request->user()->id,
            'retry_of_id' => $build->id,
            'manifest' => $build->manifest,
        ]);

        $audit->log('build.retried', $retry, metadata: ['retry_of' => $build->uuid]);

        StartIsoBuild::dispatch($retry);

        return redirect()->route('builds.show', $retry)->with('success', 'Retry queued.');
    }

    public function cancel(Build $build, AuditLogger $audit): RedirectResponse
    {
        $this->authorize('cancel', $build);

        if (! $build->canBeCanceled()) {
            return back()->with('error', 'This build cannot be canceled.');
        }

        $audit->log('build.cancel_requested', $build, after: ['uuid' => $build->uuid]);
        CancelIsoBuild::dispatch($build);

        return back()->with('success', 'Cancel requested.');
    }

    public function download(Build $build, ArtifactStore $artifacts, AuditLogger $audit): Response
    {
        $this->authorize('download', $build);

        if ($build->artifact_path === null) {
            abort(404, 'This build has no artifact.');
        }

        $audit->log('build.downloaded', $build, metadata: ['uuid' => $build->uuid]);

        $local = $artifacts->localFile($build);

        if ($local !== null) {
            $stream = fopen($local, 'rb');

            if ($stream === false) {
                abort(404, 'This build artifact cannot be opened.');
            }

            return response()->streamDownload(static function () use ($stream): void {
                fpassthru($stream);
                fclose($stream);
            }, basename($local), [
                'Content-Type' => 'application/x-iso9660-image',
                'X-Checksum-Sha256' => (string) $build->artifact_sha256,
            ]);
        }

        if ($build->artifact_disk === 'local') {
            abort(404, 'This build artifact is not available on the panel host.');
        }

        return redirect()->away($artifacts->temporaryUrl($build));
    }

    /**
     * Lightweight status endpoint used by the Vue polling fallback.
     */
    public function status(Build $build): JsonResponse
    {
        $this->authorize('view', $build);

        return ApiResponse::success([
            'uuid' => $build->uuid,
            'status' => $build->status->value,
            'stage' => $build->stage,
            'progress' => $build->progress,
            'exitCode' => $build->exit_code,
            'errorMessage' => $build->error_message,
            'artifactSize' => $build->artifact_size,
            'artifactSha256' => $build->artifact_sha256,
            'finishedAt' => $build->finished_at?->toIso8601String(),
        ]);
    }

    /**
     * Polling fallback for browsers that cannot open a WebSocket.
     */
    public function logs(Request $request, Build $build): JsonResponse
    {
        $this->authorize('view', $build);

        $data = $request->validate([
            'after' => ['nullable', 'integer', 'min:0'],
        ]);

        $logs = $build->logs()
            ->when($data['after'] ?? null, fn ($query, int $after) => $query->where('sequence', '>', $after))
            ->orderBy('sequence')
            ->limit(1000)
            ->get();

        return ApiResponse::success(
            $logs->map(static fn (BuildLog $log): array => (new BuildLogResource($log))->resolve($request))->values()->all(),
            ['latestSequence' => (int) ($logs->last()?->sequence ?? ($data['after'] ?? 0))],
        );
    }
}
