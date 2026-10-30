<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Enums\BuildStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\BuildResource;
use App\Models\Build;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BuildApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Build::class);

        $filters = $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', array_map(static fn (BuildStatus $s): string => $s->value, BuildStatus::cases()))],
            'channel' => ['nullable', 'string', 'in:stable,testing'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $paginator = Build::query()
            ->with('requestedBy')
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['channel'] ?? null, fn ($query, string $channel) => $query->where('channel', $channel))
            ->latest()
            ->paginate((int) ($filters['per_page'] ?? 20));

        $data = $paginator->getCollection()
            ->map(static fn (Build $build): array => (new BuildResource($build))->resolve($request))
            ->values()
            ->all();

        return ApiResponse::success($data, [
            'currentPage' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
            'lastPage' => $paginator->lastPage(),
        ]);
    }

    public function show(Request $request, Build $build): JsonResponse
    {
        $this->authorize('view', $build);

        $build->load(['requestedBy', 'logs' => fn ($query) => $query->latest('sequence')->limit(500)]);

        return ApiResponse::success((new BuildResource($build))->resolve($request));
    }
}
