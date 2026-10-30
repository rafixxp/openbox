<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Build;
use App\Models\BuildLog;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BuildLogAppended implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Build $build,
        public BuildLog $log,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('builds.'.$this->build->uuid)];
    }

    public function broadcastAs(): string
    {
        return 'BuildLogAppended';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'sequence' => $this->log->sequence,
            'level' => $this->log->level,
            'message' => $this->log->message,
            'loggedAt' => $this->log->logged_at?->toIso8601String(),
        ];
    }
}
