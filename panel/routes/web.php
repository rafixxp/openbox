<?php

declare(strict_types=1);

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\TwoFactorChallengeController;
use App\Http\Controllers\Auth\TwoFactorSetupController;
use App\Http\Controllers\BuildController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MirrorController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\ReleaseController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login');

    Route::get('/two-factor-challenge', [TwoFactorChallengeController::class, 'create'])->name('two-factor.challenge');
    Route::post('/two-factor-challenge', [TwoFactorChallengeController::class, 'store'])->middleware('throttle:two-factor');
});

Route::middleware(['auth:sanctum', 'two-factor'])->group(function (): void {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::get('/profile/two-factor', [TwoFactorSetupController::class, 'show'])->name('profile.two-factor.show');
    Route::post('/profile/two-factor/enable', [TwoFactorSetupController::class, 'enable'])->name('profile.two-factor.enable');
    Route::post('/profile/two-factor/confirm', [TwoFactorSetupController::class, 'confirm'])->name('profile.two-factor.confirm');
    Route::delete('/profile/two-factor', [TwoFactorSetupController::class, 'disable'])->name('profile.two-factor.disable');
    Route::post('/profile/two-factor/recovery-codes', [TwoFactorSetupController::class, 'regenerateRecoveryCodes'])
        ->name('profile.two-factor.recovery-codes');

    Route::get('/builds', [BuildController::class, 'index'])
        ->middleware('permission:builds.view')->name('builds.index');
    Route::post('/builds', [BuildController::class, 'store'])
        ->middleware('permission:builds.trigger')->name('builds.store');
    Route::get('/builds/{build}', [BuildController::class, 'show'])
        ->middleware('permission:builds.view')->name('builds.show');
    Route::get('/builds/{build}/logs', [BuildController::class, 'logs'])
        ->middleware('permission:builds.view')->name('builds.logs');
    Route::get('/builds/{build}/status', [BuildController::class, 'status'])
        ->middleware('permission:builds.view')->name('builds.status');
    Route::post('/builds/{build}/retry', [BuildController::class, 'retry'])
        ->middleware('permission:builds.trigger')->name('builds.retry');
    Route::post('/builds/{build}/cancel', [BuildController::class, 'cancel'])
        ->middleware('permission:builds.cancel')->name('builds.cancel');
    Route::get('/builds/{build}/download', [BuildController::class, 'download'])
        ->middleware('permission:builds.download')->name('builds.download');

    Route::get('/packages', [PackageController::class, 'index'])
        ->middleware('permission:packages.view')->name('packages.index');
    Route::post('/packages', [PackageController::class, 'store'])
        ->middleware('permission:packages.create')->name('packages.store');
    Route::put('/packages/{package}', [PackageController::class, 'update'])
        ->middleware('permission:packages.update')->name('packages.update');
    Route::delete('/packages/{package}', [PackageController::class, 'destroy'])
        ->middleware('permission:packages.delete')->name('packages.destroy');
    Route::post('/packages/{package}/sign', [PackageController::class, 'sign'])
        ->middleware('permission:packages.sign')->name('packages.sign');
    Route::get('/packages/{package}/download', [PackageController::class, 'download'])
        ->middleware('permission:packages.view')->name('packages.download');

    Route::get('/releases', [ReleaseController::class, 'index'])
        ->middleware('permission:releases.view')->name('releases.index');
    Route::post('/releases', [ReleaseController::class, 'store'])
        ->middleware('permission:releases.manage')->name('releases.store');
    Route::post('/releases/{release}/publish', [ReleaseController::class, 'publish'])
        ->middleware('permission:releases.publish')->name('releases.publish');
    Route::post('/releases/{release}/archive', [ReleaseController::class, 'archive'])
        ->middleware('permission:releases.manage')->name('releases.archive');
    Route::delete('/releases/{release}', [ReleaseController::class, 'destroy'])
        ->middleware('permission:releases.manage')->name('releases.destroy');

    Route::get('/mirrors', [MirrorController::class, 'index'])
        ->middleware('permission:mirrors.view')->name('mirrors.index');
    Route::post('/mirrors', [MirrorController::class, 'store'])
        ->middleware('permission:mirrors.manage')->name('mirrors.store');
    Route::put('/mirrors/{mirror}', [MirrorController::class, 'update'])
        ->middleware('permission:mirrors.manage')->name('mirrors.update');
    Route::delete('/mirrors/{mirror}', [MirrorController::class, 'destroy'])
        ->middleware('permission:mirrors.manage')->name('mirrors.destroy');
    Route::post('/mirrors/{mirror}/check', [MirrorController::class, 'check'])
        ->middleware('permission:mirrors.manage')->name('mirrors.check');
    Route::post('/mirrors/{mirror}/sync', [MirrorController::class, 'sync'])
        ->middleware('permission:mirrors.manage')->name('mirrors.sync');

    Route::get('/users', [UserController::class, 'index'])
        ->middleware('permission:users.view')->name('users.index');
    Route::post('/users', [UserController::class, 'store'])
        ->middleware('permission:users.manage')->name('users.store');
    Route::put('/users/{user}', [UserController::class, 'update'])
        ->middleware('permission:users.manage')->name('users.update');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])
        ->middleware('permission:users.manage')->name('users.destroy');

    Route::get('/settings', [SettingController::class, 'index'])
        ->middleware('permission:settings.view')->name('settings.index');
    Route::put('/settings', [SettingController::class, 'update'])
        ->middleware('permission:settings.manage')->name('settings.update');
    Route::post('/settings/notifications/test', [SettingController::class, 'testNotification'])
        ->middleware('permission:settings.manage')->name('settings.notifications.test');
    Route::post('/settings/backups', [SettingController::class, 'backup'])
        ->middleware('permission:settings.manage')->name('settings.backups.create');
    Route::post('/settings/backups/{backup}/restore', [SettingController::class, 'restore'])
        ->middleware('permission:settings.manage')->name('settings.backups.restore');
    Route::get('/settings/backups/{backup}/download', [SettingController::class, 'downloadBackup'])
        ->middleware('permission:settings.manage')->name('settings.backups.download');

    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('permission:audit.view')->name('audit.index');
});
