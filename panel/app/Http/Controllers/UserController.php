<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\RoleName;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::query()
            ->with('roles')
            ->orderBy('name')
            ->paginate(20);

        return Inertia::render('Users/Index', [
            'users' => UserResource::collection($users),
            'roles' => Role::query()->orderBy('name')->get(['name', 'label']),
            'canManage' => $request->user()->hasPermissionTo('users.manage'),
        ]);
    }

    public function store(StoreUserRequest $request, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'email_verified_at' => now(),
        ]);

        $this->syncRoles($user, $data['roles']);

        $audit->log('user.created', $user, after: [
            'email' => $user->email,
            'roles' => $data['roles'],
        ]);

        return back()->with('success', 'User created.');
    }

    public function update(UpdateUserRequest $request, User $user, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validated();

        $this->guardLastAdmin($user, $data['roles']);

        $before = [
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->values()->all(),
        ];

        $user->name = $data['name'];
        $user->email = $data['email'];

        if (filled($data['password'] ?? null)) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();
        $this->syncRoles($user, $data['roles']);

        $audit->log('user.updated', $user, before: $before, after: [
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $data['roles'],
        ]);

        return back()->with('success', 'User updated.');
    }

    public function destroy(Request $request, User $user, AuditLogger $audit): RedirectResponse
    {
        if ($request->user()->is($user)) {
            return back()->with('error', 'You cannot delete your own account.');
        }

        if ($user->hasRole(RoleName::Admin) && $this->adminCount() <= 1) {
            return back()->with('error', 'The last admin cannot be deleted.');
        }

        $audit->log('user.deleted', $user, before: [
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->values()->all(),
        ]);

        $user->delete();

        return back()->with('success', 'User deleted.');
    }

    /** @param array<int, string> $roles */
    private function syncRoles(User $user, array $roles): void
    {
        $ids = Role::query()->whereIn('name', $roles)->pluck('id');
        $user->roles()->sync($ids);
        $user->forgetPermissionCache();
    }

    /** @param array<int, string> $roles */
    private function guardLastAdmin(User $user, array $roles): void
    {
        if (! $user->hasRole(RoleName::Admin) || in_array(RoleName::Admin->value, $roles, true)) {
            return;
        }

        if ($this->adminCount() <= 1) {
            throw ValidationException::withMessages([
                'roles' => 'The last admin must keep the admin role.',
            ]);
        }
    }

    private function adminCount(): int
    {
        return User::query()
            ->whereHas('roles', static fn ($query) => $query->where('name', RoleName::Admin->value))
            ->count();
    }
}
