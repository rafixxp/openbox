# Security

This document describes the trust boundaries, authentication and authorization
model, audit guarantees, service-to-service signing, secret handling, and the
hardening controls implemented in `panel/`, `api/`, and `docker/`.

## Trust boundaries

```text
Browser ──(session cookie + CSRF)──► Panel (Laravel)
                                        │
                                        ├─ PostgreSQL: state + immutable audit chain
                                        ├─ Redis: sessions, cache, queues, nonces
                                        ├─ S3/MinIO: private artifacts, backups
                                        │
                                        └─(HMAC-SHA256)──► Agent (Fastify)
                                                              │
                                                              └─ privileged build worker
                                                                   └─ isolated live-build workspace
```

| Zone | Runs as | Can reach | Must never |
| --- | --- | --- | --- |
| Panel web | `www-data` | PostgreSQL, Redis, MinIO, agent | execute `live-build`, `install_panel_en.sh`, or `pg_restore` |
| Horizon / scheduler | `www-data` | PostgreSQL, Redis, MinIO | mount the source tree writable |
| Agent HTTP | `node` (non-root) | Redis, panel callbacks, MinIO | spawn builds with privileges |
| Build worker | root, privileged container | source tree (read-only), Redis, MinIO, panel callbacks | expose an HTTP port to the internet |
| Browser | end user | panel only | supply build commands or paths |

The build worker is the only component with kernel capabilities, and it is
opt-in (`--profile build` plus `docker/build/privileged.override.yml`). Keep it
on a separate host from the public panel when possible.

## Authentication

### Session authentication (browser)

- Inertia pages use Laravel's session guard via `auth:sanctum` with
  `$middleware->statefulApi()`. Cookies are `HttpOnly`, `SameSite=Lax`, and
  encrypted (`SESSION_ENCRYPT=true`).
- Set `SESSION_SECURE_COOKIE=true` and serve over HTTPS in production.
- `POST /login` is limited to **5 attempts/minute** per `email|ip`
  (`RateLimiter::for('login')`). A successful login calls
  `session()->regenerate()` before redirecting.
- `POST /logout` invalidates the session and regenerates the CSRF token.

### Two-factor authentication (TOTP)

- `POST /profile/two-factor/enable` generates a random TOTP secret and stores it
  with the Eloquent `encrypted` cast. The secret is shown once as an
  `otpauth://` URI (rendered as text, never `v-html`).
- `POST /profile/two-factor/confirm` verifies a 6-digit code and sets
  `two_factor_confirmed_at`.
- Recovery codes are generated once, stored inside the encrypted
  `two_factor_recovery_codes` column, and consumed one at a time with a
  constant-time comparison (`hash_equals`).
- After credential validation, a 2FA-enabled user is placed in a pending state
  (`auth.two_factor_user_id`). The `two-factor` middleware (`EnsureTwoFactorVerified`)
  blocks every authenticated route until the challenge succeeds.
- `POST /two-factor-challenge` is limited to **5 attempts/minute** per
  `pending user id|ip`.
- The provisioning URI is rendered locally into a canvas with the bundled
  `qrcode` package. No external QR service receives the secret, and the secret
  is never inserted with `v-html`.

### API tokens (Sanctum)

`POST /api/v1/auth/token` accepts `email`, `password`, `device_name`, and
`otp` (required when 2FA is enabled). Behaviour:

| Aspect | Value |
| --- | --- |
| Token type | Sanctum personal access token (`Bearer`) |
| Lifetime | 30 days (`expiresAt` returned) |
| Abilities | Admin: `['*']`; others: their permission names |
| 2FA | TOTP code or a single-use recovery code is required |
| Throttle | `throttle:login` (5/min) |
| Audit | `auth.api_token.created` with device name and abilities |

Tokens are pruned daily by `sanctum:prune-expired --hours=24`. Users cannot
elevate abilities at token creation; abilities are derived from current
permissions, so removing a role also narrows newly issued tokens. Revoke a
token by deleting the row in `personal_access_tokens` (or via a future admin
surface).

## Authorization (RBAC)

Three system roles are seeded; every route additionally declares a
`permission:<name>` middleware.

| Permission | admin | maintainer | viewer |
| --- | :---: | :---: | :---: |
| `dashboard.view` | ✅ | ✅ | ✅ |
| `builds.view` | ✅ | ✅ | ✅ |
| `builds.trigger` | ✅ | ✅ | — |
| `builds.cancel` | ✅ | ✅ | — |
| `builds.download` | ✅ | ✅ | — |
| `packages.view` | ✅ | ✅ | ✅ |
| `packages.create` | ✅ | ✅ | — |
| `packages.update` | ✅ | ✅ | — |
| `packages.delete` | ✅ | — | — |
| `packages.sign` | ✅ | ✅ | — |
| `releases.view` | ✅ | ✅ | ✅ |
| `releases.manage` | ✅ | ✅ | — |
| `releases.publish` | ✅ | ✅ | — |
| `mirrors.view` | ✅ | ✅ | ✅ |
| `mirrors.manage` | ✅ | ✅ | — |
| `users.view` | ✅ | — | — |
| `users.manage` | ✅ | — | — |
| `settings.view` | ✅ | — | — |
| `settings.manage` | ✅ | — | — |
| `audit.view` | ✅ | ✅ | — |
| `logs.view` | ✅ | — | — |

