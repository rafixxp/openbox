<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->roles->pluck('name')->values()->all(),
            'twoFactorEnabled' => $this->hasEnabledTwoFactor(),
            'lastLoginAt' => null,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
