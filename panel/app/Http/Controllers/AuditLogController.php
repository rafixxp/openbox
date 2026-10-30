<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'action' => ['nullable', 'string', 'max:128'],
            'actor' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $logs = AuditLog::query()
            ->when($filters['action'] ?? null, fn ($query, string $action) => $query->where('action', 'like', $action.'%'))
            ->when($filters['actor'] ?? null, fn ($query, string $actor) => $query->where('actor_name', 'like', '%'.$actor.'%'))
            ->when($filters['from'] ?? null, fn ($query, string $from) => $query->where('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($query, string $to) => $query->where('created_at', '<=', $to.' 23:59:59'))
            ->latest('id')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('Audit/Index', [
            'logs' => AuditLogResource::collection($logs),
            'filters' => $filters,
        ]);
    }
}
