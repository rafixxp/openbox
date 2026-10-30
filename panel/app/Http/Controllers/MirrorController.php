<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MirrorStatus;
use App\Http\Requests\Mirror\StoreMirrorRequest;
use App\Http\Resources\MirrorResource;
use App\Jobs\CheckMirrorHealth;
use App\Jobs\SyncMirrorJob;
use App\Models\Mirror;
use App\Models\Release;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MirrorController extends Controller
{
    public function index(Request $request): Response
    {
        $mirrors = Mirror::query()
            ->with(['syncs' => fn ($query) => $query->latest()->limit(3)])
            ->orderByDesc('is_primary')
            ->orderBy('name')
            ->get();

        return Inertia::render('Mirrors/Index', [
            'mirrors' => MirrorResource::collection($mirrors),
            'statuses' => array_map(static fn (MirrorStatus $status): string => $status->value, MirrorStatus::cases()),
            'canManage' => $request->user()->hasPermissionTo('mirrors.manage'),
            'releases' => Release::query()
                ->where('status', 'published')
                ->latest()
                ->get(['id', 'version', 'channel']),
        ]);
    }

    public function store(StoreMirrorRequest $request, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();

        if (($data['is_primary'] ?? false) === true) {
            Mirror::query()->update(['is_primary' => false]);
        }

        $mirror = Mirror::query()->create([
            ...$data,
            'status' => MirrorStatus::from($data['status'] ?? MirrorStatus::Offline->value),
        ]);

        $audit->log('mirror.created', $mirror, after: [
            'name' => $mirror->name,
            'base_url' => $mirror->base_url,
        ]);

        return back()->with('success', 'Mirror added.');
    }

    public function update(StoreMirrorRequest $request, Mirror $mirror, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();
        $before = $mirror->only(['name', 'base_url', 'sync_target', 'region', 'status', 'is_primary']);

        if (($data['is_primary'] ?? false) === true) {
            Mirror::query()->whereKeyNot($mirror->id)->update(['is_primary' => false]);
        }

        if (isset($data['status'])) {
            $data['status'] = MirrorStatus::from((string) $data['status']);
        }

        $mirror->update($data);
        $audit->log('mirror.updated', $mirror, before: $before, after: $mirror->fresh()->only(array_keys($before)));

        return back()->with('success', 'Mirror updated.');
    }

    public function destroy(Mirror $mirror, AuditLogger $audit): RedirectResponse
    {
        $audit->log('mirror.deleted', $mirror, before: ['name' => $mirror->name, 'base_url' => $mirror->base_url]);
        $mirror->delete();

        return back()->with('success', 'Mirror removed.');
    }

    public function check(Mirror $mirror, AuditLogger $audit): RedirectResponse
    {
        $audit->log('mirror.check_requested', $mirror);
        CheckMirrorHealth::dispatch($mirror);

        return back()->with('success', 'Health check queued.');
    }

    public function sync(Request $request, Mirror $mirror, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validate([
            'release_id' => ['nullable', 'integer', 'exists:releases,id'],
        ]);

        $release = isset($data['release_id']) ? Release::query()->find($data['release_id']) : null;

        $audit->log('mirror.sync_requested', $mirror, metadata: ['release' => $release?->version]);
        SyncMirrorJob::dispatch($mirror, $release);

        return back()->with('success', 'Mirror sync queued.');
    }
}
