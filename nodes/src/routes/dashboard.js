const express = require('express');
const si = require('systeminformation');
const { execFile } = require('child_process');
const os = require('os');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const router = express.Router();

async function run(cmd, args) {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

router.get('/', async (req, res) => {
  try {
    const [
      cpuLoad, cpuInfo, cpuTemp, mem, fsSize, osInfo, time, net, netStats,
      diskIO, processes, usersGroup, dockerInfo, versions
    ] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
      si.cpuTemperature(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
      si.time(),
      si.networkInterfaces(),
      si.networkStats(),
      si.disksIO(),
      si.processes(),
      si.users(),
      si.dockerContainers().catch(() => []),
      si.versions()
    ]);

    const hostname = await run('hostname');
    const uptimeShell = await run('uptime', ['-p']);
    const whoBoot = await run('who', ['-b']);

    const disks = fsSize.map((d) => ({
      fs: d.fs,
      mount: d.mount,
      type: d.type,
      total: d.size,
      used: d.used,
      available: d.available,
      usePercent: d.use ? Math.round(d.use) : null
    }));

    const memory = {
      total: mem.total,
      used: mem.used,
      active: mem.active,
      available: mem.available,
      free: mem.free,
      swapTotal: mem.swaptotal,
      swapUsed: mem.swapused,
      swapFree: mem.swapfree,
      usePercent: Math.round((mem.used / mem.total) * 100),
      swapPercent: mem.swaptotal ? Math.round((mem.swapused / mem.swaptotal) * 100) : 0
    };

    const cpu = {
      manufacturer: cpuInfo.manufacturer,
      brand: cpuInfo.brand,
      speed: cpuInfo.speed,
      cores: cpuInfo.cores,
      processors: cpuInfo.processors,
      loadPercent: Math.round(cpuLoad.currentLoad),
      loadUser: Math.round(cpuLoad.currentLoadUser),
      loadSystem: Math.round(cpuLoad.currentLoadSystem),
      loadAvg: os.loadavg(),
      temperature: cpuTemp.main && cpuTemp.main > 0 ? cpuTemp.main : null
    };

    const netIfaces = net
      .filter((i) => !i.virtual && i.ip4)
      .map((i) => ({
        iface: i.iface,
        internal: i.internal,
        ip4: i.ip4,
        mac: i.mac,
        type: i.type
      }));

    const netStat = netStats
      .filter((s) => s.iface && s.rx_sec !== undefined && !s.iface.startsWith('lo'))
      .map((s) => ({
        iface: s.iface,
        rxSec: s.rx_sec > 0 ? s.rx_sec : 0,
        txSec: s.tx_sec > 0 ? s.tx_sec : 0,
        rxBytes: s.rx_bytes,
        txBytes: s.tx_bytes
      }));

    const disksIo = diskIO && (diskIO.rIO || diskIO.wIO) ? {
      rIO: diskIO.rIO,
      wIO: diskIO.wIO,
      rBytes: diskIO.rIO_sec !== undefined ? diskIO.rIO_sec : null,
      wBytes: diskIO.wIO_sec !== undefined ? diskIO.wIO_sec : null
    } : null;

    const topProcesses = (processes.list || [])
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 8)
      .map((p) => ({
        pid: p.pid,
        name: p.name,
        cpu: Math.round(p.cpu * 10) / 10,
        mem: Math.round(p.mem * 10) / 10,
        user: p.user,
        state: p.state
      }));

    res.json({
      host: {
        hostname: hostname || os.hostname(),
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        codename: osInfo.codename,
        arch: osInfo.arch,
        kernel: osInfo.kernel,
        virtual: osInfo.virtual,
        logoFile: osInfo.logofile
      },
      uptime: os.uptime(),
      uptimeText: uptimeShell || null,
      bootTime: whoBoot || null,
      time: {
        timezone: time.timezone,
        timezoneName: time.timezoneName,
        localDate: time.localtime
      },
      cpu,
      memory,
      disks,
      network: { interfaces: netIfaces, stats: netStat },
      disksIo,
      processes: { all: processes.all, running: processes.running, top: topProcesses },
      users: usersGroup.map((u) => ({ user: u.user, terminal: u.tty, login: u.loginDate, ip: u.ip })),
      docker: {
        containers: (Array.isArray(dockerInfo) ? dockerInfo : []).map((c) => ({ name: c.name, state: c.state, image: c.image }))
      },
      versions: {
        node: versions.node,
        nginx: versions.nginx || null,
        docker: versions.docker || null,
        git: versions.git || null,
        openssl: versions.openssl || null,
        python: versions.python || null
      },
      nodeUptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
