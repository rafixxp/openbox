<?php

declare(strict_types=1);

use App\Models\DebianPackage;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('s3');
});

it('uploads a .deb artifact and stores sha256 metadata', function (): void {
    $maintainer = userWithRole('maintainer');

    $file = UploadedFile::fake()->create('hello_1.0_amd64.deb', 128, 'application/vnd.debian.binary-package');

    $this->actingAs($maintainer)->post('/packages', [
        'artifact' => $file,
        'name' => 'hello',
        'version' => '1.0',
        'architecture' => 'amd64',
        'channel' => 'stable',
        'component' => 'main',
        'description' => 'Hello package',
        'depends' => ['libc6 (>= 2.36)'],
    ])->assertRedirect();

    $package = DebianPackage::query()->firstOrFail();

    expect($package->name)->toBe('hello')
        ->and($package->version)->toBe('1.0')
        ->and($package->sha256)->toHaveLength(64)
        ->and($package->status->value)->toBe('uploaded');

    Storage::disk('s3')->assertExists($package->filename);
});

it('forbids viewers from uploading packages', function (): void {
    $viewer = userWithRole('viewer');

    $this->actingAs($viewer)->post('/packages', [
        'artifact' => UploadedFile::fake()->create('x.deb', 10),
        'channel' => 'stable',
    ])->assertForbidden();
});

it('lists packages for a viewer', function (): void {
    $viewer = userWithRole('viewer');

    $this->actingAs($viewer)->get('/packages')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Packages/Index'));
});
