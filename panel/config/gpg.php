<?php

declare(strict_types=1);

return [
    'home' => env('GNUPGHOME', storage_path('app/gnupg')),
    'key_id' => env('GPG_KEY_ID'),
    'passphrase' => env('GPG_PASSPHRASE'),
];
