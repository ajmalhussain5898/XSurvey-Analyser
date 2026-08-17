// POST { name, email, roleRequested, note } -> { ok: true }
// Stores a pending request for an admin to review under the Admin Portal tab.
// No account or access is granted here — this only queues the request.

const { kv } = require('../lib/kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }

  const { name, email, roleRequested, note } = req.body || {};
  if (!name || !email) { res.status(400).json({ error: 'Name and email are required.' }); return; }
  const normEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) { res.status(400).json({ error: 'Enter a valid email address.' }); return; }

  try {
    const existingUser = await kv.get('user:' + normEmail);
    if (existingUser) { res.status(409).json({ error: 'This email already has access — try logging in instead.' }); return; }

    await kv.set('pending:' + normEmail, {
      name: String(name).trim().slice(0, 120),
      email: normEmail,
      roleRequested: ['analyst', 'exec'].includes(roleRequested) ? roleRequested : 'exec',
      note: note ? String(note).trim().slice(0, 300) : '',
      requestedAt: new Date().toISOString()
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
