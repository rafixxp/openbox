/**
 * Endpoint upload dengan batas 100MB/file.
 *
 * Router ini dipasang sebelum routes/files.js. Hanya menangani POST /upload;
 * request lain diteruskan ke router lama lewat next(), sehingga perilaku file
 * manager yang sudah ada tidak berubah.
 */
const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const multer = require('multer');
const { isAdminUser } = require('../auth');

const router = express.Router();
const MAX_UPLOAD = 100 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD, files: 1 },
});

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

function uploadOne(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Ukuran file melebihi batas 100MB/file' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Upload hanya satu file per request' });
    }
    return res.status(400).json({ error: err.message || 'Upload gagal' });
  });
}

router.post('/upload', uploadOne, handleUpload);

async function handleUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
    if (req.file.size > MAX_UPLOAD) {
      return res.status(413).json({ error: 'Ukuran file melebihi batas 100MB/file' });
    }
    const root = resolveRoot(req, req.body.root);
    const abs = safePath(root, req.body.path || req.file.originalname);
    if (!abs) return res.status(400).json({ error: 'Path tidak valid' });
    res.locals.auditTarget = abs;
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, req.file.buffer);
    res.json({ ok: true, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { router, uploadHandler: [uploadOne, handleUpload], MAX_UPLOAD };
