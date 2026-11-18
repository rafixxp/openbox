const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_DIR = path.join(__dirname, '..', 'storage');
const FILE = path.join(STORAGE_DIR, 'panel-accounts.json');

const ROLES = { admin: 'admin', user: 'user' };

const PERMISSIONS = {
  dashboard: 'Dashboard',
  files: 'File Manager',
  services: 'Services',
  sites: 'Websites',
  database: 'Database',
  terminal: 'Terminal',
  account: 'Manajemen Akun',
  cloud: 'Cloud Storage',
};

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);
const DEFAULT_USER_PERMS = ['dashboard', 'files'];

const NAME_RE = /^[a-z_][a-z0-9_.-]{0,63}$/i;

function ensureDir() {
  try { fs.mkdirSync(STORAGE_DIR, { recursive: true }); } catch {}
}

function readAccounts() {
  ensureDir();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeAccounts(accounts) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(accounts, null, 2), 'utf8');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored).split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return computed === hash;
}

function findAccount(accounts, username) {
  return accounts.find((a) => a.username === username);
}

function authenticate(username, password) {
  const accounts = readAccounts();
  const acc = findAccount(accounts, username);
  if (!acc || acc.active === false) return null;
  if (!verifyPassword(password, acc.passwordHash)) return null;
  return {
    username: acc.username,
    role: acc.role || 'user',
    permissions: Array.isArray(acc.permissions) ? acc.permissions : [],
    fullName: acc.fullName || '',
  };
}

function listAccounts() {
  return readAccounts().map((a) => ({
    username: a.username,
    role: a.role || 'user',
    permissions: Array.isArray(a.permissions) ? a.permissions : [],
    fullName: a.fullName || '',
    active: a.active !== false,
    createdAt: a.createdAt || '',
  }));
}

function normalizePermissions(role, permissions) {
  if (role === 'admin') return ALL_PERMISSIONS.slice();
  if (Array.isArray(permissions)) {
    return permissions.filter((p) => ALL_PERMISSIONS.includes(p));
  }
  return DEFAULT_USER_PERMS.slice();
}

function createAccount({ username, password, role, permissions, fullName }) {
  const accounts = readAccounts();
  if (findAccount(accounts, username)) return { ok: false, error: 'Username sudah digunakan' };
  if (!NAME_RE.test(String(username || ''))) return { ok: false, error: 'Username tidak valid' };
  if (!password || String(password).length < 6) return { ok: false, error: 'Password minimal 6 karakter' };
  if (/[:\r\n]/.test(String(password))) return { ok: false, error: 'Password tidak boleh mengandung titik dua atau baris baru' };
  if (!ROLES[role]) role = 'user';

  const account = {
    username,
    role,
    permissions: normalizePermissions(role, permissions),
    fullName: fullName || '',
    active: true,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };
  accounts.push(account);
  writeAccounts(accounts);
  return { ok: true, account: { ...account, passwordHash: undefined } };
}

function updateAccount(username, changes) {
  const accounts = readAccounts();
  const idx = accounts.findIndex((a) => a.username === username);
  if (idx === -1) return { ok: false, error: 'Akun tidak ditemukan' };
  const acc = accounts[idx];
  if (changes.role && ROLES[changes.role]) acc.role = changes.role;
  if (changes.permissions !== undefined) acc.permissions = normalizePermissions(acc.role, changes.permissions);
  if (changes.fullName !== undefined) acc.fullName = changes.fullName;
  if (changes.active !== undefined) acc.active = changes.active === true;
  if (changes.password) acc.passwordHash = hashPassword(changes.password);
  accounts[idx] = acc;
  writeAccounts(accounts);
  return { ok: true, account: { ...acc, passwordHash: undefined } };
}

function deleteAccount(username) {
  const accounts = readAccounts();
  const filtered = accounts.filter((a) => a.username !== username);
  if (filtered.length === accounts.length) return { ok: false, error: 'Akun tidak ditemukan' };
  writeAccounts(filtered);
  return { ok: true };
}

function getPermissions() { return PERMISSIONS; }
function getAllPermissions() { return ALL_PERMISSIONS.slice(); }

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Belum login' });
    const perms = req.permissions || [];
    if (perms.includes('*') || perms.includes(permission)) return next();
    return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki izin untuk fitur ini' });
  };
}

module.exports = {
  authenticate, listAccounts, createAccount, updateAccount, deleteAccount,
  getPermissions, getAllPermissions, ROLES, ALL_PERMISSIONS, DEFAULT_USER_PERMS,
  requirePermission, FILE, hashPassword, verifyPassword,
};
