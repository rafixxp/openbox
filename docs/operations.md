# Operations

Deployment, scheduled work, backups, mirrors, monitoring, and routine
maintenance for the Openbox panel.

## Runtime topology

| Component | Image / service | Scales with | Needs privileges |
| --- | --- | --- | --- |
| nginx | `nginx:1.27-alpine` | requests | no |
| PHP-FPM panel | `openbox/panel` | concurrent requests | no |
| Horizon (queues) | same image, `php artisan horizon` | queued jobs | no |
| Scheduler | same image, `php artisan schedule:work` | one instance only | no |
| Reverb | same image, `php artisan reverb:start` | WebSocket connections | no |
| PostgreSQL | `postgres:16-alpine` | data size | no |
| Redis | `redis:7-alpine` | queues/cache | no |
| MinIO / S3 | external or `minio/minio` | artifacts | no |
| Agent HTTP | `openbox/build-agent` | job submissions | no |
| Build worker | `openbox/build-worker` | concurrent builds (`BUILD_CONCURRENCY`) | **yes** |

Run exactly **one** scheduler process. Horizon can run multiple supervisors,
but `supervisor-builds` should usually stay at one process per build host.

## First deployment

### 1. Prepare configuration

```bash
cp panel/.env.example panel/.env
cp api/.env.example api/.env
```

Generate secrets:

```bash
openssl rand -base64 32   # APP_KEY  (prefix with base64:)
openssl rand -hex 32      # BUILD_AGENT_SECRET (same value in both files)
```

Set at minimum:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://panel.example.com
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=panel.example.com

BUILD_AGENT_SECRET=<32-byte hex>
BUILD_AGENT_CALLBACK_URL=https://panel.example.com   # no /api suffix
BUILD_AGENT_URL=http://build-agent:8090

DB_PASSWORD=<strong>
AWS_ACCESS_KEY_ID=<strong>
AWS_SECRET_ACCESS_KEY=<strong>
AWS_ENDPOINT=https://s3.example.com
AWS_PUBLIC_ENDPOINT=              # only if the endpoint above is internal
```

For the agent (`api/.env`), `BUILD_AGENT_SECRET` must be **identical**,
`WORKER_ENABLED=false` on the HTTP process, and `WORKER_ENABLED=true` only on
the worker entrypoint.

### 2. Build and migrate

```bash
docker compose -f docker/compose.dev.yml build
docker compose -f docker/compose.dev.yml run --rm migrate
```

The `migrate` service runs `php artisan migrate --force` followed by
`php artisan db:seed --force`. Seeding is idempotent (`updateOrCreate`) and
creates roles, permissions, settings, and the bootstrap admin from
`PANEL_ADMIN_EMAIL` / `PANEL_ADMIN_PASSWORD`.

For a non-Docker deployment:

```bash
cd panel
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
npm ci && npm run build
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Do **not** cache config while `APP_KEY` or secrets are still placeholders.

### 3. Start services

```bash
docker compose -f docker/compose.dev.yml up -d nginx panel horizon scheduler reverb build-agent
```

Add the privileged worker only on a dedicated build host:

```bash
docker compose -f docker/compose.dev.yml \
               -f docker/build/privileged.override.yml \
               --profile build up -d build-worker
```

The worker image does not bake in `build-iso.sh`; Compose mounts
`docker/scripts/build-iso.sh` read-only at
`/opt/openbox/docker/scripts/build-iso.sh`. For standalone deployments, mount
the same file at that path (or rebuild the image with the repository as a
build context) and keep `/workspace/source` read-only.

### 4. Verify

```bash
curl -fsS https://panel.example.com/api/v1/health
curl -fsS http://build-agent:8090/health
```

Then log in, enable TOTP on the admin account, and change the seeded password.

## Scheduled work

Defined in `panel/routes/console.php`:

| Schedule | Command / job | Purpose |
| --- | --- | --- |
| every 5 min | `horizon:snapshot` | Horizon metrics |
| hourly | `CheckMirrorHealth` per mirror | update status/latency |
| daily | `sanctum:prune-expired --hours=24` | remove expired tokens |
| weekly | `queue:prune-failed --hours=336` | trim failed jobs |

