<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PackageStatus;
use App\Enums\ReleaseChannel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DebianPackage extends Model
{
    protected $table = 'debian_packages';

    /** @var list<string> */
    protected $fillable = [
        'name',
        'version',
        'architecture',
        'channel',
        'component',
        'section',
        'description',
        'depends',
        'recommends',
        'filename',
        'size',
        'sha256',
        'status',
        'gpg_key_id',
        'gpg_signature',
        'metadata',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'channel' => ReleaseChannel::class,
            'status' => PackageStatus::class,
            'depends' => 'array',
            'recommends' => 'array',
            'metadata' => 'array',
            'size' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
