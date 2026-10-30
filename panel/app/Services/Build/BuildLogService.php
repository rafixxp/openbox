<?php

declare(strict_types=1);

namespace App\Services\Build;

use App\Events\BuildLogAppended;
use App\Models\Build;
use App\Models\BuildLog;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class BuildLogService
{
    private const LEVELS = ['debug', 'info', 'warning', 'error'];

    public function append(Build $build, string $message, string $level = 'info', ?CarbonInterface $loggedAt = null): BuildLog
    {
        return DB::transaction(function () use ($build, $message, $level, $loggedAt): BuildLog {
            $sequence = ((int) $build->logs()->max('sequence')) + 1;

            $log = BuildLog::query()->create([
                'build_id' => $build->getKey(),
                'sequence' => $sequence,
                'level' => $this->normalizeLevel($level),
                'message' => $this->sanitize($message),
                'logged_at' => $loggedAt ?? now(),
            ]);

            broadcast(new BuildLogAppended($build, $log));

            return $log;
        });
    }

    /**
     * Persist a batch of agent log lines. Duplicate sequences are ignored so
     * retried callbacks stay idempotent.
     *
     * @param  array<int, array{sequence:int|string, level?:string, message:string, loggedAt?:string}>  $entries
     */
    public function appendBatch(Build $build, array $entries): int
    {
        $created = 0;

        foreach ($entries as $entry) {
            $sequence = (int) ($entry['sequence'] ?? 0);
            $message = (string) ($entry['message'] ?? '');

            if ($sequence < 1 || $message === '') {
                continue;
            }

            $loggedAt = isset($entry['loggedAt'])
                ? Carbon::parse($entry['loggedAt'])
                : now();

            $log = BuildLog::query()->firstOrCreate(
                ['build_id' => $build->getKey(), 'sequence' => $sequence],
                [
                    'level' => $this->normalizeLevel((string) ($entry['level'] ?? 'info')),
                    'message' => $this->sanitize($message),
                    'logged_at' => $loggedAt,
                ]
            );

            if ($log->wasRecentlyCreated) {
                $created++;
                broadcast(new BuildLogAppended($build, $log))->toOthers();
            }
        }

        return $created;
    }

    private function normalizeLevel(string $level): string
    {
        $level = strtolower($level);

        return in_array($level, self::LEVELS, true) ? $level : 'info';
    }

    /**
     * Strip ANSI escapes and control characters. Vue renders log text with
     * text interpolation only (never v-html), so this is defence in depth.
     */
    private function sanitize(string $message): string
    {
        $message = preg_replace('/\e\[[0-9;]*[A-Za-z]/', '', $message) ?? $message;
        $message = preg_replace('/[^\P{C}\n\t]/u', '', $message) ?? $message;

        return mb_substr($message, 0, 32000);
    }
}
