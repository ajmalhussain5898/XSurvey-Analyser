// POST { email, password } -> { token, name, email, role }
//
// Special case: the very first time the developer logs in with the email/password
// set as ADMIN_EMAIL / ADMIN_PASSWORD in Vercel env vars, that account is created
// automatically with role "admin". No manual DB setup or seed script needed —
// after that first login it's a normal stored user like any other.

const { kv } = require('../lib/kv');
const { hashPassword, verifyPassword, signToken } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }

  const { email, password } = req.body || {};
  if (!email || !password) { res.status(400).json({ error: 'Email and password are required.' }); return; }
  const normEmail = String(email).trim().toLowerCase();

  try {
    let user = await kv.get('user:' + normEmail);

    if (!user) {
      const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      if (adminEmail && normEmail === adminEmail) {
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) { res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' }); return; }
        if (password !== adminPassword) { res.status(401).json({ error: 'Incorrect email or password.' }); return; }
        const { salt, hash } = hashPassword(adminPassword);
        user = { name: 'Admin', email: normEmail, salt, hash, role: 'admin', createdAt: new Date().toISOString() };
        await kv.set('user:' + normEmail, user);
      }
    }

    if (!user) { res.status(401).json({ error: 'Incorrect email or password, or this account has not been approved yet.' }); return; }
    if (!verifyPassword(password, user.salt, user.hash)) { res.status(401).json({ error: 'Incorrect email or password.' }); return; }

    const token = signToken({ email: user.email, name: user.name, role: user.role });
    res.status(200).json({ token, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
