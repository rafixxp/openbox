<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Defence in depth: a user with confirmed TOTP can never keep a web session
 * that was established without completing the second factor.
 */
class EnsureTwoFactorVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null
            && $user->hasEnabledTwoFactor()
            && ! $request->session()->get('auth.two_factor_verified', false)) {
            $request->session()->put('auth.two_factor_user_id', $user->id);

            Auth::guard('web')->logout();
            $request->session()->regenerate();

            return redirect()->route('two-factor.challenge');
        }

        return $next($request);
    }
}
