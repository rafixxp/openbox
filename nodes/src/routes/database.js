/**
 * Manajemen database SQL (MySQL/MariaDB) lewat CLI.
 * - CRUD database, tabel, dan record.
 * - Semua endpoint hanya untuk admin.
 * - Koneksi pakai socket/TCP default milik sistem;
 *   bisa dioverride via env PANEL_MYSQL_SOCKET atau PANEL_MYSQL_PORT.
 */
const express = require('express');
const { execFile } = require('child_process');
const auth = require('../auth');

const router = express.Router();

const IDENT_RE = /^[a-zA-Z0-9_$][a-zA-Z0-9_$-]{0,63}$/;

const SQL_SERVERS = [
  { key: 'mariadb', label: 'MariaDB', client: 'mysql', units: ['mariadb.service'] },
  { key: 'mysql', label: 'MySQL', client: 'mysql', units: ['mysqld.service', 'mysql.service'] },
];

const STATUS_ONLY_SERVERS = [
  { key: 'postgresql', label: 'PostgreSQL', client: 'psql', units: ['postgresql.service'] },
  { key: 'redis', label: 'Redis', client: 'redis-cli', units: ['redis-server.service'] },
];

const SYSTEM_DBS = new Set(['information_schema', 'performance_schema', 'mysql', 'sys']);

function isRoot() {
  return typeof process.getuid === 'function' ? process.getuid() === 0 : true;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: options.timeout || 30000 }, (err, stdout, stderr) => {
      resolve({ code: err ? ((err.code ?? 1) | 0 || 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || ''), err });
    });
  });
}

function runPriv(cmd, args, options = {}) {
  if (isRoot()) return run(cmd, args, options);
  return run('sudo', ['-n', cmd, ...args], options);
}

function activeUnit(units) {
  return run('systemctl', ['is-active', ...units]);
}

function svcRaw(req) {
  return String(req.params.svc || '').toLowerCase();
}

function serverInfo(key) {
  return SQL_SERVERS.find((s) => s.key === key);
}

/* ---------- SQL helpers ---------- */

function mysqlArgs() {
  const args = ['-N', '-B', '--connect-timeout=5'];
  if (process.env.PANEL_MYSQL_SOCKET) args.push('--socket', process.env.PANEL_MYSQL_SOCKET);
  else if (process.env.PANEL_MYSQL_PORT) args.push('--host', '127.0.0.1', '--port', String(process.env.PANEL_MYSQL_PORT));
  return args;
}

/** jalankan SQL; return {code, stdout, stderr}. stdout tsv batch. */
function sql(svc, sqlText, { database } = {}) {
  const info = serverInfo(svc);
  if (!info) return Promise.resolve({ code: 1, stdout: '', stderr: 'server database tidak dikenal' });
  const hasOverride = !!(process.env.PANEL_MYSQL_SOCKET || process.env.PANEL_MYSQL_PORT);
  // Socket/port custom → jalankan langsung (mode deployment khusus/test);
  // default sistem butuh hak root → sudo -n bila proses panel bukan root.
  const runner = info.client === 'mysql' && hasOverride ? run : runPriv;
  const args = mysqlArgs();
  if (database) {
    if (!IDENT_RE.test(database)) return Promise.resolve({ code: 1, stdout: '', stderr: 'Nama database tidak valid' });
    args.push(database);
  }
  args.push('-e', sqlText);
  return runner(info.client, args);
}

/** unpick tsv batch mysql: split baris/kolom lalu unescape (\n \t \\ dst) */
function parseTsv(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line) => (line === '' ? [''] : line.split('\t')).map(unescapeCell));
}

function unescapeCell(c) {
  let out = '';
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (ch === '\\' && i + 1 < c.length) {
      const n = c[++i];
      const map = { t: '\t', n: '\n', r: '\r', '0': '\0', b: '\b', Z: '\x1a', '\\': '\\' };
      out += map[n] !== undefined ? map[n] : n;
    } else out += ch;
  }
  return out;
}

const q = (name) => '`' + name + '`';

/** escape nilai: null → NULL, angka murni → tanpa kutip (aman utk numerik), lainnya string kutip */
function escVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return 'NULL';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  let s = String(v);
  s = s.replace(/\0/g, '\\0').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\x1a/g, '\\Z');
  return "'" + s + "'";
}

/** nilai utk kolom tertentu berdasarkan tipe kolom */
function valueForColumn(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return 'NULL';
  const s = String(v);
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  return escVal(s);
}

function buildWhere(where, columns) {
  if (!where || typeof where !== 'object' || Object.keys(where).length === 0) {
    throw new Error('Kunci baris (waku) wajib untuk operasi ini');
  }
  const cols = new Map(columns.map((c) => [c.name, c]));
  const parts = [];
  for (const [name, rawVal] of Object.entries(where)) {
    if (!cols.has(name)) throw new Error('Kolom "' + name + '" tidak ada di tabel ini');
    if (rawVal === null || rawVal === undefined) parts.push(`${q(name)} IS NULL`);
    else parts.push(`${q(name)}=${valueForColumn(rawVal)}`);
  }
  return parts.map((p) => '(' + p + ')').join(' AND ');
}

