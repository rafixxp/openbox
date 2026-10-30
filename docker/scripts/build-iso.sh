#!/usr/bin/env bash
#
# Isolated live-build runner used by the Openbox build agent.
#
# Contract with api/src/services/runner.ts:
#   build-iso.sh --manifest <file> --workspace <dir> --output-dir <dir>
#                --source-root <dir> --iso-name <name>
#                --suite <codename> --architecture <arch> --mirror <url>
#                --packages-file <file> [--clean]
#                [--include-panel-installer --panel-installer <file>]
#
# The script never touches the source tree. It rsyncs the live-build project
# into <workspace>/source, rewrites distribution settings there, runs
# `lb build`, and moves the resulting ISO into <output-dir>.
#
# Progress is emitted as `[openbox] stage=<name> progress=<0-100>` so the
# agent can forward it to the panel without parsing human output.

set -Eeuo pipefail

MANIFEST=""
WORKSPACE=""
OUTPUT_DIR=""
SOURCE_ROOT=""
ISO_NAME=""
SUITE=""
ARCHITECTURE=""
MIRROR=""
PACKAGES_FILE=""
PANEL_INSTALLER=""
CLEAN=0
INCLUDE_PANEL=0
HEARTBEAT_PID=""

usage() {
    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

log() {
    printf '[openbox] %s\n' "$*"
}

warn() {
    printf '[openbox] level=warning %s\n' "$*" >&2
}

fail() {
    printf '[openbox] level=error %s\n' "$*" >&2
    exit 1
}

stage() {
    printf '[openbox] stage=%s progress=%s\n' "$1" "$2"
}

cleanup() {
    if [ -n "$HEARTBEAT_PID" ] && kill -0 "$HEARTBEAT_PID" 2>/dev/null; then
        kill "$HEARTBEAT_PID" 2>/dev/null || true
        wait "$HEARTBEAT_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

require_value() {
    [ "$#" -ge 2 ] && [ -n "$2" ] || fail "Missing value for $1"
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --manifest) require_value "$@"; MANIFEST="$2"; shift 2 ;;
        --workspace) require_value "$@"; WORKSPACE="$2"; shift 2 ;;
        --output-dir) require_value "$@"; OUTPUT_DIR="$2"; shift 2 ;;
        --source-root) require_value "$@"; SOURCE_ROOT="$2"; shift 2 ;;
        --iso-name) require_value "$@"; ISO_NAME="$2"; shift 2 ;;
        --suite) require_value "$@"; SUITE="$2"; shift 2 ;;
        --architecture) require_value "$@"; ARCHITECTURE="$2"; shift 2 ;;
        --mirror) require_value "$@"; MIRROR="$2"; shift 2 ;;
        --packages-file) require_value "$@"; PACKAGES_FILE="$2"; shift 2 ;;
        --panel-installer) require_value "$@"; PANEL_INSTALLER="$2"; shift 2 ;;
        --clean) CLEAN=1; shift ;;
        --include-panel-installer) INCLUDE_PANEL=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown argument: $1" ;;
    esac
done

[ -n "$MANIFEST" ] || fail "--manifest is required"
[ -n "$WORKSPACE" ] || fail "--workspace is required"
[ -n "$OUTPUT_DIR" ] || fail "--output-dir is required"
[ -n "$SOURCE_ROOT" ] || fail "--source-root is required"
[ -n "$ISO_NAME" ] || fail "--iso-name is required"
[ -n "$SUITE" ] || fail "--suite is required"
[ -n "$ARCHITECTURE" ] || fail "--architecture is required"
[ -n "$MIRROR" ] || fail "--mirror is required"
[ -n "$PACKAGES_FILE" ] || fail "--packages-file is required"

[ -f "$MANIFEST" ] || fail "Manifest not found: $MANIFEST"
[ -d "$SOURCE_ROOT" ] || fail "Source root not found: $SOURCE_ROOT"
[ -f "$PACKAGES_FILE" ] || fail "Package list not found: $PACKAGES_FILE"

