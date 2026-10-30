<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\RoleName;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            SettingsSeeder::class,
        ]);

        $email = (string) env('PANEL_ADMIN_EMAIL', 'admin@example.com');
        $password = (string) env('PANEL_ADMIN_PASSWORD', '');

        if ($password === '') {
            $password = Str::password(20);
            $this->command?->warn('PANEL_ADMIN_PASSWORD was empty. Generated admin password: '.$password);
        }

        $admin = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => 'Panel Administrator',
                'password' => $password,
                'email_verified_at' => now(),
            ]
        );

        $admin->roles()->syncWithoutDetaching([
            Role::query()->where('name', RoleName::Admin->value)->value('id'),
        ]);
    }
}
