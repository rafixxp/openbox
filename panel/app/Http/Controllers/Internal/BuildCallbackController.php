<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal;

use App\Enums\BuildStatus;
use App\Http\Controllers\Controller;
use App\Models\Build;
use App\Services\Build\BuildLifecycleService;
use App\Services\Build\BuildLogService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Signed callbacks from the Fastify build agent. Every route in this
 * controller is protected by the agent.signature middleware (HMAC + nonce).
 */
class BuildCallbackController extends Controller
{
    public function logs(Request $request, Build $build, BuildLogService $logs, BuildLifecycleService $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'entries' => ['required', 'array', 'min:1', 'max:200'],
            'entries.*.sequence' => ['required', 'integer', 'min:1'],
            'entries.*.level' => ['sometimes', 'string', Rule::in(['debug', 'info', 'warning', 'error'])],
            'entries.*.message' => ['required', 'string', 'max:32000'],
            'entries.*.loggedAt' => ['sometimes', 'date'],
        ]);

        if ($build->status->isTerminal()) {
            return ApiResponse::success(['accepted' => 0], ['ignored' => 'build is already terminal']);
        }

        if (in_array($build->status, [BuildStatus::Queued, BuildStatus::Dispatching], true)) {
            $lifecycle->markRunning($build, 'agent');
        }

        $created = $logs->appendBatch($build, $data['entries']);

        return ApiResponse::success(['accepted' => $created]);
    }

    public function status(Request $request, Build $build, BuildLifecycleService $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', 'string', Rule::in(['running'])],
            'progress' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'stage' => ['sometimes', 'nullable', 'string', 'max:64'],
        ]);

        if ($build->status->isTerminal()) {
            return ApiResponse::success(['ignored' => true, 'status' => $build->status->value]);
        }

        if (($data['status'] ?? null) === 'running') {
            $lifecycle->markRunning($build, $data['stage'] ?? 'agent');
        }

        if (array_key_exists('progress', $data) || array_key_exists('stage', $data)) {
            $lifecycle->progress($build, (int) ($data['progress'] ?? $build->progress), $data['stage'] ?? null);
        }

        $build->refresh();

        return ApiResponse::success([
            'uuid' => $build->uuid,
            'status' => $build->status->value,
            'progress' => $build->progress,
            'stage' => $build->stage,
        ]);
    }

    public function complete(Request $request, Build $build, BuildLifecycleService $lifecycle): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(['succeeded', 'failed', 'canceled'])],
            'exitCode' => ['nullable', 'integer', 'between:-255,255'],
            'error' => ['nullable', 'string', 'max:4000'],
            'progress' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'artifact' => ['nullable', 'array'],
            'artifact.disk' => ['required_with:artifact', 'string', 'in:s3,local'],
            'artifact.path' => ['required_with:artifact', 'string', 'max:1024'],
            'artifact.size' => ['required_with:artifact', 'integer', 'min:1'],
            'artifact.sha256' => ['required_with:artifact', 'string', 'regex:/^[a-f0-9]{64}$/'],
        ]);

        if ($build->status->isTerminal()) {
            return ApiResponse::success(['ignored' => true, 'status' => $build->status->value]);
        }

        if ($data['status'] === 'succeeded' && empty($data['artifact']['path'])) {
            return ApiResponse::error('artifact_required', 'A succeeded build must include an artifact.', [], 422);
        }

        $status = BuildStatus::from($data['status']);

        $lifecycle->finish(
            $build,
            $status,
            exitCode: $data['exitCode'] ?? null,
            error: $data['error'] ?? null,
            artifact: $data['artifact'] ?? null,
            progress: (int) ($data['progress'] ?? 100),
        );

        return ApiResponse::success([
            'uuid' => $build->uuid,
            'status' => $status->value,
        ]);
    }
}
