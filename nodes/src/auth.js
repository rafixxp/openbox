const crypto = require('crypto');
const pty = require('node-pty');
const os = require('os');
const fs = require('fs');
const sessions = new Map();

const TTL = 7 * 24 * 3600 * 1000;
const COOKIE = 'np_sid';

function userExists(username) {
  try {
    const line = fs.readFileSync('/etc/passwd', 'utf8').split('\n')
      .find((l) => l.split(':')[0] === username);
    if (!line) return null;
    const [name, , , , , home, shell] = line.split(':');
    return { username: name, home, shell };
  } catch {
    return null;
  }
}

/**
 * Autentikasi username/password Linux lokal dengan menspawn `su`
 * lewat node-pty (su butuh TTY untuk prompt password).
 */
function linuxAuth(username, password) {
  return new Promise((resolve) => {
    let done = false;
    let askedPw = false;
    let buf = '';
    let su;
    try {
      su = pty.spawn('su', ['--', username, '-c', 'true'], { name: 'xterm', cols: 80, rows: 24, cwd: '/tmp' });
    } catch {
      return resolve({ ok: false, reason: 'server' });
    }
    const finish = (ok, reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { su.kill(); } catch {}
      resolve({ ok, reason });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), 12000);
    su.onData((data) => {
      buf += data;
      if (!askedPw && /password/i.test(buf)) {
        askedPw = true;
        buf = '';
        su.write(password + '\r');
      } else if (/(denied|failure|incorrect|tidak sah)/i.test(buf) || /su: Authentication/i.test(buf)) {
        finish(false, 'credentials');
      }
    });
    su.onExit(({ exitCode }) => {
      finish(askedPw && exitCode === 0, exitCode === 0 ? 'ok' : 'credentials');
    });
  });
}

/** Ubah password akun Linux milik proses panel memakai interactive `passwd`. */
function linuxChangePassword(current, next) {
  return new Promise((resolve) => {
    let done = false;
    let buf = '';
    let steps = [current, next, next];
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
        child.write(String(steps[0] || '') + '\r');
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
}
setInterval(prune, 3600 * 1000).unref();

function middleware(req, res, next) {
  req.user = valid(sidFromReq(req));
  req.sid = req.user ? sidFromReq(req) : null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Belum login' });
  next();
}

function routes(app) {
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }
    const info = userExists(username);
    if (!info) {
      setTimeout(() => res.status(401).json({ error: 'Username atau password salah' }), 400);
      return;
    }
    const r = await linuxAuth(username, password);
    if (!r.ok) {
      setTimeout(() => res.status(401).json({ error: 'Username atau password salah' }), 400);
      return;
    }
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, { username, exp: Date.now() + TTL });
    res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}`);
    res.json({ ok: true, user: { username } });
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
        home: info?.home,
        shell: info?.shell,
      },
    });
  });

  app.post('/api/auth/change-password', async (req, res) => {
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

function checkRequest(req) {
  return valid(sidFromReq(req)) !== null;
}

module.exports = { middleware, requireAuth, routes, checkRequest };
