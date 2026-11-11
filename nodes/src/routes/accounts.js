const express = require('express');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const auth = require('../auth');

const router = express.Router();

const SYSTEM_SHELLS = ['/usr/sbin/nologin', '/sbin/nologin', '/bin/false'];
const MIN_UID = Number(process.env.PANEL_MIN_UID || 1000);
const NAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/i;

function managedUser(name) {
  if (!NAME_RE.test(String(name || ''))) return null;
  return readPasswd().find((u) => u.name === name && u.uid >= MIN_UID) || null;
}

function sudoGroupName() {
  const groups = readGroup();
  return (groups.find((g) => ['sudo', 'wheel', 'admin'].includes(g.name)) || {}).name || null;
}

function exec(cmd, args, options = {}) {
  const needsRoot = typeof process.getuid === 'function' && process.getuid() !== 0;
  if (needsRoot) args = ['-n', cmd, ...args];
  return new Promise((resolve) => {
    execFile(needsRoot ? 'sudo' : cmd, args, { timeout: options.timeout || 60000 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr, err });
    });
  });
}

function runRoot(cmd, args) {
  // exec() menangani penebusan hak root (sudo -n) bila proses bukan root
  return exec(cmd, args, { timeout: 90000 });
}

function readPasswd() {
  return fs.readFileSync('/etc/passwd', 'utf8').split('\n').filter(Boolean).map((line) => {
    const [name, , uid, gid, gecos, home, shell] = line.split(':');
    return { name, uid: Number(uid), gid: Number(gid), gecos, home, shell };
  });
}

function readGroup() {
  return fs.readFileSync('/etc/group', 'utf8').split('\n').filter(Boolean).map((line) => {
    const [name, , gid, members] = line.split(':');
    return { name, gid: Number(gid), members: (members || '').split(',').filter(Boolean) };
  });
}

async function lockStates(names) {
  const states = {};
  for (const n of names) states[n] = null;
  const r = await exec('passwd', ['-S', ...names], { timeout: 30000 });
  if (r.code !== 0) return states;
  for (const line of r.stdout.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && states[parts[0]] !== undefined) {
      const st = parts[1];
      states[parts[0]] = st === 'NP' ? 'none' : st === 'P' ? 'open' : 'locked';
    }
  }
  return states;
}

function isSudo(groups) {
  return ['sudo', 'wheel', 'admin'].some((g) => groups.includes(g));
}

