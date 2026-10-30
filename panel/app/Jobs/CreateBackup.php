<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Backup;
use App\Services\Audit\AuditLogger;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Throwable;

class CreateBackup implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public ?int $userId = null)
    {
        $this->onQueue('default');
    }

    public function handle(AuditLogger $audit): void
    {
        $filename = 'openbox-'.now()->format('Ymd-His').'.dump';
        $relativePath = 'backups/'.$filename;

        Storage::disk('local')->makeDirectory('backups');

        $backup = Backup::query()->create([
            'filename' => $filename,
            'disk' => 'local',
            'path' => $relativePath,
            'status' => 'running',
            'created_by' => $this->userId,
        ]);

        $absolutePath = Storage::disk('local')->path($relativePath);
        $connection = config('database.connections.pgsql');

        $process = new Process([
            'pg_dump',
            '--format=custom',
            '--no-owner',
            '--no-acl',
            '--file='.$absolutePath,
            (string) $connection['database'],
        ], null, [
            'PGHOST' => (string) $connection['host'],
            'PGPORT' => (string) $connection['port'],
            'PGUSER' => (string) $connection['username'],
            'PGPASSWORD' => (string) $connection['password'],
        ]);

        $process->setTimeout(1700);

        try {
            $process->mustRun();

            $backup->update([
                'status' => 'completed',
                'size' => is_file($absolutePath) ? filesize($absolutePath) : null,
                'sha256' => is_file($absolutePath) ? hash_file('sha256', $absolutePath) : null,
                'completed_at' => now(),
            ]);

            $audit->log('backup.created', $backup, after: [
                'filename' => $filename,
                'size' => $backup->size,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            $backup->update([
                'status' => 'failed',
                'error' => mb_substr($exception->getMessage(), 0, 4000),
            ]);

            throw $exception;
        }
    }
}
