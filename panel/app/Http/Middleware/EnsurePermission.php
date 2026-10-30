<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        foreach ($permissions as $permission) {
            if (! $user->hasPermissionTo($permission)) {
                abort(403, 'Missing permission: '.$permission);
            }
        }

        return $next($request);
    }
}
