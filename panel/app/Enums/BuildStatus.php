<?php

declare(strict_types=1);

namespace App\Enums;

enum BuildStatus: string
{
    case Queued = 'queued';
    case Dispatching = 'dispatching';
    case Running = 'running';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Canceled = 'canceled';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Succeeded, self::Failed, self::Canceled], true);
    }

    public function isActive(): bool
    {
        return in_array($this, [self::Queued, self::Dispatching, self::Running], true);
    }

    public function canTransitionTo(self $next): bool
    {
        if ($this === $next) {
            return true;
        }

        return match ($this) {
            self::Queued => in_array($next, [self::Dispatching, self::Canceled, self::Failed], true),
            self::Dispatching => in_array($next, [self::Running, self::Failed, self::Canceled], true),
            self::Running => in_array($next, [self::Succeeded, self::Failed, self::Canceled], true),
            default => false,
        };
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
