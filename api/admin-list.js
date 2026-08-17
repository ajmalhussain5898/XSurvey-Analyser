// GET (Authorization: Bearer <admin token>) -> { pending: [...], users: [...] }
const { kv } = require('../lib/kv');
const { requireAdmin } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  if (!requireAdmin(req, res)) return;

  try {
    const pendingKeys = await kv.keys('pending:*');
    const userKeys = await kv.keys('user:*');
    const pendingRaw = pendingKeys.length ? await Promise.all(pendingKeys.map(k => kv.get(k))) : [];
    const usersRaw = userKeys.length ? await Promise.all(userKeys.map(k => kv.get(k))) : [];
    const users = usersRaw.filter(Boolean).map(u => ({ name: u.name, email: u.email, role: u.role, createdAt: u.createdAt }))
      .sort((a, b) => (a.email > b.email ? 1 : -1));
    const pending = pendingRaw.filter(Boolean).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    res.status(200).json({ pending, users });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
