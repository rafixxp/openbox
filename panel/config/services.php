<?php

declare(strict_types=1);

return [
    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],
    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],
    'resend' => [
        'key' => env('RESEND_KEY'),
    ],
    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Fastify build agent (service-to-service only)
    |--------------------------------------------------------------------------
    | The agent never authenticates as a panel user. Requests are signed with
    | HMAC-SHA256 using a shared secret; the same secret signs callbacks.
    */
    'build_agent' => [
        'url' => env('BUILD_AGENT_URL', 'http://build-agent:8090'),
        'secret' => env('BUILD_AGENT_SECRET'),
        'timeout' => (int) env('BUILD_AGENT_TIMEOUT', 15),
        'callback_base_url' => env('BUILD_AGENT_CALLBACK_URL', env('APP_URL')),
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
        'chat_id' => env('TELEGRAM_CHAT_ID'),
        'timeout' => (int) env('TELEGRAM_TIMEOUT', 10),
    ],
];
