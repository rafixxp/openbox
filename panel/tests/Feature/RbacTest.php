<?php

declare(strict_types=1);

use Database\Seeders\RolePermissionSeeder;

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows a viewer to list builds', function (): void {
    $viewer = userWithRole('viewer');

    $this->actingAs($viewer)->get('/builds')->assertOk();
});

it('forbids a viewer from triggering a build', function (): void {
    $viewer = userWithRole('viewer');

    $this->actingAs($viewer)->post('/builds', [
        'channel' => 'stable',
    ])->assertForbidden();
});

it('forbids a viewer from managing users', function (): void {
    $viewer = userWithRole('viewer');

    $this->actingAs($viewer)->get('/users')->assertForbidden();
    $this->actingAs($viewer)->post('/users', [])->assertForbidden();
});

it('lets an admin see every section', function (): void {
    $admin = adminUser();

    $this->actingAs($admin)->get('/')->assertOk();
    $this->actingAs($admin)->get('/builds')->assertOk();
    $this->actingAs($admin)->get('/packages')->assertOk();
    $this->actingAs($admin)->get('/releases')->assertOk();
    $this->actingAs($admin)->get('/mirrors')->assertOk();
    $this->actingAs($admin)->get('/users')->assertOk();
    $this->actingAs($admin)->get('/settings')->assertOk();
    $this->actingAs($admin)->get('/audit-logs')->assertOk();
});

it('exposes permissions to the Inertia page', function (): void {
    $admin = adminUser();

    $this->actingAs($admin)->get('/builds')
        ->assertInertia(fn ($page) => $page
            ->component('Builds/Index')
            ->where('auth.user.roles', ['admin'])
            ->where('canTrigger', true)
        );
});
