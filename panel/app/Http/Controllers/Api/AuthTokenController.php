<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\CreateTokenRequest;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Totp\TotpService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthTokenController extends Controller
{
    public function store(CreateTokenRequest $request, TotpService $totp, AuditLogger $audit): JsonResponse
    {
        $data = $request->validated();

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user instanceof User || ! Hash::check($data['password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        if ($user->hasEnabledTwoFactor()) {
            $otp = (string) ($data['otp'] ?? '');

            if ($otp === '') {
                throw ValidationException::withMessages(['otp' => 'A two-factor code is required.']);
            }

            $valid = $totp->verify((string) $user->two_factor_secret, $otp);

            if (! $valid) {
                $remaining = $totp->consumeRecoveryCode($user->two_factor_recovery_codes ?? [], $otp);

                if ($remaining === null) {
                    throw ValidationException::withMessages(['otp' => 'The two-factor code is invalid.']);
                }

                $user->forceFill(['two_factor_recovery_codes' => $remaining])->save();
            }
        }

        $abilities = $user->isAdmin() ? ['*'] : $user->permissionNames();
        $expiresAt = now()->addDays(30);

        $token = $user->createToken($data['device_name'], $abilities, $expiresAt);

        Auth::setUser($user);
        $audit->log('auth.api_token.created', $user, metadata: [
            'device_name' => $data['device_name'],
            'abilities' => $abilities,
        ]);

        return ApiResponse::success([
            'token' => $token->plainTextToken,
            'type' => 'Bearer',
            'expiresAt' => $expiresAt->toIso8601String(),
            'abilities' => $abilities,
        ]);
    }
}
