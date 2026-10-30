# API Reference

Three HTTP surfaces exist, all using the same JSON envelope:

| Surface | Base path | Auth | Consumer |
| --- | --- | --- | --- |
| Panel web (Inertia) | `/` | session + CSRF | browser |
| Panel JSON API | `/api/v1` | Sanctum bearer token | automation |
| Internal callbacks | `/api/v1/internal` | HMAC-SHA256 | Fastify agent |

The build agent's own API is documented separately in
[`api/src/openapi.ts`](../api/src/openapi.ts) and served at
`GET http://<agent>:8090/openapi.json` (OpenAPI 3.1).

## Response envelope

Every JSON response (success or failure) has this shape:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "validation_error",
    "message": "The given data was invalid.",
    "details": { "email": ["The email field is required."] }
  },
  "meta": {}
}
```

Empty `meta` serialises as `{}` (not `[]`).

### Error codes

| HTTP | `error.code` | Source |
| --- | --- | --- |
| 400 | `bad_request` | generic HTTP exception |
| 400 | `invalid_json` | agent: malformed JSON body |
| 401 | `unauthenticated` | missing/expired token |
| 401 | `invalid_signature` | agent HMAC mismatch |
| 401 | `stale_signature` | agent timestamp outside ±300s |
| 403 | `forbidden` | RBAC/policy denial |
| 404 | `not_found` | missing route/record |
| 404 | `job_not_found` | agent cancel for unknown job |
| 409 | `conflict` | generic conflict |
| 409 | `replayed_request` | agent nonce reuse |
| 413 | `payload_too_large` | agent body >2 MB |
| 415 | `unsupported_media_type` | agent content type |
| 419 | `csrf_token_mismatch` | expired CSRF token |
| 422 | `validation_error` | Form Request / zod failure |
| 422 | `artifact_required` | success callback without artifact |
| 422 | `panel_installer_missing` | agent: installer flag without checksum |
| 429 | `too_many_requests` | rate limiter |
| 500 | `server_error` / `internal_error` | unexpected failure |
| 503 | `service_unavailable` | degraded dependency |
| 503 | `agent_not_configured` | `BUILD_AGENT_SECRET` unset |

## Panel web routes (Inertia)

All authenticated routes use `auth:sanctum` + `two-factor`. The permission
column is the additional `permission:` middleware.

### Guest

| Method | Path | Name | Throttle |
| --- | --- | --- | --- |
| GET | `/login` | `login` | — |
| POST | `/login` | — | `login` (5/min) |
| GET | `/two-factor-challenge` | `two-factor.challenge` | — |
| POST | `/two-factor-challenge` | — | `two-factor` (5/min) |

### Authenticated

| Method | Path | Name | Permission |
| --- | --- | --- | --- |
| GET | `/` | `dashboard` | — (dashboard view) |
| POST | `/logout` | `logout` | — |
| GET | `/profile/two-factor` | `profile.two-factor.show` | — |
| POST | `/profile/two-factor/enable` | `profile.two-factor.enable` | — |
| POST | `/profile/two-factor/confirm` | `profile.two-factor.confirm` | — |
| DELETE | `/profile/two-factor` | `profile.two-factor.disable` | — |
| POST | `/profile/two-factor/recovery-codes` | `profile.two-factor.recovery-codes` | — |
| GET | `/builds` | `builds.index` | `builds.view` |
| POST | `/builds` | `builds.store` | `builds.trigger` |
| GET | `/builds/{build}` | `builds.show` | `builds.view` |
| GET | `/builds/{build}/logs?after=N` | `builds.logs` | `builds.view` |
| GET | `/builds/{build}/status` | `builds.status` | `builds.view` |
| POST | `/builds/{build}/retry` | `builds.retry` | `builds.trigger` |
| POST | `/builds/{build}/cancel` | `builds.cancel` | `builds.cancel` |
| GET | `/builds/{build}/download` | `builds.download` | `builds.download` |
| GET | `/packages` | `packages.index` | `packages.view` |
| POST | `/packages` | `packages.store` | `packages.create` |
| PUT | `/packages/{package}` | `packages.update` | `packages.update` |
| DELETE | `/packages/{package}` | `packages.destroy` | `packages.delete` |
| POST | `/packages/{package}/sign` | `packages.sign` | `packages.sign` |
| GET | `/packages/{package}/download` | `packages.download` | `packages.view` |
| GET | `/releases` | `releases.index` | `releases.view` |
| POST | `/releases` | `releases.store` | `releases.manage` |
| POST | `/releases/{release}/publish` | `releases.publish` | `releases.publish` |
| POST | `/releases/{release}/archive` | `releases.archive` | `releases.manage` |
| DELETE | `/releases/{release}` | `releases.destroy` | `releases.manage` |
| GET | `/mirrors` | `mirrors.index` | `mirrors.view` |
| POST | `/mirrors` | `mirrors.store` | `mirrors.manage` |
| PUT | `/mirrors/{mirror}` | `mirrors.update` | `mirrors.manage` |
| DELETE | `/mirrors/{mirror}` | `mirrors.destroy` | `mirrors.manage` |
| POST | `/mirrors/{mirror}/check` | `mirrors.check` | `mirrors.manage` |
| POST | `/mirrors/{mirror}/sync` | `mirrors.sync` | `mirrors.manage` |
| GET | `/users` | `users.index` | `users.view` |
| POST | `/users` | `users.store` | `users.manage` |
| PUT | `/users/{user}` | `users.update` | `users.manage` |
| DELETE | `/users/{user}` | `users.destroy` | `users.manage` |
| GET | `/settings` | `settings.index` | `settings.view` |
| PUT | `/settings` | `settings.update` | `settings.manage` |
| POST | `/settings/notifications/test` | `settings.notifications.test` | `settings.manage` |
| POST | `/settings/backups` | `settings.backups.create` | `settings.manage` |
| POST | `/settings/backups/{backup}/restore` | `settings.backups.restore` | `settings.manage` |
| GET | `/settings/backups/{backup}/download` | `settings.backups.download` | `settings.manage` |
| GET | `/audit-logs` | `audit.index` | `audit.view` |

Inertia pages answer `GET` with HTML (or JSON when `X-Inertia: true`), and
`POST`/`PUT`/`DELETE` with `303` redirects plus flash messages. They are not
intended as a JSON API.

Route-key note: builds use `uuid` (`Build::getRouteKeyName()`), packages and
releases use numeric ids.

### Page props (selected)

| Page | Props |
| --- | --- |
| `Dashboard` | `metrics`, `recentBuilds`, `mirrors`, `notifications`, `canTrigger` |
| `Builds/Index` | `builds` (paginated), `filters`, `channels`, `statuses`, `activeCount`, `canTrigger` |
| `Builds/Show` | `build` (with `logs` and artifact metadata) |
| `Packages/Index` | `packages` (paginated), `filters`, `channels`, `statuses`, `can` |
| `Releases/Index` | `releases` (paginated), `succeededBuilds`, `channels`, `can` |
| `Mirrors/Index` | `mirrors`, `statuses`, `releases`, `canManage` |
| `Users/Index` | `users` (paginated), `roles`, `canManage` |
| `Settings/Index` | `values`, `backups`, `canManage` |
| `Audit/Index` | `logs` (paginated), `filters` |

## Panel JSON API

Base: `/api/v1`. Authenticated routes require `Authorization: Bearer <token>`.

### `GET /api/v1/health`

Public. Checks PostgreSQL and Redis.

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "checks": { "database": true, "redis": true },
    "version": "1.0.0"
  },
  "error": null,
  "meta": {}
}
```

