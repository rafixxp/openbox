<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Totp\TotpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TwoFactorSetupController extends Controller
{
    public function show(Request $request, TotpService $totp): Response
    {
        $user = $request->user();
        $secret = $user->two_factor_secret;
        $pending = filled($secret) && ! $user->hasEnabledTwoFactor();

        return Inertia::render('Profile/TwoFactor', [
            'enabled' => $user->hasEnabledTwoFactor(),
            'pending' => $pending,
            'secret' => $pending ? $secret : null,
            'otpauthUri' => $pending && $secret
                ? $totp->provisioningUri($secret, $user->email, (string) config('app.name'))
                : null,
            'recoveryCodesRemaining' => count($user->two_factor_recovery_codes ?? []),
        ]);
    }

    public function enable(Request $request, AuditLogger $audit, TotpService $totp): RedirectResponse
    {
        $user = $request->user();

        if ($user->hasEnabledTwoFactor()) {
            return back()->with('error', 'Two-factor authentication is already enabled.');
        }

        $secret = $totp->generateSecret();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        $audit->log('auth.two_factor.enable_started', $user);

        return back()->with('success', 'Scan the secret in your authenticator app, then confirm with a code.');
    }

    public function confirm(Request $request, AuditLogger $audit, TotpService $totp): RedirectResponse
    {
        $request->validate(['code' => ['required', 'string', 'max:16']]);

        $user = $request->user();

        if (! filled($user->two_factor_secret)) {
            return back()->with('error', 'Start the two-factor setup first.');
        }

        if (! $totp->verify((string) $user->two_factor_secret, (string) $request->input('code'))) {
            throw ValidationException::withMessages(['code' => 'The two-factor code is invalid.']);
        }

        $codes = $totp->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $codes,
        ])->save();

        $request->session()->put('auth.two_factor_verified', true);

        $audit->log('auth.two_factor.enabled', $user);

        return redirect()->route('profile.two-factor.show')
            ->with('success', 'Two-factor authentication enabled.')
            ->with('recoveryCodes', $codes);
    }

    public function disable(Request $request, AuditLogger $audit): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'string'],
            'code' => ['required', 'string', 'max:16'],
        ]);

        $user = $request->user();

        if (! Hash::check((string) $request->input('password'), (string) $user->password)) {
            throw ValidationException::withMessages(['password' => 'The password is incorrect.']);
        }

        if (! $this->verifyCode($request, $user)) {
            throw ValidationException::withMessages(['code' => 'The two-factor code is invalid.']);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        $request->session()->put('auth.two_factor_verified', true);

        $audit->log('auth.two_factor.disabled', $user);

        return back()->with('success', 'Two-factor authentication disabled.');
    }

    public function regenerateRecoveryCodes(Request $request, AuditLogger $audit, TotpService $totp): RedirectResponse
    {
        $request->validate(['password' => ['required', 'string']]);

        $user = $request->user();

        if (! Hash::check((string) $request->input('password'), (string) $user->password)) {
            throw ValidationException::withMessages(['password' => 'The password is incorrect.']);
        }

        if (! $user->hasEnabledTwoFactor()) {
            return back()->with('error', 'Two-factor authentication is not enabled.');
        }

        $codes = $totp->generateRecoveryCodes();
        $user->forceFill(['two_factor_recovery_codes' => $codes])->save();

        $audit->log('auth.two_factor.recovery_codes_regenerated', $user);

        return back()
            ->with('success', 'Recovery codes regenerated.')
            ->with('recoveryCodes', $codes);
    }

    private function verifyCode(Request $request, User $user): bool
    {
        $totp = app(TotpService::class);
        $code = (string) $request->input('code');

        if ($totp->verify((string) $user->two_factor_secret, $code)) {
            return true;
        }

        $remaining = $totp->consumeRecoveryCode($user->two_factor_recovery_codes ?? [], $code);

        if ($remaining === null) {
            return false;
        }

        $user->forceFill(['two_factor_recovery_codes' => $remaining])->save();

        return true;
    }
}
