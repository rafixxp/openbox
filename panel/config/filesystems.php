<?php

declare(strict_types=1);

$s3 = [
    'driver' => 's3',
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    'bucket' => env('AWS_BUCKET', 'openbox-artifacts'),
    'url' => env('AWS_URL'),
    'endpoint' => env('AWS_ENDPOINT', 'http://minio:9000'),
    'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', true),
    'throw' => true,
];

return [
    'default' => env('FILESYSTEM_DISK', 's3'),

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
        ],
        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
        ],
        's3' => $s3,

        /*
         * Same bucket and credentials, but signed URLs are generated for a
         * browser-reachable endpoint. In development the panel reaches MinIO at
         * http://minio:9000 while the host browser reaches it at
         * http://localhost:9000. Leave AWS_PUBLIC_ENDPOINT empty in production
         * so both disks use the same (public) endpoint.
         */
        's3_public' => [
            ...$s3,
            'endpoint' => env('AWS_PUBLIC_ENDPOINT') ?: env('AWS_ENDPOINT', 'http://minio:9000'),
        ],
    ],
];