`503` with `data.status = "degraded"` when a check fails.

### `POST /api/v1/auth/token`

Throttled by `login` (5/min). Stateless; no cookies.

```json
{
  "email": "ops@example.com",
  "password": "secret",
  "device_name": "ci-runner",
  "otp": "123456"
}
```

`otp` is required when the user has confirmed TOTP. Response:

```json
{
  "success": true,
  "data": {
    "token": "1|plainTextToken...",
    "type": "Bearer",
    "expiresAt": "2026-11-29T12:00:00+00:00",
    "abilities": ["builds.view", "builds.trigger"]
  },
  "error": null,
  "meta": {}
}
```

Invalid credentials return `422 validation_error` with an `email` (or `otp`)
message, matching Laravel's validation behaviour rather than leaking whether
the account exists.

### `GET /api/v1/builds`

Requires `builds.view`. Query parameters: `status`, `channel`, `per_page`
(1–100, default 20).

```json
{
  "success": true,
  "data": [
    {
      "uuid": "2f6d3a9e-4b1c-4f7a-9d2e-8c5b6a7f0e11",
      "status": "running",
      "channel": "stable",
      "stage": "chroot",
      "progress": 42,
      "requestedBy": { "id": 1, "name": "Panel Administrator" },
      "errorMessage": null,
      "artifact": null,
      "createdAt": "2026-10-30T12:00:00+00:00",
      "startedAt": "2026-10-30T12:00:05+00:00",
      "finishedAt": null
    }
  ],
  "error": null,
  "meta": { "currentPage": 1, "perPage": 20, "total": 1, "lastPage": 1 }
}
```

### `GET /api/v1/builds/{uuid}`