Enforcement layers:

1. **Route middleware** — `EnsurePermission` rejects with `403` (Inertia error
   page, or API envelope for `/api/*`).
2. **Policies** — `BuildPolicy` is registered for `Build`; controllers call
   `$this->authorize(...)` for object-level checks (`BuildApiController`,
   `BuildController@logs/status/download`).
3. **Gate shortcut** — `Gate::before` returns `true` for admins only.
4. **Form Requests** — `authorize()` re-checks sensitive actions (for example
   `StoreBuildRequest` requires `builds.trigger`).

Role assignment is admin-only (`users.manage`). The `UserController` prevents
removing or demoting the last remaining admin. System roles cannot be deleted.

## Audit trail

`audit_logs` is append-only and hash-chained.

```
payload = { action, actor_id, actor_name, subject_type, subject_id,
            before, after, metadata, previous_hash }
hash    = sha256(json_encode(payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE))
```

Guarantees:

- The row is written inside a transaction that locks the previous record
  (`lockForUpdate()`), so concurrent writers cannot fork the chain.
- `AuditLog` model events throw on `updating`/`deleting`.
- A PostgreSQL trigger (`openbox_audit_logs_immutable`) raises
  `audit_logs is immutable` on `UPDATE`/`DELETE`, so even raw SQL through the
  application role cannot rewrite history. The migration drops the trigger on
  `down()` only.
- `ip_address` and a 1000-character `user_agent` are captured from the request.

Events recorded include authentication, build queue/dispatch/cancel/complete,
package upload/sign/delete, release publish/archive, mirror sync, settings
changes, backup create/restore, and user/role changes.

Verification query (detects a rewritten or deleted row):

```sql
WITH ordered AS (
  SELECT id, previous_hash, hash,
         lag(hash) OVER (ORDER BY id) AS expected_previous
  FROM audit_logs
)
SELECT id FROM ordered
WHERE previous_hash IS DISTINCT FROM expected_previous;
```

Empty result = chain intact. Gaps in `id` are expected after failed
transactions but must never produce a `previous_hash` mismatch.

## Service-to-service authentication (HMAC)

The Laravel panel and the Fastify agent share `BUILD_AGENT_SECRET`. The same
signature scheme protects both directions.

Canonical string (UTF-8, LF separators, no trailing newline):

```
timestamp \n nonce \n METHOD \n /path \n sha256(raw_body)
```

Headers:

| Header | Meaning |
| --- | --- |
| `X-Agent-Timestamp` | Unix seconds. ±300 s window |
| `X-Agent-Nonce` | Unique per request, ≤128 chars |
| `X-Agent-Signature` | Lowercase hex HMAC-SHA256 of the canonical string |
| `X-Agent-Id` | Sender identity (used for agent-side rate limiting) |

Rules:

- The path excludes the query string; the body hash covers the exact bytes sent.
- Signatures are compared with `hash_equals` (constant time).
- The nonce is stored as `agent-nonce:<sha256(nonce)>` for 600 s. A second use
  returns `409 replayed_request`; a stale timestamp returns
  `401 stale_signature`; a wrong signature returns `401 invalid_signature`.
- If `BUILD_AGENT_SECRET` is empty, the middleware fails closed with `503
  agent_not_configured`.
- The agent applies the same rules to Laravel's `POST /v1/jobs` and
  `POST /v1/jobs/{uuid}/cancel`, using an in-process nonce store.
- Callback URLs are **not** taken from the callback body: Laravel supplies a
  per-job `callbackBaseUrl` and the agent appends
  `/api/v1/internal/builds/{uuid}/{logs|status|complete}`. This prevents a
  forged manifest from redirecting callbacks to an attacker host; the agent
  only signs requests to the base URL its job carries.

Rotate the secret by generating a new value, updating both `panel/.env` and
`api/.env`, and restarting the agent and Horizon workers. In-flight callbacks
signed with the old secret will fail and be retried; the build itself is
unaffected.

## Secret handling

| Secret | Location | Notes |
| --- | --- | --- |
| `APP_KEY` | `panel/.env` | Encrypts sessions, TOTP secrets, encrypted settings |
| `BUILD_AGENT_SECRET` | `panel/.env` + `api/.env` | 32-byte random hex; never shipped to the browser |
| `REVERB_APP_SECRET` | `panel/.env` | Server-side only; the browser gets `VITE_REVERB_APP_KEY` |
| DB / Redis / S3 credentials | `.env` | Compose injects via `env_file`, never baked into images |
| `GPG_PASSPHRASE`, `GPG_KEY_ID` | `.env` | Private key material stays under `GNUPGHOME` on the panel host |
| `TELEGRAM_BOT_TOKEN` | `settings` table | Stored with `encrypted` cast; API returns only `_configured` |
| TOTP secrets / recovery codes | `users` columns | `encrypted` / `encrypted:array` casts |

