const fs = require('fs');
const path = require('path');
const panelAccounts = require('./panel-accounts');

const FILE = path.join(__dirname, '..', 'storage', 'linux-account-access.json');

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

function normalize(role, permissions) {
  if (role === 'admin') return panelAccounts.ALL_PERMISSIONS.slice();
  if (!Array.isArray(permissions)) return panelAccounts.DEFAULT_USER_PERMS.slice();
  return [...new Set(permissions.filter((p) => panelAccounts.ALL_PERMISSIONS.includes(p)))];
}

function getAccess(username) {
  const rec = readAll()[String(username)];
  if (!rec || typeof rec !== 'object') return null;
  const role = panelAccounts.ROLES[rec.role] ? rec.role : 'user';
  return { role, permissions: normalize(role, rec.permissions) };
}

function saveAccess(username, role, permissions) {
  if (!panelAccounts.ROLES[role]) return { ok: false, error: 'Role tidak valid' };
  if (permissions !== undefined && !Array.isArray(permissions)) {
    return { ok: false, error: 'Permission harus berupa daftar izin' };
  }
  if (Array.isArray(permissions)) {
    const invalid = permissions.filter((p) => typeof p !== 'string' || !panelAccounts.ALL_PERMISSIONS.includes(p));
    if (invalid.length) return { ok: false, error: `Permission tidak dikenal: ${invalid.join(', ')}` };
  }
  const data = readAll();
  data[String(username)] = { role, permissions: normalize(role, permissions) };
  writeAll(data);
  return { ok: true, access: data[String(username)] };
}

function removeAccess(username) {
  const data = readAll();
  if (!Object.prototype.hasOwnProperty.call(data, String(username))) return false;
  delete data[String(username)];
  writeAll(data);
  return true;
}

function resolveAccess(username, systemAdmin) {
  if (systemAdmin) {
    return { role: 'admin', permissions: panelAccounts.ALL_PERMISSIONS.slice(), isAdmin: true };
  }
  const saved = getAccess(username);
  if (saved) {
    return {
      role: saved.role,
      permissions: saved.permissions,
      isAdmin: saved.role === 'admin',
    };
  }
  return {
    role: 'user',
    permissions: panelAccounts.DEFAULT_USER_PERMS.slice(),
    isAdmin: false,
  };
}

module.exports = {
  FILE,
  getAccess,
  saveAccess,
  removeAccess,
  resolveAccess,
  normalize,
};