`schedule:work` must run continuously. With systemd:

```ini
[Unit]
Description=Openbox panel scheduler
After=network.target

[Service]
WorkingDirectory=/var/www/openbox/panel
ExecStart=/usr/bin/php artisan schedule:work
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

## Queue operations

| Queue | Jobs | Consumer |
| --- | --- | --- |
| `builds` | `StartIsoBuild`, `CancelIsoBuild` | Horizon `supervisor-builds` (Laravel side) |
| `default` | mirror sync, health checks, notifications, backups | Horizon `supervisor-1` |

Useful commands:

```bash
php artisan horizon:status
php artisan horizon:terminate          # graceful restart after deploy
php artisan queue:failed
php artisan queue:retry <id>
php artisan queue:flush
```

Builds are `tries = 1`: a failed dispatch is not retried automatically. Use the
UI retry action, which creates a linked build (`retry_of_id`).

If the agent queue is stuck, inspect Redis/BullMQ:

```bash
redis-cli -n 0 keys 'bull:*'
docker compose logs -f build-worker
```

## Migrations

```bash
# preview
php artisan migrate --pretend

# apply
php artisan migrate --force

# rollback the last batch (dangerous with audit triggers)
php artisan migrate:rollback --step=1
```

Guidelines:

- Take a backup before migrating (`Settings → Backups`, or `pg_dump`).
- Audit-log and build-log triggers are created in migrations; never drop them
  manually.
- New `audit_logs` columns must remain append-only. Adding a nullable column is
  safe; rewriting rows is not.
- After schema changes run `php artisan horizon:terminate` so workers reload.

## Backups

### From the panel

Admins (`settings.manage`) can queue `CreateBackup` from the settings page. It
runs `pg_dump --format=custom --no-owner --no-acl` into
`storage/app/private/backups/openbox-<timestamp>.dump`, records size and
sha256, and audits `backup.created`.

Restore requires typing the exact filename in `confirm`; `RestoreBackup` then
runs `pg_restore` and audits `backup.restore_requested`.

### Automated off-host backup

```bash
#!/usr/bin/env bash
set -euo pipefail
ts=$(date +%Y%m%d-%H%M%S)
pg_dump --format=custom --no-owner --no-acl \
  --file="/var/backups/openbox-${ts}.dump" \
  "postgresql://openbox:${DB_PASSWORD}@127.0.0.1:5432/openbox_panel"
