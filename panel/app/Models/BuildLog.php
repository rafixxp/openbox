<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BuildLog extends Model
{
    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = ['build_id', 'sequence', 'level', 'message', 'logged_at'];

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'logged_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(static function (): void {
            throw new \RuntimeException('Build logs are append-only.');
        });

        static::deleting(static function (): void {
            throw new \RuntimeException('Build logs are append-only.');
        });
    }

    /** @return BelongsTo<Build, $this> */
    public function build(): BelongsTo
    {
        return $this->belongsTo(Build::class);
    }
}
