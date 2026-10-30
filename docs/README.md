# Openbox Panel

Web control plane for the existing Openbox Debian Bookworm live-build image.
It adds an authenticated Laravel 11 + Inertia/Vue application, a queue-driven
ISO build pipeline, a signed Fastify build agent, and Docker assets for local
development.

The existing live-build tree is treated as read-only input:

```text
binary/  chroot/  .build/  config/  auto/  live-build/   # never modified by the panel
panel/                                                    # Laravel + Vue application
api/                                                      # Fastify build agent + worker
shared/                                                   # wire-contract TypeScript types
docker/                                                   # images, compose, build script
docs/                                                     # architecture, security, CI templates
```

`install_panel_en.sh` (the aaPanel installer) is never executed on the panel
host. It can only be staged inside an isolated live-build chroot when a build
explicitly opts in.

## What is included

| Area | Implementation |
| --- | --- |
| Authentication | Laravel Sanctum SPA sessions + personal access tokens, login throttles, TOTP 2FA with recovery codes |
| RBAC | `admin`, `maintainer`, `viewer` roles and 21 granular permissions enforced by middleware and policies |
| Audit | Append-only, hash-chained audit log with PostgreSQL triggers and model-level immutability |
| Dashboard | Build, package, release, mirror and user summaries with flash/notification surfaces |
| Packages | Upload `.deb`, checksum, GPG signing, update/delete, download |
| Builds | Trigger from manifest, queue, realtime logs (Reverb) with polling fallback, cancel, retry, artifact download |
| Releases | Draft/publish/archive lifecycle, channels, checksums, build linkage |
| Mirrors | CRUD, health checks, rclone-backed sync jobs, sync history |
| Users | User CRUD, role assignment, last-admin protection |
| Settings | Encrypted settings, mail/Telegram test, GPG key id, backup retention |
| Backups | `pg_dump` / `pg_restore` jobs, download, destructive restore with filename confirmation |
| Build agent | Fastify HTTP API, HMAC-SHA256 + nonce replay protection, BullMQ worker, S3 upload, OpenAPI at `/openapi.json` |

## Quick start (Docker)

Prerequisites: Docker Engine 24+, Docker Compose 2.24+ (for
`additional_contexts`), Linux host.

```bash
# Creates panel/.env and api/.env, generates APP_KEY + shared agent secret,
# then starts the stack including the privileged build worker.
./docker/scripts/dev-bootstrap.sh
```

Open <http://localhost:8080>. The default development admin comes from
`panel/.env` (`PANEL_ADMIN_EMAIL` / `PANEL_ADMIN_PASSWORD`).

Services and ports:

| Service | Port | Notes |
| --- | --- | --- |
| Panel (nginx) | 8080 | Inertia UI + JSON API |
| Reverb WebSocket | 8081 | Realtime build logs; polling fallback works without it |
| Build agent | 8090 | Signed service-to-service API |
| MinIO API / console | 9000 / 9001 | `openbox` / `openbox-minio-password` |
| PostgreSQL | 5432 (localhost only) | `openbox_panel` |
| Redis | 6379 (localhost only) | Sessions, cache, queues |

The ISO worker needs `SYS_ADMIN`, so it lives behind the `build` profile and the
privileged override. The bootstrap script already passes both flags. Without
them the panel works but builds remain queued.

## Documentation

| Document | Contents |
| --- | --- |
| [architecture.md](architecture.md) | Component diagram, request/build flows, schema, queues |
| [security.md](security.md) | Auth, RBAC, 2FA, audit chain, HMAC, secret handling |
| [build-integration.md](build-integration.md) | Manifest, agent contract, isolated workspace, installer staging |
| [api.md](api.md) | Full web/API/agent route table and payload contracts |
| [operations.md](operations.md) | Deployment, migrations, backups, mirrors, monitoring |
| [development.md](development.md) | Local setup, tests, linting, frontend workflow |
| [ci/README.md](ci/README.md) | Ready-to-copy CI workflow templates |

## Baseline commands

```bash
# Backend (inside panel/, with PHP 8.3 + Composer installed)
composer install
php artisan migrate --seed
php artisan test            # Pest
./vendor/bin/pint --test

# Frontend
npm install
npm run typecheck           # vue-tsc --noEmit
npm test                    # Vitest + Vue Test Utils
npm run build

# Build agent
cd api
npm install
npm run typecheck
npm test
npm run build
```

PHP/Composer/Docker execution is environment-dependent; the repository ships
tests for all three layers so CI can enforce them.

## Design constraints honoured

- Existing build folders (`binary/`, `chroot/`, `.build/`, `config/`, `auto/`,
  `live-build/`) are not modified by any panel code.
- Controllers never invoke `live-build` or `install_panel_en.sh`. Only the
  queued build job may dispatch the agent/runner, and only inside an isolated
  workspace copy.
- Validation happens at boundaries (Laravel Form Requests, agent zod schemas);
  every JSON response uses `{ success, data, error, meta }`.
- Database columns are `snake_case`; PHP classes are `PascalCase`; JavaScript
  and wire payloads are `camelCase`.
- No unsafe `v-html`; log rendering uses text interpolation only.
