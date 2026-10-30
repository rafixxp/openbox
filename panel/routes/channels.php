<?php

declare(strict_types=1);

use App\Models\Build;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('builds.{uuid}', static function (User $user, string $uuid): bool {
    if (! $user->hasPermissionTo('builds.view')) {
        return false;
    }

    return Build::query()->where('uuid', $uuid)->exists();
});
