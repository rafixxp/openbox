const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const router = express.Router();

const NGINX_SITES_AVAILABLE = ['/etc/nginx/sites-available', '/etc/nginx/conf.d'];
const NGINX_SITES_ENABLED = '/etc/nginx/sites-enabled';
const WEB_ROOT = '/var/www';

function run(cmd, args, options = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: options.timeout || 60000, cwd: options.cwd || '/', ...options }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout, stderr, err });
    });
  });
}

function findSitesDir() {
  for (const dir of NGINX_SITES_AVAILABLE) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
  }
  return null;
}

router.get('/', async (req, res) => {
  const sitesDir = findSitesDir();
  const enabled = new Set();
  if (fs.existsSync(NGINX_SITES_ENABLED)) {
    for (const f of fs.readdirSync(NGINX_SITES_ENABLED)) enabled.add(f);
  }

  let sites = {};
  if (sitesDir) {
    for (const f of fs.readdirSync(sitesDir)) {
      const abs = path.join(sitesDir, f);
      if (!fs.statSync(abs).isFile()) continue;
      const content = fs.readFileSync(abs, 'utf8');
      const rootMatch = content.match(/root\s+([^;]+);/);
      const serverName = content.match(/server_name\s+([^;]+);/);
      const listen = content.match(/listen\s+([^;]+);/);
      sites[path.join(sitesDir, f)] = {
        filename: f,
        file: path.join(sitesDir, f),
        enabled: enabled.has(f) || enabled.has(path.basename(f)),
        root: rootMatch ? rootMatch[1].trim() : null,
        serverName: serverName ? serverName[1].trim() : null,
        listen: listen ? listen[1].trim() : null
      };
    }
  }

  let webDirs = [];
  if (fs.existsSync(WEB_ROOT)) {
    webDirs = fs.readdirSync(WEB_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => ({
      name: d.name,
      path: path.join(WEB_ROOT, d.name),
      hasGit: fs.existsSync(path.join(WEB_ROOT, d.name, '.git')),
      size: null
    }));
    for (const dir of webDirs) {
      try {
        const st = await fsp.stat(dir.path);
        dir.created = st.birthtime;
      } catch {}
      if (dir.hasGit) {
        const info = await run('git', ['-C', dir.path, 'remote', 'get-url', 'origin']);
        dir.gitUrl = info.stdout ? info.stdout.trim() : null;
        const branch = await run('git', ['-C', dir.path, 'rev-parse', '--abbrev-ref', 'HEAD']);
        dir.branch = branch.stdout ? branch.stdout.trim() : null;
      }
    }
  }

  const nginxCheck = await run('systemctl', ['is-active', 'nginx']);
  res.json({
    nginxActive: nginxCheck.stdout.trim() === 'active',
    nginxSitesDir: sitesDir,
    sites: Object.values(sites),
    webDirs
  });
});

function isNginxConfAllowed(file) {
  return NGINX_SITES_AVAILABLE.some((dir) => file === path.join(dir, path.basename(file)));
}

