<?php

declare(strict_types=1);

namespace App\Services\Build;

use App\Models\Build;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

final class BuildAgentClient
{
    public function dispatch(Build $build): void
    {
        $response = $this->send('/v1/jobs', [
            'buildUuid' => $build->uuid,
            'channel' => $build->channel->value,
            'manifest' => $build->manifest,
            'callbackBaseUrl' => (string) config('build.agent.callback_base_url'),
            'includePanelInstaller' => (bool) ($build->manifest['includePanelInstaller'] ?? false),
        ]);

        if (! $response->successful()) {
            throw new RuntimeException(sprintf(
                'Build agent rejected job (HTTP %d): %s',
                $response->status(),
                mb_substr($response->body(), 0, 500),
            ));
        }
    }

    public function cancel(Build $build): void
    {
        $response = $this->send('/v1/jobs/'.$build->uuid.'/cancel', []);

        if (! $response->successful() && $response->status() !== 404) {
            throw new RuntimeException('Build agent could not cancel the job (HTTP '.$response->status().').');
        }
    }

    /** @param array<string, mixed> $payload */
    private function send(string $path, array $payload): \Illuminate\Http\Client\Response
    {
        $baseUrl = rtrim((string) config('build.agent.url'), '/');
        $secret = (string) config('build.agent.secret');

        if ($baseUrl === '' || $secret === '') {
            throw new RuntimeException('Build agent URL/secret is not configured.');
        }

        $url = $baseUrl.$path;
        $body = $payload === [] ? '' : json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $requestPath = (string) (parse_url($url, PHP_URL_PATH) ?: '/');

        $attempts = 2;
        $lastError = null;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            // Every attempt needs a fresh nonce: the agent rejects reused
            // nonces with 409, and the first request may have been applied even
            // when its response was lost. Job ids make dispatch/cancel
            // idempotent, so a second signed request is safe.
            $timestamp = (string) time();
            $nonce = (string) Str::uuid();

            $canonical = implode("\n", [
                $timestamp,
                $nonce,
                'POST',
                $requestPath,
                hash('sha256', $body),
            ]);

            $signature = hash_hmac('sha256', $canonical, $secret);

            try {
                $response = $this->http()
                    ->withHeaders([
                        'X-Agent-Id' => (string) config('app.name'),
                        'X-Agent-Timestamp' => $timestamp,
                        'X-Agent-Nonce' => $nonce,
                        'X-Agent-Signature' => $signature,
                    ])
                    ->withBody($body, 'application/json')
                    ->post($url);
            } catch (ConnectionException $exception) {
                $lastError = $exception;

                if ($attempt === $attempts) {
                    throw $exception;
                }

                usleep(250_000);

                continue;
            }

            if ($response->serverError() && $attempt < $attempts) {
                usleep(250_000);

                continue;
            }

            return $response;
        }

        throw $lastError ?? new RuntimeException('Build agent request failed.');
    }

    private function http(): PendingRequest
    {
        return Http::timeout((int) config('build.agent.timeout', 15))
            ->connectTimeout(5)
            ->acceptJson();
    }
}
