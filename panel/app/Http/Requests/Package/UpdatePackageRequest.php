<?php

declare(strict_types=1);

namespace App\Http\Requests\Package;

use App\Enums\ReleaseChannel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePackageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('packages.update') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255', 'regex:/^[a-z0-9][a-z0-9+.-]*$/'],
            'version' => ['sometimes', 'string', 'max:128'],
            'architecture' => ['sometimes', 'string', 'max:32', 'in:amd64,arm64,all'],
            'channel' => ['sometimes', Rule::enum(ReleaseChannel::class)],
            'component' => ['sometimes', 'string', 'max:64'],
            'section' => ['sometimes', 'nullable', 'string', 'max:64'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'depends' => ['sometimes', 'array'],
            'depends.*' => ['string', 'max:255'],
        ];
    }
}
