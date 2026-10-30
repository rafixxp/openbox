<?php

declare(strict_types=1);

use App\Enums\BuildStatus;
use App\Jobs\CancelIsoBuild;
use App\Jobs\StartIsoBuild;
use App\Models\AuditLog;
use App\Models\Build;
use App\Models\BuildLog;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\Queue;

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('queues a build and audits the trigger', function (): void {
    Queue::fake();
    $admin = adminUser();

    $response = $this->actingAs($admin)->post('/builds', [
        'channel' => 'stable',
        'clean' => false,
        'include_panel_installer' => false,
        'notes' => 'Release candidate',
    ]);

    $build = Build::query()->firstOrFail();

    $response->assertRedirect(route('builds.show', $build));

    expect($build->status)->toBe(BuildStatus::Queued)
        ->and($build->requested_by)->toBe($admin->id)
        ->and($build->manifest['channel'])->toBe('stable')
        ->and($build->manifest['notes'])->toBe('Release candidate');

    Queue::assertPushed(StartIsoBuild::class);
    expect(AuditLog::query()->where('action', 'build.triggered')->exists())->toBeTrue();
});

it('is idempotent when the client supplies an idempotency key', function (): void {
    Queue::fake();
    $admin = adminUser();
    $key = '3f8a2f74-6e57-4f2b-9b1e-1f7b2b0a4c11';

    $this->actingAs($admin)->post('/builds', ['channel' => 'stable', 'idempotency_key' => $key]);
    $this->actingAs($admin)->post('/builds', ['channel' => 'stable', 'idempotency_key' => $key]);

    expect(Build::query()->count())->toBe(1);
});

it('streams log lines over the polling endpoint', function (): void {
    $admin = adminUser();
    $build = Build::factory()->create(['requested_by' => $admin->id]);

    BuildLog::query()->create([
        'build_id' => $build->id,
        'sequence' => 1,
        'level' => 'info',
        'message' => 'lb build started',
        'logged_at' => now(),
    ]);

    $this->actingAs($admin)
        ->getJson("/builds/{$build->uuid}/logs?after=0")
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.0.message', 'lb build started')
        ->assertJsonPath('meta.latestSequence', 1);
});

it('queues cancellation for an active build', function (): void {
    Queue::fake();
    $admin = adminUser();
    $build = Build::factory()->create(['requested_by' => $admin->id]);

    $this->actingAs($admin)->post("/builds/{$build->uuid}/cancel")
        ->assertRedirect();

    Queue::assertPushed(CancelIsoBuild::class);
});

it('shows a build with its latest logs', function (): void {
    $admin = adminUser();
    $build = Build::factory()->create(['requested_by' => $admin->id]);
    BuildLog::query()->create([
        'build_id' => $build->id,
        'sequence' => 1,
        'level' => 'info',
        'message' => 'hello',
        'logged_at' => now(),
    ]);

    $this->actingAs($admin)->get("/builds/{$build->uuid}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Builds/Show')
            ->where('build.uuid', $build->uuid)
            ->where('build.logs.0.message', 'hello')
        );
});

it('returns 404 when downloading a build without an artifact', function (): void {
    $admin = adminUser();
    $build = Build::factory()->create(['requested_by' => $admin->id]);

    $this->actingAs($admin)->get("/builds/{$build->uuid}/download")->assertNotFound();
});
