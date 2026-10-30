<?php

declare(strict_types=1);

use App\Jobs\CheckMirrorHealth;
use App\Models\Mirror;
use Illuminate\Support\Facades\Schedule;

Schedule::command('horizon:snapshot')->everyFiveMinutes();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::command('queue:prune-failed --hours=336')->weekly();

Schedule::call(static function (): void {
    Mirror::query()->each(static fn (Mirror $mirror) => CheckMirrorHealth::dispatch($mirror));
})->hourly()->name('mirror-health')->withoutOverlapping();
