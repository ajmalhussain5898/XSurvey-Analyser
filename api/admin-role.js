// POST (Authorization: Bearer <admin token>) { email, role } -> { ok:true }
const { kv } = require('../lib/kv');
const { requireAdmin } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  if (!requireAdmin(req, res)) return;

  const { email, role } = req.body || {};
  if (!email || !['analyst', 'exec', 'admin'].includes(role)) { res.status(400).json({ error: 'A valid email and role are required.' }); return; }
  const normEmail = String(email).trim().toLowerCase();

  try {
    const user = await kv.get('user:' + normEmail);
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    user.role = role;
    await kv.set('user:' + normEmail, user);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
