# Architecture

## Components

```text
                 HTTPS (session / Sanctum token)
 Browser ─────────────────────────────────────────────┐
   │  Inertia XHR + Echo WebSocket                    │
   ▼                                                  ▼
 nginx ──► PHP-FPM (panel)                        Reverb (ws)
             │  Laravel 11, Inertia, Vue 3            ▲
             │                                       │ broadcast
             ├── PostgreSQL 16 (state, audit)         │
             ├── Redis (sessions, cache, queues) ─────┘
             ├── MinIO / S3 (artifacts, backups)
             │
             │ BuildAgentClient (HMAC-SHA256)
             ▼
        Fastify agent :8090 ──► BullMQ ──► privileged build worker
                                             │  rsync isolated workspace
                                             │  docker/scripts/build-iso.sh
                                             │  lb build
                                             ▼
                                     ISO ──► S3 ──► panel download

        Agent ── signed callbacks ──► /api/v1/internal/builds/{uuid}/*
```

| Layer | Path | Responsibility |
| --- | --- | --- |
| Panel HTTP | `panel/app/Http` | Controllers, Form Requests, middleware, resources |
| Domain services | `panel/app/Services` | Build lifecycle, manifests, GPG, mirrors, backups, audit |
| Queue jobs | `panel/app/Jobs` | Build dispatch/cancel, mirror sync, notifications, backups |
| UI | `panel/resources/js` | Inertia pages, components, composables, typed DTOs |
| Agent API | `api/src/server.ts` | Signed HTTP endpoints, OpenAPI, health |
| Agent worker | `api/src/services/runner.ts` | live-build process, log batching, callbacks, artifact upload |
| Build contract | `api/src/schemas/job.ts`, `shared/types` | Validated job/manifest/callback shapes |
| Build script | `docker/scripts/build-iso.sh` | Isolated copy, config rewrite, `lb build`, ISO move |

## Authentication and request flow

1. `GET /login` renders the Inertia guest layout. `POST /login` is throttled by
   the `login` rate limiter.
2. On valid credentials the session is regenerated. If TOTP is enabled the user
   is placed in the two-factor challenge state; otherwise the dashboard loads.
3. Every authenticated route passes `auth:sanctum` and `two-factor`. Each route
   adds `permission:<name>`; `EnsurePermission` consults the user's roles.
4. Controllers validate through Form Requests, call domain services, write an
   audit entry, and redirect/render. JSON clients receive the shared envelope.

Inertia props are camelCase. Eloquent models use snake_case columns. API
Resources (`panel/app/Http/Resources`) perform the mapping.

## Build flow

```text
POST /builds (permission builds.trigger)
  └─ BuildController@store
      ├─ BuildManifestFactory::make()     snapshot settings + signed packages
      ├─ Build::create(status=queued, manifest JSONB, idempotency_key)
      ├─ AuditLogger::log('build.triggered')
      └─ StartIsoBuild::dispatch($build)->onQueue('builds')

queue: builds
  └─ StartIsoBuild
      ├─ lifecycle.markDispatching(driver)
      ├─ BUILD_DRIVER=agent → BuildAgentClient::dispatch(build)
      │     POST /v1/jobs { buildUuid, channel, manifest, callbackBaseUrl, ... }
      └─ BUILD_DRIVER=local → BuildScriptRunner (docker/scripts/build-iso.sh)

Fastify agent
  ├─ verifies HMAC + nonce + timestamp window
  ├─ zod-validates the job and enqueues BullMQ job id = build UUID
  └─ worker: BuildRunner
        ├─ rm/mkdir <workDir>/<uuid>, write manifest.json + packages.txt
        ├─ spawn build-iso.sh (no shell, argv array)
        ├─ batch logs → /internal/builds/{uuid}/logs
        ├─ throttle stage/progress → /internal/builds/{uuid}/status
        ├─ artifact upload (S3/MinIO or local)
        └─ terminal → /internal/builds/{uuid}/complete

Laravel callbacks
  ├─ BuildLogService::appendBatch()  (idempotent on sequence)
  ├─ BuildLifecycleService::finish() (terminal guard)
  └─ broadcast BuildLogAppended / BuildStatusChanged via Reverb
```

Realtime UI: `panel/resources/js/Composables/useBuildChannel.ts` subscribes to
`private-builds.{uuid}` and falls back to `/builds/{uuid}/logs?after=N` plus
`/builds/{uuid}/status` when Echo is unavailable.

## Queue topology

| Queue | Producer | Consumer |
| --- | --- | --- |
| `builds` | `StartIsoBuild`, `CancelIsoBuild` | Horizon `supervisor-builds` (Laravel side), BullMQ worker (agent side) |
| `default` | Mirror sync, notifications, backups, checks | Horizon `supervisor-1` |

Horizon runs inside Laravel and must not consume the agent's BullMQ `builds`
queue: both use Redis, so the agent uses its own queue name (`BUILD_QUEUE`,
default `builds`) and the Laravel job only dispatches HTTP. If reusing a Redis
instance, keep the namespaced keys distinct (BullMQ prefix `bull` by default).

## Database schema

All application tables live in `panel/database/migrations`. Column names are
snake_case.

| Table | Purpose |
| --- | --- |
| `users`, `password_reset_tokens`, `sessions` | Laravel identity + session storage |
| `roles`, `permissions`, `permission_role`, `role_user` | RBAC |
| `personal_access_tokens` | Sanctum API tokens |
| `debian_packages`, `repositories` | Debian package inventory and apt repositories |
| `builds` | Build request, JSONB manifest, status, artifact metadata |
| `build_logs` | Append-only, sequence-ordered log lines |
| `releases` | Published artifacts, channel, checksums |
| `mirrors`, `mirror_syncs` | Mirror endpoints and sync history |
| `settings` | Encrypted key/value settings with groups |
| `audit_logs` | Hash-chained immutable audit trail |
| `panel_notifications` | In-app notification feed |
| `backups` | pg_dump artifacts and restore status |
| `cache`, `jobs`, `job_batches`, `failed_jobs` | Laravel infrastructure |

Notable constraints:

- `builds.manifest` is JSONB; `builds.uuid` is the route key.
- `builds.retry_of_id` links retries; `builds.idempotency_key` prevents
  duplicate submissions.
- `build_logs` is unique on `(build_id, sequence)`.
- `audit_logs.previous_hash`/`hash` form the chain; triggers reject
  `UPDATE`/`DELETE`.
- `releases.checksums` stores ISO digests per artifact.

## Status model

```text
queued ─► dispatching ─► running ─► succeeded
   │            │            └────► failed
   └────────────┴───────────────► canceled
```

`BuildStatus::isTerminal()` guards late callbacks; `BuildLifecycleService`
ignores duplicate completion, so retries and racing callbacks are idempotent.

## Failure boundaries

| Failure | Behaviour |
| --- | --- |
| Agent unreachable at dispatch | Job throws, build marked failed, audit + notification |
| Callback signature invalid | `401` envelope, no state change |
| Replayed callback nonce | `409` envelope, no state change |
| Duplicate build UUID dispatch | Agent returns `202` with `duplicate: true` |
| Process timeout | Agent terminates process, reports `failed` with timeout error |
| Cancellation | Agent polls a Redis cancel key, SIGTERM then SIGKILL, reports `canceled` |
| Artifact missing after exit 0 | Agent reports `failed` (`Artifact collection failed`) |
| Upload failure | Agent reports `failed`; panel keeps build failed, no artifact |
