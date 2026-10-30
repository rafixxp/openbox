<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * Envelope used by every JSON API response:
 * { success, data, error, meta }
 */
final class ApiResponse
{
    /** @param array<string, mixed> $meta */
    public static function success(mixed $data = null, array $meta = [], int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'error' => null,
            'meta' => $meta === [] ? (object) [] : $meta,
        ], $status);
    }

    /** @param array<string, mixed> $details @param array<string, mixed> $meta */
    public static function error(
        string $code,
        string $message,
        array $details = [],
        int $status = 422,
        array $meta = [],
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'data' => null,
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details === [] ? (object) [] : $details,
            ],
            'meta' => $meta === [] ? (object) [] : $meta,
        ], $status);
    }
}
