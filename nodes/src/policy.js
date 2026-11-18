'use strict';

/**
 * Kebijakan operasional "Pengelolaan Services (Khusus)".
 *
 * Layanan inti host (Nginx & SSL Certbot) dikelola secara eksklusif oleh
 * dosen/pembicara. Panel (NodePanel) tidak boleh melakukan start/stop/restart/
 * reload/disable pada layanan tersebut, tidak boleh menerbitkan/memperpanjang
 * sertifikat (certbot), dan tidak boleh memutasi vhost nginx (create/edit/
 * toggle/delete) — semua status hanya read-only.
 *
 * Konfigurasi dapat disesuaikan lewat environment variable saat build/pengemasan:
 *   PANEL_PROTECTED_SERVICES       daftar layanan terlindung (default: nginx,certbot)
 *   PANEL_LOCK_CERTBOT             "0" untuk membuka renew/issue certbot (default: terkunci)
 *   PANEL_ALLOW_NGINX_MUTATIONS    "1" untuk membuka mutasi vhost nginx (default: terkunci)
 */

function envList(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

// Layanan yang dilindungi sesuai dokumen kebijakan: Nginx & Certbot.
const PROTECTED_SERVICES = envList('PANEL_PROTECTED_SERVICES', ['nginx', 'certbot']);

// Certbot (issue/renew) dikelola eksklusif dosen/pembicara.
const CERTBOT_LOCKED = envBool('PANEL_LOCK_CERTBOT', true);

// Mutasi vhost nginx (create/edit/toggle/delete + reload nginx) terkunci.
const NGINX_MUTATIONS_ALLOWED = envBool('PANEL_ALLOW_NGINX_MUTATIONS', false);

const COORDINATION_MESSAGE = '';

function baseName(name) {
  return String(name || '').replace(/\.service$/, '').toLowerCase();
}

function isProtectedService(name) {
  return PROTECTED_SERVICES.includes(baseName(name));
}

module.exports = {
  PROTECTED_SERVICES,
  CERTBOT_LOCKED,
  NGINX_MUTATIONS_ALLOWED,
  COORDINATION_MESSAGE,
  isProtectedService,
  protectedServiceList: () => [...PROTECTED_SERVICES],
  policySummary: () => ({
    protectedServices: [...PROTECTED_SERVICES],
    certbotLocked: CERTBOT_LOCKED,
    nginxMutationsAllowed: NGINX_MUTATIONS_ALLOWED,
    note: COORDINATION_MESSAGE,
  }),
};