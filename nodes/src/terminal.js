const os = require('os');
const pty = require('node-pty');

function attachTerminal(wss) {
  wss.on('connection', (ws) => {
    const shell = process.env.SHELL || '/bin/bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.PANEL_ROOT || os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' }
    });

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
        if (type === 'data') ptyProcess.write(data);
        else if (type === 'resize') ptyProcess.resize(data.cols, data.rows);
      } catch {}
    });

    ws.on('close', () => {
      ptyProcess.kill();
    });
  });
}

module.exports = { attachTerminal };
