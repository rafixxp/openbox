<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\BuildStatus;
use App\Enums\ReleaseChannel;
use App\Models\Build;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Build> */
class BuildFactory extends Factory
{
    protected $model = Build::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'status' => BuildStatus::Queued,
            'channel' => ReleaseChannel::Stable,
            'stage' => null,
            'progress' => 0,
            'requested_by' => User::factory(),
            'manifest' => [
                'schemaVersion' => 1,
                'channel' => 'stable',
                'debian' => [
                    'suite' => 'bookworm',
                    'architecture' => 'amd64',
                    'mirror' => 'http://deb.debian.org/debian',
                ],
                'packages' => [],
                'includePanelInstaller' => false,
                'liveBuild' => [
                    'isolatedWorkspace' => true,
                    'clean' => false,
                    'isoName' => 'openbox-image-amd64.hybrid.iso',
                ],
            ],
        ];
    }

    public function succeeded(): static
    {
        return $this->state(fn (): array => [
            'status' => BuildStatus::Succeeded,
            'progress' => 100,
            'started_at' => now()->subMinutes(10),
            'finished_at' => now(),
            'artifact_disk' => 's3',
            'artifact_path' => 'iso/stable/test/openbox-image-amd64.hybrid.iso',
            'artifact_size' => 254803968,
            'artifact_sha256' => str_repeat('a', 64),
        ]);
    }
}
