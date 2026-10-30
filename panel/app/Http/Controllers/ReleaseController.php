<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\ReleaseChannel;
use App\Enums\ReleaseStatus;
use App\Http\Requests\Release\StoreReleaseRequest;
use App\Http\Resources\ReleaseResource;
use App\Models\Build;
use App\Models\Mirror;
use App\Models\Release;
use App\Jobs\SyncMirrorJob;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReleaseController extends Controller
{
    public function index(Request $request): Response
    {
        $releases = Release::query()
            ->with('isoBuild')
            ->latest()
            ->paginate(20);

        return Inertia::render('Releases/Index', [
            'releases' => ReleaseResource::collection($releases),
            'succeededBuilds' => Build::query()
                ->where('status', 'succeeded')
                ->latest()
                ->limit(20)
                ->get(['uuid', 'channel', 'created_at']),
            'channels' => ['stable', 'testing'],
            'can' => [
                'manage' => $request->user()->hasPermissionTo('releases.manage'),
                'publish' => $request->user()->hasPermissionTo('releases.publish'),
            ],
        ]);
    }

    public function store(StoreReleaseRequest $request, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();

        $build = isset($data['iso_build_uuid'])
            ? Build::query()->where('uuid', $data['iso_build_uuid'])->first()
            : null;

        if ($build !== null && $build->status->value !== 'succeeded') {
            return back()->with('error', 'Only a successful build can be attached to a release.');
        }

        $release = Release::query()->create([
            'version' => $data['version'],
            'channel' => ReleaseChannel::from($data['channel']),
            'codename' => $data['codename'] ?? null,
            'status' => ReleaseStatus::Draft,
            'notes' => $data['notes'] ?? null,
            'iso_build_id' => $build?->id,
            'created_by' => $request->user()->id,
        ]);

        $audit->log('release.created', $release, after: [
            'version' => $release->version,
            'channel' => $release->channel->value,
        ]);

        return back()->with('success', 'Release draft created.');
    }

    public function publish(Release $release, AuditLogger $audit): RedirectResponse
    {
        if ($release->status !== ReleaseStatus::Draft) {
            return back()->with('error', 'Only draft releases can be published.');
        }

        $build = $release->isoBuild;

        if ($build === null || $build->artifact_path === null) {
            return back()->with('error', 'Attach a successful ISO build with an artifact before publishing.');
        }

        $release->update([
            'status' => ReleaseStatus::Published,
            'published_at' => now(),
            'checksums' => [
                'sha256' => $build->artifact_sha256,
                'size' => $build->artifact_size,
                'iso' => basename((string) $build->artifact_path),
            ],
        ]);

        $audit->log('release.published', $release, after: [
            'version' => $release->version,
            'channel' => $release->channel->value,
            'sha256' => $build->artifact_sha256,
        ]);

        Mirror::query()->where('is_primary', true)->each(
            static fn (Mirror $mirror) => SyncMirrorJob::dispatch($mirror, $release->fresh())
        );

        return back()->with('success', 'Release published and primary mirror sync queued.');
    }

    public function archive(Release $release, AuditLogger $audit): RedirectResponse
    {
        $release->update(['status' => ReleaseStatus::Archived]);
        $audit->log('release.archived', $release);

        return back()->with('success', 'Release archived.');
    }

    public function destroy(Release $release, AuditLogger $audit): RedirectResponse
    {
        if ($release->status !== ReleaseStatus::Draft) {
            return back()->with('error', 'Published releases cannot be deleted.');
        }

        $audit->log('release.deleted', $release, before: [
            'version' => $release->version,
            'channel' => $release->channel->value,
        ]);

        $release->delete();

        return back()->with('success', 'Release deleted.');
    }
}
