<?php

declare(strict_types=1);

namespace App\Http\Requests\Build;

use App\Enums\ReleaseChannel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBuildRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('builds.trigger') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'channel' => ['required', Rule::enum(ReleaseChannel::class)],
            'clean' => ['sometimes', 'boolean'],
            'include_panel_installer' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'idempotency_key' => ['nullable', 'uuid'],
        ];
    }
}
