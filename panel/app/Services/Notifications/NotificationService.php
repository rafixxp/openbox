<?php

declare(strict_types=1);

namespace App\Services\Notifications;

use App\Enums\BuildStatus;
use App\Models\Build;
use App\Models\PanelNotification;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

final class NotificationService
{
    public function buildFinished(Build $build): void
    {
        $subject = sprintf(
            '[Openbox] ISO build %s (%s)',
            $build->status === BuildStatus::Succeeded ? 'succeeded' : $build->status->value,
            $build->uuid,
        );

        $message = implode("\n", array_filter([
            'Build: '.$build->uuid,
            'Channel: '.$build->channel->value,
            'Status: '.$build->status->value,
            'Progress: '.$build->progress.'%',
            'Started: '.($build->started_at?->toIso8601String() ?? '-'),
            'Finished: '.($build->finished_at?->toIso8601String() ?? '-'),
            $build->artifact_sha256 ? 'SHA256: '.$build->artifact_sha256 : null,
            $build->error_message ? 'Error: '.$build->error_message : null,
        ]));

        if ((bool) Setting::get('notifications.email_enabled', true)) {
            $this->sendEmail($build, $subject, $message);
        }

        if ((bool) Setting::get('notifications.telegram_enabled', false)) {
            $this->sendTelegram($build, $subject."\n\n".$message);
        }
    }

    private function sendEmail(Build $build, string $subject, string $message): void
    {
        $recipients = $this->emailRecipients();

        $notification = PanelNotification::query()->create([
            'channel' => 'email',
            'event' => 'build.finished',
            'subject' => $subject,
            'payload' => ['build_uuid' => $build->uuid, 'status' => $build->status->value],
        ]);

        try {
            if ($recipients === []) {
                throw new \RuntimeException('No email recipients configured.');
            }

            Mail::raw($message, static function ($mail) use ($recipients, $subject): void {
                $mail->to($recipients)->subject($subject);
            });

            $notification->update(['sent_at' => now()]);
        } catch (Throwable $exception) {
            Log::warning('Build email notification failed.', ['build' => $build->uuid, 'error' => $exception->getMessage()]);
            $notification->update(['error' => mb_substr($exception->getMessage(), 0, 1000)]);
        }
    }

    private function sendTelegram(Build $build, string $message): void
    {
        $token = (string) Setting::get('notifications.telegram_bot_token', '');
        $chatId = (string) Setting::get('notifications.telegram_chat_id', '');

        $notification = PanelNotification::query()->create([            'channel' => 'telegram',
            'event' => 'build.finished',
            'subject' => 'ISO build '.$build->status->value,
            'payload' => ['build_uuid' => $build->uuid, 'status' => $build->status->value],
        ]);

        try {
            if ($token === '' || $chatId === '') {
                throw new \RuntimeException('Telegram bot token/chat id is not configured.');
            }

            $response = Http::timeout(10)->post('https://api.telegram.org/bot'.$token.'/sendMessage', [
                'chat_id' => $chatId,
                'text' => mb_substr($message, 0, 4000),
                'disable_web_page_preview' => true,
            ]);

            if (! $response->successful()) {
                throw new \RuntimeException('Telegram API returned HTTP '.$response->status());
            }

            $notification->update(['sent_at' => now()]);
        } catch (Throwable $exception) {
            Log::warning('Build Telegram notification failed.', ['build' => $build->uuid, 'error' => $exception->getMessage()]);
            $notification->update(['error' => mb_substr($exception->getMessage(), 0, 1000)]);
        }
    }

    public function sendTest(string $channel): void
    {
        $message = 'Openbox Panel test notification at '.now()->toIso8601String();

        if ($channel === 'email') {
            $recipients = $this->emailRecipients();

            if ($recipients === []) {
                throw new \RuntimeException('No email recipients configured.');
            }

            Mail::raw($message, static function ($mail) use ($recipients): void {
                $mail->to($recipients)->subject('[Openbox] Test notification');
            });

            return;
        }

        $token = (string) Setting::get('notifications.telegram_bot_token', '');
        $chatId = (string) Setting::get('notifications.telegram_chat_id', '');

        if ($token === '' || $chatId === '') {
            throw new \RuntimeException('Telegram bot token/chat id is not configured.');
        }

        $response = Http::timeout(10)->post('https://api.telegram.org/bot'.$token.'/sendMessage', [
            'chat_id' => $chatId,
            'text' => $message,
            'disable_web_page_preview' => true,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Telegram API returned HTTP '.$response->status());
        }
    }

    /** @return array<int, string> */
    private function emailRecipients(): array
    {
        $recipients = Setting::get('notifications.mail_to', []);

        if (is_string($recipients)) {
            $recipients = array_filter(array_map('trim', explode(',', $recipients)));
        }

        if (! is_array($recipients) || $recipients === []) {
            $recipients = User::query()
                ->whereHas('roles', static fn ($query) => $query->where('name', 'admin'))
                ->pluck('email')
                ->all();
        }

        return array_values(array_filter($recipients));
    }
}
