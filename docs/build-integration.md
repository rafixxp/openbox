# Build Integration

How a panel build request becomes an ISO, without ever modifying the existing
live-build folders (`binary/`, `chroot/`, `.build/`, `config/`, `auto/`,
`live-build/`).

## End-to-end sequence

```text
Browser                Laravel panel                    Fastify agent              Build worker
   │                        │                                │                         │
   │ POST /builds           │                                │                         │
   ├───────────────────────►│ validate (FormRequest)         │                         │
   │                        │ BuildManifestFactory::make()   │                         │
   │                        │ INSERT builds (status=queued)  │                         │
   │                        │ audit build.queued            │                         │
   │                        │ dispatch StartIsoBuild ──┐     │                         │
   │ ◄── 303 /builds/{uuid} │                          │     │                         │
   │                        │ Horizon consumes ────────┘     │                         │
   │                        │ status=dispatching             │                         │
   │                        │ POST /v1/jobs (HMAC) ─────────►│ verify HMAC+nonce       │
   │                        │                                │ zod validate            │
   │                        │                                │ BullMQ add(jobId=uuid)  │
   │                        │                                │ ───────────────────────►│
   │                        │                                │                         │ write manifest.json
   │                        │                                │                         │ write packages.txt
   │                        │                                │                         │ spawn build-iso.sh
   │                        │                                │                         │ rsync isolated copy
   │                        │                                │                         │ lb build
   │                        │◄── POST .../logs (HMAC) ───────┼─────────────────────────┤
   │                        │◄── POST .../status (HMAC) ─────┼─────────────────────────┤
   │ ◄── Reverb log/status ─┤ broadcast                      │                         │
   │                        │                                │                         │ upload ISO → S3
   │                        │◄── POST .../complete (HMAC) ───┼─────────────────────────┤
   │                        │ status=succeeded + artifact    │                         │
   │ ◄── dashboard update ──┤                                │                         │
```

## 1. Request and manifest

`POST /builds` requires `builds.trigger`. `StoreBuildRequest` accepts:

| Field | Type | Notes |
| --- | --- | --- |
| `channel` | `stable` \| `testing` | required |
| `clean` | boolean | adds `lb clean --purge` in the workspace copy |
| `include_panel_installer` | boolean | stages the aaPanel installer hook (opt-in) |
| `notes` | string ≤2000 | stored in the manifest |
| `idempotency_key` | UUID | optional; duplicate submissions reuse the existing build |

`BuildManifestFactory` snapshots current state. Packages are the `signed` or
`published` `debian_packages` rows for the channel, ordered by name.

```json
{
  "schemaVersion": 1,
  "channel": "stable",
  "debian": {
    "suite": "bookworm",
    "architecture": "amd64",
    "mirror": "http://deb.debian.org/debian"
  },
  "packages": [
    { "name": "openbox", "version": "3.6.1-10", "architecture": "amd64" }
  ],
  "includePanelInstaller": false,
  "panelInstaller": null,
  "liveBuild": {
    "isolatedWorkspace": true,
    "clean": false,
    "isoName": "openbox-image-amd64.hybrid.iso"
  },
  "requestedBy": "ops@example.com",
  "createdAt": "2026-10-30T12:00:00+00:00",
  "notes": "optional"
}
```

When `includePanelInstaller` is true and `PANEL_INSTALLER_PATH` exists, the
factory adds:

```json
"panelInstaller": {
  "filename": "install_panel_en.sh",
  "sha256": "<64 lowercase hex chars>"
}
```

The manifest is stored in `builds.manifest` (JSONB) and is the only input the
agent trusts. Nothing from the browser is passed as a shell argument.

## 2. Queue dispatch

`StartIsoBuild` is the **only** entry point that starts a build. Controllers
dispatch it; they never call `live-build` or `install_panel_en.sh`.

