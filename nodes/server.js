const os = require('os');
const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { attachTerminal } = require('./src/terminal');
const auth = require('./src/auth');

const dashboardRoutes = require('./src/routes/dashboard');
const filesRoutes = require('./src/routes/files');
const servicesRoutes = require('./src/routes/services');
const sitesRoutes = require('./src/routes/sites');
const sslRoutes = require('./src/routes/ssl');
const databaseRoutes = require('./src/routes/database');
const accountsRoutes = require('./src/routes/accounts');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(auth.middleware);
auth.routes(app);

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use('/api/ssl', sslRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/dashboard', auth.requireAuth, dashboardRoutes);
app.use('/api/files', auth.requireAuth, filesRoutes);
app.use('/api/services', auth.requireAuth, servicesRoutes);
app.use('/api/sites', auth.requireAuth, sitesRoutes);
app.use('/api/accounts', auth.requireAuth, accountsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hostname: os.hostname(), time: new Date().toISOString() });
});

app.use('/', auth.middleware, (req, res, next) => {
  if (req.path === '/' && !req.user) return res.redirect('/login');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });
attachTerminal(wss);

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/terminal' && auth.checkRequest(req)) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`NodePanel berjalan di http://localhost:${PORT} — login: akun Linux lokal`);
});
