const fs = require('fs');
const pty = require('node-pty');
const os = require('os');
const auth = require('./auth');

const SYSTEM_SHELLS = ['/usr/sbin/nologin', '/sbin/nologin', '/bin/false'];

/**
 * Web terminal: shell selalu dijalankan sebagai user yang login.
 * - Berjalan sebagai root  : spawn `su - <user>` (tiap user dapat shell sendiri).
 * - Bukan root             : hanya user pemilik proses panel yang dapat terminal.
 */
function attachTerminal(wss) {
  wss.on('connection', (ws, req, username) => {
    try {
      setupConnection(ws, username);
    } catch (e) {
      sendMessage(ws, 'error', undefined, 'Kesalahan internal: ' + e.message);
      try { ws.close(); } catch {}
    }
  });
}

function setupConnection(ws, username) {
  const passUser = auth.isValidName(username) ? username : null;
  const allow = spawnShellFor(passUser, (msg) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'data', data: `[nodepanel] ${msg}\r\n` }));
      setTimeout(() => { try { ws.close(); } catch {} }, 750);
    }
  });

  if (!allow) return;

  let ptyProcess;
  try {
    ptyProcess = allow.spawn();
  } catch (e) {
    sendMessage(ws, 'error', undefined, 'Gagal membuka shell: ' + e.message);
    try { ws.close(); } catch {}
    return;
  }

  ptyProcess.onData((data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'data', data }));
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      ws.close();
    }
  });

  ws.on('message', (msg) => {
    try {
      const { type, data } = JSON.parse(msg);
      if (type === 'data' && typeof data === 'string') ptyProcess.write(data);
      else if (type === 'resize') ptyProcess.resize(Number(data.cols) || 80, Number(data.rows) || 24);
    } catch {}
  });

  ws.on('close', () => {
    try { ptyProcess.kill(); } catch {}
  });
}

function sendMessage(ws, type, data, message) {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type, data, message }));
}

function spawnShellFor(username, deny) {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    const info = userShellInfo(username);
    if (!username || !info) {
      deny('Sesi tidak valid untuk membuka terminal');
      return false;
    }
    if (SYSTEM_SHELLS.includes(info.shell)) {
      deny('Akun tidak punya shell login (nologin), terminal tidak tersedia');
      return false;
    }
    return {
      user: username,
      spawn: () => pty.spawn('su', ['-', username], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: info.home && info.home.startsWith('/') ? info.home : os.homedir(),
        env: { ...minimalEnv(info.home, username), TERM: 'xterm-256color', HOME: info.home || '/tmp' },
      }),
    };
  }

  const panelUser = os.userInfo().username;
  if (username && username !== panelUser) {
    deny(`Terminal khusus user panel (${panelUser}); jalankan panel sebagai root agar tiap user punya shell sendiri`);
    return false;
  }
  const shell = process.env.SHELL || '/bin/bash';
  return {
    user: panelUser,
    spawn: () => pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.PANEL_ROOT || os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' },
    }),
  };
}

function userShellInfo(username) {
  try {
    const line = fs.readFileSync('/etc/passwd', 'utf8').split('\n')
      .find((l) => l.split(':')[0] === username);
    if (!line) return null;
    const [, , , , , home, shell] = line.split(':');
    return { home, shell };
  } catch {
    return null;
  }
}

function minimalEnv(home, user) {
  return {
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    LANG: 'C.UTF-8',
    HOME: home || '/tmp',
    USER: user,
    SHELL: '/bin/bash',
  };
}

module.exports = { attachTerminal };
