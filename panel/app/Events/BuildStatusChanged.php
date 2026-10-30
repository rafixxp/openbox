<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Build;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BuildStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Build $build) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('builds.'.$this->build->uuid)];
    }

    public function broadcastAs(): string
    {
        return 'BuildStatusChanged';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'uuid' => $this->build->uuid,
            'status' => $this->build->status->value,
            'stage' => $this->build->stage,
            'progress' => $this->build->progress,
            'exitCode' => $this->build->exit_code,
            'errorMessage' => $this->build->error_message,
            'artifactSize' => $this->build->artifact_size,
            'artifactSha256' => $this->build->artifact_sha256,
            'finishedAt' => $this->build->finished_at?->toIso8601String(),
        ];
    }
}