- Queue: `config('build.queue')` (default `builds`).
- `tries = 1`, `timeout = BUILD_TIMEOUT + 300`.
- `BUILD_DRIVER=agent`: `BuildAgentClient::dispatch()` posts to `/v1/jobs`.
- `BUILD_DRIVER=local`: `BuildScriptRunner` runs the same script on the worker.
- Failure of the job (`failed()`) marks the build failed with an audit entry and
  notification.

### Job payload (Laravel → agent)

`POST /v1/jobs`

```json
{
  "buildUuid": "2f6d3a9e-4b1c-4f7a-9d2e-8c5b6a7f0e11",
  "channel": "stable",
  "manifest": { "...": "as above" },
  "callbackBaseUrl": "https://panel.example.com",
  "includePanelInstaller": false
}
```

`callbackBaseUrl` is `BUILD_AGENT_CALLBACK_URL` (defaults to `APP_URL`) and must
be the panel origin **without** `/api`. The agent appends
`/api/v1/internal/builds/{uuid}/{logs|status|complete}`.

## 3. Agent validation and queueing

The agent validates every request at the process boundary with zod
(`api/src/schemas/job.ts`):

- `buildUuid` is a UUID.
- `channel` matches `manifest.channel`.
- `debian.suite` matches `^[a-z][a-z0-9-]*$`.
- `debian.architecture` ∈ `amd64 | arm64 | i386`.
- `debian.mirror` and `callbackBaseUrl` are `http(s)://` URLs.
- `liveBuild.isoName` is a safe basename ending in `.iso` (no `/` or `..`).
- `packages` ≤500 entries with Debian package identifiers.
- `panelInstaller` filename is `^[A-Za-z0-9._-]+$` and `sha256` is 64 hex chars.
- `includePanelInstaller=true` requires a non-null `panelInstaller`.

Responses use the shared envelope:

| Status | Meaning |
| --- | --- |
| `202` | accepted; `data.duplicate` is `true` if the UUID was already queued |
| `401` | missing/stale/invalid HMAC |
| `409` | nonce replay |
| `422` | schema violation (details in `error.details`) |
| `404` | cancel requested for an unknown job |

The BullMQ job id is the build UUID, so a retried HTTP dispatch cannot create a
second build job.

## 4. Runner contract

`api/src/services/runner.ts` prepares a workspace and spawns the script with an
argv array (never a shell string):

```bash
build-iso.sh \
  --manifest  <workspace>/manifest.json \
  --workspace <workDir>/<buildUuid> \
  --output-dir <workspace>/output \
  --source-root <BUILD_SOURCE_ROOT> \
  --iso-name  openbox-image-amd64.hybrid.iso \
  --suite     bookworm \
  --architecture amd64 \
  --mirror    http://deb.debian.org/debian \
  --packages-file <workspace>/packages.txt \
  [--clean] \
  [--include-panel-installer --panel-installer <PANEL_INSTALLER_PATH>]
```

Environment: `OPENBOX_BUILD_UUID`, `OPENBOX_BUILD_CHANNEL`,
`OPENBOX_BUILD_WORKSPACE`, `OPENBOX_BUILD_ISO_NAME`,
`OPENBOX_BUILD_SOURCE_ROOT`, `LANG=C.UTF-8`, `HOME=<workspace>`.

Progress is emitted by the script as:

```text
[openbox] stage=<name> progress=<0-100>
```

The agent parses this line into `status` callbacks; every other stdout/stderr
line becomes a log entry (ANSI escapes and control chars stripped).

### Script behaviour (`docker/scripts/build-iso.sh`)

1. Validate arguments (`iso-name`, `suite`, `architecture`, `mirror`,
   required tools `rsync lb sha256sum python3`).
2. `rm -rf <workspace>/source`, then `rsync -a` the project with anchored
   excludes:

   ```text
   /.git  /.build  /binary  /chroot  /cache  /local
   /panel /api /docker /docs /shared /node_modules
   /*.iso  /*.files  /*.packages  /*.contents
   /chroot.files  /chroot.packages.*  /binary.modified_timestamps
   ```

   Anchored excludes keep `config/binary`, `config/chroot`, and `config/source`
   intact while dropping build output and control-plane sources.
