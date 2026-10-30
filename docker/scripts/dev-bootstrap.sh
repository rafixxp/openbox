#!/usr/bin/env bash
#
# First-run bootstrap for the development stack.
#
# Creates .env files from the examples, generates an APP_KEY and a shared agent
# secret, then starts the unprivileged services plus the privileged build
# worker. Safe to re-run: existing secrets are only replaced when the example
# placeholder is still present.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

for tool in docker openssl sed; do
    command -v "$tool" >/dev/null 2>&1 || {
        echo "Missing required tool: $tool" >&2
        exit 1
    }
done

if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 is required (docker compose)." >&2
    exit 1
fi

[ -f panel/.env ] || cp panel/.env.example panel/.env
[ -f api/.env ] || cp api/.env.example api/.env

if ! grep -q '^APP_KEY=base64:' panel/.env; then
    key="$(openssl rand -base64 32)"
    sed -i "s|^APP_KEY=.*|APP_KEY=base64:${key}|" panel/.env
    echo "Generated APP_KEY in panel/.env"
fi

if grep -q '^BUILD_AGENT_SECRET=dev-agent-secret-change-me' panel/.env; then
    secret="$(openssl rand -hex 32)"
    sed -i "s|^BUILD_AGENT_SECRET=.*|BUILD_AGENT_SECRET=${secret}|" panel/.env
    sed -i "s|^BUILD_AGENT_SECRET=.*|BUILD_AGENT_SECRET=${secret}|" api/.env
    echo "Generated shared BUILD_AGENT_SECRET in panel/.env and api/.env"
fi

COMPOSE=(
    docker compose
    -f docker/compose.dev.yml
    -f docker/build/privileged.override.yml
    --profile build
)

"${COMPOSE[@]}" up -d --build

echo
echo "Panel:      http://localhost:8080"
echo "MinIO:      http://localhost:9001  (openbox / openbox-minio-password)"
echo "Agent:      http://localhost:8090/health"
echo "Reverb WS:  ws://localhost:8081"
echo
echo "Admin credentials come from panel/.env:"
grep -E '^PANEL_ADMIN_(EMAIL|PASSWORD)=' panel/.env || true
echo
echo "Follow the first migration with:"
echo "  docker compose -f docker/compose.dev.yml logs -f migrate"
