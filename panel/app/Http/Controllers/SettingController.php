<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Setting\UpdateSettingsRequest;
use App\Jobs\CreateBackup;
use App\Jobs\RestoreBackup;
use App\Models\Backup;
use App\Services\Audit\AuditLogger;
use App\Services\Notifications\NotificationService;
use App\Services\Settings\SettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class SettingController extends Controller
{
    public function index(Request $request, SettingsService $settings): Response
    {
        return Inertia::render('Settings/Index', [
            'values' => $settings->all(),
            'backups' => Backup::query()->latest()->limit(10)->get([
                'id', 'filename', 'size', 'status', 'created_at',
            ]),
            'canManage' => $request->user()->hasPermissionTo('settings.manage'),
        ]);
    }

    public function update(
        UpdateSettingsRequest $request,
        SettingsService $settings,
        AuditLogger $audit,
    ): RedirectResponse {
        $flat = $settings->flatten($request->validated()['settings'] ?? []);
        $before = $settings->all();

        $settings->update($flat);

        $redactedBefore = $before;
        $redactedAfter = $settings->all();
        unset($redactedBefore['notifications.telegram_bot_token'], $redactedAfter['notifications.telegram_bot_token']);

        $audit->log('settings.updated', before: $redactedBefore, after: $redactedAfter);

        return back()->with('success', 'Settings saved.');
    }

    public function testNotification(Request $request, NotificationService $notifications): RedirectResponse
    {
        $data = $request->validate([
            'channel' => ['required', 'string', 'in:email,telegram'],
        ]);

        try {
            $notifications->sendTest($data['channel']);

            return back()->with('success', 'Test notification sent via '.$data['channel'].'.');
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Test failed: '.$exception->getMessage());
        }
    }

    public function backup(Request $request, AuditLogger $audit): RedirectResponse
    {
        CreateBackup::dispatch($request->user()->id);
        $audit->log('backup.requested');

        return back()->with('success', 'Database backup queued.');
    }

    public function restore(Request $request, Backup $backup, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validate([
            'confirm' => ['required', 'string'],
        ]);

        if ($data['confirm'] !== $backup->filename) {
            return back()->with('error', 'Confirmation does not match the backup filename.');
        }

        RestoreBackup::dispatch($backup);
        $audit->log('backup.restore_requested', $backup, metadata: ['filename' => $backup->filename]);

        return back()->with('success', 'Restore queued. The panel may be unavailable while PostgreSQL restores.');
    }

    public function downloadBackup(Backup $backup): BinaryFileResponse
    {
        $path = Storage::disk($backup->disk)->path($backup->path);

        if (! is_file($path)) {
            abort(404, 'Backup file not found.');
        }

        return response()->download($path, $backup->filename, [
            'Content-Type' => 'application/octet-stream',
        ]);
    }
}
