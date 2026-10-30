<?php

declare(strict_types=1);

namespace App\Enums;

enum MirrorStatus: string
{
    case Online = 'online';
    case Degraded = 'degraded';
    case Offline = 'offline';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
