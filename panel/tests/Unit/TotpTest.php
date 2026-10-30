<?php

declare(strict_types=1);

use App\Services\Totp\Base32;
use App\Services\Totp\TotpService;

it('encodes and decodes base32', function (): void {
    $data = '12345678901234567890';
    $encoded = Base32::encode($data);

    expect($encoded)->toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
        ->and(Base32::decode($encoded))->toBe($data);
});

it('matches the RFC 6238 SHA1 test vector', function (): void {
    $service = new TotpService();
    $secret = Base32::encode('12345678901234567890');

    expect($service->code($secret, 59, 8))->toBe('94287082')
        ->and($service->code($secret, 1111111109, 8))->toBe('07081804');
});

it('generates a valid otpauth provisioning URI', function (): void {
    $service = new TotpService();

    $uri = $service->provisioningUri('JBSWY3DPEHPK3PXP', 'admin@example.com');

    expect($uri)->toStartWith('otpauth://totp/')
        ->and($uri)->toContain('secret=JBSWY3DPEHPK3PXP')
        ->and($uri)->toContain('issuer=Openbox%20Panel');
});

it('generates unique recovery codes and consumes them once', function (): void {
    $service = new TotpService();
    $codes = $service->generateRecoveryCodes();

    expect($codes)->toHaveCount(8)
        ->and(array_unique($codes))->toHaveCount(8);

    $remaining = $service->consumeRecoveryCode($codes, $codes[0]);

    expect($remaining)->toHaveCount(7)
        ->and($remaining)->not->toContain($codes[0])
        ->and($service->consumeRecoveryCode($remaining, $codes[0]))->toBeNull();
});
