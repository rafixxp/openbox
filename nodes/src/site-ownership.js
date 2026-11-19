const fs = require('fs');
const path = require('path');
const panelAccounts = require('./panel-accounts');

const FILE = path.join(__dirname, '..', 'storage', 'site-owners.json');
const WEB_ROOT = '/var/www';
const MIN_UID = Number(process.env.PANEL_MIN_UID || 1000);
const NAME_RE = /^[a-z_][a-z0-9_.-]{0,63}$/i;
const SYSTEM_SHELLS = ['/usr/sbin/nologin', '/sbin/nologin', '/bin/false'];

function readAll() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeKey(name) {
  const value = String(name ?? '').trim();
  return NAME_RE.test(value) ? value : null;
}

function readPasswd() {
  try {
    return fs.readFileSync('/etc/passwd', 'utf8').split('\n').filter(Boolean).map((line) => {
      const [name, , uid, , gecos, home, shell] = line.split(':');
      return { username: name, uid: Number(uid), fullName: (gecos || '').split(',')[0].trim(), home, shell };
    });
  } catch {
    return [];
  }
}

function linuxUsers() {
  return readPasswd().filter((u) => u.uid >= MIN_UID && !SYSTEM_SHELLS.includes(u.shell));
}

function listUsers() {
  const users = linuxUsers().map((u) => ({ ...u, source: 'linux' }));
  for (const acc of panelAccounts.listAccounts()) {
    if (acc.active === false || users.some((u) => u.username === acc.username)) continue;
    users.push({ username: acc.username, uid: null, fullName: acc.fullName || '', home: null, source: 'panel' });
  }
  return users;
}

function isKnownUser(username) {
  const name = normalizeKey(username);
  return !!name && listUsers().some((u) => u.username === name);
}

function getOwner(name) {
  const key = normalizeKey(name);
  if (!key) return null;
  const owner = readAll()[key];
  return typeof owner === 'string' && normalizeKey(owner) ? owner : null;
}

function setOwner(name, username) {
  const key = normalizeKey(name);
  if (!key) return { ok: false, error: 'Nama situs tidak valid' };
  const data = readAll();
  if (!username) {
    delete data[key];
  } else {
    if (!isKnownUser(username)) return { ok: false, error: 'Pemilik tidak dikenal' };
    data[key] = normalizeKey(username);
  }
  writeAll(data);
  return { ok: true, owner: username ? normalizeKey(username) : null };
}

function ownerFromComment(content) {
  const match = String(content || '').match(/^\s*#\s*(?:site[-_ ]?owner|owner)\s*:\s*([a-z0-9_.-]+)\s*$/im);
  return match && isKnownUser(match[1]) ? normalizeKey(match[1]) : null;
}

function ownerFromDocroot(root) {
  if (typeof root !== 'string' || !root.trim()) return null;
  const docroot = path.resolve(root.trim().replace(/^["']|["']$/g, ''));
  const rel = path.relative(WEB_ROOT, docroot);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    const first = rel.split(path.sep)[0];
    if (linuxUsers().some((u) => u.username === first)) return first;
  }
  try {
    const uid = fs.statSync(docroot).uid;
    const user = linuxUsers().find((u) => u.uid === uid);
    if (user) return user.username;
  } catch {}
  return null;
}

function resolveOwner({ name, root, content } = {}) {
  return getOwner(name) || ownerFromComment(content) || ownerFromDocroot(root);
}

function canAccess(req, owner) {
  if (!req) return false;
  if (req.isAdmin) return true;
  return !!req.user && !!owner && req.user === owner;
}

module.exports = {
  FILE,
  listUsers,
  isKnownUser,
  getOwner,
  setOwner,
  resolveOwner,
  canAccess,
};
