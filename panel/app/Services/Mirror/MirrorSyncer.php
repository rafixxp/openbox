<?php

declare(strict_types=1);

namespace App\Services\Mirror;

use App\Models\Mirror;
use App\Models\Release;

interface MirrorSyncer
{
    /** @return int bytes transferred (0 when the backend cannot report it) */
    public function sync(Mirror $mirror, ?Release $release = null): int;
}