[[ "$ISO_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*\.iso$ ]] || fail "Unsafe ISO name: $ISO_NAME"
[[ "$SUITE" =~ ^[a-z][a-z0-9-]*$ ]] || fail "Invalid Debian suite: $SUITE"
[[ "$ARCHITECTURE" =~ ^(amd64|arm64|i386)$ ]] || fail "Unsupported architecture: $ARCHITECTURE"
[[ "$MIRROR" =~ ^https?:// ]] || fail "Mirror must be an http(s) URL"

for tool in rsync lb sha256sum python3; do
    command -v "$tool" >/dev/null 2>&1 || fail "Required tool missing: $tool"
done

mkdir -p "$WORKSPACE" "$OUTPUT_DIR"
WORKSPACE="$(cd "$WORKSPACE" && pwd)"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"
SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd)"
TARGET="$WORKSPACE/source"

stage preparing 2
log "Isolating live-build project from $SOURCE_ROOT"

# Rebuild the workspace copy from scratch so a previous failed run cannot leak
# chroot/ or binary/ artifacts into this build.
rm -rf "$TARGET"
mkdir -p "$TARGET"

# Anchored excludes keep config/binary, config/chroot and config/source intact
# while dropping build outputs and control-plane sources from the copy.
rsync -a \
    --exclude '/.git' \
    --exclude '/.build' \
    --exclude '/binary' \
    --exclude '/chroot' \
    --exclude '/cache' \
    --exclude '/local' \
    --exclude '/panel' \
    --exclude '/api' \
    --exclude '/docker' \
    --exclude '/docs' \
    --exclude '/shared' \
    --exclude '/node_modules' \
    --exclude '/*.iso' \
    --exclude '/*.files' \
    --exclude '/*.packages' \
    --exclude '/*.contents' \
    --exclude '/chroot.files' \
    --exclude '/chroot.packages.*' \
    --exclude '/binary.modified_timestamps' \
    "$SOURCE_ROOT"/ "$TARGET"/

[ -d "$TARGET/config" ] || fail "Copied source has no config/ directory"
[ -f "$TARGET/config/bootstrap" ] || fail "Copied source has no config/bootstrap"

stage configuring 8
log "Applying suite=$SUITE architecture=$ARCHITECTURE mirror=$MIRROR"

# Only the isolated copy is rewritten. The original repository is never passed
# to lb config or lb build.
sed -i \
    -e "s|^LB_ARCHITECTURE=.*|LB_ARCHITECTURE=\"$ARCHITECTURE\"|" \
    -e "s|^LB_DISTRIBUTION=.*|LB_DISTRIBUTION=\"$SUITE\"|" \
    -e "s|^LB_DISTRIBUTION_CHROOT=.*|LB_DISTRIBUTION_CHROOT=\"$SUITE\"|" \
    -e "s|^LB_DISTRIBUTION_BINARY=.*|LB_DISTRIBUTION_BINARY=\"$SUITE\"|" \
    -e "s|^LB_PARENT_DISTRIBUTION=.*|LB_PARENT_DISTRIBUTION=\"$SUITE\"|" \
    -e "s|^LB_PARENT_DISTRIBUTION_CHROOT=.*|LB_PARENT_DISTRIBUTION_CHROOT=\"$SUITE\"|" \
    -e "s|^LB_PARENT_DISTRIBUTION_BINARY=.*|LB_PARENT_DISTRIBUTION_BINARY=\"$SUITE\"|" \
    -e "s|^LB_MIRROR_BOOTSTRAP=.*|LB_MIRROR_BOOTSTRAP=\"$MIRROR\"|" \
    -e "s|^LB_MIRROR_CHROOT=.*|LB_MIRROR_CHROOT=\"$MIRROR\"|" \
    -e "s|^LB_MIRROR_BINARY=.*|LB_MIRROR_BINARY=\"$MIRROR\"|" \
    -e "s|^LB_PARENT_MIRROR_BOOTSTRAP=.*|LB_PARENT_MIRROR_BOOTSTRAP=\"$MIRROR\"|" \
    -e "s|^LB_PARENT_MIRROR_CHROOT=.*|LB_PARENT_MIRROR_CHROOT=\"$MIRROR\"|" \
    -e "s|^LB_PARENT_MIRROR_BINARY=.*|LB_PARENT_MIRROR_BINARY=\"$MIRROR\"|" \
    "$TARGET/config/bootstrap"

if [ -f "$TARGET/config/chroot" ]; then
    sed -i \
        -e "s|^LB_LINUX_FLAVOURS_WITH_ARCH=.*|LB_LINUX_FLAVOURS_WITH_ARCH=\"$ARCHITECTURE\"|" \
        "$TARGET/config/chroot"
fi

# Package names come from the panel manifest. They are validated as identifiers
# and written as a live-build package list; no version strings or shell input
# are ever interpolated into a command.
PACKAGE_LIST="$TARGET/config/package-lists/50-openbox-panel.list.chroot"
: > "$PACKAGE_LIST"
while IFS= read -r package || [ -n "$package" ]; do
    package="${package%%#*}"
    package="$(printf '%s' "$package" | tr -d '[:space:]')"
    [ -n "$package" ] || continue
    [[ "$package" =~ ^[a-z0-9][a-z0-9+.-]*$ ]] || fail "Invalid package name in manifest: $package"
    printf '%s\n' "$package" >> "$PACKAGE_LIST"
done < "$PACKAGES_FILE"

if [ -s "$PACKAGE_LIST" ]; then
    sort -u "$PACKAGE_LIST" -o "$PACKAGE_LIST"
    log "Package list contains $(wc -l < "$PACKAGE_LIST") entries"
else
    rm -f "$PACKAGE_LIST"
fi

if [ "$INCLUDE_PANEL" -eq 1 ]; then
    stage staging-panel-installer 12
    [ -n "$PANEL_INSTALLER" ] || fail "--include-panel-installer requires --panel-installer"
    [ -f "$PANEL_INSTALLER" ] || fail "Panel installer not found: $PANEL_INSTALLER"

    EXPECTED_SHA="$(python3 - "$MANIFEST" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    manifest = json.load(handle)

installer = manifest.get("panelInstaller") or {}
print(installer.get("sha256", ""))
PY
)"

    ACTUAL_SHA="$(sha256sum "$PANEL_INSTALLER" | awk '{print $1}')"
    [ -n "$EXPECTED_SHA" ] || fail "Manifest has no panelInstaller.sha256"
    [ "$EXPECTED_SHA" = "$ACTUAL_SHA" ] || fail "Panel installer checksum mismatch (expected $EXPECTED_SHA, got $ACTUAL_SHA)"

    install -d -m 0755 "$TARGET/config/includes.chroot/opt/openbox"
    install -m 0755 "$PANEL_INSTALLER" "$TARGET/config/includes.chroot/opt/openbox/install_panel_en.sh"
    install -d -m 0755 "$TARGET/config/hooks/live"

    cat > "$TARGET/config/hooks/live/20-panel-installer.chroot" <<'HOOK'
#!/bin/sh
# Staged by the Openbox build agent. Only executes when the build explicitly
# opted in (OPENBOX_INSTALL_PANEL=1). Never runs on the panel host.
set -eu

if [ "${OPENBOX_INSTALL_PANEL:-0}" != "1" ]; then
    echo "[openbox] panel installer staged but not enabled; skipping"
    exit 0
fi

INSTALLER=/opt/openbox/install_panel_en.sh
EXPECTED="__OPENBOX_INSTALLER_SHA256__"

if [ ! -f "$INSTALLER" ]; then
    echo "[openbox] missing $INSTALLER" >&2
    exit 1
fi

ACTUAL="$(sha256sum "$INSTALLER" | awk '{print $1}')"
if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "[openbox] panel installer checksum mismatch inside chroot" >&2
    exit 1
fi

echo "[openbox] running opt-in aaPanel installer inside chroot"
cd /root
bash "$INSTALLER"
HOOK

    sed -i "s|__OPENBOX_INSTALLER_SHA256__|$EXPECTED_SHA|g" \
        "$TARGET/config/hooks/live/20-panel-installer.chroot"
    chmod 0755 "$TARGET/config/hooks/live/20-panel-installer.chroot"

    export OPENBOX_INSTALL_PANEL=1
    log "Panel installer staged as config/hooks/live/20-panel-installer.chroot"
else
    export OPENBOX_INSTALL_PANEL=0
fi

cd "$TARGET"

if [ "$CLEAN" -eq 1 ]; then
    stage cleaning 10
    lb clean --purge || fail "lb clean failed"
fi

stage live-build 15
log "Starting live-build (this can take 20-60 minutes)"

BUILD_STARTED="$(date +%s)"
(
    while sleep 30; do
        elapsed=$(( $(date +%s) - BUILD_STARTED ))
        progress=$(( 15 + elapsed / 45 ))
        [ "$progress" -gt 85 ] && progress=85
        stage live-build "$progress"
    done
) &
HEARTBEAT_PID=$!

set +e
lb build 2>&1 | tee "$WORKSPACE/lb-build.log"
BUILD_STATUS="${PIPESTATUS[0]}"
set -e

cleanup
HEARTBEAT_PID=""

if [ "$BUILD_STATUS" -ne 0 ]; then
    fail "live-build failed with status $BUILD_STATUS (log: $WORKSPACE/lb-build.log)"
fi

stage packaging 90

ISO_SOURCE="$(find "$TARGET" -maxdepth 1 -type f -name '*.hybrid.iso' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"
if [ -z "$ISO_SOURCE" ]; then
    ISO_SOURCE="$(find "$TARGET" -maxdepth 1 -type f -name '*.iso' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"
fi
[ -n "$ISO_SOURCE" ] && [ -f "$ISO_SOURCE" ] || fail "live-build finished but no ISO was produced"

ISO_TARGET="$OUTPUT_DIR/$ISO_NAME"
mv -f "$ISO_SOURCE" "$ISO_TARGET"
chmod 0644 "$ISO_TARGET"

ISO_SHA="$(sha256sum "$ISO_TARGET" | awk '{print $1}')"
printf '%s  %s\n' "$ISO_SHA" "$ISO_NAME" > "$ISO_TARGET.sha256"
ISO_SIZE="$(stat -c '%s' "$ISO_TARGET")"

stage completed 100
log "ISO ready: $ISO_TARGET ($ISO_SIZE bytes, sha256 $ISO_SHA)"