3. Rewrite only the copy's `config/bootstrap` (`LB_ARCHITECTURE`,
   `LB_DISTRIBUTION*`, `LB_MIRROR*`, `LB_PARENT_*`) and
   `config/chroot` (`LB_LINUX_FLAVOURS_WITH_ARCH`).
4. Write `config/package-lists/50-openbox-panel.list.chroot` from
   `packages.txt`, validating each name as a Debian identifier.
5. Optionally stage the panel installer (see below).
6. `lb clean --purge` only when `--clean`.
7. `lb build 2>&1 | tee <workspace>/lb-build.log`, with a 30s heartbeat that
   advances progress from 15 to 85.
8. Find the newest `*.hybrid.iso` (fallback `*.iso`) in the copy, move it to
   `<output-dir>/<iso-name>`, write `<iso-name>.sha256`, and log
   `stage=completed progress=100`.

## 5. Opt-in panel installer staging

`install_panel_en.sh` is the aaPanel installer and is **never** executed on the
panel host. It is only staged when a build opts in and the manifest carries a
checksum:

1. The agent passes `--include-panel-installer --panel-installer <path>`.
2. The script reads `panelInstaller.sha256` from the manifest and compares it
   with `sha256sum` of the file. A mismatch aborts the build before `lb build`.
3. The script installs the file at
   `config/includes.chroot/opt/openbox/install_panel_en.sh`.
4. It writes `config/hooks/live/20-panel-installer.chroot`, substituting the
   expected digest. The hook:
   - exits `0` unless `OPENBOX_INSTALL_PANEL=1`,
   - re-verifies the digest inside the chroot,
   - runs `bash /opt/openbox/install_panel_en.sh` from `/root`.

The hook is always staged from a heredoc owned by the script, so the manifest
cannot inject hook content.

## 6. Status, logs, and completion callbacks

All three callbacks are `POST` to the panel with HMAC headers.

### `POST /api/v1/internal/builds/{uuid}/logs`

```json
{
  "entries": [
    {
      "sequence": 41,
      "level": "info",
      "message": "Installing packages",
      "loggedAt": "2026-10-30T12:00:00.000Z"
    }
  ]
}
```

- 1–200 entries per call.
- `sequence` is monotonic per build; `(build_id, sequence)` is unique, so
  retried batches are idempotent.
- Terminal builds return `202` with `data.accepted = 0` and are not mutated.
- Receiving logs while `queued`/`dispatching` moves the build to `running`.

### `POST /api/v1/internal/builds/{uuid}/status`

```json
{ "status": "running", "stage": "chroot", "progress": 42 }
```

Returns the current `{ uuid, status, progress, stage }`. Progress is clamped to
`0..100`; terminal builds are ignored.

### `POST /api/v1/internal/builds/{uuid}/complete`

```json
{
  "status": "succeeded",
  "exitCode": 0,
  "error": null,
  "progress": 100,
  "artifact": {
    "disk": "s3",
    "path": "builds/2f6d3a9e-.../openbox-image-amd64.hybrid.iso",
    "size": 734003200,
    "sha256": "<64 hex>"
  }
}
```

- `status` ∈ `succeeded | failed | canceled`.
- A `succeeded` build **must** include an artifact (`422 artifact_required`
  otherwise).
- Duplicate completion returns the existing terminal state with `ignored: true`.
- `BuildLifecycleService` enforces legal transitions and broadcasts
  `BuildStatusChanged`.

## 7. Artifact storage

| Producer | Disk/key |
| --- | --- |
| Agent (`ARTIFACT_DISK=s3`) | `builds/{uuid}/{isoName}` in `S3_BUCKET` |
| Agent (`ARTIFACT_DISK=local`) | absolute path on the worker host |
| Laravel local driver | `iso/{channel}/{uuid}/{isoName}` via `ArtifactStore` |

