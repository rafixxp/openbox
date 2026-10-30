<?php

declare(strict_types=1);

return [
    'syncer' => env('MIRROR_SYNCER', 'rclone'),
    'rclone_binary' => env('RCLONE_BINARY', 'rclone'),
    'source' => env('MIRROR_SOURCE', ''),
    'timeout' => (int) env('MIRROR_SYNC_TIMEOUT', 3600),
];
