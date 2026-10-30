<?php

declare(strict_types=1);

namespace App\Services\Gpg;

use Symfony\Component\Process\Process;

final class GpgSigner
{
    public function sign(string $path, ?string $keyId = null): string
    {
        $keyId ??= (string) config('gpg.key_id');

        if ($keyId === '') {
            throw new \RuntimeException('No GPG signing key configured.');
        }

        if (! is_file($path)) {
            throw new \RuntimeException('Artifact to sign does not exist.');
        }

        $signaturePath = $path.'.asc';

        $arguments = [
            'gpg',
            '--batch',
            '--yes',
            '--armor',
            '--pinentry-mode',
            'loopback',
            '--local-user',
            $keyId,
            '--detach-sign',
            '--output',
            $signaturePath,
        ];

        $passphrase = (string) config('gpg.passphrase');

        if ($passphrase !== '') {
            array_push($arguments, '--passphrase-fd', '0');
        }

        $arguments[] = $path;

        $process = new Process($arguments, null, [
            'GNUPGHOME' => (string) config('gpg.home'),
        ]);

        $process->setInput($passphrase !== '' ? $passphrase."\n" : null);
        $process->setTimeout(120);
        $process->mustRun();

        $signature = file_get_contents($signaturePath);

        if ($signature === false) {
            throw new \RuntimeException('GPG signature could not be read.');
        }

        @unlink($signaturePath);

        return $signature;
    }
}