router.get('/git-info', async (req, res) => {
  const dir = req.query.dir;
  if (!isWebDirSafe(dir) || !fs.existsSync(path.join(dir, '.git'))) {
    return res.json({ hasGit: false });
  }
  const [remote, branch, log, status] = await Promise.all([
    run('git', ['-C', dir, 'remote', 'get-url', 'origin'], { timeout: 10000 }),
    run('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 10000 }),
    run('git', ['-C', dir, 'log', '--oneline', '-5', '--pretty=format:%h %ad %s', '--date=short'], { timeout: 10000 }),
    run('git', ['-C', dir, 'status', '--porcelain'], { timeout: 10000 })
  ]);
  res.json({
    hasGit: true,
    gitUrl: remote.code === 0 ? remote.stdout.trim() : null,
    branch: branch.stdout.trim(),
    log: log.stdout.split('\n').filter(Boolean),
    changes: status.stdout ? status.stdout.trim().split('\n').filter(Boolean) : []
  });
});

router.post('/git-pull', async (req, res) => {
  const { dir } = req.body;
  if (!isWebDirSafe(dir) || !fs.existsSync(dir + '/.git')) return res.status(400).json({ error: 'Direktori bukan repo git' });
  const pull = await run('git', ['-C', dir, 'pull'], { timeout: 300000 });
  res.json({
    ok: pull.code === 0,
    output: ((pull.stdout || '') + (pull.stderr || '')).trim()
  });
});

function isWebDirSafe(dir) {
  return typeof dir === 'string' && path.resolve(dir).startsWith(WEB_ROOT + '/');
}

function isNginxConfAllowed(file) {
  return NGINX_SITES_AVAILABLE.some((dir) => file === path.join(dir, path.basename(file)));
}

router.post('/toggle', async (req, res) => {
  const { file, enable } = req.body;
  if (!file || !isNginxConfAllowed(file)) return res.status(400).json({ error: 'File harus di direktori sites nginx' });
  if (!fs.existsSync(NGINX_SITES_ENABLED)) return res.status(400).json({ error: 'site-enabled tidak ditemukan' });
  const link = path.join(NGINX_SITES_ENABLED, path.basename(file));
  if (enable) {
    if (!fs.existsSync(link)) {
      const ln = await run('ln', ['-s', file, link]);
      if (ln.code !== 0) return res.status(400).json({ error: 'Gagal symlink: ' + (ln.stderr || '').trim() });
    }
  } else if (fs.existsSync(link)) {
    await fsp.unlink(link).catch(() => {});
  }
  const test = await run('nginx', ['-t']);
  if (test.code !== 0) {
    return res.status(400).json({ error: 'Konfigurasi nginx tidak valid: ' + (test.stderr || '').trim() });
  }
  const reload = await run('systemctl', ['reload', 'nginx']);
  res.json({ ok: reload.code === 0, enabled: enable, nginxReloadOutput: (reload.stderr || reload.stdout).trim() });
});

router.get('/config', async (req, res) => {
  try {
    const file = req.query.file;
    if (!file || !isNginxConfAllowed(file) || !fs.existsSync(file)) throw new Error('invalid');
    res.json({ file, content: fs.readFileSync(file, 'utf8') });
  } catch (err) {
    res.status(400).json({ error: 'File tidak ditemukan' });
  }
});

router.post('/config', async (req, res) => {
  try {
    if (!req.body.file || !isNginxConfAllowed(req.body.file)) {
      return res.status(400).json({ error: 'Hanya file di sites-available yang boleh diubah' });
    }
    await fsp.writeFile(req.body.file, req.body.content, 'utf8');
    const reload = await run('systemctl', ['reload', 'nginx']);
    res.json({ ok: reload.code === 0, nginxReloadOutput: (reload.stderr || reload.stdout).trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/nginx-test', async (req, res) => {
  const test = await run('nginx', ['-t']);
  res.json({
    ok: test.code === 0,
    output: ((test.stdout || '') + (test.stderr || '')).trim() || 'OK'
  });
});

router.post('/git-clone', async (req, res) => {
  const { dir, gitUrl, branch } = req.body;
  if (!isWebDirSafe(dir)) return res.status(400).json({ error: 'Direktori harus di dalam /var/www' });
  if (!gitUrl || !/^https?:\/\/|\.git$|git@/.test(gitUrl)) return res.status(400).json({ error: 'Git URL tidak valid' });

  let entries = [];
  try { entries = await fsp.readdir(dir); } catch { entries = []; }

  if (entries.length === 0) {
    const args = branch ? ['clone', '-b', branch, gitUrl, dir] : ['clone', gitUrl, dir];
    const res1 = await run('git', args, { timeout: 300000, cwd: WEB_ROOT });
    if (res1.code === 0) return res.json({ ok: true, output: (res1.stdout + res1.stderr).trim() });
    const fallback = await run('git', ['clone', gitUrl, dir], { timeout: 300000, cwd: WEB_ROOT });
    if (fallback.code !== 0) return res.status(400).json({ error: 'Clone gagal: ' + ((fallback.stderr + res1.stderr).trim().slice(0, 500)) });
    return res.json({ ok: true, output: (fallback.stdout + fallback.stderr).trim() });
  }

  if (fs.existsSync(path.join(dir, '.git'))) {
    return res.status(409).json({ error: 'Folder sudah punya .git' });
  }

  const init = await run('git', ['-C', dir, 'init']);
  const remoteAdd = await run('git', ['-C', dir, 'remote', 'add', 'origin', gitUrl], { timeout: 15000 });
  if (init.code !== 0 || remoteAdd.code !== 0) {
    return res.status(400).json({ error: 'Git init gagal: ' + ((init.stderr + remoteAdd.stderr).trim().slice(0, 400)) });
  }
  const fetch = await run('git', ['-C', dir, 'fetch', 'origin'], { timeout: 300000 });
  if (fetch.code !== 0) {
    return res.status(400).json({ error: 'Fetch gagal: ' + fetch.stderr.trim().slice(0, 500) });
  }
  const br = branch || 'main';
  const checkout = await run('git', ['-C', dir, 'checkout', '-B', br, `origin/${br}`], { timeout: 60000 });
  if (checkout.code !== 0) {
    const co2 = await run('git', ['-C', dir, 'checkout', '-B', br, 'origin/HEAD'], { timeout: 60000 });
    if (co2.code !== 0) {
      return res.status(400).json({ error: `Branch ${br} tidak ada / checkout gagal: ` + (co2.stderr + checkout.stderr).trim().slice(0, 400) });
    }
  }
  res.json({ ok: true, output: ('Repo terhubung dari folder existing: ' + (fetch.stdout + fetch.stderr).trim().slice(0, 300)) });
});

router.post('/create', async (req, res) => {
  const { name, serverName, gitUrl, branch, port, root } = req.body;
  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    return res.status(400).json({ error: 'Nama website tidak valid (a-z, 0-9, ., _, -)' });
  }

  const sitesDir = findSitesDir();
  if (!sitesDir) return res.status(400).json({ error: 'Direktori sites-available nginx tidak ditemukan' });

  const confFile = path.join(sitesDir, name);
  if (fs.existsSync(confFile)) return res.status(409).json({ error: 'File konfigurasi sudah ada' });

  const docroot = root || path.join(WEB_ROOT, name);
  let gitInfo = { configured: true, added: null };

  if (gitUrl) {
    const clone = await run('git', ['clone', '-b', branch || 'main', gitUrl, docroot], { timeout: 300000 });
    if (clone.code !== 0) {
      const fallback = await run('git', ['clone', gitUrl, docroot], { timeout: 300000 });
      if (fallback.code !== 0) {
        return res.status(400).json({ error: 'Git clone gagal: ' + ((fallback.stderr || '') + clone.stderr).trim().slice(0, 400) });
      }
    }
  } else {
    await fsp.mkdir(docroot, { recursive: true });
    await fsp.writeFile(path.join(docroot, 'index.html'), `<!doctype html><html><head><title>${name}</title></head><body><h1>${name}</h1><p>Sudah terpasang via NodePanel.</p></body></html>`, 'utf8');
  }

  const listenPort = port || 80;
  const conf = `server {
  listen ${listenPort};
  listen [::]:${listenPort};
  server_name ${serverName || `${name}.local`};
  root ${docroot};
  index index.html index.htm index.php index.js;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~ \\.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php-fpm.sock;
  }
}
`;
  await fsp.writeFile(confFile, conf, 'utf8');

  if (fs.existsSync(NGINX_SITES_ENABLED)) {
    const link = path.join(NGINX_SITES_ENABLED, name);
    if (!fs.existsSync(link)) {
      const ln = await run('ln', ['-s', confFile, link]);
      if (ln.code === 0) gitInfo.added = link;
    }
  }

  const test = await run('nginx', ['-t']);
  if (test.code !== 0) {
    await fsp.unlink(confFile).catch(() => {});
    return res.status(400).json({ error: 'Konfigurasi nginx tidak valid: ' + (test.stderr || '').trim() });
  }

  const reload = await run('systemctl', ['reload', 'nginx']);
  res.json({
    ok: true,
    name,
    configFile: confFile,
    docroot,
    nginxReloaded: reload.code === 0,
    nginxReloadOutput: (reload.stderr || reload.stdout).trim(),
    ...gitInfo
  });
});

router.post('/delete', async (req, res) => {
  const { file, dir, deleteDir } = req.body;
  const results = {};
  if (file) {
    if (!isNginxConfAllowed(file)) return res.status(400).json({ error: 'File harus di direktori sites nginx' });
    if (fs.existsSync(file)) await fsp.unlink(file).catch(() => {});
    results.configRemoved = true;
    const enabledLink = path.join(NGINX_SITES_ENABLED, path.basename(file));
    if (fs.existsSync(enabledLink)) {
      await fsp.unlink(enabledLink).catch(() => {});
      results.enabledLinkRemoved = true;
    }
    const reload = await run('systemctl', ['reload', 'nginx']);
    results.nginxReloaded = reload.code === 0;
  }
  if (dir && deleteDir) {
    if (!isWebDirSafe(dir)) return res.status(400).json({ error: 'Tidak boleh menghapus di luar /var/www' });
    await fsp.rm(dir, { recursive: true, force: true });
    results.docrootRemoved = true;
  }
  res.json({ ok: true, ...results });
});

module.exports = router;
