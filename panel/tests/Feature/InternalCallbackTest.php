<?php

declare(strict_types=1);

use App\Enums\BuildStatus;
use App\Models\Build;
use App\Models\BuildLog;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\Queue;

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('accepts signed log batches from the agent', function (): void {
    $build = Build::factory()->create();

    $path = "/api/v1/internal/builds/{$build->uuid}/logs";
    $body = json_encode([
        'entries' => [
            ['sequence' => 1, 'level' => 'info', 'message' => 'stage: bootstrap'],
            ['sequence' => 2, 'level' => 'info', 'message' => 'stage: chroot'],
        ],
    ], JSON_UNESCAPED_SLASHES);

    $response = $this->call(
        'POST',
        $path,
        [],
        [],
        [],
        array_merge([
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], agentSignatureHeaders('POST', $path, $body)),
        $body,
    );

    $response->assertOk()->assertJsonPath('data.accepted', 2);

    expect($build->fresh()->status)->toBe(BuildStatus::Running)
        ->and(BuildLog::query()->where('build_id', $build->id)->count())->toBe(2);
});

it('rejects unsigned callbacks', function (): void {
    $build = Build::factory()->create();

    $this->postJson("/api/v1/internal/builds/{$build->uuid}/logs", [
        'entries' => [['sequence' => 1, 'message' => 'nope']],
    ])->assertStatus(401);
});

it('rejects replayed nonces', function (): void {
    $build = Build::factory()->create();
    $path = "/api/v1/internal/builds/{$build->uuid}/status";
    $body = json_encode(['progress' => 10], JSON_UNESCAPED_SLASHES);
    $headers = array_merge([
        'HTTP_ACCEPT' => 'application/json',
        'CONTENT_TYPE' => 'application/json',
    ], agentSignatureHeaders('POST', $path, $body));

    $this->call('POST', $path, [], [], [], $headers, $body)->assertOk();
    $this->call('POST', $path, [], [], [], $headers, $body)->assertStatus(409);
});

it('completes a build with a signed artifact payload', function (): void {
    Queue::fake();

    $build = Build::factory()->create();
    $path = "/api/v1/internal/builds/{$build->uuid}/complete";
    $body = json_encode([
        'status' => 'succeeded',
        'exitCode' => 0,
        'artifact' => [
            'disk' => 's3',
            'path' => 'iso/stable/'.$build->uuid.'/openbox.iso',
            'size' => 1024,
            'sha256' => str_repeat('b', 64),
        ],
    ], JSON_UNESCAPED_SLASHES);

    $this->call(
        'POST',
        $path,
        [],
        [],
        [],
        array_merge([
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], agentSignatureHeaders('POST', $path, $body)),
        $body,
    )->assertOk();

    $build->refresh();

    expect($build->status)->toBe(BuildStatus::Succeeded)
        ->and($build->artifact_sha256)->toBe(str_repeat('b', 64))
        ->and($build->progress)->toBe(100);
});

it('requires an artifact for a succeeded callback', function (): void {
    Queue::fake();

    $build = Build::factory()->create();
    $path = "/api/v1/internal/builds/{$build->uuid}/complete";
    $body = json_encode(['status' => 'succeeded'], JSON_UNESCAPED_SLASHES);

    $this->call(
        'POST',
        $path,
        [],
        [],
        [],
        array_merge([
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], agentSignatureHeaders('POST', $path, $body)),
        $body,
    )->assertStatus(422)->assertJsonPath('error.code', 'artifact_required');
});
