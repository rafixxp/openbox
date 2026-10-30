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

/**
 * Restores a custom-format pg_dump. This is destructive; the controller
 * requires an explicit confirmation and the route is admin-only.
 */
class RestoreBackup implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public Backup $backup)
    {
        $this->onQueue('default');
    }

    public function handle(AuditLogger $audit): void
    {
        if ($this->backup->status !== 'completed') {
            throw new \RuntimeException('Only completed backups can be restored.');
        }

        $absolutePath = Storage::disk($this->backup->disk)->path($this->backup->path);

        if (! is_file($absolutePath)) {
            throw new \RuntimeException('Backup file is missing.');
        }

        $connection = config('database.connections.pgsql');

        $process = new Process([
            'pg_restore',
            '--clean',
            '--if-exists',
            '--no-owner',
            '--no-acl',
            '--dbname='.(string) $connection['database'],
            $absolutePath,
        ], null, [
            'PGHOST' => (string) $connection['host'],
            'PGPORT' => (string) $connection['port'],
            'PGUSER' => (string) $connection['username'],
            'PGPASSWORD' => (string) $connection['password'],
        ]);

        $process->setTimeout(1700);

        try {
            $process->mustRun();

            $this->backup->update(['restored_at' => now()]);

            $audit->log('backup.restored', $this->backup, metadata: [
                'filename' => $this->backup->filename,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            $this->backup->update(['error' => mb_substr($exception->getMessage(), 0, 4000)]);

            throw $exception;
        }
    }
}
