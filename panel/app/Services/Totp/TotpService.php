<?php

declare(strict_types=1);

namespace App\Services\Totp;

use App\Models\User;
use Illuminate\Support\Str;

final class TotpService
{
    public function generateSecret(int $bytes = 20): string
    {
        return Base32::encode(random_bytes($bytes));
    }

    public function code(string $secret, ?int $timestamp = null, int $digits = 6, int $period = 30): string
    {
        $timestamp ??= time();
        $counter = intdiv($timestamp, $period);

        $binaryCounter = pack('N*', 0).pack('N*', $counter);
        $hash = hash_hmac('sha1', $binaryCounter, Base32::decode($secret), true);
        $offset = ord($hash[19]) & 0x0F;

        $binary = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        );

        return str_pad((string) ($binary % (10 ** $digits)), $digits, '0', STR_PAD_LEFT);
    }

    public function verify(string $secret, string $code, int $window = 1, int $digits = 6, int $period = 30): bool
    {
        $code = preg_replace('/\s+/', '', $code) ?? '';

        if (! ctype_digit($code) || strlen($code) !== $digits) {
            return false;
        }

        $now = time();

        for ($offset = -$window; $offset <= $window; $offset++) {
            $candidate = $this->code($secret, $now + ($offset * $period), $digits, $period);
            if (hash_equals($candidate, $code)) {
                return true;
            }
        }

        return false;
    }

    public function provisioningUri(
        string $secret,
        string $account,
        string $issuer = 'Openbox Panel',
        int $digits = 6,
        int $period = 30,
    ): string {
        $label = rawurlencode($issuer).':'.rawurlencode($account);

        return sprintf(
            'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d',
            $label,
            $secret,
            rawurlencode($issuer),
            $digits,
            $period,
        );
    }

    /** @return list<string> */
    public function generateRecoveryCodes(int $count = 8): array
    {
        return collect(range(1, $count))
            ->map(static fn (): string => Str::upper(Str::random(5).'-'.Str::random(5)))
            ->values()
            ->all();
    }

    /**
     * Consume a recovery code. Returns the remaining codes, or null when the
     * code is invalid. The caller must persist the returned array.
     *
     * @param  array<int, string>  $codes
     * @return array<int, string>|null
     */
    public function consumeRecoveryCode(array $codes, string $candidate): ?array
    {
        $candidate = Str::upper(trim($candidate));

        foreach ($codes as $index => $code) {
            if (hash_equals(Str::upper($code), $candidate)) {
                unset($codes[$index]);

                return array_values($codes);
            }
        }

        return null;
    }

    public function recoveryCodesFor(User $user): array
    {
        return $user->two_factor_recovery_codes ?? [];
    }
}
