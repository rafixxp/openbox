<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * HMAC-SHA256 service authentication for the Fastify build agent.
 * Not a user authentication mechanism: no session, no Sanctum guard.
 *
 * Canonical string:
 *   timestamp \n nonce \n METHOD \n /path \n sha256(raw body)
 */
class VerifyAgentSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('build.agent.secret');

        if ($secret === '') {
            return ApiResponse::error('agent_not_configured', 'Build agent secret is not configured.', [], 503);
        }

        $timestamp = (string) $request->header('X-Agent-Timestamp', '');
        $nonce = (string) $request->header('X-Agent-Nonce', '');
        $signature = (string) $request->header('X-Agent-Signature', '');

        if (! ctype_digit($timestamp) || $nonce === '' || strlen($nonce) > 128 || $signature === '') {
            return ApiResponse::error('invalid_signature', 'Missing or malformed signature headers.', [], 401);
        }

        if (abs(time() - (int) $timestamp) > 300) {
            return ApiResponse::error('stale_signature', 'Signature timestamp is outside the allowed window.', [], 401);
        }

        $canonical = implode("\n", [
            $timestamp,
            $nonce,
            $request->method(),
            '/'.ltrim($request->path(), '/'),
            hash('sha256', $request->getContent()),
        ]);

        $expected = hash_hmac('sha256', $canonical, $secret);

        if (! hash_equals($expected, $signature)) {
            return ApiResponse::error('invalid_signature', 'Signature verification failed.', [], 401);
        }

        $nonceKey = 'agent-nonce:'.hash('sha256', $nonce);

        if (! Cache::add($nonceKey, true, 600)) {
            return ApiResponse::error('replayed_request', 'This nonce has already been used.', [], 409);
        }

        $request->attributes->set('agent_id', (string) $request->header('X-Agent-Id', 'build-agent'));

        return $next($request);
    }
}
