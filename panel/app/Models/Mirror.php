<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MirrorStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Mirror extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'name',
        'base_url',
        'sync_target',
        'region',
        'status',
        'is_primary',
        'last_synced_at',
        'latency_ms',
        'last_error',
    ];

    protected function casts(): array
    {
        return [
            'status' => MirrorStatus::class,
            'is_primary' => 'boolean',
            'last_synced_at' => 'datetime',
            'latency_ms' => 'integer',
        ];
    }

    /** @return HasMany<MirrorSync, $this> */
    public function syncs(): HasMany
    {
        return $this->hasMany(MirrorSync::class);
    }
}
