<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\RoleName;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /** @var array<string, array{label:string, group:string}> */
    private const PERMISSIONS = [
        'dashboard.view' => ['label' => 'View dashboard', 'group' => 'dashboard'],
        'builds.view' => ['label' => 'View builds', 'group' => 'builds'],
        'builds.trigger' => ['label' => 'Trigger ISO builds', 'group' => 'builds'],
        'builds.cancel' => ['label' => 'Cancel builds', 'group' => 'builds'],
        'builds.download' => ['label' => 'Download ISO artifacts', 'group' => 'builds'],
        'packages.view' => ['label' => 'View packages', 'group' => 'packages'],
        'packages.create' => ['label' => 'Upload packages', 'group' => 'packages'],
        'packages.update' => ['label' => 'Update packages', 'group' => 'packages'],
        'packages.delete' => ['label' => 'Delete packages', 'group' => 'packages'],
        'packages.sign' => ['label' => 'Sign packages', 'group' => 'packages'],
        'releases.view' => ['label' => 'View releases', 'group' => 'releases'],
        'releases.manage' => ['label' => 'Manage releases', 'group' => 'releases'],
        'releases.publish' => ['label' => 'Publish releases', 'group' => 'releases'],
        'mirrors.view' => ['label' => 'View mirrors', 'group' => 'mirrors'],
        'mirrors.manage' => ['label' => 'Manage mirrors', 'group' => 'mirrors'],
        'users.view' => ['label' => 'View users', 'group' => 'users'],
        'users.manage' => ['label' => 'Manage users and roles', 'group' => 'users'],
        'settings.view' => ['label' => 'View settings', 'group' => 'settings'],
        'settings.manage' => ['label' => 'Manage settings and backups', 'group' => 'settings'],
        'audit.view' => ['label' => 'View audit trail', 'group' => 'audit'],
        'logs.view' => ['label' => 'View request/build logs', 'group' => 'logs'],
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $name => $attributes) {
            Permission::query()->updateOrCreate(['name' => $name], [
                'label' => $attributes['label'],
                'group' => $attributes['group'],
            ]);
        }

        $admin = Role::query()->updateOrCreate(['name' => RoleName::Admin->value], [
            'label' => 'Administrator',
            'description' => 'Full access, including users, settings and GPG signing.',
            'is_system' => true,
        ]);

        $maintainer = Role::query()->updateOrCreate(['name' => RoleName::Maintainer->value], [
            'label' => 'Maintainer',
            'description' => 'Builds, packages, releases and mirrors. No user/settings administration.',
            'is_system' => true,
        ]);

        $viewer = Role::query()->updateOrCreate(['name' => RoleName::Viewer->value], [
            'label' => 'Viewer',
            'description' => 'Read-only access to builds, packages, releases and mirrors.',
            'is_system' => true,
        ]);

        $admin->permissions()->sync(Permission::query()->pluck('id'));

        $maintainer->permissions()->sync(Permission::query()->whereIn('name', [
            'dashboard.view',
            'builds.view', 'builds.trigger', 'builds.cancel', 'builds.download',
            'packages.view', 'packages.create', 'packages.update', 'packages.sign',
            'releases.view', 'releases.manage', 'releases.publish',
            'mirrors.view', 'mirrors.manage',
            'audit.view',
        ])->pluck('id'));

        $viewer->permissions()->sync(Permission::query()->whereIn('name', [
            'dashboard.view',
            'builds.view',
            'packages.view',
            'releases.view',
            'mirrors.view',
        ])->pluck('id'));
    }
}
