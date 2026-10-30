<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Release */
class ReleaseResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'channel' => $this->channel->value,
            'codename' => $this->codename,
            'status' => $this->status->value,
            'notes' => $this->notes,
            'checksums' => $this->checksums ?? [],
            'build' => $this->whenLoaded('isoBuild', fn (): ?array => $this->isoBuild === null ? null : [
                'uuid' => $this->isoBuild->uuid,
                'status' => $this->isoBuild->status->value,
            ]),
            'publishedAt' => $this->published_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
