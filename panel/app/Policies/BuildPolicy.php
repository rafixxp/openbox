<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Build;
use App\Models\User;

class BuildPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('builds.view');
    }

    public function view(User $user, Build $build): bool
    {
        return $user->hasPermissionTo('builds.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('builds.trigger');
    }

    public function cancel(User $user, Build $build): bool
    {
        return $user->hasPermissionTo('builds.cancel');
    }

    public function retry(User $user, Build $build): bool
    {
        return $user->hasPermissionTo('builds.trigger');
    }

    public function download(User $user, Build $build): bool
    {
        return $user->hasPermissionTo('builds.download');
    }
}
