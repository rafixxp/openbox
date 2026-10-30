<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AuditLog */
class AuditLogResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'actorName' => $this->actor_name,
            'action' => $this->action,
            'subjectType' => $this->subject_type,
            'subjectId' => $this->subject_id,
            'metadata' => $this->metadata ?? [],
            'ipAddress' => $this->ip_address,
            'hash' => $this->hash,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
