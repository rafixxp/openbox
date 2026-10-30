<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Build */
class BuildResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'status' => $this->status->value,
            'channel' => $this->channel->value,
            'stage' => $this->stage,
            'progress' => $this->progress,
            'manifest' => $this->manifest,
            'exitCode' => $this->exit_code,
            'errorMessage' => $this->error_message,
            'agent' => $this->agent,
            'retryOf' => $this->retry_of_id,
            'artifact' => $this->artifact_path === null ? null : [
                'disk' => $this->artifact_disk,
                'size' => $this->artifact_size,
                'sha256' => $this->artifact_sha256,
                'downloadUrl' => route('builds.download', $this->resource),
            ],
            'requestedBy' => $this->whenLoaded('requestedBy', fn (): ?array => $this->requestedBy === null ? null : [
                'id' => $this->requestedBy->id,
                'name' => $this->requestedBy->name,
            ]),
            'logs' => BuildLogResource::collection($this->whenLoaded('logs')),
            'can' => [
                'cancel' => $request->user()?->can('cancel', $this->resource) ?? false,
                'retry' => $request->user()?->can('retry', $this->resource) ?? false,
                'download' => $this->artifact_path !== null
                    && ($request->user()?->can('download', $this->resource) ?? false),
            ],
            'startedAt' => $this->started_at?->toIso8601String(),
            'finishedAt' => $this->finished_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
