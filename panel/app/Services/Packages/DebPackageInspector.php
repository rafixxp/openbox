<?php

declare(strict_types=1);

namespace App\Services\Packages;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

final class DebPackageInspector
{
    /**
     * Read Debian control metadata from a .deb using dpkg-deb. Returns an empty
     * array when dpkg-deb is unavailable; callers keep user supplied values.
     *
     * @return array<string, mixed>
     */
    public function inspect(string $path): array
    {
        if (! is_file($path)) {
            return [];
        }

        $fields = ['Package', 'Version', 'Architecture', 'Depends', 'Recommends', 'Section', 'Description'];

        try {
            $process = new Process(['dpkg-deb', '-f', $path, ...$fields]);
            $process->setTimeout(30);
            $process->mustRun();
        } catch (ProcessFailedException|\Symfony\Component\Process\Exception\ProcessTimedOutException) {
            return [];
        }

        $values = [];
        $current = null;

        foreach (preg_split('/\R/', trim($process->getOutput())) ?: [] as $line) {
            if (preg_match('/^([A-Za-z-]+):\s*(.*)$/', $line, $matches) === 1) {
                $current = $matches[1];
                $values[$current] = $matches[2];
            } elseif ($current !== null && str_starts_with($line, ' ')) {
                $values[$current] .= "\n".trim($line);
            }
        }

        return [
            'name' => $values['Package'] ?? null,
            'version' => $values['Version'] ?? null,
            'architecture' => $values['Architecture'] ?? null,
            'depends' => $this->splitRelations($values['Depends'] ?? null),
            'recommends' => $this->splitRelations($values['Recommends'] ?? null),
            'section' => $values['Section'] ?? null,
            'description' => $values['Description'] ?? null,
        ];
    }

    /** @return list<string> */
    private function splitRelations(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return collect(explode(',', str_replace("\n", ' ', $value)))
            ->map(static fn (string $item): string => trim($item))
            ->filter()
            ->values()
            ->all();
    }
}
