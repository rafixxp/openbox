<?php

declare(strict_types=1);

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class)->in('Feature');

function userWithRole(string $role): User
{
    $user = User::factory()->create();

    $user->roles()->attach(
        Role::query()->where('name', $role)->firstOrFail()->id
    );

    return $user->fresh(['roles.permissions']);
}

function adminUser(): User
{
    return userWithRole('admin');
}

/** @return array<string, string> */
function agentSignatureHeaders(string $method, string $path, string $body): array
{
    $timestamp = (string) time();
    $nonce = (string) Str::uuid();

    $canonical = implode("\n", [
        $timestamp,
        $nonce,
        strtoupper($method),
        $path,
        hash('sha256', $body),
    ]);

    return [
        'HTTP_X_AGENT_ID' => 'pest-agent',
        'HTTP_X_AGENT_TIMESTAMP' => $timestamp,
        'HTTP_X_AGENT_NONCE' => $nonce,
        'HTTP_X_AGENT_SIGNATURE' => hash_hmac('sha256', $canonical, (string) config('build.agent.secret')),
    ];
}
