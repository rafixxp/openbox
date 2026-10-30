<?php

declare(strict_types=1);

namespace App\Http\Requests\Release;

use App\Enums\ReleaseChannel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReleaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('releases.manage') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'version' => ['required', 'string', 'max:64', 'regex:/^[0-9A-Za-z.+~-]+$/'],
            'channel' => ['required', Rule::enum(ReleaseChannel::class)],
            'codename' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'iso_build_uuid' => ['nullable', 'uuid', 'exists:builds,uuid'],
        ];
    }
}
