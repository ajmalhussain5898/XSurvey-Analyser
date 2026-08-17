// Shared, dependency-free auth helpers used by every /api/* function.
// - Passwords are hashed with Node's built-in scrypt (never stored in plain text).
// - Sessions are a signed, stateless token (payload + HMAC-SHA256 signature) — no
//   session table needed. The server just needs SESSION_SECRET to verify them.

const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function hashPassword(password, existingSalt) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  try {
    const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(check, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}
// Generates a readable temporary password, e.g. "Xk4-Tqp92R"
function genTempPassword() {
  const raw = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  const p = (raw + 'Xa9Tq2Rk').slice(0, 10);
  return p.slice(0, 3) + '-' + p.slice(3);
}

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not configured on the server. Add it under Vercel → Project Settings → Environment Variables.');
  return s;
}

function signToken(payload, expiresInSeconds) {
  const secret = getSecret();
  const body = Object.assign({}, payload, {
    iat: Date.now(),
    exp: Date.now() + (expiresInSeconds || 60 * 60 * 24 * 7) * 1000 // default 7 days
  });
  const payloadB64 = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  return payloadB64 + '.' + b64url(sig);
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  let secret;
  try { secret = getSecret(); } catch (e) { return null; }
  const expectedSigB64 = b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
  const a = Buffer.from(expectedSigB64);
  const b = Buffer.from(sigB64);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')); } catch (e) { return null; }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function getBearerToken(req) {
  const h = (req.headers && (req.headers['authorization'] || req.headers['Authorization'])) || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

// Call at the top of any handler that requires a logged-in user of any role.
// Returns the decoded payload {email,name,role,...} or null (and already sent a 401).
function requireAuth(req, res) {
  const payload = verifyToken(getBearerToken(req));
  if (!payload) {
    res.status(401).json({ error: 'Your session has expired or is invalid. Please log in again.' });
    return null;
  }
  return payload;
}

// Same, but also requires role === 'admin'. Sends 403 if logged in but not an admin.
function requireAdmin(req, res) {
  const payload = requireAuth(req, res);
  if (!payload) return null;
  if (payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin access is required for this action.' });
    return null;
  }
  return payload;
}

module.exports = { hashPassword, verifyPassword, genTempPassword, signToken, verifyToken, getBearerToken, requireAuth, requireAdmin };
