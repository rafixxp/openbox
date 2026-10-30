<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ReleaseChannel;
use App\Enums\ReleaseStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Release extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'version',
        'channel',
        'codename',
        'status',
        'notes',
        'checksums',
        'iso_build_id',
        'created_by',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'channel' => ReleaseChannel::class,
            'status' => ReleaseStatus::class,
            'checksums' => 'array',
            'published_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Build, $this> */
    public function isoBuild(): BelongsTo
    {
        return $this->belongsTo(Build::class, 'iso_build_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