Artifacts are private. `GET /builds/{uuid}/download` requires
`builds.download`, then returns a 15-minute temporary S3 URL (or the disk URL if
temporary URLs are unsupported). The build row stores
`artifact_disk`, `artifact_path`, `artifact_size`, `artifact_sha256`.
`artifact_disk=local` is streamed by the panel, but only when the path resolves
inside `BUILD_WORK_DIR`; the panel never reads arbitrary paths reported by the
agent.

The panel uploads through `AWS_ENDPOINT` but signs download URLs through the
`s3_public` disk. Set `AWS_PUBLIC_ENDPOINT` when the internal endpoint is not
resolvable by the browser (the Compose stack sets it to
`http://localhost:9000`); in production, where S3 is already public, leave it
empty.

## 8. Cancellation, timeout, retry

### Cancel

`POST /builds/{uuid}/cancel` requires `builds.cancel`.

- `queued`: `CancelIsoBuild` marks the build canceled without dispatch.
- `dispatching`/`running`, driver `agent`: signed `POST /v1/jobs/{uuid}/cancel`.
  The agent sets a Redis cancel key (`openbox:build:cancel:{uuid}`, 24h TTL),
  removes the BullMQ job if still waiting, and returns `202`.
- The runner polls the key every second, sends `SIGTERM`, then `SIGKILL` after
  10s, and reports `canceled`.
- Driver `local`: the panel sets `build:cancel:{uuid}` in cache; the runner
  stops the process on the next output chunk.
- The Laravel job marks the build canceled immediately after forwarding.

### Timeout

- Agent: `BUILD_TIMEOUT_SECONDS` (default 7200). On expiry it SIGTERMs, then
  SIGKILLs, and reports `failed` with `Build timed out after … seconds.`
- Local: Symfony `Process` timeout `BUILD_TIMEOUT`; the build is failed with
  `Build timed out.`
- The Laravel queue job timeout is `BUILD_TIMEOUT + 300`.

### Retry

`POST /builds/{uuid}/retry` requires `builds.trigger`. It creates a **new**
build row with a fresh UUID, copies the manifest, sets `retry_of_id` to the
original, and dispatches `StartIsoBuild`. The original record is never mutated
and no logs are shared. Use retry only for terminal builds (the controller
rejects active ones).

## 9. Local driver

Set `BUILD_DRIVER=local` to have Horizon run the script directly:

```dotenv
BUILD_DRIVER=local
BUILD_SCRIPT=/opt/openbox/docker/scripts/build-iso.sh
OPENBOX_ROOT=/workspace/source
BUILD_WORK_DIR=/var/lib/openbox-build/workspace
PANEL_INSTALLER_PATH=/workspace/source/install_panel_en.sh
```

Requirements:

- `live-build`, `debootstrap`, `rsync`, `xorriso`, `squashfs-tools`, `python3`
  available to the PHP process.
- The worker runs on a dedicated host/container with the privileges live-build
  needs. Never enable this on the public web container.
- `Horizon` must be able to write `BUILD_WORK_DIR` and read `OPENBOX_ROOT`.

The agent path is preferred in production because the panel stays unprivileged.

## 10. Troubleshooting

| Symptom | Check |
| --- | --- |
| Build stuck in `queued` | Horizon running? `php artisan horizon:status`; `jobs` table if using database queue |
| Build stuck in `dispatching` | `BUILD_AGENT_URL` reachable, secret matches, agent logs |
| Agent returns `401` | clock skew >300s, wrong secret, or proxy rewrote the body |
| Agent returns `409` | nonce replay (duplicate proxy retry); check the reverse proxy |
| `422 validation_error` | inspect `error.details`; usually channel mismatch or unsafe ISO name |
| No logs in UI | WebSocket blocked → polling fallback hits `/builds/{uuid}/logs` |
| `Artifact collection failed` | script exited 0 but produced no ISO at `<workspace>/output/<iso>` |
| Callback `401` | agent and panel secrets differ, or `callbackBaseUrl` includes `/api` |
| Cancel does nothing | build already terminal, or agent cancel key expired |
| `lb build` fails | read `<workspace>/lb-build.log` and the tail in `builds.error_message` |