function buildValues(values, columns) {
  if (!values || typeof values !== 'object' || Object.keys(values).length === 0) {
    throw new Error('Tidak ada data yang diubah');
  }
  const cols = new Map(columns.map((c) => [c.name, c]));
  const sets = [];
  for (const [name, rawVal] of Object.entries(values)) {
    if (!cols.has(name)) throw new Error('Kolom "' + name + '" tidak ada di tabel ini');
    sets.push(`${q(name)}=${valueForColumn(rawVal)}`);
  }
  return sets.join(', ');
}

/* ---------- ekstraksi kolom ---------- */

async function tableColumns(svc, db, table) {
  const res = await sql(svc, `SHOW COLUMNS FROM ${q(db)}.${q(table)}`);
  if (res.code !== 0) throw new Error((res.stderr || 'Gagal membaca struktur tabel').trim());
  return parseTsv(res.stdout).map((r) => ({
    name: r[0],
    type: r[1],
    nullable: r[2] === 'YES',
    key: r[3],
    dflt: r[4],
    extra: r[5],
  }));
}

/* ---------- routes (semua admin) ---------- */

router.use(auth.requireAdmin);

router.get('/', async (req, res) => {
  const out = [];
  const hasMysqlClient = (await run('which', ['mysql'])).code === 0;

  for (const def of [...SQL_SERVERS, ...STATUS_ONLY_SERVERS]) {
    const a = await activeUnit(def.units);
    const active = a.stdout.trim() === 'active';
    let unit = null;
    if (active) {
      for (const u of def.units) {
        if ((await run('systemctl', ['is-active', u])).stdout.trim() === 'active') { unit = u; break; }
      }
    }
    const clientAvailable = def.client === 'mysql' ? hasMysqlClient : (await run('which', [def.client])).code === 0;
    out.push({
      service: def.key,
      label: def.label,
      running: active,
      unit,
      clientAvailable,
      manageable: SQL_SERVERS.some((s) => s.key === def.key),
    });
  }
  res.json({ servers: out });
});

router.get('/:svc/databases', async (req, res) => {
  const svc = svcRaw(req);
  if (STATUS_ONLY_SERVERS.some((s) => s.key === svc)) {
    return res.status(400).json({ error: 'CRUD untuk layanan ini belum tersedia; gunakan halaman Services' });
  }
  if (!serverInfo(svc)) return res.status(404).json({ error: 'Server database tidak dikenal' });
  const r = await sql(svc, 'SHOW DATABASES');
  if (r.code !== 0) return res.status(502).json({ error: (r.stderr || 'Gagal terhubung ke server database').trim() });
  const names = parseTsv(r.stdout).map((row) => row[0]).filter(Boolean);
  // mariadb/mysql bisa dobel tampil; sembunyikan alias yang tidak aktif
  const list = names.map((n) => ({ name: n, system: SYSTEM_DBS.has(n) }));
  res.json({ databases: list });
});

