<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\DebianPackage */
class PackageResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'version' => $this->version,
            'architecture' => $this->architecture,
            'channel' => $this->channel->value,
            'component' => $this->component,
            'section' => $this->section,
            'description' => $this->description,
            'depends' => $this->depends ?? [],
            'size' => $this->size,
            'sha256' => $this->sha256,
            'status' => $this->status->value,
            'gpgKeyId' => $this->gpg_key_id,
            'uploadedBy' => $this->whenLoaded('uploader', fn (): ?array => $this->uploader === null ? null : [
                'id' => $this->uploader->id,
                'name' => $this->uploader->name,
            ]),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
