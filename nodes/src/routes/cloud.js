/**
 * Integrasi cloud storage: Google Drive & OneDrive.
 *
 * Fitur:
 *  - OAuth 2.0 connect/callback (tanpa mengubah auth.js)
 *  - daftar file/folder
 *  - impor file cloud -> filesystem panel (maks 100MB)
 *  - ekspor file panel -> cloud (maks 100MB)
 *
 * Konfigurasi lewat environment variable:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI (opsional)
 *   ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_REDIRECT_URI (opsional)
 *   PANEL_PUBLIC_URL (opsional, untuk membentuk redirect URI)
 *   PANEL_CLOUD_TOKENS (opsional, lokasi file token)
 *
 * Catatan keamanan: token disimpan di file ber-mode 600 di storage panel.
 * Callback OAuth sengaja tidak memakai cookie sesi karena cookie panel
 * SameSite=Strict tidak ikut terkirim pada redirect lintas situs dari provider.
 * Identitas user diambil dari parameter `state` yang acak, sekali pakai, dan
 * berumur pendek.
 */
const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { isAdminUser } = require('../auth');

const router = express.Router();

const MAX_TRANSFER = 100 * 1024 * 1024;
const STATE_TTL = 10 * 60 * 1000;
const TOKEN_FILE =
  process.env.PANEL_CLOUD_TOKENS ||
  path.join(__dirname, '..', '..', 'storage', 'cloud-tokens.json');

const pendingStates = new Map();
let tokenCache = null;

/* ------------------------------------------------------------------ */
/* helper                                                              */
/* ------------------------------------------------------------------ */

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function wrap(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (res.headersSent) return next(err);
      res.status(err.status || 500).json({
        error: err.message || 'Terjadi kesalahan',
        ...(err.code ? { code: err.code } : {}),
      });
    });
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Belum login' });
  next();
}

function publicBaseUrl(req) {
  if (process.env.PANEL_PUBLIC_URL) {
    return process.env.PANEL_PUBLIC_URL.replace(/\/+$/, '');
  }
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

async function readJsonResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* bukan JSON */
  }
  if (!res.ok) {
    const detail =
      (data && (data.error_description || data.error?.message || data.error)) ||
      text.slice(0, 300) ||
      `HTTP ${res.status}`;
    throw httpError(res.status, String(detail));
  }
  return data;
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return readJsonResponse(res);
}

async function readBodyBuffer(res, maxBytes) {
  const len = Number(res.headers.get('content-length') || 0);
  if (len && len > maxBytes) {
    throw httpError(413, `File melebihi batas ${Math.round(maxBytes / 1024 / 1024)}MB`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) {
    throw httpError(413, `File melebihi batas ${Math.round(maxBytes / 1024 / 1024)}MB`);
  }
  return buf;
}

function cleanStates() {
  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (now > value.exp) pendingStates.delete(key);
  }
}
setInterval(cleanStates, 60 * 1000).unref();

/* ------------------------------------------------------------------ */
/* penyimpanan token                                                   */
/* ------------------------------------------------------------------ */

async function loadTokens() {
  if (tokenCache) return tokenCache;
  try {
    tokenCache = JSON.parse(await fsp.readFile(TOKEN_FILE, 'utf8'));
    if (!tokenCache || typeof tokenCache !== 'object') tokenCache = {};
  } catch {
    tokenCache = {};
  }
  return tokenCache;
}

