<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\PackageStatus;
use App\Enums\ReleaseChannel;
use App\Http\Requests\Package\StorePackageRequest;
use App\Http\Requests\Package\UpdatePackageRequest;
use App\Http\Resources\PackageResource;
use App\Models\DebianPackage;
use App\Services\Audit\AuditLogger;
use App\Services\Gpg\GpgSigner;
use App\Services\Packages\DebPackageInspector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class PackageController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'channel' => ['nullable', 'string', 'in:stable,testing'],
            'status' => ['nullable', 'string', 'in:'.implode(',', array_map(static fn (PackageStatus $s): string => $s->value, PackageStatus::cases()))],
        ]);

        $packages = DebianPackage::query()
            ->with('uploader')
            ->when($filters['q'] ?? null, function ($query, string $term): void {
                $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $term).'%';
                $query->where(fn ($inner) => $inner->whereLike('name', $like, caseSensitive: false)->orWhereLike('description', $like, caseSensitive: false));
            })
            ->when($filters['channel'] ?? null, fn ($query, string $channel) => $query->where('channel', $channel))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Packages/Index', [
            'packages' => PackageResource::collection($packages),
            'filters' => $filters,
            'channels' => ReleaseChannel::values(),
            'statuses' => array_map(static fn (PackageStatus $status): string => $status->value, PackageStatus::cases()),
            'can' => [
                'create' => $request->user()->hasPermissionTo('packages.create'),
                'update' => $request->user()->hasPermissionTo('packages.update'),
                'delete' => $request->user()->hasPermissionTo('packages.delete'),
                'sign' => $request->user()->hasPermissionTo('packages.sign'),
            ],
        ]);
    }

    public function store(
        StorePackageRequest $request,
        DebPackageInspector $inspector,
        AuditLogger $audit,
    ): RedirectResponse {
        $data = $request->validated();
        $file = $request->file('artifact');

        if ($file === null) {
            throw ValidationException::withMessages(['artifact' => 'A .deb file is required.']);
        }

        $temporaryPath = $file->getRealPath();

        if ($temporaryPath === false) {
            throw ValidationException::withMessages(['artifact' => 'The uploaded file is not readable.']);
        }

        $control = $inspector->inspect($temporaryPath);
        $name = $data['name'] ?? $control['name'] ?? null;
        $version = $data['version'] ?? $control['version'] ?? null;
        $architecture = $data['architecture'] ?? $control['architecture'] ?? 'amd64';

        if ($name === null || $version === null) {
            throw ValidationException::withMessages([
                'artifact' => 'Package name/version could not be read from the .deb. Provide them manually.',
            ]);
        }

        if (preg_match('/^[a-z0-9][a-z0-9+.-]*$/', $name) !== 1) {
            throw ValidationException::withMessages([
                'name' => 'The package name is not a valid Debian identifier.',
            ]);
        }

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9.+~:-]*$/', $version) !== 1) {
            throw ValidationException::withMessages([
                'version' => 'The package version contains unsupported characters.',
            ]);
        }

        if (! in_array($architecture, ['amd64', 'arm64', 'all', 'i386'], true)) {
            throw ValidationException::withMessages([
                'architecture' => 'The package architecture is not supported.',
            ]);
        }

        $channel = ReleaseChannel::from($data['channel']);
        $filename = sprintf('%s_%s_%s.deb', $name, $version, $architecture);

        $path = $file->storeAs(
            sprintf('packages/%s/%s', $channel->value, $name),
            $filename,
            's3'
        );

        if ($path === false) {
            throw ValidationException::withMessages(['artifact' => 'The artifact could not be stored.']);
        }

        $package = DebianPackage::query()->create([
            'name' => $name,
            'version' => $version,
            'architecture' => $architecture,
            'channel' => $channel,
            'component' => $data['component'] ?? 'main',
            'section' => $data['section'] ?? $control['section'] ?? null,
            'description' => $data['description'] ?? $control['description'] ?? null,
            'depends' => $data['depends'] ?? $control['depends'] ?? [],
            'recommends' => $control['recommends'] ?? [],
            'filename' => $path,
            'size' => (int) $file->getSize(),
            'sha256' => (string) hash_file('sha256', $temporaryPath),
            'status' => PackageStatus::Uploaded,
            'metadata' => ['control' => $control],
            'uploaded_by' => $request->user()->id,
        ]);

        $audit->log('package.uploaded', $package, after: [
            'name' => $package->name,
            'version' => $package->version,
            'channel' => $package->channel->value,
            'sha256' => $package->sha256,
        ]);

        return back()->with('success', 'Package uploaded. Sign it before publishing.');
    }

    public function update(UpdatePackageRequest $request, DebianPackage $package, AuditLogger $audit): RedirectResponse
    {
        $before = $package->only(['name', 'version', 'channel', 'component', 'section', 'description', 'depends']);
        $data = $request->validated();

        if (isset($data['channel'])) {
            $data['channel'] = ReleaseChannel::from((string) $data['channel']);
        }

        $package->update($data);
        $audit->log('package.updated', $package, before: $before, after: $package->fresh()->only(array_keys($before)));

        return back()->with('success', 'Package updated.');
    }

    public function sign(DebianPackage $package, GpgSigner $signer, AuditLogger $audit): RedirectResponse
    {
        $stream = Storage::disk('s3')->readStream($package->filename);

        if (! is_resource($stream)) {
            return back()->with('error', 'Package artifact is missing from object storage.');
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'openbox-deb-');

        if ($temporaryPath === false) {
            return back()->with('error', 'Temporary file could not be created.');
        }

        try {
            $target = fopen($temporaryPath, 'wb');

            if ($target === false) {
                throw new \RuntimeException('Temporary file cannot be opened.');
            }

            stream_copy_to_stream($stream, $target);
            fclose($target);
            fclose($stream);

            $signature = $signer->sign($temporaryPath, (string) ($package->gpg_key_id ?? config('gpg.key_id')));

            $package->update([
                'gpg_signature' => $signature,
                'gpg_key_id' => (string) config('gpg.key_id'),
                'status' => PackageStatus::Signed,
            ]);

            $audit->log('package.signed', $package, metadata: ['key_id' => config('gpg.key_id')]);

            return back()->with('success', 'Package signed with the server-side GPG key.');
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('error', 'Signing failed: '.$exception->getMessage());
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
            @unlink($temporaryPath);
        }
    }

    public function destroy(DebianPackage $package, AuditLogger $audit): RedirectResponse
    {
        $audit->log('package.deleted', $package, before: [
            'name' => $package->name,
            'version' => $package->version,
            'sha256' => $package->sha256,
        ]);

        Storage::disk('s3')->delete($package->filename);
        $package->delete();

        return back()->with('success', 'Package deleted.');
    }

    public function download(DebianPackage $package): StreamedResponse
    {
        $stream = Storage::disk('s3')->readStream($package->filename);

        if (! is_resource($stream)) {
            abort(404, 'Package artifact not found.');
        }

        return response()->streamDownload(static function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, basename($package->filename), [
            'Content-Type' => 'application/vnd.debian.binary-package',
            'X-Checksum-Sha256' => $package->sha256,
        ]);
    }
}
