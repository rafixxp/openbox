<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Repository extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'name',
        'slug',
        'suite',
        'components',
        'architectures',
        'base_url',
        'signing_key_fingerprint',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'components' => 'array',
            'architectures' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
