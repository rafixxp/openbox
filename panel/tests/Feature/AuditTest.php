<?php

declare(strict_types=1);

use App\Models\AuditLog;
use App\Services\Audit\AuditLogger;
use Database\Seeders\RolePermissionSeeder;

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('chains audit records by hash', function (): void {
    $admin = adminUser();
    $this->actingAs($admin);

    $logger = app(AuditLogger::class);
    $first = $logger->log('test.first', metadata: ['a' => 1]);
    $second = $logger->log('test.second', metadata: ['b' => 2]);

    expect($first->hash)->toHaveLength(64)
        ->and($first->previous_hash)->toBeNull()
        ->and($second->previous_hash)->toBe($first->hash)
        ->and($second->hash)->not->toBe($first->hash);
});

it('refuses to update an audit record', function (): void {
    $admin = adminUser();
    $this->actingAs($admin);

    $log = app(AuditLogger::class)->log('test.immutable');

    expect(fn () => $log->update(['action' => 'tampered']))
        ->toThrow(RuntimeException::class, 'immutable');
});

it('refuses to delete an audit record', function (): void {
    $admin = adminUser();
    $this->actingAs($admin);

    $log = app(AuditLogger::class)->log('test.immutable_delete');

    expect(fn () => $log->delete())
        ->toThrow(RuntimeException::class, 'immutable');

    expect(AuditLog::query()->whereKey($log->id)->exists())->toBeTrue();
});

it('shows the audit trail to permitted users only', function (): void {
    $admin = adminUser();
    app(AuditLogger::class)->log('test.read');

    $this->actingAs($admin)->get('/audit-logs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Audit/Index'));

    $viewer = userWithRole('viewer');
    $this->actingAs($viewer)->get('/audit-logs')->assertForbidden();
});
