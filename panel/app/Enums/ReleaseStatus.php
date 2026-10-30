<?php

declare(strict_types=1);

namespace App\Enums;

enum ReleaseStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
