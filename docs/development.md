# Development

How to run, test, and extend the panel locally.

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| Docker Engine + Compose v2 | 24+ / 2.24+ | dev stack (`additional_contexts` required) |
| PHP | 8.3 | running Laravel without Docker |
| Composer | 2.x | PHP dependencies |
| Node.js | 20+ (22 LTS recommended) | Vue + agent |
| PostgreSQL | 16 | production-like database |
| Redis | 7 | queues, cache, sessions |
| `rclone` | any recent | mirror sync |
| `pg_dump` / `pg_restore` | 16 | backups |

PHP extensions: `bcmath`, `intl`, `opcache`, `pcntl`, `pdo_pgsql`, `pgsql`,
`posix`, `redis`, `zip`.

## Docker quick start

```bash
cp panel/.env.example panel/.env
cp api/.env.example api/.env
./docker/scripts/dev-bootstrap.sh
```

The script:

1. Creates both `.env` files if missing.
2. Generates `APP_KEY` when it is empty.
3. Generates a shared `BUILD_AGENT_SECRET` and writes it to both files when the
   placeholder is still present.
4. Runs compose with the `build` profile and the privileged override.

Endpoints:

| URL | Service |
| --- | --- |
| <http://localhost:8080> | panel |
| <http://localhost:8080/horizon> | Horizon (admin only) |
| <http://localhost:8090/health> | agent |
| <http://localhost:9001> | MinIO console |
| `ws://localhost:8081` | Reverb |

Useful commands:

```bash
# everything except the privileged worker
docker compose -f docker/compose.dev.yml up -d

# rebuild one service
docker compose -f docker/compose.dev.yml build panel
docker compose -f docker/compose.dev.yml up -d panel

# logs
docker compose -f docker/compose.dev.yml logs -f panel horizon reverb build-agent

# artisan / composer / npm inside the panel
docker compose -f docker/compose.dev.yml exec panel php artisan migrate
docker compose -f docker/compose.dev.yml exec panel composer install
docker compose -f docker/compose.dev.yml exec panel npm run build

# stop and remove volumes (destroys DB, Redis, MinIO, build workspace)
docker compose -f docker/compose.dev.yml down -v
```

The compose file bind-mounts `panel/` and uses named volumes for `vendor/`,
`storage/`, `bootstrap/cache`, and `public/build`. If you change
`package.json` or `composer.json`, rebuild the image or run the installer
inside the container.

## Manual setup

```bash
# 1. Panel
cd panel
composer install
cp .env.example .env
php artisan key:generate

# 2. Point .env at local services
#    DB_HOST=127.0.0.1 DB_PORT=5432
#    REDIS_HOST=127.0.0.1
#    BUILD_AGENT_URL=http://127.0.0.1:8090
#    BUILD_AGENT_CALLBACK_URL=http://127.0.0.1:8080

# 3. Database
php artisan migrate --seed
php artisan storage:link

# 4. Frontend
npm install
npm run dev          # Vite HMR on :5173

# 5. Queue + realtime
php artisan horizon
php artisan reverb:start --port=8081
php artisan schedule:work
```

Run the agent in a second terminal:

```bash
cd api
npm install
cp .env.example .env
# set the same BUILD_AGENT_SECRET as panel/.env
npm run dev
```

For local builds without the agent, set `BUILD_DRIVER=local` and install
`live-build` on the machine. This requires root-level tooling and should only
be done on a disposable VM; the agent path is the default for a reason.

## Tests

### Laravel (Pest)

```bash
cd panel
composer install
php artisan test

# focused
php artisan test --filter=BuildTest
./vendor/bin/pest tests/Feature/AuthTest.php

# style
./vendor/bin/pint --test
./vendor/bin/pint            # fix
```

`phpunit.xml` runs against in-memory SQLite, `QUEUE_CONNECTION=sync`,
`BROADCAST_CONNECTION=null`, and a fixed test agent secret. PostgreSQL-only
objects (audit trigger) are skipped for SQLite. For PostgreSQL-specific
behaviour, run against a scratch Postgres database with `DB_CONNECTION=pgsql`.

Coverage today:

| File | Covers |
| --- | --- |
| `tests/Feature/AuthTest.php` | login, throttling, logout, token issuance |
| `tests/Feature/TwoFactorSetupTest.php` | enable/confirm/disable, challenge |
| `tests/Unit/TotpTest.php` | TOTP generation/verification window |
| `tests/Feature/RbacTest.php` | role/permission enforcement, last-admin guard |
| `tests/Feature/BuildTest.php` | trigger, manifest, retry, cancel, download permissions |
| `tests/Feature/PackageTest.php` | upload validation, sign, delete |
| `tests/Feature/InternalCallbackTest.php` | HMAC verify, replay, log idempotency, completion guard |
| `tests/Feature/AuditTest.php` | hash chain, model/trigger immutability |

