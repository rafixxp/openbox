<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\BuildLog */
class BuildLogResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'sequence' => $this->sequence,
            'level' => $this->level,
            'message' => $this->message,
            'loggedAt' => $this->logged_at?->toIso8601String(),
        ];
    }
}
