<?php

declare(strict_types=1);

namespace App\Enums;

enum PackageStatus: string
{
    case Uploaded = 'uploaded';
    case Signed = 'signed';
    case Published = 'published';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
