const crypto = require('crypto');
const pty = require('node-pty');
const os = require('os');
const fs = require('fs');

const TTL = 7 * 24 * 3600 * 1000;
const COOKIE = 'np_sid';
const sessions = new Map();

const SYSTEM_SHELLS = ['/usr/sbin/nologin', '/sbin/nologin', '/bin/false'];
const SUDO_GROUPS = ['sudo', 'wheel', 'admin'];
const NAME_RE = /^[a-z_][a-z0-9_.-]{0,63}$/i;

/* ---------- /etc/passwd & /etc/group helpers ---------- */

function readPasswd() {
  return fs.readFileSync('/etc/passwd', 'utf8').split('\n').filter(Boolean).map((line) => {
    const [name, pw, uid, gid, gecos, home, shell] = line.split(':');
    return { name, uid: Number(uid), gid: Number(gid), gecos: gecos || '', home, shell };
  });
}

function readGroup() {
  return fs.readFileSync('/etc/group', 'utf8').split('\n').filter(Boolean).map((line) => {
    const [name, , gid, members] = line.split(':');
    return { name, gid: Number(gid), members: (members || '').split(',').filter(Boolean) };
  });
}

function userExists(username) {
  if (!NAME_RE.test(String(username || ''))) return null;
  const u = readPasswd().find((x) => x.name === username);
  if (!u) return null;
  const fullName = (u.gecos || '').split(',')[0].trim();
  return {
    username: u.name,
    uid: u.uid,
    gecos: u.gecos,
    fullName,
    home: u.home,
    shell: u.shell,
  };
}

function isAdminUser(username) {
  const info = userExists(username);
  if (!info) return false;
  if (info.uid === 0) return true;
  const groups = readGroup();
  return groups.some((g) => SUDO_GROUPS.includes(g.name) && (g.members.includes(username) || g.gid === info.gid));
}

/* ---------- PAM-based password verification via `su` + pty ---------- */

/**
 * Verifikasi password akun Linux lewat `su` (PAM) di dalam PTY.
 * - Panel berjalan sebagai root : su tidak akan meminta password, jadi proses su
 *   dieksekusi sebagai `nobody` via setpriv agar PAM tetap memvalidasi password.
 * - Panel berjalan sebagai user : su biasa, PAM meminta password target.
 * User dengan shell nologin/false ditolak dengan pesan jelas.
 */
function linuxAuth(username, password) {
  const info = userExists(username);
  if (!info) return Promise.resolve({ ok: false, reason: 'credentials' });
  if (SYSTEM_SHELLS.includes(info.shell)) {
    return Promise.resolve({
      ok: false,
      reason: 'nologin',
      error: 'Akun tidak dapat login (shell tidak aktif / nologin). Hubungi administrator.',
    });
  }

  const iAmRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  let file, args;
  if (iAmRoot) {
    // jalankan su sebagai nobody supaya password benar-benar divalidasi PAM
    file = 'setpriv';
    args = ['--reuid=65534', '--regid=65534', '--clear-groups', 'su', '--', username, '-c', 'true'];
  } else {
    file = 'su';
    args = ['--', username, '-c', 'true'];
  }

  return new Promise((resolve) => {
    let done = false;
    let askedPw = false;
    let buf = '';
    let child;
    try {
      child = pty.spawn(file, args, { name: 'xterm', cols: 80, rows: 24, cwd: '/tmp' });
    } catch {
      return resolve({ ok: false, reason: 'server', error: 'su tidak tersedia pada sistem ini' });
    }
    const finish = (ok, reason, error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { child.kill(); } catch {}
      resolve({ ok, reason, error });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), 15000);
    child.onData((data) => {
      buf += data;
      if (!askedPw && /password/i.test(buf)) {
        askedPw = true;
        buf = '';
        child.write(password + '\r');
      } else if (/(denied|failure|incorrect|tidak sah)/i.test(buf) || /su: Authentication/i.test(buf)) {
        finish(false, 'credentials');
      }
    });
    child.onExit(({ exitCode }) => {
      if (askedPw && exitCode === 0) finish(true, 'ok');
      else finish(false, askedPw ? 'credentials' : 'credentials');
    });
  });
}

