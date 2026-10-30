<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Mirror */
class MirrorResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'baseUrl' => $this->base_url,
            'syncTarget' => $this->sync_target,
            'region' => $this->region,
            'status' => $this->status->value,
            'isPrimary' => $this->is_primary,
            'latencyMs' => $this->latency_ms,
            'lastError' => $this->last_error,
            'lastSyncedAt' => $this->last_synced_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
