<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BuildStatus;
use App\Http\Resources\BuildResource;
use App\Models\Build;
use App\Models\DebianPackage;
use App\Models\Mirror;
use App\Models\PanelNotification;
use App\Models\Release;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $since = now()->subDays(30);

        $totalFinished = Build::query()
            ->whereIn('status', [BuildStatus::Succeeded, BuildStatus::Failed])
            ->where('created_at', '>=', $since)
            ->count();

        $succeeded = Build::query()
            ->where('status', BuildStatus::Succeeded)
            ->where('created_at', '>=', $since)
            ->count();

        $recentFinished = Build::query()
            ->whereNotNull('started_at')
            ->whereNotNull('finished_at')
            ->latest('finished_at')
            ->limit(50)
            ->get();

        $averageSeconds = (int) round($recentFinished->avg(
            static fn (Build $build): float => (float) $build->started_at->diffInSeconds($build->finished_at)
        ) ?? 0);

        $recentBuilds = Build::query()
            ->with('requestedBy')
            ->latest()
            ->limit(8)
            ->get();

        return Inertia::render('Dashboard', [
            'metrics' => [
                'activeBuilds' => Build::query()->whereIn('status', ['queued', 'dispatching', 'running'])->count(),
                'successRate' => $totalFinished === 0 ? 0 : (int) round(($succeeded / $totalFinished) * 100),
                'averageBuildSeconds' => $averageSeconds,
                'publishedReleases' => Release::query()->where('status', 'published')->count(),
                'packages' => DebianPackage::query()->count(),
                'onlineMirrors' => Mirror::query()->where('status', 'online')->count(),
                'totalMirrors' => Mirror::query()->count(),
            ],
            'recentBuilds' => BuildResource::collection($recentBuilds)->resolve($request),
            'mirrors' => Mirror::query()->orderByDesc('is_primary')->limit(6)->get(['id', 'name', 'status', 'last_synced_at', 'latency_ms']),
            'notifications' => PanelNotification::query()->latest()->limit(5)->get(),
            'canTrigger' => $request->user()->hasPermissionTo('builds.trigger'),
        ]);
    }
}