Operational rules:

- `.env`, `.env.*` are git-ignored; only `.env.example` is committed.
- Docker images never contain `.env` (`.dockerignore` excludes it).
- The GPG private key is generated/imported on the server and is never placed
  under the web root or in the build agent image. Signing happens in the panel
  process via `gpg` with a restricted `GNUPGHOME`.
- Logs redact authorization headers; the agent never logs request bodies.
- Rotate every development default (`openbox-dev-password`,
  `openbox-minio-password`, `dev-agent-secret-change-me`) before any shared
  deployment. `docker/scripts/dev-bootstrap.sh` generates `APP_KEY` and the
  agent secret automatically, but not database or MinIO passwords.

## Web application hardening

### CSRF

- All state-changing browser routes are `POST`/`PUT`/`DELETE` on the `web`
  middleware group and require the CSRF token.
- Inertia's axios client sends `X-XSRF-TOKEN` automatically; the Blade shell
  exposes `csrf-token` for Echo's `/broadcasting/auth` call.
- The token API (`/api/v1/auth/token`) is intentionally stateless and does not
  accept cookies (`statefulApi` only applies to listed domains).

### XSS

- No `v-html` is used anywhere; build log lines, package metadata, and error
  messages are rendered with `{{ }}` text interpolation.
- The agent strips ANSI escape sequences and control characters from build
  output before persisting it.
- Nginx adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive
  `Permissions-Policy`. The agent adds `nosniff` and `cache-control: no-store`.

### SQL injection

- All queries use Eloquent or the query builder with bindings.
- Validation uses `Rule::in`, `Rule::enum`, and typed arrays; no user string is
  interpolated into raw SQL.
- `BuildLogService` writes parameterized inserts; `build_logs` uniqueness on
  `(build_id, sequence)` makes retried callbacks idempotent.

### Command execution

- Laravel never calls `live-build` or `install_panel_en.sh` from a controller.
- The local runner and the agent spawn the build script with an **argv array**
  (no shell). Manifest values are validated before use: ISO name is a safe
  basename, suite matches `^[a-z][a-z0-9-]*$`, architecture is one of
  `amd64|arm64|i386`, mirror must be `http(s)`, package names match
  `^[a-z0-9][a-z0-9+.-]*$`.
- `rclone` and `pg_dump`/`pg_restore` are invoked through Symfony `Process`
  arrays, never string concatenation.

### Rate limits

| Limiter | Key | Limit |
| --- | --- | --- |
| `login` | lowercased email + IP | 5/min |
| `two-factor` | pending user id + IP | 5/min |
| `api` | user id (or IP) | 60/min |
| `agent` | `X-Agent-Id` header (or IP) | 600/min |

## Build isolation and installer safety

- `docker/scripts/build-iso.sh` rsyncs the project into
  `<workspace>/source` with anchored excludes (`/binary`, `/chroot`, `/.build`,
  `/panel`, `/api`, `/docker`, `/docs`, `/shared`, caches, previous ISOs).
  The repository checkout is never passed to `lb build`.
- Only the copy's `config/bootstrap` and `config/chroot` are rewritten.
- `install_panel_en.sh` is the aaPanel installer. It is only staged when a
  build sets `includePanelInstaller` **and** the manifest carries its sha256.
  The script verifies the digest before copying, and the generated
  `20-panel-installer.chroot` hook verifies it again inside the chroot before
  executing. The hook exits 0 unless `OPENBOX_INSTALL_PANEL=1`.
- The installer never runs on the panel host, in the web container, or in the
  agent HTTP process.
- Build artifacts are uploaded with `visibility: private`; downloads go through
  the panel's permission-checked route (`builds.download`), which issues a
  short-lived temporary URL or streams a local artifact confined to
  `BUILD_WORK_DIR`.

## Backup and restore safeguards

- Creating a backup requires `settings.manage` and an admin role.
- Restore requires `settings.manage`, an explicit `confirm` field equal to the
  backup `filename`, and records `backup.restore_requested` in the audit log
  before the destructive `pg_restore` job runs.
- Backups are written to the local disk (`storage/app/private/backups`) and
  hashed (sha256) at completion; downloads require `settings.manage`.

## Hardening checklist

- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] `APP_KEY` and `BUILD_AGENT_SECRET` generated with `openssl rand`
- [ ] `SESSION_SECURE_COOKIE=true`, TLS terminated in front of nginx
- [ ] `SANCTUM_STATEFUL_DOMAINS` limited to the panel hostname
- [ ] Database, Redis, MinIO credentials rotated from examples
- [ ] Redis and PostgreSQL bound to a private network (Compose binds them to
      `127.0.0.1` by default)
- [ ] MinIO bucket policy is private; no anonymous read
- [ ] GPG key imported server-side; passphrase in `.env`, never in the DB
- [ ] Build worker isolated (separate host/profile); no inbound port
- [ ] Audit chain verified before and after upgrades
- [ ] Backups tested with `pg_restore --list` on a staging database
- [ ] Log retention/rotation configured for `daily` channel and worker stdout
