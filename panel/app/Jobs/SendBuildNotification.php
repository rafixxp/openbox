<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Build;
use App\Services\Notifications\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendBuildNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [10, 30];

    public function __construct(public Build $build)
    {
        $this->onQueue('default');
    }

    public function handle(NotificationService $notifications): void
    {
        $notifications->buildFinished($this->build->fresh() ?? $this->build);
    }
}
