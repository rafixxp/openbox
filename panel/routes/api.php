<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AuthTokenController;
use App\Http\Controllers\Api\BuildApiController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Internal\BuildCallbackController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class)->name('api.health');

    Route::post('/auth/token', [AuthTokenController::class, 'store'])
        ->middleware('throttle:login')
        ->name('api.auth.token');

    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {
        Route::get('/builds', [BuildApiController::class, 'index'])
            ->middleware('permission:builds.view')->name('api.builds.index');
        Route::get('/builds/{build}', [BuildApiController::class, 'show'])
            ->middleware('permission:builds.view')->name('api.builds.show');
    });

    Route::prefix('internal/builds/{build}')
        ->middleware(['agent.signature', 'throttle:agent'])
        ->group(function (): void {
            Route::post('/logs', [BuildCallbackController::class, 'logs'])->name('api.internal.builds.logs');
            Route::post('/status', [BuildCallbackController::class, 'status'])->name('api.internal.builds.status');
            Route::post('/complete', [BuildCallbackController::class, 'complete'])->name('api.internal.builds.complete');
        });
});