async function saveTokens() {
  const dir = path.dirname(TOKEN_FILE);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = TOKEN_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(tokenCache || {}, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fsp.rename(tmp, TOKEN_FILE);
  try {
    await fsp.chmod(TOKEN_FILE, 0o600);
  } catch {
    /* FS tanpa permission Unix */
  }
}

function tokenKey(provider, user) {
  return `${provider}:${user}`;
}

/* ------------------------------------------------------------------ */
/* provider                                                            */
/* ------------------------------------------------------------------ */

const PROVIDERS = {
  google: {
    label: 'Google Drive',
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI (opsional)'],
    clientId: () => process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET || '',
    scope:
      'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    redirectUri: (req) =>
      process.env.GOOGLE_REDIRECT_URI || `${publicBaseUrl(req)}/api/cloud/google/callback`,
    extraAuth: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
    async list(token, folderId) {
      const q = `'${folderId || 'root'}' in parents and trashed=false`;
      const url =
        'https://www.googleapis.com/drive/v3/files?pageSize=200' +
        '&fields=files(id,name,mimeType,size,modifiedTime),nextPageToken' +
        '&q=' +
        encodeURIComponent(q);
      const data = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
      return (data.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: f.mimeType === 'application/vnd.google-apps.folder' ? 'dir' : 'file',
        size: Number(f.size || 0),
        modified: f.modifiedTime || null,
        mime: f.mimeType || '',
      }));
    },
    async download(token, id, name, mime) {
      if (String(mime || '').startsWith('application/vnd.google-apps.')) {
        throw httpError(
          400,
          'File Google Docs/Sheets/Slides tidak bisa diimpor langsung. Pilih file binary biasa.'
        );
      }
      const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) await readJsonResponse(res);
      return readBodyBuffer(res, MAX_TRANSFER);
    },
    async upload(token, parentId, name, buffer) {
      const boundary = 'nodepanel' + crypto.randomBytes(10).toString('hex');
      const meta = JSON.stringify({
        name,
        parents: [parentId || 'root'],
      });
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
        Buffer.from(meta),
        Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return fetchJson(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );
    },
  },

  onedrive: {
    label: 'OneDrive',
    env: ['ONEDRIVE_CLIENT_ID', 'ONEDRIVE_CLIENT_SECRET', 'ONEDRIVE_REDIRECT_URI (opsional)'],
    clientId: () => process.env.ONEDRIVE_CLIENT_ID || '',
    clientSecret: () => process.env.ONEDRIVE_CLIENT_SECRET || '',
    scope: 'offline_access Files.ReadWrite.All',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    redirectUri: (req) =>
      process.env.ONEDRIVE_REDIRECT_URI ||
      `${publicBaseUrl(req)}/api/cloud/onedrive/callback`,
    extraAuth: { response_mode: 'query' },
    async list(token, folderId) {
      const id = folderId || 'root';
      const base =
        id === 'root'
          ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
          : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(id)}/children`;
      const url =
        base +
        '?$top=200&$select=id,name,size,folder,file,lastModifiedDateTime';
      const data = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
      return (data.value || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: f.folder ? 'dir' : 'file',
        size: Number(f.size || 0),
        modified: f.lastModifiedDateTime || null,
        mime: (f.file && f.file.mimeType) || '',
      }));
    },
    async download(token, id) {
      const url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(id)}/content`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) await readJsonResponse(res);
      return readBodyBuffer(res, MAX_TRANSFER);
    },
    async upload(token, parentId, name, buffer) {
      const url =
        parentId && parentId !== 'root'
          ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
              parentId
            )}:/${encodeURIComponent(name)}:/content`
          : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`;
      return fetchJson(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: buffer,
      });
    },
  },
};

function getProvider(req) {
  const provider = String(req.params.provider || '').toLowerCase();
  const cfg = PROVIDERS[provider];
  if (!cfg) throw httpError(404, 'Provider cloud tidak dikenal');
  return { provider, cfg };
}

function isConfigured(cfg) {
  return !!(cfg.clientId() && cfg.clientSecret());
}

