<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Backup extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'filename',
        'disk',
        'path',
        'size',
        'sha256',
        'status',
        'error',
        'created_by',
        'completed_at',
        'restored_at',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'completed_at' => 'datetime',
            'restored_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
