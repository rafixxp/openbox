<?php

declare(strict_types=1);

use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureTwoFactorVerified;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\VerifyAgentSignature;
use App\Support\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);

        // Sanctum session/cookie authentication for the SPA.
        $middleware->statefulApi();

        $middleware->alias([
            'permission' => EnsurePermission::class,
            'two-factor' => EnsureTwoFactorVerified::class,
            'agent.signature' => VerifyAgentSignature::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiResponse::error('validation_error', 'The given data was invalid.', $e->errors(), 422);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiResponse::error('unauthenticated', 'Authentication is required.', [], 401);
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiResponse::error('too_many_requests', 'Too many requests.', [
                'retry_after' => $e->getHeaders()['Retry-After'] ?? null,
            ], 429);
        });

        // Any other HTTP exception on the JSON API keeps the envelope shape.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $e->getStatusCode();

            $code = match ($status) {
                400 => 'bad_request',
                401 => 'unauthenticated',
                403 => 'forbidden',
                404 => 'not_found',
                409 => 'conflict',
                419 => 'csrf_token_mismatch',
                422 => 'unprocessable_entity',
                429 => 'too_many_requests',
                503 => 'service_unavailable',
                default => 'http_error',
            };

            return ApiResponse::error(
                $code,
                $e->getMessage() !== '' ? $e->getMessage() : 'The request could not be completed.',
                [],
                $status,
            );
        });

        // Render branded Inertia error pages instead of the default Symfony
        // screen. Inertia handles these on both full page loads and visits.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if ($request->is('api/*')) {
                return null;
            }

            $status = $e->getStatusCode();

            if (! in_array($status, [403, 404, 405, 419, 429, 500, 503], true)) {
                return null;
            }

            return Inertia::render('Errors/Error', [
                'status' => $status,
                'message' => $e->getMessage() !== '' ? $e->getMessage() : null,
            ])->toResponse($request)->setStatusCode($status);
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') || app()->hasDebugModeEnabled()) {
                return null;
            }

            report($e);

            return ApiResponse::error('server_error', 'An unexpected error occurred.', [], 500);
        });
    })
    ->create();
