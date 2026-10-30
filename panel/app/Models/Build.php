<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BuildStatus;
use App\Enums\ReleaseChannel;
use Database\Factories\BuildFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Build extends Model
{
    /** @use HasFactory<BuildFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $fillable = [
        'uuid',
        'status',
        'channel',
        'stage',
        'progress',
        'requested_by',
        'retry_of_id',
        'agent',
        'manifest',
        'exit_code',
        'error_message',
        'artifact_disk',
        'artifact_path',
        'artifact_size',
        'artifact_sha256',
        'started_at',
        'finished_at',
        'canceled_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => BuildStatus::class,
            'channel' => ReleaseChannel::class,
            'manifest' => 'array',
            'progress' => 'integer',
            'exit_code' => 'integer',
            'artifact_size' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'canceled_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /** @return BelongsTo<User, $this> */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** @return BelongsTo<Build, $this> */
    public function retryOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'retry_of_id');
    }

    /** @return HasMany<Build, $this> */
    public function retries(): HasMany
    {
        return $this->hasMany(self::class, 'retry_of_id');
    }

    /** @return HasMany<BuildLog, $this> */
    public function logs(): HasMany
    {
        return $this->hasMany(BuildLog::class)->orderBy('sequence');
    }

    /** @return HasOne<Release, $this> */
    public function release(): HasOne
    {
        return $this->hasOne(Release::class, 'iso_build_id');
    }

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function canBeCanceled(): bool
    {
        return $this->status->isActive();
    }
}
