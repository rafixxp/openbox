<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'status' => session('status'),
        ]);
    }

    public function store(LoginRequest $request, AuditLogger $audit): RedirectResponse
    {
        $request->authenticate();

        $user = $request->user();

        if ($user !== null && $user->hasEnabledTwoFactor()) {
            Auth::guard('web')->logout();

            $request->session()->put('auth.two_factor_user_id', $user->id);
            $request->session()->put('auth.two_factor_remember', $request->boolean('remember'));
            $request->session()->regenerate();

            return redirect()->route('two-factor.challenge');
        }

        $request->session()->regenerate();
        $request->session()->put('auth.two_factor_verified', true);

        $audit->log('auth.login', $user, metadata: ['method' => 'password']);

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request, AuditLogger $audit): RedirectResponse
    {
        $user = $request->user();

        if ($user !== null) {
            $audit->log('auth.logout', $user);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
