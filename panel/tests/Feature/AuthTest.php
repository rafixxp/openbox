<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\Totp\TotpService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('shows the login page', function (): void {
    $this->get('/login')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Auth/Login'));
});

it('authenticates a user with email and password', function (): void {
    $user = adminUser();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
});

it('rejects invalid credentials', function (): void {
    $user = User::factory()->create();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('rate limits repeated login attempts', function (): void {
    $user = User::factory()->create();

    for ($attempt = 1; $attempt <= 6; $attempt++) {
        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong',
        ]);
    }

    $response->assertStatus(429);
});

it('redirects users with 2FA to the challenge page and verifies TOTP', function (): void {
    $totp = app(TotpService::class);
    $user = adminUser();
    $user->forceFill([
        'two_factor_secret' => $totp->generateSecret(),
        'two_factor_confirmed_at' => now(),
    ])->save();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('two-factor.challenge'));

    $this->assertGuest();

    $secret = (string) $user->fresh()->two_factor_secret;

    $this->get(route('two-factor.challenge'))->assertOk();

    $this->post(route('two-factor.challenge'), [
        'code' => $totp->code($secret),
    ])->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
});

it('logs failed 2FA codes without authenticating', function (): void {
    $totp = app(TotpService::class);
    $user = adminUser();
    $user->forceFill([
        'two_factor_secret' => $totp->generateSecret(),
        'two_factor_confirmed_at' => now(),
    ])->save();

    $this->post('/login', ['email' => $user->email, 'password' => 'password']);
    $this->post(route('two-factor.challenge'), ['code' => '000000'])
        ->assertSessionHasErrors('code');

    $this->assertGuest();
});
