<?php

declare(strict_types=1);

namespace App\Enums;

enum ReleaseChannel: string
{
    case Stable = 'stable';
    case Testing = 'testing';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(static fn (self $channel): string => $channel->value, self::cases());
    }
}
