# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Build worker image: Node agent + Debian live-build toolchain.
#
# This image runs with `privileged: true` (see privileged.override.yml) because
# live-build creates chroots, mounts /proc, and writes loopback filesystems.
# Never run it on the panel web host without that isolation boundary.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS agent-build

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        cpio \
        curl \
        debootstrap \
        dosfstools \
        file \
        gnupg \
        isolinux \
        jq \
        live-build \
        mtools \
        parted \
        python3 \
        rsync \
        squashfs-tools \
        syslinux-common \
        syslinux-utils \
        tini \
        wget \
        xorriso \
        xz-utils \
        zstd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=agent-build /app/package.json ./package.json
COPY --from=agent-build /app/node_modules ./node_modules
COPY --from=agent-build /app/dist ./dist

RUN mkdir -p /var/lib/openbox-build /workspace/source /opt/openbox/docker/scripts

# The worker must run as root to create chroots; compose isolates it with
# privileged mode and a read-only source mount.
USER root

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/worker-entry.js"]