async function getAccessToken(provider, user) {
  const cfg = PROVIDERS[provider];
  const store = await loadTokens();
  const key = tokenKey(provider, user);
  const token = store[key];
  if (!token) return null;

  if (token.access_token && (!token.expires_at || Date.now() < token.expires_at - 60_000)) {
    return token.access_token;
  }
  if (!token.refresh_token) return null;

  const body = new URLSearchParams({
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token,
  });
  const data = await fetchJson(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  token.access_token = data.access_token;
  token.expires_at = Date.now() + Number(data.expires_in || 3600) * 1000;
  if (data.refresh_token) token.refresh_token = data.refresh_token;
  store[key] = token;
  await saveTokens();
  return token.access_token;
}

/* ------------------------------------------------------------------ */
/* helper filesystem (sama dengan aturan routes/files.js)              */
/* ------------------------------------------------------------------ */

function homeOf(username) {
  try {
    const line = fs
      .readFileSync('/etc/passwd', 'utf8')
      .split('\n')
      .find((l) => l.split(':')[0] === username);
    if (!line) return null;
    const home = line.split(':').slice(5, 6)[0];
    return home && fs.existsSync(home) ? home : null;
  } catch {
    return null;
  }
}

function resolveRoot(req, requested) {
  if (isAdminUser(req.user)) {
    if (requested && fs.existsSync(requested) && fs.statSync(requested).isDirectory()) {
      return requested;
    }
    return process.env.PANEL_ROOT || os.homedir();
  }
  return homeOf(req.user) || os.homedir();
}

function safePath(base, target) {
  const baseAbs = path.resolve(base);
  const t = String(target ?? '')
    .trim()
    .replace(/^\/+/, '');
  if (t === '' || t === '.') return baseAbs;
  const resolved = path.resolve(baseAbs, t);
  const okPrefix =
    baseAbs === path.sep ? resolved.startsWith(path.sep) : resolved.startsWith(baseAbs + path.sep);
  if (!okPrefix && resolved !== baseAbs) return null;
  return resolved;
}

async function uniquePath(p) {
  try {
    await fsp.access(p);
  } catch {
    return p;
  }
  const dir = path.dirname(p);
  const ext = path.extname(p);
  const base = path.basename(p, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    try {
      await fsp.access(candidate);
    } catch {
      return candidate;
    }
  }
  throw httpError(409, 'Tidak bisa menemukan nama unik');
}

/* ------------------------------------------------------------------ */
/* routes                                                              */
/* ------------------------------------------------------------------ */

router.get(
  '/providers',
  requireUser,
  wrap(async (req, res) => {
    const store = await loadTokens();
    res.json({
      providers: Object.entries(PROVIDERS).map(([id, cfg]) => ({
        id,
        label: cfg.label,
        configured: isConfigured(cfg),
        connected: !!store[tokenKey(id, req.user)],
        env: cfg.env,
      })),
    });
  })
);

router.get(
  '/:provider/connect',
  requireUser,
  wrap(async (req, res) => {
    const { provider, cfg } = getProvider(req);
    if (!isConfigured(cfg)) {
      throw httpError(
        400,
        `${cfg.label} belum dikonfigurasi. Set ${cfg.env.join(', ')} lalu restart panel.`
      );
    }
    cleanStates();
    const state = crypto.randomBytes(24).toString('hex');
    pendingStates.set(state, {
      user: req.user,
      provider,
      exp: Date.now() + STATE_TTL,
    });
    const url = new URL(cfg.authUrl);
    url.searchParams.set('client_id', cfg.clientId());
    url.searchParams.set('redirect_uri', cfg.redirectUri(req));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', cfg.scope);
    url.searchParams.set('state', state);
    for (const [key, value] of Object.entries(cfg.extraAuth || {})) {
      url.searchParams.set(key, value);
    }
    res.redirect(url.toString());
  })
);

/**
 * Callback tidak memakai requireUser karena cookie SameSite=Strict tidak ikut
 * pada redirect lintas situs. `state` mengikat callback ke user yang memulai.
 */
router.get(
  '/:provider/callback',
  wrap(async (req, res) => {
    const { provider, cfg } = getProvider(req);
    const state = String(req.query.state || '');
    const pending = pendingStates.get(state);
    if (
      !pending ||
      pending.exp < Date.now() ||
      pending.provider !== provider ||
      !pending.user
    ) {
      return res
        .status(400)
        .type('text')
        .send('State OAuth tidak valid atau sudah kedaluwarsa. Silakan ulangi dari panel.');
    }
    pendingStates.delete(state);

    if (req.query.error) {
      return res
        .status(400)
        .type('text')
        .send('Otorisasi ditolak: ' + String(req.query.error));
    }
    if (!req.query.code) {
      return res.status(400).type('text').send('Kode otorisasi tidak ditemukan.');
    }

    const body = new URLSearchParams({
      code: String(req.query.code),
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
      redirect_uri: cfg.redirectUri(req),
      grant_type: 'authorization_code',
    });
    const data = await fetchJson(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const store = await loadTokens();
    store[tokenKey(provider, pending.user)] = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
      token_type: data.token_type || 'Bearer',
      scope: data.scope || cfg.scope,
      connected_at: new Date().toISOString(),
    };
    await saveTokens();

    // Navigasi same-site dari halaman callback supaya cookie sesi (Strict)
    // kembali terkirim saat SPA dimuat.
    const target = `/?cloud=${encodeURIComponent(provider)}#/files`;
    res
      .type('html')
      .send(
        `<!doctype html><meta charset="utf-8"><title>Cloud terhubung</title>` +
          `<p>Cloud berhasil terhubung. Mengalihkan…</p>` +
          `<script>location.replace(${JSON.stringify(target)});</script>`
      );
  })
);

router.post(
  '/:provider/disconnect',
  requireUser,
  wrap(async (req, res) => {
    const { provider } = getProvider(req);
    const store = await loadTokens();
    delete store[tokenKey(provider, req.user)];
    await saveTokens();
    res.json({ ok: true });
  })
);

router.get(
  '/:provider/items',
  requireUser,
  wrap(async (req, res) => {
    const { provider, cfg } = getProvider(req);
    const token = await getAccessToken(provider, req.user);
    if (!token) {
      return res.status(409).json({
        error: `Belum terhubung ke ${cfg.label}`,
        code: 'not_connected',
      });
    }
    const items = await cfg.list(token, String(req.query.folderId || ''));
    res.json({
      provider,
      folderId: String(req.query.folderId || ''),
      items,
    });
  })
);

router.post(
  '/:provider/import',
  requireUser,
  wrap(async (req, res) => {
    const { provider, cfg } = getProvider(req);
    const token = await getAccessToken(provider, req.user);
    if (!token) {
      return res.status(409).json({
        error: `Belum terhubung ke ${cfg.label}`,
        code: 'not_connected',
      });
    }

    const body = req.body || {};
    const id = String(body.id || '');
    const name = String(body.name || '').trim();
    if (!id || !name) throw httpError(400, 'id dan name wajib diisi');
    if (/[\/\\\0]/.test(name) || name === '.' || name === '..') {
      throw httpError(400, 'Nama file dari cloud tidak valid');
    }

    const root = resolveRoot(req, body.root);
    let abs = safePath(root, body.path || name);
    if (!abs) throw httpError(400, 'Path tujuan tidak valid');
    abs = await uniquePath(abs);

    const buffer = await cfg.download(token, id, name, body.mime);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, buffer);
    res.json({
      ok: true,
      name: path.basename(abs),
      size: buffer.length,
      provider,
    });
  })
);

