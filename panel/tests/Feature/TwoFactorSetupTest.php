<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\Totp\TotpService;
use Database\Seeders\RolePermissionSeeder;

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('enables and confirms TOTP for the current user', function (): void {
    $admin = adminUser();
    $totp = app(TotpService::class);

    $this->actingAs($admin)->post('/profile/two-factor/enable')->assertRedirect();

    $secret = (string) $admin->fresh()->two_factor_secret;

    expect($secret)->not->toBeEmpty();

    $this->actingAs($admin)->post('/profile/two-factor/confirm', [
        'code' => $totp->code($secret),
    ])->assertRedirect(route('profile.two-factor.show'));

    $admin->refresh();

    expect($admin->hasEnabledTwoFactor())->toBeTrue()
        ->and($admin->two_factor_recovery_codes)->toHaveCount(8);

    $this->actingAs($admin)->get('/profile/two-factor')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Profile/TwoFactor')
            ->where('enabled', true)
        );
});

it('disables TOTP with password and a valid code', function (): void {
    $admin = adminUser();
    $totp = app(TotpService::class);
    $secret = $totp->generateSecret();

    $admin->forceFill([
        'two_factor_secret' => $secret,
        'two_factor_confirmed_at' => now(),
    ])->save();

    $this->actingAs($admin)->delete('/profile/two-factor', [
        'password' => 'password',
        'code' => $totp->code($secret),
    ])->assertRedirect();

    expect($admin->fresh()->hasEnabledTwoFactor())->toBeFalse();
});

it('does not disable TOTP with a wrong password', function (): void {
    $admin = adminUser();
    $totp = app(TotpService::class);

    $admin->forceFill([
        'two_factor_secret' => $totp->generateSecret(),
        'two_factor_confirmed_at' => now(),
    ])->save();

    $this->actingAs($admin)->delete('/profile/two-factor', [
        'password' => 'not-the-password',
        'code' => '123456',
    ])->assertSessionHasErrors('password');

    expect($admin->fresh()->hasEnabledTwoFactor())->toBeTrue();
});
