<?php

declare(strict_types=1);

namespace App\Http\Requests\Mirror;

use App\Enums\MirrorStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMirrorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('mirrors.manage') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'base_url' => ['required', 'url', 'max:2048'],
            'sync_target' => ['nullable', 'string', 'max:2048'],
            'region' => ['nullable', 'string', 'max:64'],
            'status' => ['sometimes', Rule::enum(MirrorStatus::class)],
            'is_primary' => ['sometimes', 'boolean'],
        ];
    }
}
