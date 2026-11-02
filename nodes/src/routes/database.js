const express = require('express');
const { execFile } = require('child_process');

const router = express.Router();

function run(cmd, args, options = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: options.timeout || 10000, cwd: options.cwd || process.cwd() }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout, stderr, err });
    });
  });
}

router.get('/status', async (req, res) => {
  const result = { servers: [] };

  for (const svc of ['mysql', 'mariadb']) {
    const check = await run('systemctl', ['is-active', svc + '.service']);
    const running = check.stdout.trim() === 'active';
    const databases = [];
    if (running) {
      const mysqlInfo = await run('mysql', ['-N', '-e', 'SHOW DATABASES'], { timeout: 10000 });
      databases = mysqlInfo.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    result.servers.push({ service: svc, running, databases });
  }

  const redisCheck = await run('systemctl', ['is-active', 'redis-server.service']);
  const redisRunning = redisCheck.stdout.trim() === 'active';
  if (redisRunning) {
    result.servers.push({ service: 'redis', running: true, databases: [{ name: 'redis', kind: 'in-memory cache' }] });
  }

  result.runningCount = result.servers.filter((s) => s.running).length;
  res.json(result);
});

module.exports = router;
