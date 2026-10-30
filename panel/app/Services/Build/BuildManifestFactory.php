<?php

declare(strict_types=1);

namespace App\Services\Build;

use App\Enums\ReleaseChannel;
use App\Models\DebianPackage;
use App\Models\Setting;
use App\Models\User;

final class BuildManifestFactory
{
    /**
     * Build the JSONB manifest persisted with every build. The manifest is the
     * only input the build agent/script trusts; it never accepts shell input.
     *
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function make(ReleaseChannel $channel, array $options = [], ?User $user = null): array
    {
        $packages = DebianPackage::query()
            ->where('channel', $channel->value)
            ->whereIn('status', ['signed', 'published'])
            ->orderBy('name')
            ->get(['name', 'version', 'architecture'])
            ->map(static fn (DebianPackage $package): array => [
                'name' => $package->name,
                'version' => $package->version,
                'architecture' => $package->architecture,
            ])
            ->all();

        $installerPath = (string) config('build.panel_installer');
        $includePanelInstaller = (bool) ($options['includePanelInstaller'] ?? false);

        $manifest = [
            'schemaVersion' => 1,
            'channel' => $channel->value,
            'debian' => [
                'suite' => (string) Setting::get('build.debian_suite', 'bookworm'),
                'architecture' => (string) Setting::get('build.architecture', 'amd64'),
                'mirror' => (string) Setting::get('mirror.primary_url', 'http://deb.debian.org/debian'),
            ],
            'packages' => $packages,
            'includePanelInstaller' => $includePanelInstaller,
            'panelInstaller' => $includePanelInstaller && is_file($installerPath)
                ? [
                    'filename' => basename($installerPath),
                    'sha256' => hash_file('sha256', $installerPath),
                ]
                : null,
            'liveBuild' => [
                'isolatedWorkspace' => (bool) config('build.isolated_workspace'),
                'clean' => (bool) ($options['clean'] ?? false),
                'isoName' => (string) config('build.iso_name'),
            ],
            'requestedBy' => $user?->email,
            'createdAt' => now()->toIso8601String(),
        ];

        if (isset($options['notes']) && is_string($options['notes'])) {
            $manifest['notes'] = mb_substr(strip_tags($options['notes']), 0, 2000);
        }

        return $manifest;
    }
}
