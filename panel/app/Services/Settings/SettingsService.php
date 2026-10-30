<?php

declare(strict_types=1);

namespace App\Services\Settings;

use App\Models\Setting;
use Illuminate\Support\Arr;

final class SettingsService
{
    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'mirror.primary_url' => 'http://deb.debian.org/debian',
        'mirror.fallback_url' => '',
        'mirror.publish_path' => '',
        'build.debian_suite' => 'bookworm',
        'build.architecture' => 'amd64',
        'build.max_parallel' => 1,
        'build.iso_name' => 'openbox-image-amd64.hybrid.iso',
        'notifications.email_enabled' => true,
        'notifications.mail_to' => [],
        'notifications.telegram_enabled' => false,
        'notifications.telegram_chat_id' => '',
        'gpg.key_id' => '',
        'backup.retention_days' => 14,
    ];

    /** @var list<string> */
    public const ENCRYPTED = [
        'notifications.telegram_bot_token',
    ];

    /** @return array<string, mixed> */
    public function all(): array
    {
        $values = [];

        foreach (self::DEFAULTS as $key => $default) {
            $values[$key] = Setting::get($key, $default);
        }

        $values['notifications.telegram_bot_token_configured'] = filled(Setting::get('notifications.telegram_bot_token'));

        return $values;
    }

    /**
     * @param  array<string, mixed>  $flat
     * @return array<string, mixed>
     */
    public function update(array $flat): array
    {
        $allowed = array_merge(array_keys(self::DEFAULTS), self::ENCRYPTED);

        foreach ($flat as $key => $value) {
            if (! in_array($key, $allowed, true)) {
                continue;
            }

            if (in_array($key, self::ENCRYPTED, true) && blank($value)) {
                continue;
            }

            $group = str_contains($key, '.') ? explode('.', $key)[0] : 'general';

            Setting::put(
                $key,
                $value,
                in_array($key, self::ENCRYPTED, true),
                $group,
            );
        }

        return $this->all();
    }

    /** @param array<string, mixed> $nested @return array<string, mixed> */
    public function flatten(array $nested): array
    {
        return Arr::dot($nested);
    }
}
