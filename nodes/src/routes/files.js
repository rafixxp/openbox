const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const exec = (cmd, args, options = {}) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: options.timeout || 120000, cwd: options.cwd || process.cwd() }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout, stderr, err });
    });
  });

function safePath(base, target) {
  const baseAbs = path.resolve(base);
  const t = String(target ?? '').trim().replace(/^\/+/, '');
  if (t === '' || t === '.') return baseAbs;
  const resolved = path.resolve(baseAbs, t);
  const okPrefix = baseAbs === path.sep ? resolved.startsWith(path.sep) : resolved.startsWith(baseAbs + path.sep);
  if (!okPrefix && resolved !== baseAbs) {
    return null;
  }
  return resolved;
}

function getRoot(p) {
  if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  return process.env.PANEL_ROOT || os.homedir();
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
    const candidate = path.join(dir, `${base} (copy ${i})${ext}`);
    try {
      await fsp.access(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error('Tidak bisa menemukan nama unik');
}

router.get('/browse', async (req, res) => {
  try {
    const root = getRoot(req.query.root);
    const rel = req.query.path ? String(req.query.path) : '';
    const abs = safePath(root, rel || '.');
    if (!abs) return res.status(400).json({ error: 'Path tidak valid' });

    const entries = await fsp.readdir(abs, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (e) => {
        const full = path.join(abs, e.name);
        try {
          const st = await fsp.lstat(full);
          const item = {
            name: e.name,
            type: e.isDirectory() ? 'dir' : e.isSymbolicLink() ? 'symlink' : 'file',
            size: st.size,
            created: st.birthtime,
            modified: st.mtime,
            permissions: (st.mode & parseInt('777', 8)).toString(8),
            owner: null
          };
          if (e.isFile() && st.size < 20 * 1024 * 1024) {
            const ext = path.extname(e.name).toLowerCase();
            item.isText = ['.txt', '.js', '.json', '.css', '.html', '.htm', '.md', '.yml', '.yaml', '.conf', '.sh', '.log', '.env', '.php', '.py', '.ini', '.xml', '.ts', '.tsx', '.jsx', '.sql', '.toml', '', '.service', '.c', '.cpp', '.go', '.rb', '.rs'].includes(ext);
          }
          return item;
        } catch {
          return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', error: 'no-access' };
        }
      })
    );

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      root,
      path: rel || '/',
      absolute: abs,
      parent: rel ? path.posix.join('/', path.posix.dirname(rel), '/') : null,
      items
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/read', async (req, res) => {
  try {
    const root = getRoot(req.query.root);
    const abs = safePath(root, req.query.path);
    if (!abs) return res.status(400).json({ error: 'Path tidak valid' });
    const st = await fsp.stat(abs);
    if (st.isDirectory()) return res.status(400).json({ error: 'Bukan file' });
    const isText = req.query.binary === '1'
      ? false
      : (path.extname(abs).toLowerCase() !== '' || st.size < 2 * 1024 * 1024);
    const buf = await fsp.readFile(abs);
    const printable = buf.slice(0, 8000).every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b > 127);
    if (!printable) {
      return res.status(415).json({ error: 'File biner, tidak bisa diedit' });
    }
    res.json({ path: req.query.path, content: buf.toString('utf8'), size: st.size, modified: st.mtime });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const abs = safePath(root, req.body.path);
    if (!abs) return res.status(400).json({ error: 'Path tidak valid' });
    await fsp.writeFile(abs, String(req.body.content ?? ''), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const abs = safePath(root, req.body.path);
    if (!abs) return res.status(400).json({ error: 'Path tidak valid' });
    try {
      await fsp.access(abs);
      return res.status(409).json({ error: 'Sudah ada' });
    } catch {
      /* belum ada, lanjut */
    }
    if (req.body.type === 'dir') {
      await fsp.mkdir(abs, { recursive: true });
    } else {
      await fsp.writeFile(abs, '', 'utf8');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/rename', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const from = safePath(root, req.body.from);
    const to = safePath(root, req.body.to);
    if (!from || !to) return res.status(400).json({ error: 'Path tidak valid' });
    await fsp.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const abs = safePath(root, req.body.path);
    if (!abs || abs === path.resolve(root)) return res.status(400).json({ error: 'Path tidak valid' });
    const st = await fsp.lstat(abs);
    if (st.isDirectory()) await fsp.rm(abs, { recursive: true, force: true });
    else await fsp.unlink(abs);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const abs = safePath(root, req.body.path);
    if (!abs) return res.status(400).json({ error: 'Path tidak valid' });
    await fsp.writeFile(abs, req.file.buffer);
    res.json({ ok: true, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/download', (req, res) => {
  const root = getRoot(req.query.root);
  const abs = safePath(root, req.query.path);
  if (!abs) return res.status(400).json({ error: 'Path tidak valid' });
  res.download(abs, path.basename(abs), (err) => {
    if (err && !res.headersSent) res.status(400).json({ error: err.message });
  });
});

router.post('/copy', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const from = safePath(root, req.body.from);
    if (!from || !fs.existsSync(from)) return res.status(400).json({ error: 'Sumber tidak ada' });
    let to = safePath(root, req.body.to);
    if (!to) return res.status(400).json({ error: 'Path tujuan tidak valid' });
    if (fs.existsSync(to)) to = await uniquePath(to);
    await exec('cp', ['-a', from, to]);
    res.json({ ok: true, to: path.basename(to) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/move', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const from = safePath(root, req.body.from);
    if (!from || !fs.existsSync(from)) return res.status(400).json({ error: 'Sumber tidak ada' });
    let to = safePath(root, req.body.to);
    if (!to) return res.status(400).json({ error: 'Path tujuan tidak valid' });
    if (fs.existsSync(to)) to = await uniquePath(to);
    await exec('mv', [from, to]);
    res.json({ ok: true, to: path.basename(to) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/compress', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const abs = safePath(root, req.body.path);
    if (!abs || !fs.existsSync(abs)) return res.status(400).json({ error: 'Path tidak ada' });
    const parent = path.dirname(abs);
    const base = path.basename(abs);
    let format = req.body.format === 'zip' ? 'zip' : 'targz';

    if (!req.body.path) return res.status(400).json({ error: 'Path wajib' });
    let out;
    let result;
    if (format === 'zip') {
      const zipCheck = await exec('which', ['zip']);
      if (zipCheck.code !== 0) {
        format = 'targz';
      } else {
        out = abs + '.zip';
        if (fs.existsSync(out)) return res.status(409).json({ error: 'File output sudah ada' });
        result = await exec('zip', ['-r', out, base], { cwd: parent });
      }
    }
    if (format !== 'zip') {
      out = abs + '.tar.gz';
      if (fs.existsSync(out)) return res.status(409).json({ error: 'File output sudah ada' });
      result = await exec('tar', ['-czf', out, '-C', parent, base]);
    }
    if (result.code !== 0) {
      await fsp.unlink(out).catch(() => {});
      return res.status(400).json({ error: ('Gagal mengarsipkan: ' + (result.stderr || result.stdout)).trim() });
    }
    const st = await fsp.stat(out);
    res.json({ ok: true, output: path.basename(out), size: st.size, format });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/extract', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const abs = safePath(root, req.body.path);
    if (!abs || !fs.existsSync(abs)) return res.status(400).json({ error: 'Path tidak ada' });
    const parent = path.dirname(abs);
    const ext = path.extname(abs).toLowerCase();
    const base = path.basename(abs);
    if (!/\.(zip|tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz)$/.test(base.toLowerCase())) {
      return res.status(400).json({ error: 'Format arsip tidak didukung (zip/tar/tar.gz/tgz/xz)' });
    }
    let dest;
    if (req.body.dest && String(req.body.dest).trim()) {
      dest = safePath(root, String(req.body.dest).trim());
      if (!dest) return res.status(400).json({ error: 'Destinasi tidak valid' });
    }
    if (!dest) dest = path.join(parent, base.replace(/\.(zip|tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz)$/i, '') + '_extracted');
    dest = await uniquePath(dest);
    await fsp.mkdir(dest, { recursive: true });
    let result;
    if (base.toLowerCase().endsWith('.zip')) {
      const unzipCheck = await exec('which', ['unzip']);
      if (unzipCheck.code !== 0) return res.status(400).json({ error: 'unzip tidak terpasang. install: sudo apt install unzip' });
      result = await exec('unzip', ['-o', '-q', abs, '-d', dest]);
    } else if (ext === '.gz' && !base.toLowerCase().endsWith('.tar.gz')) {
      result = await exec('gzip', ['-d', '-k', '-f', abs]);
    } else {
      result = await exec('tar', ['-xf', abs, '-C', dest], { timeout: 300000 });
    }
    if (result.code !== 0) {
      return res.status(400).json({ error: ('Gagal ekstrak: ' + (result.stderr || result.stdout)).trim() });
    }
    let files = await fsp.readdir(dest).catch(() => []);
    if (!req.body.dest && ext === '.gz' && !base.toLowerCase().endsWith('.tar.gz')) files = [base.replace(/\.gz$/i, '')];
    res.json({ ok: true, dest: path.basename(dest), files: files.slice(0, 50) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/chmod', async (req, res) => {
  try {
    const root = getRoot(req.body.root);
    const abs = safePath(root, req.body.path);
    const mode = String(req.body.mode || '').trim();
    if (!abs || !fs.existsSync(abs)) return res.status(400).json({ error: 'Path tidak ada' });
    if (!/^[0-7]{3,4}$/.test(mode)) return res.status(400).json({ error: 'Mode harus okal, contoh: 644 atau 755' });
    if (req.body.recursive && fs.statSync(abs).isDirectory()) {
      const result = await exec('chmod', ['-R', mode, abs]);
      if (result.code !== 0) return res.status(400).json({ error: 'chmod gagal: ' + result.stderr.trim() });
    } else {
      await fsp.chmod(abs, parseInt(mode, 8));
    }
    const st = await fsp.stat(abs);
    res.json({ ok: true, mode: (st.mode & parseInt('777', 8)).toString(8).padStart(3, '0') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/du', async (req, res) => {
  try {
    const root = getRoot(req.query.root);
    const abs = safePath(root, req.query.path);
    if (!abs || !fs.existsSync(abs)) return res.status(400).json({ error: 'Path tidak ada' });
    const result = await exec('du', ['-s', '-b', abs], { timeout: 60000 });
    if (result.code !== 0) return res.status(400).json({ error: 'du gagal: ' + result.stderr.trim() });
    const bytes = parseInt(result.stdout.split('\t')[0], 10);
    res.json({ path: req.query.path, bytes });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'];
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.bmp': 'image/bmp' };

router.get('/preview', async (req, res) => {
  try {
    const root = getRoot(req.query.root);
    const abs = safePath(root, req.query.path);
    if (!abs || !fs.existsSync(abs)) return res.status(400).json({ error: 'Path tidak ada' });
    const ext = path.extname(abs).toLowerCase();
    if (!IMAGE_EXT.includes(ext)) return res.status(415).json({ error: 'Bukan file gambar' });
    const st = await fsp.stat(abs);
    if (st.size > 10 * 1024 * 1024) return res.status(400).json({ error: 'Gambar terlalu besar (>10MB)' });
    const buf = await fsp.readFile(abs);
    res.json({ mime: IMAGE_MIME[ext], data: `data:${IMAGE_MIME[ext]};base64,${buf.toString('base64')}`, size: st.size, name: path.basename(abs) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
