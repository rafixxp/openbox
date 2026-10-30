<?php

declare(strict_types=1);

namespace App\Services\Audit;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

final class AuditLogger
{
    /**
     * Append an immutable audit record. Records are chained: each hash covers
     * the previous record hash so tampering with an older row is detectable.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  array<string, mixed>  $metadata
     */
    public function log(
        string $action,
        ?Model $subject = null,
        array $before = [],
        array $after = [],
        array $metadata = [],
    ): AuditLog {
        return DB::transaction(function () use ($action, $subject, $before, $after, $metadata): AuditLog {
            $previous = AuditLog::query()->latest('id')->lockForUpdate()->first();
            $actor = Auth::user();

            $payload = [
                'action' => $action,
                'actor_id' => $actor?->getKey(),
                'actor_name' => $actor?->name,
                'subject_type' => $subject?->getMorphClass(),
                'subject_id' => $subject ? (string) $subject->getKey() : null,
                'before' => $before,
                'after' => $after,
                'metadata' => $metadata,
                'previous_hash' => $previous?->hash,
            ];

            $hash = hash(
                'sha256',
                json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            );

            return AuditLog::query()->create([
                ...$payload,
                'ip_address' => Request::ip(),
                'user_agent' => substr((string) Request::userAgent(), 0, 1000),
                'hash' => $hash,
            ]);
        });
    }
}
