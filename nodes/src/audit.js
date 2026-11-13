/**
 * Audit log untuk aksi file manager.
 *
 * Middleware ini sengaja dipisah dari routes/files.js supaya kode file manager
 * yang sudah ada tidak perlu diubah. Cukup pasang sebelum router /api/files.
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const express = require('express');

const LOG_DIR = process.env.PANEL_LOG_DIR || path.join(__dirname, '..', 'storage', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'actions.log');
const MAX_BYTES = Number(process.env.PANEL_LOG_MAX_BYTES || 5 * 1024 * 1024);

let writeQueue = Promise.resolve();

function ensureDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* biarkan gagal saat append; jangan sampai mengganggu request */
  }
}

function targetOf(req, res) {
  if (res && res.locals && typeof res.locals.auditTarget === 'string') {
    return res.locals.auditTarget.slice(0, 512);
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const value =
    body.path ||
    body.from ||
    body.to ||
    (req.query && (req.query.path || req.query.root)) ||
    '';
  return typeof value === 'string' ? value.slice(0, 512) : '';
}

async function rotateIfNeeded() {
  try {
    const st = await fsp.stat(LOG_FILE);
    if (st.size < MAX_BYTES) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fsp.rename(LOG_FILE, `${LOG_FILE}.${stamp}`);
  } catch {
    /* file belum ada / tidak bisa dirotasi */
  }
}

async function appendEntry(entry) {
  ensureDir();
  await rotateIfNeeded();
  await fsp.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

function write(entry) {
  writeQueue = writeQueue.then(() => appendEntry(entry)).catch(() => {});
  return writeQueue;
}

/** Middleware: catat method, URL, user, status, durasi, dan target path. */
function files(req, res, next) {
  logWithPrefix('files', req, res, next);
}

/** Middleware audit untuk route cloud (google/onedrive). */
function cloud(req, res, next) {
  logWithPrefix('cloud', req, res, next);
}

function logWithPrefix(prefix, req, res, next) {
  const started = Date.now();
  // Hitung action sekarang: req.path masih relatif terhadap mount router.
  // Kalau dihitung di callback `finish`, Express sudah memulihkan path penuh.
  const segments = String(req.path || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z0-9_-]/gi, '').toLowerCase())
    .filter(Boolean);
  const action = segments.length ? `${prefix}.${segments.join('.')}` : `${prefix}.unknown`;
  res.on('finish', () => {
    write({
      ts: new Date().toISOString(),
      user: req.user || null,
      ip: req.ip || null,
      action,
      method: req.method,
      path: req.originalUrl || req.url,
      target: targetOf(req, res),
      status: res.statusCode,
      ok: res.statusCode < 400,
      durationMs: Date.now() - started,
    });
  });
  next();
}

function parseLines(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* lewati baris rusak */
    }
  }
  return out;
}

async function readRecent({ limit = 100, user, action, ok } = {}) {
  let raw = '';
  try {
    raw = await fsp.readFile(LOG_FILE, 'utf8');
  } catch {
    return [];
  }
  let entries = parseLines(raw);
  if (user) entries = entries.filter((e) => e.user === user);
  if (action) entries = entries.filter((e) => String(e.action || '').includes(action));
  if (typeof ok === 'boolean') entries = entries.filter((e) => e.ok === ok);
  return entries.slice(-limit).reverse();
}

const router = express.Router();

router.get('/', async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const action = req.query.action ? String(req.query.action) : '';
  const user = req.query.user ? String(req.query.user) : '';
  const ok = req.query.ok === '1' ? true : req.query.ok === '0' ? false : undefined;
  const entries = await readRecent({ limit, action, user, ok });
  res.json({
    entries,
    count: entries.length,
    logFile: LOG_FILE,
    maxBytes: MAX_BYTES,
  });
});

module.exports = {
  files,
  cloud,
  routes: router,
  write,
  readRecent,
  LOG_FILE,
};
