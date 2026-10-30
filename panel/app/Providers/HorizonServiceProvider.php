<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\Horizon;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    public function boot(): void
    {
        parent::boot();

        Horizon::auth(static function (): bool {
            $user = auth()->user();

            return $user instanceof User && $user->hasPermissionTo('settings.manage');
        });
    }

    protected function gate(): void
    {
        Gate::define('viewHorizon', static function (User $user): bool {
            return $user->hasPermissionTo('settings.manage');
        });
    }
}