### Frontend (Vitest + Vue Test Utils)

```bash
cd panel
npm run typecheck
npm test
npm run test:watch
npm run build
```

`vitest.config.ts` is deliberately separate from `vite.config.ts`: tests load
only the Vue plugin, while the build config loads `laravel-vite-plugin`.
Components are mounted with `@vue/test-utils`; the Echo composable is tested
with a fake `window.Echo` (see `resources/js/tests/setup.ts`).

### Agent (Vitest)

```bash
cd api
npm run typecheck
npm test
npm run build
```

The agent suite (40 tests) covers HMAC canonicalisation/tamper/replay, zod
schemas, signed/duplicate/cancel routes, malformed JSON, callback signing and
retry, runner success/failure/cancel, and the shared contract in
`shared/types/contracts.ts`.

## Code conventions

### PHP

- `declare(strict_types=1);` in every file.
- Classes `PascalCase`; methods/variables `camelCase`; DB columns `snake_case`.
- Controllers stay thin: validate with Form Requests, delegate to
  `app/Services`, return `Inertia::render` or `ApiResponse`.
- Queue work lives in `app/Jobs`; ISO builds only through `StartIsoBuild`.
- Every state change that matters writes `AuditLogger::log(...)`.
- Use enums (`BuildStatus`, `ReleaseChannel`, `RoleName`, `MirrorStatus`)
  instead of string literals in new code.

### Vue / TypeScript

- `<script setup lang="ts">` and strict typing; no `any` unless unavoidable.
- camelCase props and payloads; snake_case only in raw form fields that map to
  DB/request keys.
- Never use `v-html` (build logs and user content are rendered as text).
- Shared UI primitives live in `resources/js/Components`; page-local state stays
  in the page.
- New Inertia pages go under `resources/js/Pages/<Area>/<Name>.vue`, named
  exactly as the controller renders them.
- Types for API/Inertia payloads live in `resources/js/types/index.ts`.

### Agent

- Validate at the boundary with zod; downstream code receives typed values.
- Never read `process.env` outside `src/config.ts`.
- Spawn processes with argv arrays, never a shell string.
- Keep route handlers thin; put behaviour in `src/services`.

## Adding a feature

### New protected page

1. Add the permission to `RolePermissionSeeder::PERMISSIONS` and to the role
   lists (`admin` gets everything automatically).
2. Create the controller action returning `Inertia::render('Area/Page', [...])`.
3. Register the route inside the `auth:sanctum` + `two-factor` group with
   `->middleware('permission:<name>')`.
4. Add the page under `resources/js/Pages/Area/Page.vue` and the nav entry in
   `AuthenticatedLayout.vue`.
5. Write a feature test hitting the route as each role.

### New API endpoint

- Put it under `routes/api.php` in the `v1` group.
- Use a Form Request, return `ApiResponse::success()` / `ApiResponse::error()`.
- Add `throttle:api` for token routes.
- Document it in `docs/api.md`.

### Changing the build contract

Update all of these together:

1. `panel/app/Services/Build/BuildManifestFactory.php`
2. `panel/app/Services/Build/BuildAgentClient.php`
3. `api/src/schemas/job.ts`
4. `shared/types/contracts.ts`
5. `api/src/openapi.ts`
6. Tests: `api/test/schemas.test.ts`, `api/test/contract.test.ts`,
   `panel/tests/Feature/BuildTest.php`
7. `docs/build-integration.md`

`npm run typecheck` in `api/` plus the contract test fail if the zod schema and
shared types drift.

## Debugging

| Task | Command |
| --- | --- |
| Tail app log | `tail -f panel/storage/logs/laravel-$(date +%F).log` |
| Inspect queued jobs | `php artisan horizon` UI or `redis-cli keys 'bull:*'` |
| See dispatched jobs | set `QUEUE_CONNECTION=sync` in `.env` (runs inline) |
| Fake agent responses | `Http::fake([...])` in a Pest test |
| Inspect agent payload | `LOG_LEVEL=debug npm run dev` in `api/` |
| Rebuild frontend assets | `npm run build` (production) or `npm run dev` (HMR) |
| Clear caches | `php artisan optimize:clear` |
| Route list | `php artisan route:list --except-vendor` |

When a build callback is rejected, reproduce the signature in a test with
`agentSignatureHeaders()` from `tests/Pest.php`; the helper builds the exact
canonical string the middleware expects.

## IDE setup

- PHP: point the interpreter at PHP 8.3, enable Pint on save.
- TypeScript: use the workspace TypeScript (`panel/node_modules/typescript`),
  not a global install.
- Vue: Volar/Vue - Official extension; `tsconfig.json` already includes
  `resources/js/**/*.vue`.
- Recommended: run `npm run typecheck` and `./vendor/bin/pint --test` before
  committing.
