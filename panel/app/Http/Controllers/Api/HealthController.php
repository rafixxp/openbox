<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->check(static fn () => DB::select('select 1')),
            'redis' => $this->check(static fn () => Redis::connection()->ping()),
        ];

        $ok = ! in_array(false, $checks, true);

        return ApiResponse::success(
            ['status' => $ok ? 'ok' : 'degraded', 'checks' => $checks, 'version' => config('app.version', '1.0.0')],
            status: $ok ? 200 : 503,
        );
    }

    private function check(callable $callback): bool
    {
        try {
            $callback();

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
