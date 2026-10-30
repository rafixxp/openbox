<?php

declare(strict_types=1);

namespace App\Http\Requests\Package;

use App\Enums\ReleaseChannel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePackageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('packages.create') ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'artifact' => ['required', 'file', 'max:524288', 'extensions:deb'],
            'name' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9][a-z0-9+.-]*$/'],
            'version' => ['nullable', 'string', 'max:128'],
            'architecture' => ['nullable', 'string', 'max:32', 'in:amd64,arm64,all'],
            'channel' => ['required', Rule::enum(ReleaseChannel::class)],
            'component' => ['nullable', 'string', 'max:64'],
            'section' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:2000'],
            'depends' => ['nullable', 'array'],
            'depends.*' => ['string', 'max:255'],
        ];
    }
}