Requires `builds.view` (policy). Includes the 500 most recent log entries and
the artifact metadata.

```json
{
  "success": true,
  "data": {
    "uuid": "...",
    "status": "succeeded",
    "logs": [
      { "sequence": 1, "level": "info", "message": "...", "loggedAt": "..." }
    ],
    "artifact": {
      "disk": "s3",
      "size": 734003200,
      "sha256": "...",
      "downloadUrl": "https://panel.example.com/builds/<uuid>/download"
    }
  },
  "error": null,
  "meta": {}
}
```

### Polling fallbacks

These are web routes returning the same envelope and require `builds.view`:

- `GET /builds/{uuid}/logs?after=<sequence>` → up to 1000 entries, meta
  `{ latestSequence }`.
- `GET /builds/{uuid}/status` → `{ uuid, status, stage, progress, exitCode,
  errorMessage, artifactSize, artifactSha256, finishedAt }`.

## Internal callback API (agent → panel)

Base: `/api/v1/internal/builds/{uuid}`. All three routes use
`agent.signature` + `throttle:agent`. See
[build-integration.md](build-integration.md#6-status-logs-and-completion-callbacks)
for payloads.

| Method | Path | Body |
| --- | --- | --- |
| POST | `/logs` | `{ entries: [{ sequence, level, message, loggedAt }] }` (1–200) |
| POST | `/status` | `{ status: "running", stage?, progress? }` |
| POST | `/complete` | `{ status, exitCode, error, progress, artifact? }` |

Signature headers: `X-Agent-Timestamp`, `X-Agent-Nonce`, `X-Agent-Signature`,
`X-Agent-Id`.

## Build agent API

Base URL: `BUILD_AGENT_URL` (default `http://build-agent:8090`). All job
routes require HMAC headers. Full schema: `/openapi.json`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | none | liveness + uptime |
| GET | `/openapi.json` | none | OpenAPI 3.1 document |
| POST | `/v1/jobs` | HMAC | enqueue a build |
| POST | `/v1/jobs/{uuid}/cancel` | HMAC | cancel queued/running build |

### `POST /v1/jobs`

Request: `{ buildUuid, channel, manifest, callbackBaseUrl, includePanelInstaller }`
(see [build-integration.md](build-integration.md#job-payload-laravel--agent)).

`202` response:

```json
{
  "success": true,
  "data": { "buildUuid": "...", "accepted": true, "duplicate": false },
  "error": null,
  "meta": { "queuedAt": "2026-10-30T12:00:00.000Z" }
}
```

### `POST /v1/jobs/{uuid}/cancel`

`202`:

```json
{
  "success": true,
  "data": { "buildUuid": "...", "canceling": true },
  "error": null,
  "meta": {}
}
```

`404 job_not_found` when no queued or active job exists.

### Signing example

```bash
BODY='{"buildUuid":"...","channel":"stable",...}'
TS=$(date +%s)
NONCE=$(uuidgen)
PATH_ONLY=/v1/jobs
BODY_HASH=$(printf '%s' "$BODY" | sha256sum | awk '{print $1}')
CANONICAL=$(printf '%s\n%s\nPOST\n%s\n%s' "$TS" "$NONCE" "$PATH_ONLY" "$BODY_HASH")
SIG=$(printf '%s' "$CANONICAL" | openssl dgst -sha256 -hmac "$BUILD_AGENT_SECRET" -hex | awk '{print $2}')

curl -sS -X POST "$BUILD_AGENT_URL$PATH_ONLY" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: manual" \
  -H "X-Agent-Timestamp: $TS" \
  -H "X-Agent-Nonce: $NONCE" \
  -H "X-Agent-Signature: $SIG" \
  --data-binary "$BODY"
```

## OpenAPI / Scramble

Scramble registers a UI at `/docs/api` (JSON at `/docs/api.json`) by default.
In production, either protect those routes with `auth` + `permission:settings.view`
or publish `config/scramble.php` and disable the UI. The `/api` surface is
intentionally small, so exporting the document for consumers is often enough:

```bash
cd panel
php artisan scramble:export --path=../docs/openapi-panel.json
```

The agent ships its own hand-written document at `/openapi.json`, pinned by
`api/test/contract.test.ts`.

## Versioning and compatibility

- `/api/v1` is stable; breaking changes require `/api/v2`.
- Wire fields are camelCase; database columns are snake_case.
- Shared TypeScript contracts live in `shared/types/contracts.ts` and must be
  updated together with `api/src/schemas/job.ts` and the Laravel resources.
- The envelope (`success`, `data`, `error`, `meta`) is part of the contract:
  clients must not assume `data` is present when `success` is false.
