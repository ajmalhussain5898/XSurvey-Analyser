// POST (Authorization: Bearer <admin token>) { email, role, name? }
// -> { ok:true, email, name, role, tempPassword }
// Creates the account and returns the generated password ONCE, on screen, for the
// admin to send to the person manually (WhatsApp/email) — nothing is emailed automatically.

const { kv } = require('../lib/kv');
const { requireAdmin, hashPassword, genTempPassword } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  if (!requireAdmin(req, res)) return;

  const { email, role, name } = req.body || {};
  if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }
  const normEmail = String(email).trim().toLowerCase();
  const finalRole = ['analyst', 'exec', 'admin'].includes(role) ? role : 'exec';

  try {
    const pending = await kv.get('pending:' + normEmail);
    const tempPassword = genTempPassword();
    const { salt, hash } = hashPassword(tempPassword);
    const user = {
      name: (name || (pending && pending.name) || normEmail.split('@')[0]).slice(0, 120),
      email: normEmail, salt, hash, role: finalRole,
      createdAt: new Date().toISOString()
    };
    await kv.set('user:' + normEmail, user);
    await kv.del('pending:' + normEmail);
    res.status(200).json({ ok: true, email: normEmail, name: user.name, role: finalRole, tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
