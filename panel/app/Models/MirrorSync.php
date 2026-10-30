<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MirrorSync extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'mirror_id',
        'release_id',
        'status',
        'bytes_synced',
        'error',
        'started_at',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'bytes_synced' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Mirror, $this> */
    public function mirror(): BelongsTo
    {
        return $this->belongsTo(Mirror::class);
    }

    /** @return BelongsTo<Release, $this> */
    public function release(): BelongsTo
    {
        return $this->belongsTo(Release::class);
    }
}
