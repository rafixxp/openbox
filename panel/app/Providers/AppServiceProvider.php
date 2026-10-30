<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Build;
use App\Models\User;
use App\Policies\BuildPolicy;
use App\Services\Mirror\MirrorSyncer;
use App\Services\Mirror\RcloneMirrorSyncer;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(MirrorSyncer::class, RcloneMirrorSyncer::class);
    }

    public function boot(): void
    {
        Gate::policy(Build::class, BuildPolicy::class);

        Gate::before(static function (User $user): ?bool {
            return $user->isAdmin() ? true : null;
        });

        RateLimiter::for('login', static function (Request $request): Limit {
            $key = Str::lower((string) $request->input('email')).'|'.$request->ip();

            return Limit::perMinute(5)->by($key);
        });

        RateLimiter::for('two-factor', static function (Request $request): Limit {
            return Limit::perMinute(5)->by((string) $request->session()->get('auth.two_factor_user_id').'|'.$request->ip());
        });

        RateLimiter::for('api', static function (Request $request): Limit {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('agent', static function (Request $request): Limit {
            return Limit::perMinute(600)->by((string) $request->header('X-Agent-Id', $request->ip()));
        });

        Password::defaults(static function (): Password {
            return app()->isProduction()
                ? Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()
                : Password::min(8);
        });
    }
}
