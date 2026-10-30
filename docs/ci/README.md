# CI Templates

The project must only add files under `panel/`, `api/`, `shared/`, `docker/`,
and `docs/`, so the GitHub Actions workflows live here as copyable templates
instead of in `.github/workflows/`.

To enable them:

```bash
mkdir -p .github/workflows
cp docs/ci/laravel.yml  .github/workflows/laravel.yml
cp docs/ci/frontend.yml .github/workflows/frontend.yml
cp docs/ci/agent.yml    .github/workflows/agent.yml
```

Then commit the copied files. Adjust branches, PHP/Node versions, and service
credentials to match your environment.

## What each workflow does

| Workflow | Path | Jobs |
| --- | --- | --- |
| `laravel.yml` | `panel/` | Composer install, Pint, Pest against PostgreSQL 16 + Redis 7 |
| `frontend.yml` | `panel/` | `npm install`, `vue-tsc`, Vitest, production Vite build |
| `agent.yml` | `api/` | `npm install`, `tsc --noEmit`, Vitest, `tsc` build |

## Conventions

- **Lockfiles**: `panel/` and `api/` do not currently commit
  `package-lock.json`. The templates run `npm install` when no lockfile exists
  and `npm ci` otherwise. Commit the lockfiles and switch to `npm ci` for
  reproducible builds.
- **PHP dependencies**: the Laravel template also uses
  `composer install` without a `composer.lock`. Commit the lockfile to pin
  versions.
- **Database**: `panel/phpunit.xml` defaults to in-memory SQLite. The Laravel
  workflow exports `DB_CONNECTION=pgsql` and `DB_DATABASE=openbox_panel_test`
  so PostgreSQL-only objects (audit triggers) are exercised. PHPUnit `<env>`
  entries do not override variables already present in the environment.
- **Secrets**: no workflow needs `BUILD_AGENT_SECRET` from repository secrets;
  tests use fixed local values. Real deployments should inject secrets through
  the platform, never commit them.
- **Docker**: the templates do not build images. Add a separate workflow if you
  publish `openbox/panel`, `openbox/build-agent`, or `openbox/build-worker`.
  Building the worker image pulls `live-build` and is slow; run it only on
  release tags.

## Adding a Docker build workflow

Sketch (not included by default):

```yaml
name: images
on:
  push:
    tags: ["v*"]
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: panel
          file: docker/php/Dockerfile
          build-contexts: |
            dockerassets=docker
          push: true
          tags: ghcr.io/${{ github.repository }}/panel:${{ github.ref_name }}
```

The panel Dockerfile expects the `dockerassets` build context
(`docker/php/php.ini`), which is why `build-contexts` is required.
