<?php

declare(strict_types=1);

namespace App\Services\Build;

final readonly class LocalBuildResult
{
    public function __construct(
        public int $exitCode,
        public bool $canceled,
        public bool $timedOut,
        public ?string $artifactPath,
        public ?int $artifactSize,
        public ?string $artifactSha256,
        public string $outputTail,
    ) {}
}
