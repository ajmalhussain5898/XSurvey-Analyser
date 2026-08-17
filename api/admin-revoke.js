// POST (Authorization: Bearer <admin token>) { email } -> { ok:true }
const { kv } = require('../lib/kv');
const { requireAdmin } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { email } = req.body || {};
  if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }
  const normEmail = String(email).trim().toLowerCase();
  if (normEmail === admin.email) { res.status(400).json({ error: "You can't revoke your own access." }); return; }

  try {
    await kv.del('user:' + normEmail);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
