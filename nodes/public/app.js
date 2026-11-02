/* NodePanel frontend — SPA */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const STATE = {
  filesRoot: localStorage.getItem('np-root') || '',
  filesPath: localStorage.getItem('np-path') || '/',
};

let ME = null;

async function api(url, options) {
  const res = await fetch(url, options);
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401) { location.href = '/login'; throw new Error('Sesi berakhir'); }
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toast-area').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function fmtBytes(bytes, digits = 1) {
  if (bytes === null || bytes === undefined) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = Number(bytes);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function modal({ title, body, footer, wide }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal ${wide ? 'modal-wide' : ''}">
        <div class="modal-header">${title ?? esc(title)}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">${footer || ''}</div>
      </div>
    </div>`;
  return root;
}

function closeModal() { $('#modal-root').innerHTML = ''; }

/* ============ DASHBOARD ============ */
async function renderDashboard(el) {
  el.innerHTML = `<div class="empty"><span class="spinner"></span>&nbsp; Memuat informasi server...</div>`;
  let d;
  try { d = await api('/api/dashboard'); }
  catch (e) { el.innerHTML = `<div class="card"><div class="empty">Gagal memuat: ${esc(e.message)}</div></div>`; return; }

  function discRoot(disks) {
    const root = disks.find((x) => x.mount === '/') || disks[0];
    if (!root) return '-';
    return root.usePercent !== null && root.usePercent !== undefined
      ? `${root.usePercent}%`
      : `${fmtBytes(root.used)} / ${fmtBytes(root.total)}`;
  }

  const ICON_STROKE = 'class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const DI = {
    cpu: `<svg ${ICON_STROKE}><path d="M6 6h.01M6 18h.01M18 6h.01M18 18h.01"/><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>`,
    ram: `<svg ${ICON_STROKE}><path d="M6 19v-3M10 19v-3M14 19v-3M18 19v-3"/><rect x="3" y="5" width="18" height="11" rx="2"/><path d="M8 9h.01M12 9h.01M16 9h.01"/></svg>`,
    disk: `<svg ${ICON_STROKE}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M7 21v-2M17 21v-2M12 21v-2M12 14.5l-1-1.7"/></svg>`,
    uptime: `<svg ${ICON_STROKE}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    system: `<svg ${ICON_STROKE}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>`,
    refresh: `<svg ${ICON_STROKE}><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`,
    network: `<svg ${ICON_STROKE}><path d="M12 2a10 10 0 1 0 10 10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/><path d="M22 12a10 10 0 0 1-10 10"/></svg>`,
    process: `<svg ${ICON_STROKE}><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>`,
    session: `<svg ${ICON_STROKE}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>`,
  };

  const kpi = [
    { icon: DI.cpu, label: 'CPU', value: `${d.cpu.loadPercent}%`, sub: `${(d.cpu.brand || '').split(' ')[0]} · ${d.cpu.cores} core` },
    { icon: DI.ram, label: 'RAM', value: `${d.memory.usePercent}%`, sub: `${fmtBytes(d.memory.used)} / ${fmtBytes(d.memory.total)}` },
    { icon: DI.disk, label: 'Disk (/)', value: `${discRoot(d.disks)}`, sub: 'used / total' },
    { icon: DI.uptime, label: 'Uptime', value: fmtUptime(d.uptime), sub: d.time.timezoneName || '' },
  ];

  el.innerHTML = `
    <div class="grid grid-kpi">
      ${kpi.map((k) => `
        <div class="card"><div class="card-body">
          <div class="kpi-label"><span class="kpi-icon">${k.icon}</span>${k.label}</div>
          <div class="kpi-value">${esc(k.value)}</div>
          <div class="kpi-sub">${esc(k.sub)}</div>
        </div></div>`).join('')}
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">${DI.system} Detail Sistem</span>
        <button class="btn btn-sm" onclick="location.reload()">${DI.refresh} Refresh</button>
      </div>
      <div class="card-body">
        <dl class="kv">
          <dt>Hostname</dt><dd>${esc(d.host.hostname)}</dd>
          <dt>Sistem</dt><dd>${esc(d.host.distro)} ${esc(d.host.release)} (${esc(d.host.codename || '')})</dd>
          <dt>Kernel</dt><dd>${esc(d.host.kernel)}</dd>
          <dt>Arsitektur</dt><dd>${esc(d.host.arch)}</dd>
          <dt>Waktu</dt><dd>${esc(d.time.localDate)} (${esc(d.time.timezone)})</dd>
          <dt>Boot</dt><dd>${esc(d.bootTime || '-')}</dd>
          <dt>Load Average</dt><dd>${d.cpu.loadAvg.map((x) => x.toFixed(2)).join(' / ')}</dd>
          <dt>Suhu CPU</dt><dd>${d.cpu.temperature ? d.cpu.temperature + '°C' : 'Tidak tersedia'}</dd>
          <dt>Swap</dt><dd>${fmtBytes(d.memory.swapUsed)} / ${fmtBytes(d.memory.swapTotal)}${d.memory.swapTotal ? ` (${d.memory.swapPercent}%)` : ''}</dd>
        </dl>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">${DI.ram} RAM</span><span class="muted mono">${d.memory.usePercent}%</span></div>
        <div class="card-body">
          <div class="bar"><span style="width:${d.memory.usePercent}%"></span></div>
          <dl class="kv" style="margin-top:14px">
            <dt>Terpakai</dt><dd>${fmtBytes(d.memory.used)}</dd>
            <dt>Active</dt><dd>${fmtBytes(d.memory.active)}</dd>
            <dt>Tersedia</dt><dd>${fmtBytes(d.memory.available)}</dd>
          </dl>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">${DI.disk} Disk</span></div>
        <div class="card-body">
          ${d.disks.map((disk) => `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:12px">
                <span class="mono">${esc(disk.mount)}</span>
                <span class="muted">${fmtBytes(disk.used)} / ${fmtBytes(disk.total)}${disk.usePercent !== null ? ` · ${disk.usePercent}%` : ''}</span>
              </div>
              <div class="bar"><span style="width:${disk.usePercent || 0}%"></span></div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${DI.network} Jaringan</span></div>
      <div class="card-body" style="padding:0">
        <table>
          <thead><tr><th>Interface</th><th>IP</th><th>MAC</th><th>↓ RX</th><th>↑ TX</th><th>Total RX/TX</th></tr></thead>
          <tbody>
            ${d.network.interfaces.map((iface) => {
              const st = d.network.stats.find((s) => s.iface === iface.iface);
              return `<tr>
                <td class="mono">${esc(iface.iface)}</td>
                <td class="mono">${esc(iface.ip4)}</td>
                <td class="mono muted">${esc(iface.mac)}</td>
                <td class="mono">${st ? fmtBytes(st.rxSec) + '/s' : '-'}</td>
                <td class="mono">${st ? fmtBytes(st.txSec) + '/s' : '-'}</td>
                <td class="mono muted">${st ? `${fmtBytes(st.rxBytes)} / ${fmtBytes(st.txBytes)}` : '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">${DI.process} Proses Teratas (CPU)</span><span class="muted mono">${d.processes.all} proses total</span></div>
        <div class="card-body" style="padding:0">
          <table>
            <thead><tr><th>PID</th><th>Nama</th><th>User</th><th>CPU %</th><th>MEM %</th></tr></thead>
            <tbody>
              ${d.processes.top.map((p) => `<tr>
                <td class="mono muted">${p.pid}</td>
                <td class="mono">${esc(p.name)}</td>
                <td class="mono muted">${esc(p.user || '')}</td>
                <td class="mono">${p.cpu}</td>
                <td class="mono">${p.mem}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">${DI.session} Sesi &amp; Software</span></div>
        <div class="card-body" style="padding:0">
          <table>
            <tbody>
              <tr><td>Node.js</td><td class="mono">${esc(d.versions.node || '-')}</td></tr>
              <tr><td>Nginx</td><td class="mono">${esc(d.versions.nginx || '-')}</td></tr>
              <tr><td>Git</td><td class="mono">${esc(d.versions.git || '-')}</td></tr>
              <tr><td>Docker</td><td class="mono">${esc(d.versions.docker || '-')}</td></tr>
              <tr><td>OpenSSL</td><td class="mono">${esc(d.versions.openssl || '-')}</td></tr>
              ${d.users.map((u) => `<tr><td>User: ${esc(u.user)}</td><td class="mono muted">${esc(u.terminal || '')} · ${esc(u.login || '')} · ${esc(u.ip || '')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/* ===== CodeMirror (editor kode, lazy) ===== */
let cmPromise = null;
const CM_FILES = [
  'codemirror.min.js',
  'addon-matchbrackets.min.js',
  'addon-closebrackets.min.js',
  'mode-xml.min.js',
  'mode-javascript.min.js',
  'mode-css.min.js',
  'mode-htmlmixed.min.js',
  'mode-markdown.min.js',
  'mode-yaml.min.js',
  'mode-nginx.min.js',
  'mode-shell.min.js',
  'mode-properties.min.js',
  'mode-python.min.js',
  'mode-clike.min.js',
  'mode-php.min.js',
  'mode-sql.min.js',
];
const CM_MODES = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'javascript', tsx: 'javascript', json: { name: 'javascript', json: true },
  css: 'css', scss: 'css', less: 'css',
  html: 'htmlmixed', htm: 'htmlmixed', xml: 'xml', svg: 'xml', vue: 'htmlmixed',
  php: 'application/x-httpd-php',
  md: 'markdown', markdown: 'markdown',
  yaml: 'yaml', yml: 'yaml',
  conf: 'nginx', nginx: 'nginx', vhost: 'nginx',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  env: 'properties', ini: 'properties', properties: 'properties', toml: 'properties',
  service: 'properties', socket: 'properties',
  py: 'python', pyw: 'python',
  c: 'clike', h: 'clike', cpp: 'clike', cc: 'clike', hpp: 'clike',
  cxx: 'clike', hxx: 'clike', java: 'clike', cs: 'clike', go: 'clike', rs: 'clike', scala: 'clike',
  sql: 'sql',
};
const CM_LABELS = {
  javascript: 'JavaScript', json: 'JSON', css: 'CSS', htmlmixed: 'HTML', xml: 'XML',
  'application/x-httpd-php': 'PHP', markdown: 'Markdown', yaml: 'YAML', nginx: 'Nginx',
  shell: 'Shell', properties: 'INI/Props', python: 'Python', clike: 'C-like', sql: 'SQL',
  plaintext: 'Teks biasa',
};
function cmModeFor(name) {
  const n = String(name || '').toLowerCase();
  if (n.startsWith('.') || /^(cmakelists|dockerfile|makefile|procfile)$/i.test(n)) {
    if (/^\.env/.test(n) || n.startsWith('.env')) return 'properties';
    if (/dockerfile/i.test(n)) return 'shell';
    if (/makefile/i.test(n)) return { name: 'makefile' };
    return 'plaintext';
  }
  const dotIdx = n.lastIndexOf('.');
  const ext = dotIdx === -1 ? '' : n.slice(dotIdx + 1);
  return CM_MODES[ext] || 'plaintext';
}
function cmModeLabel(name) {
  const mode = cmModeFor(name);
  const label = typeof mode === 'string' ? mode : mode.name;
  return CM_LABELS[label] ? CM_LABELS[label] + ' (' + label + ')' : label;
}
function ensureCodeMirror() {
  if (window.CodeMirror) return Promise.resolve();
  if (cmPromise) return cmPromise;
  cmPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('cm-css')) {
      const link = document.createElement('link');
      link.id = 'cm-css';
      link.rel = 'stylesheet';
      link.href = '/vendor/cm/codemirror.min.css';
      document.head.appendChild(link);
    }
    let i = 0;
    (function next() {
      if (i >= CM_FILES.length) {
        if (window.CodeMirror) return resolve();
        return reject(new Error('skrip tidak lengkap'));
      }
      const s = document.createElement('script');
      s.src = '/vendor/cm/' + CM_FILES[i];
      s.async = false;
      s.onload = () => { i++; next(); };
      s.onerror = () => reject(new Error('Tidak bisa memuat /vendor/cm/' + CM_FILES[i]));
      document.head.appendChild(s);
    })();
  });
  cmPromise.catch(() => { cmPromise = null; });
  return cmPromise;
}

/* ============ FILE BROWSER (reusable) ============ */
const ICONS = {
  dir: '<svg class="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  up: '<svg class="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M9 12l3-3 3 3"/><path d="M12 9v6"/></svg>',
  file: '<svg class="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5L15.5 3z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  link: '<svg class="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
};

/**
 * Browser file reusable. opts: { root, compact, onChange }
 * Mengelola state di localStorage bila bukan mode compact.
 */
function fileBrowser(container, opts = {}) {
  const persist = !opts.compact;
  let root = opts.root ?? STATE.filesRoot;
  let pathStr = opts.path ?? (persist ? STATE.filesPath : '/');
  let clipboard = null;
  let selected = null;
  let currentItems = [];

  container.innerHTML = `
    <div class="card-header" style="flex-wrap:wrap;gap:10px">
      ${persist ? `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="card-title">Root</span>
        <input class="input" id="fb-root" style="width:240px" value="${esc(root)}" placeholder="Home direktori">
      </div>` : `
      <span class="mono muted">${esc(root)}</span>`}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto">
        <button class="btn btn-sm" data-act="newfile">+ File</button>
        <button class="btn btn-sm" data-act="newdir">+ Folder</button>
        <button class="btn btn-sm btn-primary" data-act="upload">Upload</button>
        <button class="btn btn-sm" data-act="paste" disabled title="Tempel dari clipboard">Tempel</button>
      </div>
    </div>
    <div class="card-header" style="gap:10px;flex-wrap:wrap">
      <div class="fb-crumbs crumbs"></div>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <input class="input" id="fb-search" placeholder="Cari di folder ini..." style="width:180px">
      </div>
    </div>
    <div class="card-header fb-selection" style="flex-wrap:wrap;gap:6px" data-empty="1">
      <span class="muted fb-selection-name" style="align-self:center">Pilih item di tabel untuk aksi cepat</span>
      <span class="f-sel-buttons">
        <button class="btn btn-sm" data-f="open" disabled title="Buka file / edit / preview">Buka</button>
        <button class="btn btn-sm" data-f="download" disabled>Download</button>
        <button class="btn btn-sm" data-f="rename" disabled>Rename</button>
        <button class="btn btn-sm" data-f="copy" disabled title="Salin item">Salin</button>
        <button class="btn btn-sm" data-f="cut" disabled title="Potong item">Potong</button>
        <button class="btn btn-sm" data-f="dup" disabled>Duplikat</button>
        <button class="btn btn-sm" data-f="perm" disabled>Izin</button>
        <button class="btn btn-sm" data-f="compress" disabled>Arsipkan</button>
        <button class="btn btn-sm" data-f="extract" disabled>Ekstrak</button>
        <button class="btn btn-sm btn-danger" data-f="del" disabled>Hapus</button>
      </span>
    </div>
    <div class="fb-table"><div class="empty"><span class="spinner"></span></div></div>`;

  function setSelButtons(enabled) {
    $$('.fb-selection [data-f]', container).forEach((b) => {
      const f = b.dataset.f;
      const need = { open: true, download: true, rename: true, copy: true, cut: true, dup: true, perm: true, compress: true, extract: true, del: true };
      let on = enabled;
      if (enabled && selected) {
        if (f === 'extract') on = isArchive(selected.name) && selected.type !== 'dir';
        if (f === 'open') on = selected.type !== 'dir' && (selected.isText || isImage(selected.name));
        if (f === 'download') on = selected.type !== 'dir';
      }
      b.disabled = !on || !need[f];
    });
    const bar = $('.fb-selection', container);
    if (bar) bar.dataset.empty = enabled && selected ? '0' : '1';
    const label = $('.fb-selection-name', container);
    if (selected) label.innerHTML = `Dipilih: <span class="mono">${esc(selected.name)}</span>`;
    else label.innerHTML = 'Pilih item di tabel untuk aksi cepat';
  }

  const rootInput = $('#fb-root', container);
  if (rootInput) {
    rootInput.value = root;
    rootInput.addEventListener('change', (e) => {
      root = e.target.value;
      STATE.filesRoot = root;
      localStorage.setItem('np-root', root);
      load();
    });
  }

  $$('[data-act]', container).forEach((b) => {
    if (b.dataset.act === 'newfile') b.addEventListener('click', () => promptCreate('file'));
    if (b.dataset.act === 'newdir') b.addEventListener('click', () => promptCreate('dir'));
    if (b.dataset.act === 'upload') b.addEventListener('click', () => uploadFile());
    if (b.dataset.act === 'paste') b.addEventListener('click', () => paste());
  });

  $$('.fb-selection [data-f]', container).forEach((b) => b.addEventListener('click', () => act(b.dataset.f)));
  $('#fb-search', container).addEventListener('input', () => renderRows());

  function isArchive(name) { return /\.(zip|tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz)$/i.test(name || ''); }
  function isImage(name) { return /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(name || ''); }

  load();

  async function load() {
    const tbody = $('.fb-table', container);
    tbody.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    selected = null;
    let data;
    try {
      data = await api(`/api/files/browse?path=${encodeURIComponent(pathStr)}&root=${encodeURIComponent(root)}`);
    } catch (e) {
      tbody.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
      return;
    }
    if (persist) { STATE.filesPath = pathStr; localStorage.setItem('np-path', pathStr); }

    const shown = data.path && data.path !== '/' ? data.path.replace(/^\/|\/$/g, '').split('/') : [];
    let acc = '';
    const crumbHTML = ['<a href="#" data-nav="/">/</a>'];
    shown.forEach((part, i) => {
      acc += '/' + part;
      if (i === shown.length - 1) {
        crumbHTML.push(`<span class="current mono">${esc(part)}</span>`);
      } else {
        crumbHTML.push(`<a href="#" data-nav="${esc(acc)}/">${esc(part)}</a>`);
      }
    });

    $('.fb-crumbs', container).innerHTML = `
      <span class="muted mono" style="margin-right:4px">${esc(data.root)}</span>
      ${crumbHTML.map((c, i) => `<span class="sep">${i ? '/' : ''}</span>${c}`).join('')}`;

    $$('a[data-nav]', container).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      pathStr = a.dataset.nav;
      load();
    }));

    currentItems = data.items;
    if (rootInput) rootInput.value = data.root;

    renderRows();
  }

  function filteredItems() {
    const q = ($('#fb-search', container)?.value || '').toLowerCase();
    if (!q) return currentItems;
    return currentItems.filter((it) => it.name.toLowerCase().includes(q));
  }

  function pathUp() {
    const parts = pathStr.split('/').filter(Boolean);
    parts.pop();
    return '/' + (parts.length ? parts.join('/') + '/' : '');
  }

  function renderRows() {
    const clipboardPaste = $('[data-act="paste"]', container);
    clipboardPaste.disabled = !clipboard;
    if (clipboard) clipboardPaste.title = `Tempel: ${clipboard.mode} "${clipboard.rel}"`;
    setSelButtons(false);

    const tbody = $('.fb-table', container);
    const items = filteredItems();
    const atRoot = pathStr === '/';

    const upRow = atRoot ? '' : `<tr class="row-up" data-up="1">
        <td class="td-name">${ICONS.up} <span class="muted" style="font-weight:600">..</span> <span class="muted" style="font-size:11px">— naik satu direktori</span></td>
        <td class="mono muted" style="width:90px"></td>
        <td class="mono muted" style="width:160px"></td>
        <td class="mono muted" style="width:80px"></td>
        <td style="width:230px" class="actions-cell"></td>
      </tr>`;

    if (items.length === 0) {
      tbody.innerHTML = `<table><tbody>` + upRow + `<tr class="empty-row"><td colspan="5"><div class="empty">${currentItems.length ? 'Tidak ada item yang cocok' : 'Folder kosong'}</div></td></tr></tbody></table>`;
      wireUpRow();
      return;
    }

    tbody.innerHTML = `<table><thead><tr>
        <th>Nama</th><th style="width:90px">Ukuran</th><th style="width:160px">Modifikasi</th><th style="width:80px">Izin</th><th style="width:230px">Aksi</th>
      </tr></thead><tbody>` + upRow + items.map((item, idx) => {
          const isDir = item.type === 'dir';
          const size = isDir ? duCell(item.name) : fmtBytes(item.size);
          const rel = (pathStr === '/' ? '' : pathStr) + item.name;
          const selectedCls = selected && selected.name === item.name ? ' class="row-selected"' : '';
          return `<tr${selectedCls} data-idx="${idx}">
            <td class="td-name">${ICONS[item.type] || ICONS.file} ${isDir
              ? `<a href="#" data-open="${esc(item.name)}" style="color:inherit;text-decoration:none;font-weight:500">${esc(item.name)}</a>`
              : `${isImage(item.name) ? `<a href="#" data-preview="${esc(item.name)}" title="Preview" style="color:inherit">${esc(item.name)}</a>` : `<span ${item.isText ? '' : 'style="color:var(--muted)"'}>${esc(item.name)}</span>`}`}</td>
            <td class="mono muted td-size" style="width:90px">${size}</td>
            <td class="mono muted" style="width:160px">${item.modified ? new Date(item.modified).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td>
            <td class="mono muted" style="width:80px">${item.permissions || ''}</td>
            <td class="actions-cell td-actions">
              ${!isDir && item.isText ? `<button class="btn btn-sm" data-act2="open" data-n="${esc(item.name)}" data-rel="${esc(rel)}">Buka</button>` : ''}
              <button class="btn btn-sm" data-act2="rename" data-n="${esc(item.name)}" data-rel="${esc(rel)}">Rename</button>
              <button class="btn btn-sm btn-danger" data-act2="del" data-n="${esc(item.name)}" data-rel="${esc(rel)}">Hapus</button>
            </td>
          </tr>`;
        }).join('') + `</tbody></table>`;

    wireUpRow();

    $$('a[data-open]', tbody).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      pathStr = (pathStr === '/' ? '' : pathStr) + a.dataset.open + '/';
      load();
    }));

    $$('a[data-preview]', tbody).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const rel = (pathStr === '/' ? '' : pathStr) + a.dataset.preview;
      previewImage(a.dataset.preview, rel);
    }));

    $$('button[data-act2]', tbody).forEach((btn) => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = btn.dataset.n;
      const rel = btn.dataset.rel;
      const act = btn.dataset.act2;
      try {
        if (act === 'open') {
          await openItem(name, rel);
        } else if (act === 'rename') {
          await renamePrompt(name, rel);
        } else if (act === 'del') {
          if (!confirm(`Hapus "${name}"? Tindakan ini permanen.`)) return;
          await api('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, path: rel }) });
          toast(`"${name}" dihapus`);
        }
        load();
      } catch (err) { toast(err.message, 'error'); }
    }));

    $$('a[data-du]', tbody).forEach((a) => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const rel = (pathStr === '/' ? '' : pathStr) + a.dataset.du;
      const cell = a.closest('td');
      cell.innerHTML = '<span class="spinner"></span>';
      try {
        const r = await api(`/api/files/du?path=${encodeURIComponent(rel)}&root=${encodeURIComponent(root)}`);
        cell.textContent = fmtBytes(r.bytes);
      } catch (err) {
        cell.textContent = '—';
        toast(err.message, 'error');
      }
    }));

    $$('tr[data-idx]', tbody).forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      const item = filteredItems()[parseInt(tr.dataset.idx, 10)];
      selected = item;
      $$('.fb-table tr', container).forEach((r) => r.classList.remove('row-selected'));
      tr.classList.add('row-selected');
      setSelButtons(true);
    }));
  }

  function wireUpRow() {
    const tbody = $('.fb-table', container);
    $$('.row-up[data-up]', tbody).forEach((row) => row.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      e.preventDefault();
      pathStr = pathUp();
      load();
    }));
  }

  function duCell(name) {
    const rel = (pathStr === '/' ? '' : pathStr) + name;
    return `<a href="#" data-du="${esc(name)}" title="Hitung ukuran folder (du)" class="muted" style="text-decoration:underline dotted">± ukuran</a>`;
  }

  async function openItem(name, rel) {
    const item = (selected && selected.name === name) || currentItems.find((i) => i.name === name);
    if (isImage(name)) return previewImage(name, rel);
    if (item && item.isText) return openEditor(name, rel);
  }

  async function previewImage(name, rel) {
    try {
      const img = await api(`/api/files/preview?path=${encodeURIComponent(rel)}&root=${encodeURIComponent(root)}`);
      modal({
        title: `Preview: ${esc(name)}`,
        wide: true,
        body: `<div style="text-align:center"><img src="${img.data}" alt="${esc(name)}" style="max-width:100%;max-height:60vh" /></div>`,
        footer: `<button class="btn btn-primary" onclick="closeModal()">Tutup</button>`,
      });
    } catch (e) { toast(e.message, 'error'); }
  }

  async function act(f) {
    if (!selected) return toast('Pilih dulu sebuah item', 'error');
    const name = selected.name;
    const rel = (pathStr === '/' ? '' : pathStr) + name;
    try {
      if (f === 'open') {
        await openItem(name, rel);
      } else if (f === 'copy') {
        clipboard = { mode: 'copy', rel, name };
        toast(`Disalin: "${name}" — pilih folder lain, lalu klik Tempel`);
      } else if (f === 'cut') {
        clipboard = { mode: 'cut', rel, name };
        toast(`Dipotong: "${name}" — pilih tujuan, lalu klik Tempel`);
      } else if (f === 'dup') {
        const r = await api('/api/files/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, from: rel, to: rel }) });
        toast(`Duplikat: "${r.to}"`);
      } else if (f === 'download') {
        location.href = `/api/files/download?path=${encodeURIComponent(rel)}&root=${encodeURIComponent(root)}`;
      } else if (f === 'compress') {
        await compressPrompt(name, rel);
      } else if (f === 'extract') {
        const r = await api('/api/files/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, path: rel }) });
        toast(`Diekstrak ke "${r.dest}"`);
      } else if (f === 'perm') {
        await permPrompt(name, rel);
      } else if (f === 'rename') {
        await renamePrompt(name, rel);
      } else if (f === 'del') {
        if (!confirm(`Hapus "${name}"? Tindakan ini permanen.`)) return;
        await api('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, path: rel }) });
        toast(`"${name}" dihapus`);
      } else if (f === 'paste') {
        // noop handled sebelumnya
      }
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function paste() {
    if (!clipboard) return toast('Clipboard kosong', 'error');
    try {
      const dest = (pathStr === '/' ? '' : pathStr) + clipboard.name.split('/').pop();
      const endpoint = clipboard.mode === 'copy' ? '/api/files/copy' : '/api/files/move';
      const r = await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, from: clipboard.rel, to: dest }) });
      toast(`${clipboard.mode === 'copy' ? 'Disalin' : 'Dipindah'} ke "${r.to}"`);
      clipboard = null;
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function compressPrompt(name, rel) {
    const md = modal({
      title: `Arsipkan: ${esc(name)}`,
      body: `
        <div class="field"><label>Format</label>
          <select class="select" id="cp-format">
            <option value="zip">zip (${esc(name)}.zip)</option>
            <option value="targz">tar.gz (${esc(name)}.tar.gz)</option>
          </select>
        </div>
        <p class="muted" style="font-size:12px">Arsip ditempatkan di folder yang sama. Jika <span class="mono">zip</span> tidak terpasang, otomatis fallback ke <span class="mono">tar.gz</span>.</p>`,
      footer: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="cp-ok">Arsipkan</button>`,
    });
    $('#cp-ok', md).addEventListener('click', async () => {
      try {
        const r = await api('/api/files/compress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, path: rel, format: $('#cp-format').value }) });
        closeModal(); toast(`Arsip dibuat: "${r.output}" (${fmtBytes(r.size)}, ${r.format})`);
        load();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function permPrompt(name, rel) {
    const md = modal({
      title: `Izin Akses: ${esc(name)}`,
      body: `
        <div class="field"><label>Modes (oktal, mis. 644/755)</label><input class="input mono" id="pm-mode" value="${esc(selected.permissions || '')}" maxLength="4"></div>
        <div class="field"><label class="checkline"><input type="checkbox" id="pm-rec"> Terapkan berulang (recursive, untuk folder)</label></div>`,
      footer: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="pm-ok">Terapkan</button>`,
    });
    $('#pm-ok', md).addEventListener('click', async () => {
      try {
        const r = await api('/api/files/chmod', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, path: rel, mode: $('#pm-mode').value, recursive: $('#pm-rec').checked }) });
        closeModal(); toast(`Izin diubah ke ${r.mode}`);
        load();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function openEditor(name, rel) {
    let content;
    try { content = await api(`/api/files/read?path=${encodeURIComponent(rel)}&root=${encodeURIComponent(root)}`); }
    catch (e) { return toast(e.message, 'error'); }

    const md = modal({
      title: `Edit — <span class="mono">${esc(name)}</span> <span class="muted" style="font-weight:400">(${fmtBytes(content.size)})</span>`,
      wide: true,
      body: `<textarea class="input" id="ed-content" spellcheck="false" style="min-height:420px">${esc(content.content)}</textarea>`,
      footer: `
        <span class="muted mono editor-status" style="margin-right:auto;align-self:center"></span>
        <button class="btn" onclick="closeModal()">Tutup</button>
        <button class="btn btn-sm" id="ed-reload">Reload</button>
        <button class="btn btn-primary" id="ed-save">Simpan</button>`,
    });

    function status(msg) {
      const el = $('.editor-status', md);
      if (el) el.textContent = msg;
    }

    let cm = null;
    try {
      await ensureCodeMirror();
      cm = window.CodeMirror.fromTextArea($('#ed-content', md), {
        lineNumbers: true,
        mode: cmModeFor(name),
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: false,
      });
      cm.setSize('100%', '440px');
      cm.focus();
      status(`${cmModeLabel(name)} · ${fmtBytes(content.size)}`);
    } catch {
      status('mode textarea (CodeMirror gagal dimuat)');
      $('#ed-content', md).focus();
    }

    function value() { return cm ? cm.getValue() : $('#ed-content', md).value; }

    $('#ed-save', md).addEventListener('click', async () => {
      const btn = $('#ed-save', md);
      btn.disabled = true; btn.textContent = 'Menyimpan...';
      try {
        await api('/api/files/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, path: rel, content: value() }) });
        status('Tersimpan ✓');
        toast('File tersimpan');
        load();
      } catch (e) { toast(e.message, 'error'); }
      btn.disabled = false; btn.textContent = 'Simpan';
    });

    $('#ed-reload', md).addEventListener('click', async () => {
      try {
        const fresh = await api(`/api/files/read?path=${encodeURIComponent(rel)}&root=${encodeURIComponent(root)}`);
        if (cm) cm.setValue(fresh.content);
        else $('#ed-content', md).value = fresh.content;
        status('Reload ✓');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function renamePrompt(name, rel) {
    const md = modal({
      title: 'Rename',
      body: `<div class="field"><label>Nama baru</label><input class="input" id="rn-name" value="${esc(name)}"></div>`,
      footer: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="rn-ok">Rename</button>`,
    });
    $('#rn-name', md).focus();
    $('#rn-ok', md).addEventListener('click', async () => {
      try {
        await api('/api/files/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, from: rel, to: posixDir(rel) + $('#rn-name').value }) });
        closeModal(); load(); toast('Berhasil di-rename');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  function posixDir(rel) {
    const dir = rel.replace(/\/$/, '').split('/').slice(0, -1).join('/');
    return dir === '' ? '/' : dir + '/';
  }

  function promptCreate(type) {
    const md = modal({
      title: type === 'dir' ? 'Folder Baru' : 'File Baru',
      body: `<div class="field"><label>Nama</label><input class="input" id="nc-name"></div>`,
      footer: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="nc-ok">Buat</button>`,
    });
    $('#nc-name', md).focus();
    $('#nc-ok', md).addEventListener('click', async () => {
      try {
        await api('/api/files/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root, path: (pathStr === '/' ? '' : pathStr) + $('#nc-name').value, type }) });
        closeModal(); load(); toast('Berhasil dibuat');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  function uploadFile() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.onchange = async () => {
      const file = inp.files[0];
      const fd = new FormData();
      fd.append('file', file);
      fd.append('path', (pathStr === '/' ? '' : pathStr) + file.name);
      fd.append('root', root);
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
      if (res.ok) { toast('Upload berhasil'); load(); }
      else { const j = await res.json().catch(() => ({})); toast(j.error || 'Upload gagal', 'error'); }
    };
    inp.click();
  }
}

async function renderFiles(el) {
  el.innerHTML = `<div class="card" id="fm-card"></div>`;
  fileBrowser($('#fm-card', el), { root: STATE.filesRoot, path: STATE.filesPath, persist: true });
}


/* ============ DATABASE ============ */
async function renderDatabase(el) {
  el.innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span>&nbsp; Mendeteksi database...</div></div>`;
  let data;
  try { data = await api('/api/database/status'); }
  catch (e) { el.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }

  const runningServers = data.servers.filter((s) => s.running);
  el.innerHTML = `
    <div class="grid grid-kpi">
      <div class="card"><div class="card-body"><div class="kpi-label">Database Server</div><div class="kpi-value">${data.servers.length}</div><div class="kpi-sub">terdeteksi (mysql/mariadb)</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label">Berjalan</div><div class="kpi-value">${data.runningCount}</div><div class="kpi-sub">aktif saat ini</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label">Databases</div><div class="kpi-value">${runningServers.reduce((n, s) => n + s.databases.length, 0)}</div><div class="kpi-sub">dikonfirmasi</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label">Tipe</div><div class="kpi-value">SQL + Cache</div><div class="kpi-sub">mysql/mariadb + redis</div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Status &amp; Database</span></div>
      <div class="card-body" style="padding:0">
        <table>
          <thead><tr><th>Service</th><th>Status</th><th>Database / Cache</th><th style="width:150px">Aksi</th></tr></thead>
          <tbody>
            ${data.servers.map((s) => `<tr>
              <td class="mono" style="font-weight:600">${esc(s.service)}</td>
              <td><span class="badge ${s.running ? 'badge-success' : 'badge-danger'}">${s.running ? 'running' : 'stopped'}</span></td>
              <td>${s.databases.map((d) => `<div class="mono" style="font-size:12px">${esc(d.name)}${d.kind ? ` <span class="muted">(${esc(d.kind)})</span>` : ''}</div>`).join('') || '—'}</td>
              <td class="actions-cell">
                <button class="btn btn-sm btn-primary" data-svc="${esc(s.service)}" data-do="start" ${s.running ? 'disabled' : ''}>Start</button>
                <button class="btn btn-sm" data-svc="${esc(s.service)}" data-do="stop" ${!s.running ? 'disabled' : ''}>Stop</button>
                <button class="btn btn-sm" data-svc="${esc(s.service)}" data-do="restart">Restart</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  $$('[data-svc]', el).forEach((b) => b.addEventListener('click', async () => {
    const svc = b.dataset.svc;
    const action = b.dataset.do;
    if (!['start', 'stop', 'restart'].includes(action)) return;
    b.disabled = true;
    try {
      const r = await api('/api/services/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: svc, action }) });
      toast(`${svc} — ${action} ok`);
      renderDatabase(el);
    } catch (e) { toast(e.message, 'error'); }
    b.disabled = false;
  }));
}

async function renderAccount(el) {
  el.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Akun Saya</span></div>
        <div class="card-body"><dl class="kv" id="me-kv"><dt>Memuat...</dt><dd></dd></dl></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Ganti Password Linux</span></div>
        <div class="card-body">
          <p class="muted" style="font-size:12px;margin-bottom:10px">Mengubah password akun Linux <span class="mono">${esc(ME ? ME.username : '-')}</span> (sama seperti password login SSH/su panel ini).</p>
          <div class="field"><label>Password saat ini</label><input class="input" id="pw-current" type="password" autocomplete="current-password"></div>
          <div class="field"><label>Password baru</label><input class="input" id="pw-new" type="password" autocomplete="new-password"></div>
          <div class="field"><label>Konfirmasi password baru</label><input class="input" id="pw-confirm" type="password" autocomplete="new-password"></div>
          <button class="btn btn-primary" id="pw-save">Simpan</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Akun Linux</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" id="acc-refresh">Refresh</button>
          <button class="btn btn-sm btn-primary" id="acc-new">+ Akun Baru</button>
        </div>
      </div>
      <p class="card-note" style="font-size:12px">Daftar user Linux lokal (uid &ge; 1000). Perubahan dieksekusi via <span class="mono">useradd/usermod/userdel</span>; server panel membutuhkan hak root.</p>
      <div class="card-body" style="padding:0" id="acc-table"><div class="empty"><span class="spinner"></span>&nbsp; Memuat akun...</div></div>
    </div>`;

  try {
    const me = await api('/api/auth/me');
    $('#me-kv').innerHTML = `
      <dt>Username</dt><dd>${esc(me.user.username)}</dd>
      <dt>Home</dt><dd>${esc(me.user.home || '-')}</dd>
      <dt>Shell</dt><dd>${esc(me.user.shell || '-')}</dd>
      <dt>Status Sesi</dt><dd><span class="badge badge-success">aktif</span> (cookie 7 hari)</dd>`;
  } catch {
    $('#me-kv').innerHTML = '<dt>Info</dt><dd>tidak bisa memuat</dd>';
  }

  $('#pw-save').addEventListener('click', async () => {
    const current = $('#pw-current').value;
    const next = $('#pw-new').value;
    const confirm = $('#pw-confirm').value;
    if (next !== confirm) return toast('Konfirmasi password baru tidak cocok', 'error');
    try {
      await api('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current, next }) });
      toast('Password Linux berhasil diubah');
      $('#pw-current').value = ''; $('#pw-new').value = ''; $('#pw-confirm').value = '';
    } catch (e) { toast(e.message, 'error'); }
  });

  async function loadAccounts() {
    const tb = $('#acc-table');
    tb.innerHTML = `<div class="empty"><span class="spinner"></span>&nbsp; Memuat akun...</div>`;
    let data;
    try { data = await api('/api/accounts'); }
    catch (e) { tb.innerHTML = `<div class="empty" style="color:var(--danger)">${esc(e.message)}</div>`; return; }

    let html = '';
    if (!data.iAmRoot) {
      html += `<div class="card-note" style="color:var(--danger)">Server panel tidak berjalan sebagai root / sudo NOPASSWD &mdash; operasi tulis akan ditolak sistem. Data tetap bisa dibaca.</div>`;
    }
    if (data.users.length === 0) {
      tb.innerHTML = html + `<div class="empty">Tidak ada akun user biasa</div>`;
      return;
    }
    html += `<div class="table-scroll"><table>
      <thead><tr><th>Akun</th><th>UID</th><th>Home</th><th>Shell</th><th>Sudo</th><th>Password</th><th style="width:210px">Aksi</th></tr></thead>
      <tbody>
        ${data.users.map((u) => `<tr>
          <td><span class="mono" style="font-weight:600">${esc(u.name)}</span>${u.gecos ? `<div class="muted" style="font-size:11px">${esc(u.gecos)}</div>` : ''}</td>
          <td class="mono muted">${u.uid}</td>
          <td class="mono muted td-path">${esc(u.home || '-')}</td>
          <td class="mono muted">${esc(u.shell || '-')}</td>
          <td>${u.sudo ? '<span class="badge badge-danger">sudo</span>' : '<span class="muted">–</span>'}</td>
          <td>${u.status === 'locked' ? '<span class="badge badge-danger">locked</span>' : u.status === 'none' ? '<span class="badge">tanpa password</span>' : '<span class="badge badge-success">ok</span>'}</td>
          <td class="actions-cell td-actions">
            <button class="btn btn-sm" data-a="edit" data-n="${esc(u.name)}">Edit</button>
            <button class="btn btn-sm" data-a="lock" data-n="${esc(u.name)}" data-lock="${u.status === 'locked' ? '1' : ''}">${u.status === 'locked' ? 'Unlock' : 'Lock'}</button>
            ${u.name === (ME && ME.username) ? '' : `<button class="btn btn-sm btn-danger" data-a="del" data-n="${esc(u.name)}">Hapus</button>`}
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;
    tb.innerHTML = html;

    $$('[data-a]', tb).forEach((btn) => btn.addEventListener('click', () => act(btn)));
  }

  async function act(btn) {
    const name = btn.dataset.n;
    if (btn.dataset.a === 'del') {
      openModal({
        title: 'Hapus akun',
        body: `<p>Hapus akun Linux <span class="mono">${esc(name)}</span>?</p>
          <label class="checkline"><input type="checkbox" id="del-home"> Hapus juga home direktori (-r)</label>`,
        footer: `<button class="btn btn-sm btn-primary" id="del-cancel">Batal</button><button class="btn btn-sm btn-danger" id="del-ok">Hapus</button>`,
      });
      $('#del-cancel').addEventListener('click', closeModal);
      $('#del-ok').addEventListener('click', async () => {
        const rmHome = $('#del-home').checked ? '?removeHome=1' : '';
        await doReq(() => api(`/api/accounts/${encodeURIComponent(name)}${rmHome}`, { method: 'DELETE' }), closeModal, loadAccounts);
      });
      return;
    }
    if (btn.dataset.a === 'lock') {
      const lockIt = !btn.dataset.lock;
      await doReq(() => api(`/api/accounts/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locked: lockIt }) }), null, loadAccounts);
      return;
    }
    if (btn.dataset.a === 'edit') {
      let data;
      try { data = await api('/api/accounts'); } catch (e) { return toast(e.message, 'error'); }
      const u = data.users.find((x) => x.name === name);
      if (!u) return toast('Akun tidak ditemukan', 'error');
      openModal({
        title: `Edit akun · ${esc(name)}`,
        wide: true,
        body: `
          <div class="field"><label>Nama lengkap (gecos)</label><input class="input" id="e-gecos" value="${esc(u.gecos)}"></div>
          <div class="field"><label>Shell</label><input class="input" id="e-shell" value="${esc(u.shell)}"></div>
          <div class="field"><label>Home directory</label><input class="input" id="e-home" value="${esc(u.home)}"></div>
          <div class="field"><label class="checkline"><input type="checkbox" id="e-sudo" ${u.sudo ? 'checked' : ''}> Memberi akses sudo</label></div>
          <div class="field"><label>Password baru (kosongkan agar tidak berubah)</label><input class="input" id="e-pass" type="password" autocomplete="new-password"></div>`,
        footer: `<button class="btn btn-sm" id="e-cancel">Batal</button><button class="btn btn-sm btn-primary" id="e-save">Simpan</button>`,
      });
      $('#e-cancel').addEventListener('click', closeModal);
      $('#e-save').addEventListener('click', async () => {
        const payload = {};
        if ($('#e-gecos').value !== u.gecos) payload.gecos = $('#e-gecos').value;
        if ($('#e-shell').value && $('#e-shell').value !== u.shell) payload.shell = $('#e-shell').value;
        if ($('#e-home').value && $('#e-home').value !== u.home) payload.home = $('#e-home').value;
        if ($('#e-sudo').checked !== u.sudo) payload.sudo = $('#e-sudo').checked;
        if ($('#e-pass').value) payload.password = $('#e-pass').value;
        if (Object.keys(payload).length === 0) { closeModal(); return; }
        await doReq(() => api(`/api/accounts/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), closeModal, loadAccounts);
      });
    }
  }

  $('#acc-refresh').addEventListener('click', loadAccounts);
  $('#acc-new').addEventListener('click', () => {
    openModal({
      title: 'Buat akun Linux baru',
      wide: true,
      body: `
        <div class="field"><label>Username</label><input class="input" id="n-name" pattern="[a-z_][a-z0-9_-]*" placeholder="cth: budi"></div>
        <div class="field"><label>Nama lengkap</label><input class="input" id="n-gecos" placeholder="opsional"></div>
        <div class="field"><label>Shell</label><input class="input" id="n-shell" value="/bin/bash"></div>
        <div class="field"><label>Grup tambahan</label><input class="input" id="n-groups" placeholder="opsional, koma antar grup"></div>
        <div class="field"><label>Password</label><input class="input" id="n-pass" type="password" autocomplete="new-password"></div>
        <div class="field"><label class="checkline"><input type="checkbox" id="n-sudo"> Memberi akses sudo</label></div>
        <p class="muted" style="font-size:12px">Home directory dibuat otomatis (<span class="mono">useradd -m</span>).</p>`,
      footer: `<button class="btn btn-sm" id="n-cancel">Batal</button><button class="btn btn-sm btn-primary" id="n-save">Buat</button>`,
    });
    $('#n-cancel').addEventListener('click', closeModal);
    $('#n-save').addEventListener('click', async () => {
      const name = $('#n-name').value.trim();
      const payload = { name, gecos: $('#n-gecos').value, shell: $('#n-shell').value.trim(), groups: $('#n-groups').value, password: $('#n-pass').value, sudo: $('#n-sudo').checked };
      if (!name) return toast('Nama akun wajib', 'error');
      await doReq(() => api('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), closeModal, loadAccounts);
    });
  });

  loadAccounts();
}

async function doReq(fn, closeModalFn, refresh) {
  try {
    await fn();
    toast('Berhasil');
    if (closeModalFn) closeModalFn();
    if (refresh) await refresh();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============ SERVICES ============ */
async function renderServices(el) {
  el.innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span>&nbsp; Mendeteksi layanan...</div></div>`;
  let data;
  try { data = await api('/api/services'); }
  catch (e) { el.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }

  const running = data.services.filter((s) => s.state === 'running');
  el.innerHTML = `
    <div class="grid grid-kpi">
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.layers}</span>Terdeteksi</div><div class="kpi-value">${data.services.length}</div><div class="kpi-sub">layanan</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.play}</span>Berjalan</div><div class="kpi-value">${running.length}</div><div class="kpi-sub">layanan aktif</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.stop}</span>Stopped</div><div class="kpi-value">${data.services.length - running.length}</div><div class="kpi-sub">layanan nonaktif</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.info}</span>Deteksi</div><div class="kpi-value">systemd + ps</div><div class="kpi-sub">otomatis</div></div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">${SI.server} Layanan Terdeteksi</span>
        <div style="display:flex;gap:8px">
          <input class="input" id="svc-filter" placeholder="Cari layanan..." style="width:200px">
          <button class="btn btn-sm btn-primary" id="svc-refresh">Refresh</button>
        </div>
      </div>
      <div class="card-body table-scroll borderless-rows" style="padding:0" id="svc-table"></div>
    </div>`;

  const tb = $('#svc-table');
  function draw(filter = '') {
    const list = data.services.filter((s) => s.shortName.toLowerCase().includes(filter.toLowerCase()) || (s.description || '').toLowerCase().includes(filter.toLowerCase()));
    tb.innerHTML = list.length === 0 ? `<div class="empty">Tidak ada layanan yang cocok</div>` :
      `<table>
        <thead><tr><th>Layanan</th><th>Deskripsi</th><th>Tipe</th><th>Status</th><th style="width:280px">Aksi</th></tr></thead>
        <tbody>
          ${list.map((s) => `<tr>
            <td class="mono" style="font-weight:600">${esc(s.shortName)}</td>
            <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.description)}">${esc(s.description || '-')}</td>
            <td class="mono muted">${esc(s.type)}</td>
            <td><span class="badge ${s.state === 'running' ? 'badge-success' : s.state === 'exited' ? '' : 'badge-danger'}">${esc(s.state)}</span></td>
            <td class="actions-cell">
              <button class="btn btn-sm btn-primary" data-do="start" data-id="${esc(s.name)}" ${s.state === 'running' ? 'disabled' : ''}>${SI.play} Start</button>
              <button class="btn btn-sm" data-do="stop" data-id="${esc(s.name)}" ${s.state !== 'running' ? 'disabled' : ''}>${SI.stop} Stop</button>
              <button class="btn btn-sm" data-do="restart" data-id="${esc(s.name)}">${SI.restart} Restart</button>
              <button class="btn btn-sm" data-do="status" data-id="${esc(s.name)}">${SI.info} Detail</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;

    $$('button[data-do]', tb).forEach((b) => b.addEventListener('click', async () => {
      const action = b.dataset.do, name = b.dataset.id;
      if (action !== 'status') {
        b.disabled = true; b.textContent = action === 'start' ? 'Starting…' : action === 'stop' ? 'Stopping…' : 'Restarting…';
      }
      try {
        const r = await api('/api/services/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, action }) });
        if (action === 'status') {
          await showDetail(name);
        } else {
          toast(`${name} — ${action} berhasil`);
          renderServices(el);
        }
      } catch (e) { toast(e.message, 'error'); b.disabled = false; b.innerHTML = { start: `${SI.play} Start`, stop: `${SI.stop} Stop`, restart: `${SI.restart} Restart` }[action] || action; }
    }));
  }

  function showDetail(name) {
    return api('/api/services/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.replace('.service', ''), action: 'status' }) })
      .then((r) => {
        modal({
          title: `Detail: ${esc(name)}`,
          wide: true,
          body: `<pre class="code">${esc(r.output || 'Tidak ada keluaran')}</pre>`,
          footer: `<button class="btn btn-primary" onclick="closeModal()">OK</button>`,
        });
      })
      .catch((e) => {
        modal({ title: 'Detail', body: `<pre class="code">${esc(e.message)}</pre>`, footer: `<button class="btn btn-primary" onclick="closeModal()">OK</button>` });
      });
  }

  $('#svc-filter').addEventListener('input', (e) => draw(e.target.value));
  $('#svc-refresh').addEventListener('click', () => renderServices(el));
  draw();
}

/* ============ SITES (list) ============ */
const SI = {
  globe: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>`,
  layers: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>`,
  folder: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  git: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  server: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>`,
  play: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
  stop: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
  restart: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`,
  info: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>`,
  trash: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`,
  pull: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9 9 9 0 0 1 9 9Z"/><path d="M9 13v-3M15 13v-3"/><path d="M12 20a5 5 0 0 0 5-5"/></svg>`,
  plus: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>`,
};

async function renderSites(el) {
  el.innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span>&nbsp; Memuat websites...</div></div>`;
  let data;
  try { data = await api('/api/sites'); }
  catch (e) { el.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }

  el.innerHTML = `
    <div class="grid grid-kpi">
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.globe}</span>Nginx</div>
        <div class="kpi-value" style="display:flex;align-items:center;gap:8px">
          <span class="badge ${data.nginxActive ? 'badge-success' : 'badge-danger'}">${data.nginxActive ? 'running' : 'stopped'}</span>
        </div>
        <div class="kpi-sub">${data.nginxSitesDir ? esc(data.nginxSitesDir) : 'sites dir tidak ditemukan'}</div>
      </div></div>
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.layers}</span>Server blocks</div><div class="kpi-value">${data.sites.length}</div><div class="kpi-sub">konfigurasi nginx</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.folder}</span>Docroot</div><div class="kpi-value">${data.webDirs.length}</div><div class="kpi-sub">folder di /var/www</div></div></div>
      <div class="card"><div class="card-body"><div class="kpi-label"><span class="kpi-icon">${SI.git}</span>Git repos</div><div class="kpi-value">${data.webDirs.filter((w) => w.hasGit).length}</div><div class="kpi-sub">terintegrasi git</div></div></div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${SI.globe} Websites</span>
        <button class="btn btn-sm btn-primary" id="site-add">${SI.plus} Website Baru</button>
      </div>
      <div class="card-body borderless-rows" style="padding:0">
        ${sitesTable(data.sites)}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">${SI.folder} Folder /var/www &amp; Git</span></div>
      <div class="card-body borderless-rows" style="padding:0">
        ${data.webDirs.length === 0 ? `<div class="empty">Belum ada folder di /var/www</div>` :
        `<table>
          <thead><tr><th>Folder</th><th>Git</th><th>Branch</th><th style="width:210px">Aksi</th></tr></thead>
          <tbody>
            ${data.webDirs.map((w) => `<tr>
              <td><a href="#/site/${esc(w.name)}" style="color:inherit;text-decoration:none;font-weight:500" class="mono">${esc(w.name)}</a></td>
              <td class="mono muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(w.gitUrl || '')}">${w.hasGit ? esc(w.gitUrl || 'origin tidak ada') : '—'}</td>
              <td class="mono">${esc(w.branch || '—')}</td>
              <td class="actions-cell">
                ${w.hasGit ? `<button class="btn btn-sm btn-primary" data-pull="${esc(w.path)}">${SI.pull} Git Pull</button>` : ''}
                <button class="btn btn-sm btn-danger" data-delsite="${esc(w.name)}">${SI.trash} Hapus</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;

  $('#site-add').addEventListener('click', showAddSite);

  $$('button[data-delconf]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Hapus konfigurasi "${b.dataset.delconf}"?`)) return;
    try {
      await api('/api/sites/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: b.dataset.delconf }) });
      toast('Konfigurasi dihapus');
      renderSites(el);
    } catch (e) { toast(e.message, 'error'); }
  }));

  $$('button[data-pull]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Pulling…';
    try {
      const r = await api('/api/sites/git-pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir: b.dataset.pull }) });
      modal({ title: 'Git Pull', body: `<pre class="code">${esc(r.output || 'selesai')}</pre>`, footer: `<button class="btn btn-primary" onclick="closeModal()">OK</button>` });
    } catch (e) { toast(e.message, 'error'); }
    b.disabled = false; b.innerHTML = `${SI.pull} Git Pull`;
  }));
  $$('button[data-delsite]').forEach((b) => b.addEventListener('click', () => deleteSite(b.dataset.delsite, () => renderSites(el))));

  function sitesTable(sites) {
    if (sites.length === 0) return `<div class="empty">Belum ada server block nginx</div>`;
    return `<table>
        <thead><tr><th>File</th><th>Server name</th><th>Docroot</th><th>Listen</th><th>Status</th><th style="width:210px">Aksi</th></tr></thead>
        <tbody>
          ${sites.map((s) => {
            const name = s.filename;
            return `<tr>
            <td class="mono"><a href="#/site/${esc(name)}" style="color:inherit;text-decoration:none">${esc(s.filename)}</a></td>
            <td class="mono">${esc(s.serverName || '-')}</td>
            <td class="mono muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.root || '-')}</td>
            <td class="mono muted">${esc(s.listen || '-')}</td>
            <td><span class="badge ${s.enabled ? 'badge-success' : ''}">${s.enabled ? 'enabled' : 'disabled'}</span></td>
            <td class="actions-cell">
              <a class="btn btn-sm btn-primary" href="#/site/${esc(name)}">${SI.info} Detail</a>
              <button class="btn btn-sm btn-danger" data-delconf="${esc(s.file)}">${SI.trash} Hapus conf</button>
            </td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

}

function deleteSite(name, onDone) {
  const md = modal({
    title: `Hapus website: ${esc(name)}`,
    body: `
      <p style="margin-bottom:12px">Pilih apa saja yang ingin dihapus:</p>
      <div class="field"><label><input type="checkbox" id="del-conf" checked> Konfigurasi nginx (sites-available & enabled)</label></div>
      <div class="field"><label><input type="checkbox" id="del-dir" checked> Folder <span class="mono">/var/www/${esc(name)}</span></label></div>`,
    footer: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn btn-danger" id="del-go">Hapus</button>`,
  });
  $('#del-go', md).addEventListener('click', async () => {
    try {
      await api('/api/sites/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dir: `/var/www/${name}`,
          deleteDir: $('#del-dir').checked,
          file: $('#del-conf').checked ? `/etc/nginx/sites-available/${name}` : undefined,
        }),
      });
      closeModal(); toast('Website dihapus'); onDone && onDone();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function showAddSite() {
  const md = modal({
    title: 'Website Baru',
    body: `
      <div class="field"><label>Nama (dipakai sebagai slug)</label><input class="input" id="site-name" placeholder="appku"></div>
      <div class="field"><label>Domain / server_name</label><input class="input" id="site-domain" placeholder="appku.com"></div>
      <div class="field"><label>Git URL (kosongkan jika tidak menggunakan git)</label><input class="input mono" id="site-git" placeholder="https://github.com/user/repo.git"></div>
      <div class="field"><label>Branch</label><input class="input mono" id="site-branch" placeholder="main" value="main"></div>
      <div class="field"><label>Port listen</label><input class="input mono" id="site-port" placeholder="80" value="80"></div>
      <div class="field"><label>Docroot kustom (opsional)</label><input class="input mono" id="site-root" placeholder="/var/www/<nama>"></div>
    `,
    footer: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="site-go">Tambah</button>`,
  });
  $('#site-name', md).focus();
  $('#site-go', md).addEventListener('click', async () => {
    const name = $('#site-name').value.trim();
    const domain = $('#site-domain').value.trim();
    const gitUrl = $('#site-git').value.trim();
    const branch = $('#site-branch').value.trim();
    const port = $('#site-port').value.trim();
    const docroot = $('#site-root').value.trim();
    if (!name) return toast('Nama wajib diisi', 'error');
    $('#site-go').disabled = true; $('#site-go').textContent = 'Memproses...';
    try {
      const r = await api('/api/sites/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, serverName: domain, gitUrl, branch, port, root: docroot }),
      });
      closeModal();
      toast(`Website "${r.name}" berhasil dibuat — lanjut ke konfigurasi`);
      location.hash = `#/site/${name}`;
    } catch (e) {
      toast(e.message, 'error');
      $('#site-go').disabled = false; $('#site-go').textContent = 'Tambah';
    }
  });
}

/* ============ SITE DETAIL ============ */
async function renderSiteDetail(el, name, tab) {
  el.innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span>&nbsp; Memuat detail website...</div></div>`;
  let data;
  try { data = await api('/api/sites'); }
  catch (e) { el.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }

  const site = data.sites.find((s) => s.filename === name);
  const dir = data.webDirs.find((w) => w.name === name);
  if (!site && !dir) {
    el.innerHTML = `<div class="card"><div class="empty">Website "${esc(name)}" tidak ditemukan.
      <br><a href="#/sites" style="color:inherit;text-decoration:underline">Kembali ke daftar</a></div></div>`;
    return;
  }

  const tabs = ['overview', 'files', 'git', 'nginx', 'ssl'];
  const titles = { overview: 'Overview', files: 'Files', git: 'Git', nginx: 'Nginx', ssl: 'SSL' };
  const active = tabs.includes(tab) ? tab : 'overview';

  el.innerHTML = `
    <div class="site-head">
      <div>
        <div class="site-title-row">
          <h2 class="site-title mono">${esc(name)}</h2>
          ${site ? `<span class="badge ${site.enabled ? 'badge-success' : ''}">${site.enabled ? 'enabled' : 'disabled'}</span>` : ''}
          ${data.nginxActive ? '<span class="badge badge-success">nginx running</span>' : '<span class="badge badge-danger">nginx stopped</span>'}
        </div>
        <div class="site-sub">${site ? `server_name: <span class="mono">${esc(site.serverName || '-')}</span> · listen: <span class="mono">${esc(site.listen || '-')}</span> · docroot: <span class="mono">${esc(site.root || (dir ? dir.path : '-'))}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${site ? `<button class="btn btn-sm" id="sd-toggle">${site.enabled ? 'Disable' : 'Enable'}</button>` : ''}
        <button class="btn btn-sm btn-danger" id="sd-delete">Hapus Website</button>
      </div>
    </div>

    <div class="tabs">
      ${tabs.map((t) => `<button data-tab="${t}" class="${t === active ? 'active' : ''}">${titles[t]}</button>`).join('')}
    </div>

    <div id="site-tab-content"></div>`;

  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    location.hash = `#/site/${name}/${b.dataset.tab}`;
  }));

  $('#sd-delete').addEventListener('click', () => deleteSite(name, () => { location.hash = '#/sites'; }));
  const toggle = $('#sd-toggle');
  if (toggle) toggle.addEventListener('click', async () => {
    if (!site) return;
    toggle.disabled = true;
    try {
      const r = await api('/api/sites/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: site.file, enable: !site.enabled }) });
      toast(r.ok ? `Server block ${r.enabled ? 'enabled' : 'disabled'}` : 'Reload nginx gagal', r.ok ? '' : 'error');
      renderSiteDetail(el, name, active);
    } catch (e) { toast(e.message, 'error'); toggle.disabled = false; }
  });

  const content = $('#site-tab-content');
  if (active === 'overview') fillOverview(content);
  else if (active === 'files') fillFiles(content);
  else if (active === 'git') fillGit(content);
  else if (active === 'nginx') fillNginx(content);
  else if (active === 'ssl') fillSsl(content);

  function docroot() {
    return (site && site.root) || (dir && dir.path) || `/var/www/${name}`;
  }

  function fillOverview(container) {
    container.innerHTML = `
      <div class="grid grid-2">
        <div class="card"><div class="card-header"><span class="card-title">Ringkasan</span></div><div class="card-body"><dl class="kv">
          <dt>Nama</dt><dd>${esc(name)}</dd>
          <dt>Server name</dt><dd>${esc(site?.serverName || '-')}</dd>
          <dt>Docroot</dt><dd>${esc(docroot())}</dd>
          <dt>Listen</dt><dd>${esc(site?.listen || '-')}</dd>
          <dt>Status konfig</dt><dd>${site ? (site.enabled ? 'enabled' : 'disabled') : 'tanpa server block'}</dd>
          <dt>Git</dt><dd>${dir?.hasGit ? `${esc(dir.gitUrl || '-')} (${esc(dir.branch || '')})` : 'tidak ada'}</dd>
        </dl></div></div>
        <div class="card"><div class="card-header"><span class="card-title">Aksi Cepat</span></div><div class="card-body" style="display:flex;flex-direction:column;gap:10px">
          <button class="btn" data-goto="files">📝 Kelola file website</button>
          <button class="btn" data-goto="git">⬇️ Git Pull</button>
          <button class="btn" data-goto="nginx">⚙️ Edit konfigurasi nginx</button>
          <button class="btn" data-goto="ssl">🔒 SSL / sertifikat</button>
        </div></div>
      </div>`;
    $$('[data-goto]', container).forEach((b) => b.addEventListener('click', () => location.hash = `#/site/${name}/${b.dataset.goto}`));
  }

  function fillFiles(container) {
    container.innerHTML = `<div class="card" id="sdt-files"></div>`;
    fileBrowser($('#sdt-files', container), { root: docroot(), path: '/', persist: false });
  }

  async function fillGit(container) {
    container.innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span></div></div>`;
    let g;
    try { g = await api(`/api/sites/git-info?dir=${encodeURIComponent(docroot())}`); }
    catch (e) { container.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }

    if (!g.hasGit) {
      container.innerHTML = `
        <div class="card">
          <div class="card-header"><span class="card-title">Git</span></div>
          <div class="empty">
            Folder ini belum dihubungkan dengan repository Git.
            <div style="margin-top:14px">
              <button class="btn btn-primary" id="git-connect">Hubungkan Repo</button>
            </div>
          </div>
        </div>`;
      $('#git-connect', container).addEventListener('click', () => connectRepo());
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Repository</span>
          <button class="btn btn-sm btn-primary" id="git-pull">Git Pull</button>
        </div>
        <div class="card-body"><dl class="kv">
          <dt>Remote origin</dt><dd>${esc(g.gitUrl || '-')}</dd>
          <dt>Branch</dt><dd>${esc(g.branch || '-')}</dd>
          <dt>Perubahan lokal</dt><dd>${g.changes.length} file${g.changes.length ? `\n\n<span class="muted">${esc(g.changes.join('\n'))}</span>` : ''}</dd>
        </dl></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">5 Commit Terakhir</span></div>
        <div class="card-body" style="padding:0">
          <table><tbody>
            ${g.log.map((l) => `<tr><td class="mono">${esc(l)}</td></tr>`).join('') || '<tr><td class="muted">tidak ada</td></tr>'}
          </tbody></table>
        </div>
      </div>`;

    $('#git-pull', container).addEventListener('click', async () => {
      const b = $('#git-pull', container);
      b.disabled = true; b.textContent = 'Pulling…';
      try {
        const r = await api('/api/sites/git-pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir: docroot() }) });
        modal({ title: 'Git Pull', wide: true, body: `<pre class="code">${esc(r.output || 'selesai')}</pre>`, footer: `<button class="btn btn-primary" onclick="closeModal()">OK</button>` });
      } catch (e) { toast(e.message, 'error'); }
      b.disabled = false; b.textContent = 'Git Pull';
    });

    async function connectRepo() {
      const md = modal({
        title: 'Hubungkan Repo Git',
        body: `
          <div class="field"><label>Git URL</label><input class="input mono" id="gc-url" placeholder="https://github.com/user/repo.git"></div>
          <div class="field"><label>Branch</label><input class="input mono" id="gc-branch" value="main"></div>`,
        footer: `<button class="btn" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="gc-go">Clone</button>`,
      });
      $('#gc-go', md).addEventListener('click', async () => {
        $('#gc-go').disabled = true; $('#gc-go').textContent = 'Cloning...';
        try {
          const r = await api('/api/sites/git-clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dir: docroot(), gitUrl: $('#gc-url').value.trim(), branch: $('#gc-branch').value.trim() }),
          });
          closeModal();
          toast('Repo berhasil di-clone');
          fillGit(container);
        } catch (e) { toast(e.message, 'error'); $('#gc-go').disabled = false; $('#gc-go').textContent = 'Clone'; }
      });
    }
  }

  async function fillNginx(container) {
    container.innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span></div></div>`;
    if (!site) {
      container.innerHTML = `<div class="card"><div class="empty">Website ini belum punya server block nginx.</div></div>`;
      return;
    }
    let cfg;
    try { cfg = await api(`/api/sites/config?file=${encodeURIComponent(site.file)}`); }
    catch (e) { container.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Konfigurasi Nginx — <span class="mono">${esc(site.file)}</span></span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm" id="cfg-nginx-test">Test Config</button>
            <button class="btn btn-sm btn-primary" id="cfg-save">Simpan & Reload</button>
          </div>
        </div>
        <div class="card-body">
          <textarea class="input" id="cfg-content" spellcheck="false" style="min-height:420px">${esc(cfg.content)}</textarea>
        </div>
      </div>`;

    let cm = null;
    try {
      await ensureCodeMirror();
      cm = window.CodeMirror.fromTextArea($('#cfg-content', container), {
        lineNumbers: true,
        mode: 'nginx',
        indentUnit: 2,
        tabSize: 2,
      });
      cm.setSize('100%', '480px');
    } catch { /* fallback textarea */ }
    function cfgValue() { return cm ? cm.getValue() : $('#cfg-content', container).value; }

    $('#cfg-save', container).addEventListener('click', async () => {
      try {
        const r = await api('/api/sites/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: site.file, content: cfgValue() }) });
        toast(r.ok ? 'Konfigurasi tersimpan, nginx reload' : 'Tersimpan, tapi reload nginx gagal', r.ok ? '' : 'error');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#cfg-nginx-test', container).addEventListener('click', async () => {
      // simpan dulu lalu test
      try {
        await api('/api/sites/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: site.file, content: cfgValue() }) });
        const r = await api('/api/sites/nginx-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        modal({ title: 'nginx -t', wide: true, body: `<pre class="code">${esc(r.output || 'OK')}</pre>`, footer: `<button class="btn btn-primary" onclick="closeModal()">OK</button>` });
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function fillSsl(container) {
    container.innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span>&nbsp; Memuat info SSL...</div></div>`;
    const domain = (site && site.serverName && site.serverName.split(' ')[0]) || name;
    let info;
    try { info = await api(`/api/ssl/info?domain=${encodeURIComponent(domain)}`); }
    catch (e) { container.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Sertifikat SSL — ${esc(domain)}</span></div>
        <div class="card-body">
          ${info.found === true && info.daysLeft !== undefined ? `
            <dl class="kv">
              <dt>Issuer</dt><dd>${esc(info.issuer || '-')}</dd>
              <dt>Subject</dt><dd>${esc(info.subject || '-')}</dd>
              <dt>Berlaku mulai</dt><dd>${esc(info.notBefore || '-')}</dd>
              <dt>Berlaku hingga</dt><dd>${esc(info.notAfter || '-')} <span class="muted">(${info.daysLeft} hari lagi)</span></dd>
              <dt>Lokasi</dt><dd>${esc(info.dir || '-')}</dd>
            </dl>
            <div style="margin-top:14px;display:flex;gap:8px">
              <button class="btn btn-primary" id="ssl-renew">Perpanjang SSL</button>
              <span class="muted" style="align-self:center">certbot renew --cert-name ${esc(info.certName || domain)}</span>
            </div>
          ` : `
            <div class="empty">
              Belum ada sertifikat SSL untuk <b>${esc(domain)}</b>.
              <div style="margin-top:14px;max-width:420px;margin-left:auto;margin-right:auto;text-align:left">
                <div class="field"><label>Email untuk notifikasi Let's Encrypt (opsional)</label><input class="input mono" id="ssl-email" placeholder="admin@example.com"></div>
                <button class="btn btn-primary" id="ssl-issue" style="width:100px">Issue SSL</button>
              </div>
            </div>
          `}
        </div>
      </div>`;

    const renew = $('#ssl-renew', container);
    if (renew) renew.addEventListener('click', async () => {
      renew.disabled = true; renew.textContent = 'Memperpanjang…';
      try {
        const r = await api('/api/ssl/renew', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ certName: info.certName || domain }) });
        modal({ title: 'Perpanjang SSL', wide: true, body: `<pre class="code">${esc(r.output || 'selesai')}</pre>`, footer: `<button class="btn btn-primary" onclick="closeModal()">OK</button>` });
      } catch (e) { toast(e.message, 'error'); }
      renew.disabled = false; renew.textContent = 'Perpanjang SSL';
    });

    const issue = $('#ssl-issue', container);
    if (issue) issue.addEventListener('click', async () => {
      issue.disabled = true; issue.textContent = 'Issuing…';
      try {
        const r = await api('/api/ssl/issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain, email: $('#ssl-email', container).value.trim() }) });
        modal({ title: 'Issue SSL', wide: true, body: `<pre class="code">${esc(r.output || 'selesai')}</pre>`, footer: `<button class="btn btn-primary" onclick="closeModal()">OK</button>` });
        if (r.ok) fillSsl(container);
      } catch (e) { toast(e.message, 'error'); }
      issue.disabled = false; issue.textContent = 'Issue SSL';
    });
  }
}

/* ============ TERMINAL ============ */
let term = null;
let termSocket = null;
let termResizeHandler = null;

function terminalCleanup(target) {
  if (target !== 'terminal' && term) {
    try { termSocket && termSocket.close(); } catch {}
    try { term.dispose(); } catch {}
    term = null; termSocket = null;
    if (termResizeHandler) { window.removeEventListener('resize', termResizeHandler); termResizeHandler = null; }
  }
}

async function renderTerminal(el) {
  el.innerHTML = `
    <div class="card terminal-wrap">
      <div class="terminal-toolbar">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>
        <span class="toolbar-label">Web Terminal</span>
        <div style="flex:1"></div>
        <button class="btn btn-sm" id="term-clear">Bersihkan</button>
        <button class="btn btn-sm" id="term-reconnect">Reconnect</button>
      </div>
      <div class="terminal-container" id="term-container"></div>
    </div>`;

  $('#term-clear').addEventListener('click', () => { if (term) term.clear(); });
  $('#term-reconnect').addEventListener('click', () => {
    try { termSocket && termSocket.close(); } catch {}
    try { term && term.dispose(); } catch {}
    term = null; termSocket = null;
    start();
  });

  function start() {
    if (window.Terminal) {
      init();
      return;
    }
    $('#term-container').innerHTML = `<div class="empty"><span class="spinner"></span>&nbsp; Memuat terminal...</div>`;
    ensureXterm()
      .then(init)
      .catch((e) => {
        $('#term-container').innerHTML = `<div class="empty">Gagal memuat xterm.js: ${esc(e.message)}</div>`;
      });
  }

  function ensureXterm() {
    return new Promise((resolve, reject) => {
      if (window.Terminal) return resolve();
      const seq = [
        { tag: 'script', src: '/vendor/xterm.min.js' },
        { tag: 'script', src: '/vendor/addon-fit.min.js' },
      ];
      let i = 0;
      (function next() {
        if (i >= seq.length) {
          if (window.Terminal) return resolve();
          return reject(new Error('salah satu skrip gagal'));
        }
        if (!seq[i].el) {
          seq[i].el = document.createElement(seq[i].tag);
          seq[i].el.src = seq[i].src;
          seq[i].el.async = false;
          document.head.appendChild(seq[i].el);
        }
        seq[i].el.onload = () => { i++; next(); };
        seq[i].el.onerror = () => { reject(new Error('Tidak bisa memuat ' + seq[i].src)); };
      })();
    });
  }

  function init() {
    try { termSocket && termSocket.close(); } catch {}
    try { term && term.dispose(); } catch {}
    const container = $('#term-container');
    term = new window.Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      theme: {
        background: '#ffffff',
        foreground: '#000000',
        cursor: '#000000',
        cursorAccent: '#ffffff',
        selectionBackground: '#d0d0d0',
      },
    });
    const fit = new window.FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    termSocket = new WebSocket(`${proto}//${location.host}/terminal`);
    termSocket.onopen = () => {
      term.focus();
      termSocket.send(JSON.stringify({ type: 'resize', data: { cols: term.cols, rows: term.rows } }));
    };
    termSocket.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'data') term.write(msg.data);
    };
    term.onData((d) => {
      if (termSocket && termSocket.readyState === 1) termSocket.send(JSON.stringify({ type: 'data', data: d }));
    });
    termResizeHandler = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', termResizeHandler);
    termSocket.onclose = () => { try { term.write('\r\n\x1b[31m[Koneksi terputus — tekan Reconnect]\x1b[0m\r\n'); } catch {} };
  }

  start();
}

/* ============ ROUTER ============ */
const ROUTES = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  files: { title: 'File Manager', render: renderFiles },
  services: { title: 'Services', render: renderServices },
  sites: { title: 'Websites', render: renderSites },
  database: { title: 'Database', render: renderDatabase },
  terminal: { title: 'Web Terminal', render: renderTerminal },
  account: { title: 'Account', render: renderAccount },
};

function navigate() {
  const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const parts = hash.split('/').filter(Boolean);
  let page = parts[0] || 'dashboard';
  closeModal();

  if (page === 'site' && parts[1]) {
    const name = decodeURIComponent(parts[1]);
    const tab = parts[2] || 'overview';
    $('#page-title').textContent = `Website: ${name}`;
    $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.page === 'sites'));
    renderSiteDetail($('#page-content'), name, tab);
    return;
  }

  if (!ROUTES[page]) page = 'dashboard';
  terminalCleanup(page);
  const route = ROUTES[page];
  $('#page-title').textContent = route.title;
  $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  route.render($('#page-content'));
}

function updateAccountUI() {
  if (!ME) return;
  $('#account-name').textContent = ME.username;
  $('#account-host').textContent = ME.hostname || '';
  $('#account-avatar').textContent = (ME.username || '?').slice(0, 1);
  $('#btn-logout').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  });
}

async function boot() {
  try {
    ME = await api('/api/auth/me');
    ME.hostname = location.hostname;
  } catch {
    return; // api() sudah redirect ke /login saat 401
  }
  updateAccountUI();
  window.addEventListener('hashchange', () => { navigate(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  navigate();
}

boot();