rclone copy "/var/backups/openbox-${ts}.dump" remote:openbox-backups/
find /var/backups -name 'openbox-*.dump' -mtime +14 -delete
```

Store backups encrypted and off the panel host. Artifacts in MinIO need a
bucket lifecycle/retention policy independent of database backups.

Restore drill:

```bash
pg_restore --list backup.dump | head
createdb openbox_restore_test
pg_restore --no-owner --no-acl -d openbox_restore_test backup.dump
```

## Mirror sync

Mirrors are `mirrors` rows with `base_url`, optional `sync_target`, region, and
status. Synchronisation is performed by `RcloneMirrorSyncer`:

```dotenv
MIRROR_SYNCER=rclone
RCLONE_BINARY=rclone
MIRROR_SOURCE=/srv/openbox-artifacts
MIRROR_SYNC_TIMEOUT=3600
```

`POST /mirrors/{mirror}/sync` dispatches `SyncMirrorJob`, which runs:

```bash
rclone sync <MIRROR_SOURCE>[/<channel>/<version>] <sync_target> --stats-one-line --stats=10s
```

Requirements:

- `sync_target` is a configured rclone remote (`mirror-eu:/srv/openbox`).
- `rclone config` must exist for the user running Horizon.
- `MIRROR_SOURCE` must be readable by Horizon (local artifacts dir or mounted
  bucket).

Health checks (`POST /mirrors/{mirror}/check`, hourly) update `status`,
`latency_ms`, and `last_checked_at`. Failed syncs are recorded in
`mirror_syncs` with an error message and audited.

## Monitoring

| Signal | Endpoint / source |
| --- | --- |
| Panel liveness | `GET /up` (Laravel), nginx `GET /healthz` |
| Dependencies | `GET /api/v1/health` (DB + Redis) |
| Agent liveness | `GET http://build-agent:8090/health` |
| Queue health | `/horizon` (admin, `settings.manage`) |
| Build progress | Dashboard, `/builds`, Reverb `private-builds.{uuid}` |
| Audit anomalies | chain verification query in [security.md](security.md#audit-trail) |
| Application logs | `storage/logs/laravel-*.log`, container stderr |
| Worker logs | JSON lines (`level`, `service`, `message`, `buildUuid`) |
| Disk | `storage/`, `BUILD_WORK_DIR`, MinIO bucket size |

Suggested alerts:

- `/api/v1/health` non-200 for 2 minutes
- Horizon `wait` time on `default` or `builds` > 5 minutes
- failed jobs > 0 in the last hour
- build `running` longer than `BUILD_TIMEOUT + 10 min`
- MinIO bucket free space < 20%
- audit chain verification returns rows

Reverb issues usually appear as logs not streaming while polling still works;
check `ws://<host>:8081` reachability and `VITE_REVERB_*` at build time.

## Log rotation

Laravel uses the `daily` channel with `LOG_STACK=daily,stderr`. Containers send
stderr to the Docker log driver. Configure rotation:

```yaml
logging:
  driver: json-file
  options:
    max-size: "50m"
    max-file: "5"
```

Keep build logs in PostgreSQL (`build_logs`) as the durable record; container
logs are for operations only.

## Scaling

| Bottleneck | Action |
| --- | --- |
| Web requests | add panel replicas behind nginx |
| Queue throughput | increase Horizon `maxProcesses` (never > CPU) |
| Build throughput | raise `BUILD_CONCURRENCY` and run more build workers on separate hosts |
| WebSocket fan-out | scale Reverb horizontally with a shared Redis backend |
| Artifact storage | use real S3 instead of MinIO; enable lifecycle rules |

Keep one scheduler. Build workers must not share a workspace directory across
hosts; each worker owns its `BUILD_WORK_DIR`.

## Upgrade procedure

1. Announce a maintenance window if the migration is destructive.
2. Take a database backup and snapshot MinIO.
3. Deploy new code; run `composer install --no-dev` and `npm ci && npm run build`.
4. `php artisan migrate --force`.
5. `php artisan config:cache && php artisan route:cache && php artisan view:cache`.
6. `php artisan horizon:terminate` and restart `scheduler`, `reverb`, and the
   agent/worker.
7. Verify `/api/v1/health`, `/horizon`, and one small build.
8. Re-run the audit-chain check.

Rollback: redeploy the previous image, restore the database backup if the
migration was not backwards compatible, and restart all queue consumers.

## Routine checklist

- [ ] Daily: check `/api/v1/health`, failed jobs, and build queue depth
- [ ] Weekly: verify audit chain, review new admin users, rotate logs
- [ ] Monthly: test a restore on a scratch database, prune old artifacts
- [ ] Quarterly: rotate `BUILD_AGENT_SECRET` and database credentials
- [ ] After every incident: confirm `audit_logs` has the expected entries

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `502` from nginx | PHP-FPM down / wrong `fastcgi_pass` | `docker compose ps`, check `panel` logs |
| `419` on forms | stale CSRF/session, wrong `APP_URL`/domain | reload, check `SANCTUM_STATEFUL_DOMAINS`, session driver |
| Login loops back | 2FA pending state not completed | finish `/two-factor-challenge`, clear cookies |
| Builds never leave `queued` | Horizon not running | start Horizon, check `builds` queue |
| Builds stuck in `dispatching` | agent unreachable or secret mismatch | `curl agent/health`, compare secrets |
| No realtime logs | Reverb/WebSocket blocked | confirm polling fallback; check port 8081 and `VITE_REVERB_*` |
| `pg_dump: command not found` | client tools missing in container | rebuild image (`postgresql-client` is installed in `docker/php/Dockerfile`) |
| Mirror sync fails | rclone remote missing or `MIRROR_SOURCE` unset | `rclone lsd <target>`, set `MIRROR_SOURCE` |
| Upload > 512 MB fails | nginx/php limits | raise `client_max_body_size` and `upload_max_filesize` |
