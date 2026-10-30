<?php

declare(strict_types=1);

namespace App\Services\Build;

use App\Models\Build;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

/**
 * Local driver: run docker/scripts/build-iso.sh from the queue worker.
 *
 * This uses the exact same argv contract as the Fastify agent
 * (api/src/services/runner.ts). The script owns live-build; this class never
 * shells out to user supplied strings, and it never touches the source tree
 * directly.
 */
final class BuildScriptRunner
{
    /**
     * @param  callable(string):void  $onLine
     */
    public function run(Build $build, callable $onLine): LocalBuildResult
    {
        $sourceRoot = (string) config('build.source_root');
        $script = (string) config('build.script');
        $workBase = (string) config('build.work_dir');
        $manifest = (array) $build->manifest;
        $isoName = (string) ($manifest['liveBuild']['isoName'] ?? config('build.iso_name'));

        if (! is_file($script)) {
            throw new \RuntimeException('Build script not found: '.$script);
        }

        $workspace = rtrim($workBase, '/').'/'.$build->uuid;
        $outputDir = $workspace.'/output';
        $manifestPath = $workspace.'/manifest.json';
        $packagesPath = $workspace.'/packages.txt';
        $artifactPath = $outputDir.'/'.$isoName;

        File::ensureDirectoryExists($outputDir, 0750);
        File::put(
            $manifestPath,
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES)
        );

        $packages = array_map(
            static fn (array $package): string => (string) ($package['name'] ?? ''),
            (array) ($manifest['packages'] ?? [])
        );
        File::put($packagesPath, implode("\n", array_filter($packages))."\n");

        $arguments = [
            'bash',
            $script,
            '--manifest',
            $manifestPath,
            '--workspace',
            $workspace,
            '--output-dir',
            $outputDir,
            '--source-root',
            $sourceRoot,
            '--iso-name',
            $isoName,
            '--suite',
            (string) ($manifest['debian']['suite'] ?? 'bookworm'),
            '--architecture',
            (string) ($manifest['debian']['architecture'] ?? 'amd64'),
            '--mirror',
            (string) ($manifest['debian']['mirror'] ?? 'http://deb.debian.org/debian'),
            '--packages-file',
            $packagesPath,
        ];

        if ((bool) ($manifest['liveBuild']['clean'] ?? false)) {
            $arguments[] = '--clean';
        }

        $includePanelInstaller = (bool) ($manifest['includePanelInstaller'] ?? false);

        if ($includePanelInstaller) {
            $arguments[] = '--include-panel-installer';
            $arguments[] = '--panel-installer';
            $arguments[] = (string) config('build.panel_installer');
        }

        $process = new Process(
            $arguments,
            $workspace,
            [
                'OPENBOX_BUILD_UUID' => $build->uuid,
                'OPENBOX_BUILD_CHANNEL' => $build->channel->value,
                'OPENBOX_BUILD_WORKSPACE' => $workspace,
                'OPENBOX_BUILD_SOURCE_ROOT' => $sourceRoot,
                'OPENBOX_BUILD_ISO_NAME' => $isoName,
                'PATH' => '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                'HOME' => $workspace,
                'LANG' => 'C.UTF-8',
                'LC_ALL' => 'C.UTF-8',
            ],
            null,
            (float) config('build.timeout'),
        );

        $buffer = '';
        $canceled = false;
        $timedOut = false;

        try {
            $process->run(function (string $type, string $chunk) use (
                &$buffer,
                &$canceled,
                $build,
                $process,
                $onLine,
            ): void {
                if (Cache::has('build:cancel:'.$build->uuid)) {
                    $canceled = true;
                    $process->stop(10, 15);

                    return;
                }

                $buffer .= $chunk;

                while (($position = strpos($buffer, "\n")) !== false) {
                    $line = rtrim(substr($buffer, 0, $position), "\r");
                    $buffer = substr($buffer, $position + 1);
                    $onLine($line);
                }
            });
        } catch (ProcessTimedOutException) {
            $timedOut = true;
            $process->stop(10, 15);
        }

        if ($buffer !== '') {
            $onLine(rtrim($buffer, "\r"));
        }

        Cache::forget('build:cancel:'.$build->uuid);

        $artifactExists = is_file($artifactPath);

        return new LocalBuildResult(
            exitCode: (int) ($process->getExitCode() ?? 1),
            canceled: $canceled,
            timedOut: $timedOut,
            artifactPath: $artifactExists ? $artifactPath : null,
            artifactSize: $artifactExists ? (int) filesize($artifactPath) : null,
            artifactSha256: $artifactExists ? (string) hash_file('sha256', $artifactPath) : null,
            outputTail: mb_substr($process->getErrorOutput(), -4000),
        );
    }
}
