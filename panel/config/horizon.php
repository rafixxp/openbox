<?php

declare(strict_types=1);

return [
    'domain' => env('HORIZON_DOMAIN'),
    'path' => env('HORIZON_PATH', 'horizon'),
    'use' => 'default',
    'prefix' => env('HORIZON_PREFIX', 'openbox_horizon:'),
    'middleware' => ['web', 'auth', 'two-factor', 'permission:settings.manage'],
    'waits' => [
        'redis:default' => 60,
        'redis:builds' => 60,
    ],
    'trim' => [
        'recent' => 60,
        'pending' => 60,
        'completed' => 60,
        'recent_failed' => 10080,
        'failed' => 10080,
        'monitored' => 10080,
    ],
    'silenced' => [],
    'metrics' => [
        'trim_snapshots' => ['job' => 24, 'queue' => 24],
    ],
    'fast_termination' => false,
    'memory_limit' => 512,
    'defaults' => [
        'supervisor-1' => [
            'connection' => 'redis',
            'queue' => ['default', 'builds'],
            'balance' => 'auto',
            'autoScalingStrategy' => 'time',
            'maxProcesses' => 1,
            'maxTime' => 0,
            'maxJobs' => 0,
            'memory' => 512,
            'tries' => 1,
            'timeout' => 0,
            'nice' => 0,
        ],
    ],
    'environments' => [
        'production' => [
            'supervisor-1' => [
                'maxProcesses' => 10,
                'balanceMaxShift' => 1,
                'balanceCooldown' => 3,
            ],
            'supervisor-builds' => [
                'connection' => 'redis',
                'queue' => ['builds'],
                'balance' => 'simple',
                'processes' => 1,
                'tries' => 1,
                'timeout' => 0,
                'memory' => 512,
            ],
        ],
        'local' => [
            'supervisor-1' => [
                'maxProcesses' => 3,
            ],
            'supervisor-builds' => [
                'connection' => 'redis',
                'queue' => ['builds'],
                'balance' => 'simple',
                'processes' => 1,
                'tries' => 1,
                'timeout' => 0,
            ],
        ],
    ],
];
