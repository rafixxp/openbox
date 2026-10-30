<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Totp\TotpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TwoFactorChallengeController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        if (! $request->session()->has('auth.two_factor_user_id')) {
            return redirect()->route('login');
        }

        return Inertia::render('Auth/TwoFactorChallenge');
    }

    public function store(Request $request, TotpService $totp, AuditLogger $audit): RedirectResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'max:32'],
        ]);

        $userId = $request->session()->get('auth.two_factor_user_id');
        $user = $userId === null ? null : User::query()->find($userId);

        if (! $user instanceof User || ! $user->hasEnabledTwoFactor()) {
            $request->session()->forget('auth.two_factor_user_id');

            return redirect()->route('login')->withErrors(['email' => 'Your two-factor session expired.']);
        }

        $code = (string) $request->input('code');
        $valid = $totp->verify((string) $user->two_factor_secret, $code);

        if (! $valid) {
            $remaining = $totp->consumeRecoveryCode($user->two_factor_recovery_codes ?? [], $code);

            if ($remaining === null) {
                throw ValidationException::withMessages([
                    'code' => 'The provided two-factor code is invalid.',
                ]);
            }

            $user->forceFill(['two_factor_recovery_codes' => $remaining])->save();
            $valid = true;
        }

        $remember = (bool) $request->session()->pull('auth.two_factor_remember', false);

        Auth::guard('web')->login($user, $remember);
        $request->session()->regenerate();
        $request->session()->put('auth.two_factor_verified', true);
        $request->session()->forget('auth.two_factor_user_id');

        $audit->log('auth.login', $user, metadata: ['method' => 'totp']);

        return redirect()->intended(route('dashboard'));
    }
}