router.get('/', auth.requireAdmin, async (req, res) => {
  try {
    const passwd = readPasswd();
    const users = passwd.filter((u) => u.uid >= MIN_UID);
    const names = users.map((u) => u.name);
    const states = await lockStates(names);
    const result = users.map((u) => {
      const groups = readGroup().filter((g) => g.members.includes(u.name) || g.gid === u.gid).map((g) => g.name);
      return {
        name: u.name,
        uid: u.uid,
        gid: u.gid,
        gecos: u.gecos,
        home: u.home,
        shell: u.shell,
        status: states[u.name],
        sudo: isSudo(groups),
        groups,
        loginable: !SYSTEM_SHELLS.includes(u.shell) && states[u.name] !== 'locked',
      };
    });
    res.json({ users: result, root: os.userInfo().username, iAmRoot: typeof process.getuid !== 'function' || process.getuid() === 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth.requireAdmin, async (req, res) => {
  const b = req.body || {};
  try {
    if (!NAME_RE.test(b.name || '')) return res.status(400).json({ error: 'Nama akun tidak valid (huruf/angka/_)' });
    if (readPasswd().some((u) => u.name === b.name)) return res.status(409).json({ error: 'Nama akun sudah dipakai' });
    if (!b.password || String(b.password).length < 8) return res.status(400).json({ error: 'Password wajib diisi (minimal 8 karakter)' });
    if (/[:\\r\\n]/.test(String(b.password))) return res.status(400).json({ error: 'Password tidak boleh mengandung titik dua atau baris baru' });

    const shell = String(b.shell || '/bin/bash');
    const validShells = fs.existsSync('/etc/shells')
      ? fs.readFileSync('/etc/shells', 'utf8').split('\n').map((v) => v.trim()).filter((v) => v.startsWith('/'))
      : ['/bin/bash', '/bin/sh'];
    if (!validShells.includes(shell) || SYSTEM_SHELLS.includes(shell)) return res.status(400).json({ error: 'Shell tidak valid atau tidak dapat digunakan untuk login' });

    const groups = String(b.groups || '').trim();
    if (groups) {
      const available = new Set(readGroup().map((g) => g.name));
      const requested = groups.split(',').map((g) => g.trim()).filter(Boolean);
      if (!requested.length || requested.some((g) => !/^[a-zA-Z0-9_.-]+$/.test(g) || !available.has(g))) {
        return res.status(400).json({ error: 'Satu atau beberapa grup tidak valid / tidak tersedia' });
      }
      if (!b.sudo && requested.some((g) => ['sudo', 'wheel', 'admin'].includes(g))) {
        return res.status(400).json({ error: 'Gunakan opsi akses sudo untuk memberi hak administrator' });
      }
    }

    const args = ['-m', '-s', shell];
    if (b.gecos) args.push('-c', String(b.gecos).slice(0, 200));
    if (groups) args.push('-G', groups);
    args.push('--', b.name);

    let r = await runRoot('useradd', args);
    if (r.code !== 0) return res.status(500).json({ error: (r.stderr || 'useradd gagal').trim() });

    {
      const pr = await new Promise((resolve) => {
        const { spawn } = require('child_process');
        const needsRoot = typeof process.getuid === 'function' && process.getuid() !== 0;
        const child = spawn(needsRoot ? 'sudo' : 'chpasswd', needsRoot ? ['-n', 'chpasswd'] : [], { timeout: 30000 });
        let stderr = '';
        child.stderr.on('data', (c) => { stderr += c; });
        child.on('close', (code) => resolve({ code, stderr }));
        child.stdin.write(`${b.name}:${b.password}\n`);
        child.stdin.end();
      });
      if (pr.code !== 0) {
        await runRoot('userdel', ['-r', '--', b.name]);
        return res.status(500).json({ error: (pr.stderr || 'gagal set password; akun dibatalkan').trim() });
      }
    }
    if (b.sudo) {
      const group = sudoGroupName();
      if (!group) {
        await runRoot('userdel', ['-r', '--', b.name]);
        return res.status(500).json({ error: 'Grup sudo/wheel tidak ditemukan; akun dibatalkan' });
      }
      const s = await runRoot('usermod', ['-aG', group, '--', b.name]);
      if (s.code !== 0) {
        await runRoot('userdel', ['-r', '--', b.name]);
        return res.status(500).json({ error: (s.stderr || 'gagal set sudo; akun dibatalkan').trim() });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:name', auth.requireAdmin, async (req, res) => {
  const name = req.params.name;
  const b = req.body || {};
  try {
    const exists = managedUser(name);
    if (!exists) return res.status(404).json({ error: 'Akun tidak ditemukan atau akun sistem dilindungi' });

    const mods = [];
    if (b.gecos !== undefined) mods.push(['-c', String(b.gecos)]);
    if (b.shell) mods.push(['-s', String(b.shell)]);
    if (b.home) mods.push(['-d', String(b.home)]);
    for (const m of mods) {
      const r = await runRoot('usermod', [...m, '--', name]);
      if (r.code !== 0) return res.status(500).json({ error: (r.stderr || 'usermod gagal').trim() });
    }

    if (b.sudo !== undefined) {
      if (b.sudo) {
        const group = sudoGroupName();
        if (!group) return res.status(400).json({ error: 'Grup sudo/wheel tidak ditemukan' });
        const r = await runRoot('usermod', ['-aG', group, '--', name]);
        if (r.code !== 0) return res.status(500).json({ error: (r.stderr || 'gagal set sudo').trim() });
      } else {
        const groups = readGroup();
        const sudoGroup = sudoGroupName();
        if (sudoGroup) {
          const keep = groups.filter((g) => g.members.includes(name)).map((g) => g.name).filter((g) => g !== sudoGroup);
          const r = await runRoot('usermod', ['-G', keep.join(','), '--', name]);
          if (r.code !== 0) return res.status(500).json({ error: (r.stderr || 'gagal mencabut sudo').trim() });
        }
      }
    }

    if (b.locked !== undefined) {
      const r = await runRoot(b.locked ? 'usermod' : 'usermod', b.locked ? ['-L', '--', name] : ['-U', '--', name]);
      if (r.code !== 0) return res.status(500).json({ error: (r.stderr || 'gagal ubah lock').trim() });
    }

    if (b.password) {
      if (String(b.password).length < 8 || /[:\\r\\n]/.test(String(b.password))) {
        return res.status(400).json({ error: 'Password minimal 8 karakter dan tidak boleh mengandung titik dua / baris baru' });
      }
      const { spawn } = require('child_process');
      const needsRoot = typeof process.getuid === 'function' && process.getuid() !== 0;
      const pr = await new Promise((resolve) => {
        const child = spawn(needsRoot ? 'sudo' : 'chpasswd', needsRoot ? ['-n', 'chpasswd'] : [], { timeout: 30000 });
        let stderr = '';
        child.stderr.on('data', (c) => { stderr += c; });
        child.on('close', (code) => resolve({ code, stderr }));
        child.stdin.write(`${name}:${b.password}\n`);
        child.stdin.end();
      });
      if (pr.code !== 0) return res.status(500).json({ error: (pr.stderr || 'gagal set password').trim() });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:name', auth.requireAdmin, async (req, res) => {
  const name = req.params.name;
  try {
    if (name === req.user) return res.status(400).json({ error: 'Tidak bisa menghapus akun yang sedang login' });
    if (!managedUser(name)) return res.status(404).json({ error: 'Akun tidak ditemukan atau akun sistem dilindungi' });
    const cmdArgs = req.query.removeHome === '1' ? ['-r', '--'] : ['--'];
    const r = await runRoot('userdel', cmdArgs.concat(name));
    if (r.code !== 0) return res.status(500).json({ error: (r.stderr || 'userdel gagal').trim() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
