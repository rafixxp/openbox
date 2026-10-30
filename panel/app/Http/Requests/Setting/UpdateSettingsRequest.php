<?php

declare(strict_types=1);

namespace App\Http\Requests\Setting;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('settings.manage') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'settings' => ['required', 'array'],
            'settings.mirror.primary_url' => ['sometimes', 'url', 'max:2048'],
            'settings.mirror.fallback_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'settings.mirror.publish_path' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings.build.debian_suite' => ['sometimes', 'string', 'in:bookworm'],
            'settings.build.architecture' => ['sometimes', 'string', 'in:amd64,arm64'],
            'settings.build.max_parallel' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'settings.build.iso_name' => ['sometimes', 'string', 'max:255', 'regex:/^[A-Za-z0-9][A-Za-z0-9._-]*\.iso$/'],
            'settings.notifications.email_enabled' => ['sometimes', 'boolean'],
            'settings.notifications.mail_to' => ['sometimes', 'array', 'max:20'],
            'settings.notifications.mail_to.*' => ['email'],
            'settings.notifications.telegram_enabled' => ['sometimes', 'boolean'],
            'settings.notifications.telegram_chat_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'settings.notifications.telegram_bot_token' => ['sometimes', 'nullable', 'string', 'max:255'],
            'settings.gpg.key_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'settings.backup.retention_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
        ];
    }
}
