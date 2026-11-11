const express = require('express');
const { execFile } = require('child_process');
const auth = require('../auth');

const router = express.Router();

const COMMON_PROCS = [
  'nginx', 'apache2', 'httpd', 'mysqld', 'mariadbd', 'mongod', 'redis-server',
  'postgresql', 'node', 'python', 'docker', 'containerd', 'php-fpm', 'sshd',
  'gunicorn', 'uwsgi', 'java', 'rabbitmq', 'memcached',
  'caddy', 'supervisord', 'cron', 'fail2ban', 'ufw', 'pm2', 'certbot'
];
const SERVICE_ALIASES = {
  'redis-server': 'redis',
  'mariadbd': 'mariadb',
  'mysqld': 'mysql',
  'php-fpm': 'php8.3-fpm',
  'rabbitmq': 'rabbitmq-server',
  'nginx-fpm': 'php-fpm'
};

function isRoot() {
  return typeof process.getuid === 'function' ? process.getuid() === 0 : true;
}

/**
 * runPriv: eksekusi command; jika proses panel bukan root, coba via `sudo -n`
 * (tanpa password). Gagal tetap dikembalikan beserta stderr-nya.
 */
function runPriv(cmd, args) {
  const exec = (file, cargs) => new Promise((resolve) => {
    execFile(file, cargs, { timeout: 20000 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout, stderr, err });
    });
  });
  if (isRoot()) return exec(cmd, args);
  return exec('sudo', ['-n', cmd, ...args]);
}

function directRun(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout, stderr, err });
    });
  });
}

router.get('/', async (req, res) => {
  const services = new Map();

  const sysd = await directRun('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--no-legend']);
  if (sysd.stdout) {
    for (const line of sysd.stdout.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4 && parts[0].endsWith('.service')) {
        const full = parts[0];
        const name = full.replace('.service', '');
        const active = parts[2], sub = parts[3];
        const state = active === 'active' || active === 'reloading' ? 'running' : sub === 'exited' ? 'exited' : 'stopped';
        const desc = line.replace(full, '').replace(/^.*?\S+\s+\S+\s+\S+/, '').trim();
        services.set(full, {
          name: full,
          shortName: name,
          description: desc || `${active} (${sub})`,
          state,
          type: 'systemd'
        });
      }
    }
  }

  const psOut = [];
  const ps = await directRun('ps', ['-eo', 'pid,comm,%cpu,%mem,cmd', '--no-headers']);
  if (ps.stdout) {
    for (const line of ps.stdout.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        psOut.push({ pid: parseInt(parts[0], 10), comm: parts[1], cpu: parts[2], mem: parts[3], cmd: parts.slice(4).join(' ') });
      }
    }
  }

  for (const proc of COMMON_PROCS) {
    const running = psOut.filter((p) => p.comm === proc || p.comm.startsWith(proc + ':'));
    if (running.length > 0 && !services.has(proc)) {
      const alias = SERVICE_ALIASES[proc] || proc;
      const hasSystemd = services.has(alias) || services.has(alias + '.service');
      if (hasSystemd) continue;
      services.set(proc, {
        name: proc,
        shortName: proc,
        description: `${proc} (${running.length} proses)`,
        state: 'running',
        type: 'process',
        pids: running.map((r) => r.pid),
        cpu: running.reduce((s, r) => s + parseFloat(r.cpu || 0), 0).toFixed(1),
        mem: running.reduce((s, r) => s + parseFloat(r.mem || 0), 0).toFixed(1)
      });
    }
  }

  const list = Array.from(services.values()).sort((a, b) => {
    if (a.state !== b.state) return a.state === 'running' ? -1 : 1;
    return a.shortName.localeCompare(b.shortName);
  });

  res.json({
    services: list,
    manageable: isRoot(),
    iAmRoot: isRoot(),
  });
});

router.post('/status', async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_.@:-]+$/.test(name)) {
    return res.status(400).json({ error: 'Nama layanan tidak valid' });
  }
  const unit = name.endsWith('.service') ? name : name + '.service';
  const result = await directRun('systemctl', ['status', unit, '--no-pager']);
  const out = (result.stdout || '').trim();
  if (!out) return res.status(400).json({ error: 'Tidak ada keluaran status' });
  res.json({ name: unit, output: out });
});

router.post('/action', auth.requireAdmin, async (req, res) => {
  const { name, action, type } = req.body || {};
  if (!name || !['start', 'stop', 'restart', 'status'].includes(action)) {
    return res.status(400).json({ error: 'Parameter name & action (start|stop|restart|status) wajib' });
  }
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_.@:-]+$/.test(name)) {
    return res.status(400).json({ error: 'Nama layanan tidak valid' });
  }

  // proses non-service (mis. pm2 tanpa unit systemd) tidak bisa dikontrol systemctl
  const unit = name.endsWith('.service') ? name : name + '.service';
  const known = await directRun('systemctl', ['list-unit-files', unit, '--no-pager', '--no-legend']);
  const isSystemdUnit = (known.stdout || '').trim().length > 0;

  if (!isSystemdUnit && action !== 'status') {
    return res.status(400).json({
      error: `${name} bukan unit systemd (layanan tanpa unit / berbasis proses). Kontrol lewat alat layanannya sendiri, mis. supervisor/pm2.`,
    });
  }

  const result = isSystemdUnit ? await runPriv('systemctl', [action, unit]) : { code: 1, stdout: '', stderr: 'unit tidak ditemukan' };

  if (action === 'status') {
    const out = (result.stdout || '').trim() || (result.stderr || '').trim();
    if (!out) return res.status(400).json({ error: 'Tidak ada keluaran status' });
    return res.json({ ok: true, name: unit, action, output: out });
  }
  if (result.code !== 0) {
    const err = (result.stderr || 'Operasi gagal').trim();
    const hint = !isRoot() && /password|not permitted|denied/i.test(err)
      ? ' — hak akses tidak cukup: pastikan user panel punya sudo NOPASSWD atau jalankan panel sebagai root.'
      : '';
    return res.status(400).json({ error: err + hint, code: result.code });
  }
  res.json({ ok: true, name: unit, action, output: result.stdout.trim() });
});

module.exports = router;
