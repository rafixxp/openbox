<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | ISO build driver
    |--------------------------------------------------------------------------
    | agent  : Laravel dispatches to the Fastify build agent over signed HTTP.
    | local  : The queue worker runs docker/scripts/build-iso.sh itself. This
    |          requires a privileged/dedicated worker (never the web container).
    */
    'driver' => env('BUILD_DRIVER', 'agent'),

    'agent' => [
        'url' => env('BUILD_AGENT_URL', 'http://build-agent:8090'),
        'secret' => env('BUILD_AGENT_SECRET'),
        'timeout' => (int) env('BUILD_AGENT_TIMEOUT', 15),
        'callback_base_url' => env('BUILD_AGENT_CALLBACK_URL', env('APP_URL')),
    ],

    'script' => env('BUILD_SCRIPT', base_path('../docker/scripts/build-iso.sh')),

    'source_root' => env('OPENBOX_ROOT', base_path('..')),

    'work_dir' => env('BUILD_WORK_DIR', '/var/lib/openbox-build/workspace'),

    'isolated_workspace' => (bool) env('BUILD_ISOLATED_WORKSPACE', true),

    'timeout' => (int) env('BUILD_TIMEOUT', 7200),

    'iso_name' => env('BUILD_ISO_NAME', 'openbox-image-amd64.hybrid.iso'),

    'panel_installer' => env('PANEL_INSTALLER_PATH', base_path('../install_panel_en.sh')),

    'queue' => env('BUILD_QUEUE', 'builds'),

    'log_chunk_lines' => (int) env('BUILD_LOG_CHUNK_LINES', 25),
];