router.post(
  '/:provider/export',
  requireUser,
  wrap(async (req, res) => {
    const { provider, cfg } = getProvider(req);
    const token = await getAccessToken(provider, req.user);
    if (!token) {
      return res.status(409).json({
        error: `Belum terhubung ke ${cfg.label}`,
        code: 'not_connected',
      });
    }

    const body = req.body || {};
    const root = resolveRoot(req, body.root);
    const abs = safePath(root, body.path);
    if (!abs) throw httpError(400, 'Path file tidak valid');
    const st = await fsp.stat(abs);
    if (!st.isFile()) throw httpError(400, 'Bukan file');
    if (st.size > MAX_TRANSFER) {
      throw httpError(413, `File melebihi batas ${Math.round(MAX_TRANSFER / 1024 / 1024)}MB`);
    }

    const name = String(body.name || path.basename(abs)).trim() || path.basename(abs);
    if (/[\/\\\0]/.test(name)) throw httpError(400, 'Nama file tidak valid');
    const buffer = await fsp.readFile(abs);
    const result = await cfg.upload(token, String(body.parentId || ''), name, buffer);
    res.json({
      ok: true,
      provider,
      id: result.id || null,
      name: result.name || name,
      size: buffer.length,
    });
  })
);

module.exports = {
  router,
  PROVIDERS,
  MAX_TRANSFER,
  TOKEN_FILE,
};