/** Ubah password akun Linux milik proses panel memakai interactive `passwd`. */
function linuxChangePassword(current, next) {
  return new Promise((resolve) => {
    let done = false;
    let buf = '';
    let passed = false;
    let child;
    try {
      child = pty.spawn('passwd', [], { name: 'xterm', cols: 80, rows: 24, cwd: os.homedir() });
    } catch {
      return resolve({ ok: false, error: 'Backend passwd tidak tersedia' });
    }
    const finish = (ok, error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { child.kill(); } catch {}
      resolve({ ok, error });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), 20000);
    child.onData((data) => {
      buf += data;
      if (/current password/i.test(buf)) {
        buf = '';
        child.write(String(current || '') + '\r');
      } else if (/(new password|retype)/i.test(buf)) {
        buf = '';
        child.write(next + '\r');
      } else if (/successfully/i.test(buf)) {
        passed = true;
        finish(true);
      } else if (/(wrong|incorrect|failure|unchanged|cannot)/i.test(buf)) {
        finish(false, 'Password lama salah / password ditolak sistem');
      }
    });
    child.onExit(() => finish(passed, passed ? undefined : 'Gagal mengubah password'));
  });
}

/* ---------- session & rate limit ---------- */

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sidFromReq(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE] || null;
}

function valid(sid) {
  if (!sid || !sessions.has(sid)) return null;
  const s = sessions.get(sid);
  if (Date.now() > s.exp) { sessions.delete(sid); return null; }
  return s.username;
}

function prune() {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now > s.exp) sessions.delete(sid);
  }
  for (const [k, v] of loginAttempts) {
    if (now > v.until && v.count >= MAX_ATTEMPTS) loginAttempts.delete(k);
  }
}
setInterval(prune, 3600 * 1000).unref();

// rate limit sederhana per username
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 1000;

function checkRateLimit(username) {
  const rec = loginAttempts.get(username);
  if (!rec) return { allowed: true };
  if (rec.count >= MAX_ATTEMPTS && Date.now() < rec.until) {
    const secs = Math.ceil((rec.until - Date.now()) / 1000);
    return { allowed: false, secs };
  }
  return { allowed: true };
}

function recordFail(username) {
  let rec = loginAttempts.get(username);
  if (!rec) { rec = { count: 0, until: 0 }; loginAttempts.set(username, rec); }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.until = Date.now() + LOCK_MS, (rec.count = MAX_ATTEMPTS);
}

function recordSuccess(username) {
  loginAttempts.delete(username);
}

/* ---------- middleware ---------- */

function middleware(req, res, next) {
  const username = valid(sidFromReq(req));
  req.sid = username ? sidFromReq(req) : null;
  req.user = username || null;
  req.isAdmin = username ? isAdminUser(username) : false;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Belum login' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Belum login' });
  if (!req.isAdmin) return res.status(403).json({ error: 'Akses ditolak: fitur ini hanya untuk administrator' });
  next();
}

/* ---------- routes ---------- */

const LOGIN_DELAY_MS = 400;

function routes(app) {
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }
    const uname = String(username).trim();
    if (!NAME_RE.test(uname)) {
      setTimeout(() => res.status(401).json({ error: 'Username atau password salah' }), LOGIN_DELAY_MS);
      return;
    }
    const rl = checkRateLimit(uname);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Terlalu banyak percobaan login. Coba lagi dalam ${rl.secs} detik.` });
    }

    let r;
    try {
      r = await linuxAuth(uname, password);
    } catch {
      r = { ok: false, reason: 'server' };
    }
    if (!r.ok) {
      recordFail(uname);
      const generic = 'Username atau password salah';
      const msg = r.reason === 'nologin' ? r.error : generic;
      setTimeout(() => res.status(401).json({ error: msg }), LOGIN_DELAY_MS);
      return;
    }
    recordSuccess(uname);
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, { username: uname, exp: Date.now() + TTL });
    res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}`);
    res.json({
      ok: true,
      user: {
        username: uname,
        isAdmin: isAdminUser(uname),
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.sid) sessions.delete(req.sid);
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Belum login' });
    const info = userExists(req.user);
    res.json({
      user: {
        username: req.user,
        fullName: info?.fullName || '',
        gecos: info?.gecos || '',
        home: info?.home,
        shell: info?.shell,
        uid: info?.uid,
        isAdmin: req.isAdmin,
      },
    });
  });

  app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const { current, next } = req.body || {};
    if (!current || !next) return res.status(400).json({ error: 'Isi password lama dan baru' });
    if (String(next).length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    const r = await linuxChangePassword(current, String(next));
    if (!r.ok) {
      return res.status(400).json({ error: r.error || 'Gagal mengubah password' });
    }
    res.json({ ok: true });
  });
}

/* auth untuk upgrade WebSocket — return username atau null */
function wsUser(req) {
  return valid(sidFromReq(req));
}

function checkRequest(req) {
  return wsUser(req) !== null;
}

module.exports = {
  middleware,
  requireAuth,
  requireAdmin,
  routes,
  checkRequest,
  wsUser,
  isAdminUser,
  isValidName: (n) => NAME_RE.test(String(n || '')),
};
