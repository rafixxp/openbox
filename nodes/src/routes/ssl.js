const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const auth = require('../auth');

const exec = (cmd, args, options = {}) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: options.timeout || 120000 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout, stderr, err });
    });
  });

function isRoot() {
  return typeof process.getuid === 'function' ? process.getuid() === 0 : true;
}

function execPriv(cmd, args, options = {}) {
  if (isRoot()) return exec(cmd, args, options);
  return exec('sudo', ['-n', cmd, ...args], options);
}

const router = express.Router();
const LIVE_DIR = '/etc/letsencrypt/live';

router.get('/certs', async (req, res) => {
  const certs = [];
  if (fs.existsSync(LIVE_DIR)) {
    for (const entry of fs.readdirSync(LIVE_DIR)) {
      const info = await certInfo(entry);
      if (info) certs.push(info);
    }
  }
  const certbotCheck = await exec('certbot', ['--version']);
  res.json({
    certs,
    certbotInstalled: certbotCheck.code === 0 && (certbotCheck.stdout || certbotCheck.stderr).toLowerCase().includes('certbot'),
    certbotVersion: (certbotCheck.stdout + certbotCheck.stderr).trim()
  });
});

router.get('/info', async (req, res) => {
  const domain = String(req.query.domain || '').trim();
  if (!domain) return res.status(400).json({ error: 'Parameter domain wajib' });
  const candidates = [domain, domain.split('.')[0]];
  for (const name of candidates) {
    const info = await certInfo(name);
    if (info) return res.json(info);
  }
  res.json({ found: false, domain });
});

router.post('/renew', auth.requireAdmin, async (req, res) => {
  const certName = String(req.body.certName || '').trim();
  if (!certName || !/^[a-zA-Z0-9._-]+$/.test(certName)) {
    return res.status(400).json({ error: 'certName tidak valid' });
  }
  const result = await execPriv('certbot', ['renew', '--cert-name', certName, '--non-interactive'], { timeout: 300000 });
  res.json({
    ok: result.code === 0,
    output: ((result.stdout || '') + '\n' + (result.stderr || '')).trim()
  });
});

router.post('/issue', auth.requireAdmin, async (req, res) => {
  const domain = String(req.body.domain || '').trim();
  const email = String(req.body.email || '').trim();
  // domain dipakai sebagai argumen CLI & nama folder certbot → wajib karakter aman
  if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return res.status(400).json({ error: 'Domain tidak valid' });
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Email tidak valid' });
  }
  const args = ['--nginx', '-d', domain, '--non-interactive', '--agree-tos'];
  if (email) args.push('-m', email);
  else args.push('--register-unsafely-without-email');
  const result = await execPriv('certbot', args, { timeout: 300000 });
  res.json({
    ok: result.code === 0,
    output: ((result.stdout || '') + '\n' + (result.stderr || '')).trim()
  });
});

async function certInfo(name) {
  const dir = path.join(LIVE_DIR, name);
  const cert = path.join(dir, 'fullchain.pem');
  if (!fs.existsSync(cert)) return null;
  const result = await exec('openssl', ['x509', '-noout', '-subject', '-issuer', '-dates', '-in', cert]);
  if (result.code !== 0) {
    return { found: true, certName: name, dir, error: 'Tidak bisa membaca sertifikat' };
  }
  const out = result.stdout;
  const subject = (out.match(/subject=(.*)/) || [])[1] || '';
  const issuer = (out.match(/issuer=(.*)/) || [])[1] || '';
  const notBefore = (out.match(/notBefore=(.*)/) || [])[1];
  const notAfter = (out.match(/notAfter=(.*)/) || [])[1];
  let daysLeft = null;
  if (notAfter) {
    const expiry = new Date(notAfter);
    daysLeft = Math.floor((expiry - new Date()) / 86400000);
  }
  return {
    found: true,
    certName: name,
    dir,
    subject,
    issuer,
    notBefore,
    notAfter,
    daysLeft
  };
}

module.exports = router;
