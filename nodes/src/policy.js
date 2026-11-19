'use strict';

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

const CERTBOT_LOCKED = envBool('PANEL_LOCK_CERTBOT', false);
const NGINX_MUTATIONS_ALLOWED = envBool('PANEL_ALLOW_NGINX_MUTATIONS', true);
const COORDINATION_MESSAGE = 'Aksi tidak tersedia.';

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