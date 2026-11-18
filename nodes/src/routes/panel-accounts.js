const express = require('express');
const panelAccounts = require('../panel-accounts');
const auth = require('../auth');

const router = express.Router();

// Manajemen akun panel hanya boleh diakses administrator.
router.use(auth.requireAuth, auth.requirePermission('account'));

router.get('/', (req, res) => {
  res.json({
    accounts: panelAccounts.listAccounts(),
    permissions: panelAccounts.getPermissions(),
    roles: panelAccounts.ROLES,
  });
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const r = panelAccounts.createAccount({
    username: b.username,
    password: b.password,
    role: b.role,
    permissions: b.permissions,
    fullName: b.fullName,
  });
  if (!r.ok) return res.status(400).json({ error: r.error });
  res.status(201).json({ ok: true, account: r.account });
});

router.put('/:username', (req, res) => {
  const r = panelAccounts.updateAccount(req.params.username, req.body || {});
  if (!r.ok) return res.status(400).json({ error: r.error });
  res.json({ ok: true, account: r.account });
});

router.delete('/:username', (req, res) => {
  if (req.params.username === req.user) return res.status(400).json({ error: 'Tidak bisa menghapus akun yang sedang login' });
  const r = panelAccounts.deleteAccount(req.params.username);
  if (!r.ok) return res.status(400).json({ error: r.error });
  res.json({ ok: true });
});

module.exports = router;