router.post('/:svc/databases', async (req, res) => {
  const svc = svcRaw(req);
  const name = String((req.body || {}).name || '').trim();
  if (!IDENT_RE.test(name)) return res.status(400).json({ error: 'Nama database tidak valid (huruf, angka, _, -, $; mulai bukan -)' });
  const r = await sql(svc, `CREATE DATABASE ${q(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'Gagal membuat database').trim() });
  res.json({ ok: true });
});

router.delete('/:svc/databases/:db', async (req, res) => {
  const svc = svcRaw(req);
  const { db } = req.params;
  if (!IDENT_RE.test(db)) return res.status(400).json({ error: 'Nama database tidak valid' });
  const r = await sql(svc, `DROP DATABASE ${q(db)}`);
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'Gagal menghapus database').trim() });
  res.json({ ok: true });
});

router.get('/:svc/databases/:db/tables', async (req, res) => {
  const svc = svcRaw(req);
  const { svc: _s, db } = req.params;
  if (!IDENT_RE.test(db)) return res.status(400).json({ error: 'Nama database tidak valid' });
  const r = await sql(svc, `SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=${escVal(db)} ORDER BY TABLE_NAME`, { database: db });
  if (r.code !== 0) return res.status(502).json({ error: (r.stderr || 'Gagal membaca daftar tabel').trim() });
  const tables = parseTsv(r.stdout).map((row) => ({
    name: row[0],
    type: row[1] || 'BASE TABLE',
    approxRows: row[2] === null ? null : Number(row[2]),
    engine: row[3] || null,
  }));
  res.json({ tables });
});

router.post('/:svc/databases/:db/tables', async (req, res) => {
  const svc = svcRaw(req);
  const { db } = req.params;
  if (!IDENT_RE.test(db)) return res.status(400).json({ error: 'Nama database tidak valid' });
  let ddl = String((req.body || {}).ddl || '').trim();
  if (!ddl) return res.status(400).json({ error: 'DDL CREATE TABLE wajib diisi' });
  ddl = ddl.replace(/;+\s*$/, '');
  if (ddl.split(';').length > 1) return res.status(400).json({ error: 'Satu statement saja (tanpa titik koma tambahan)' });
  if (!/^CREATE\s+TABLE\s/i.test(ddl)) return res.status(400).json({ error: 'Hanya statement CREATE TABLE yang diizinkan' });
  if (/;\s/.test(ddl)) return res.status(400).json({ error: 'DDL tidak boleh mengandung titik koma di dalamnya' });
  const r = await sql(svc, ddl, { database: db });
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'DDL gagal').trim() });
  res.json({ ok: true });
});

router.post('/:svc/databases/:db/tables/:table/truncate', async (req, res) => {
  const svc = svcRaw(req);
  const { db, table } = req.params;
  if (!IDENT_RE.test(db) || !IDENT_RE.test(table)) return res.status(400).json({ error: 'Nama tidak valid' });
  const r = await sql(svc, `TRUNCATE TABLE ${q(db)}.${q(table)}`);
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'Gagal truncate').trim() });
  res.json({ ok: true });
});

router.delete('/:svc/databases/:db/tables/:table', async (req, res) => {
  const svc = svcRaw(req);
  const { db, table } = req.params;
  if (!IDENT_RE.test(db) || !IDENT_RE.test(table)) return res.status(400).json({ error: 'Nama tidak valid' });
  const r = await sql(svc, `DROP TABLE ${q(db)}.${q(table)}`);
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'Gagal menghapus tabel').trim() });
  res.json({ ok: true });
});

router.get('/:svc/databases/:db/tables/:table', async (req, res) => {
  const svc = svcRaw(req);
  const { db, table } = req.params;
  if (!IDENT_RE.test(db) || !IDENT_RE.test(table)) return res.status(400).json({ error: 'Nama tidak valid' });

  let columns;
  try {
    columns = await tableColumns(svc, db, table);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  const pk = columns.filter((c) => c.key === 'PRI').map((c) => c.name);

  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const orderBy = pk.length ? ' ORDER BY ' + pk.map(q).join(', ') : '';
  const [countRes, rowsRes] = await Promise.all([
    sql(svc, `SELECT COUNT(*) FROM ${q(db)}.${q(table)}`),
    sql(svc, `SELECT * FROM ${q(db)}.${q(table)}${orderBy} LIMIT ${limit} OFFSET ${offset}`),
  ]);
  if (countRes.code !== 0) return res.status(502).json({ error: (countRes.stderr || 'Gagal menghitung jumlah baris').trim() });
  if (rowsRes.code !== 0) return res.status(502).json({ error: (rowsRes.stderr || 'Gagal membaca baris').trim() });

  const total = Number(parseTsv(countRes.stdout)[0][0]);
  const rows = parseTsv(rowsRes.stdout).map((r) => {
    const obj = {};
    columns.forEach((c, i) => { obj[c.name] = r[i] ?? null; });
    return obj;
  });

  res.json({ table, columns, pk, total, limit, offset, rows });
});

router.post('/:svc/databases/:db/tables/:table/rows', async (req, res) => {
  const svc = svcRaw(req);
  const { db, table } = req.params;
  if (!IDENT_RE.test(db) || !IDENT_RE.test(table)) return res.status(400).json({ error: 'Nama tidak valid' });
  let columns;
  try {
    columns = await tableColumns(svc, db, table);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  let sets;
  try {
    sets = buildValues((req.body || {}).values, columns);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const r = await sql(svc, `INSERT INTO ${q(db)}.${q(table)} SET ${sets}`);
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'INSERT gagal').trim() });
  res.json({ ok: true });
});

router.put('/:svc/databases/:db/tables/:table/rows', async (req, res) => {
  const svc = svcRaw(req);
  const { db, table } = req.params;
  if (!IDENT_RE.test(db) || !IDENT_RE.test(table)) return res.status(400).json({ error: 'Nama tidak valid' });
  const body = req.body || {};
  let columns;
  try {
    columns = await tableColumns(svc, db, table);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  let whereSql, sets;
  try {
    whereSql = buildWhere(body.where, columns);
    sets = buildValues(body.values, columns);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const r = await sql(svc, `UPDATE ${q(db)}.${q(table)} SET ${sets} WHERE ${whereSql}`);
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'UPDATE gagal').trim() });
  res.json({ ok: true });
});

router.delete('/:svc/databases/:db/tables/:table/rows', async (req, res) => {
  const svc = svcRaw(req);
  const { db, table } = req.params;
  if (!IDENT_RE.test(db) || !IDENT_RE.test(table)) return res.status(400).json({ error: 'Nama tidak valid' });
  const body = req.body || {};
  let columns;
  try {
    columns = await tableColumns(svc, db, table);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
  let whereSql;
  try {
    whereSql = buildWhere(body.where, columns);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const r = await sql(svc, `DELETE FROM ${q(db)}.${q(table)} WHERE ${whereSql}`);
  if (r.code !== 0) return res.status(400).json({ error: (r.stderr || 'DELETE gagal').trim() });
  res.json({ ok: true });
});

module.exports = router;
