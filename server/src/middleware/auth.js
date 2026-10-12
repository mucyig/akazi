const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN, REQUIRE_EMAIL_VERIFICATION } = require('../lib/env');

const USER_COLS = 'id, role, status, name, email, phone, email_verified_at, password_changed_at';

const toPublicUser = (u) => ({
  id: u.id, role: u.role, status: u.status, name: u.name, email: u.email, phone: u.phone,
  email_verified: !!u.email_verified_at, created_at: u.created_at,
});

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN });
}

// Returns the user for a valid token, or { error, status } explaining why not
async function resolveToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return { error: 'Invalid or expired session. Please sign in again.', status: 401 };
  }
  const r = await query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [decoded.id]);
  const user = r.rows[0];
  if (!user) return { error: 'User account no longer exists.', status: 401 };
  // A password change or reset signs out every older session
  if (user.password_changed_at && decoded.iat < Math.floor(new Date(user.password_changed_at).getTime() / 1000)) {
    return { error: 'Your password was changed. Please sign in again.', status: 401 };
  }
  if (user.status === 'suspended') return { error: 'Your account has been suspended by administration.', status: 403 };
  return { user };
}

const bearer = (req) => {
  const h = req.headers['authorization'];
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
};

async function authenticateToken(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ message: 'Authentication required. No token provided.' });
  try {
    const out = await resolveToken(token);
    if (out.error) return res.status(out.status).json({ message: out.error });
    req.user = out.user;
    next();
  } catch (err) {
    console.error('[Auth] error:', err.message);
    res.status(500).json({ message: 'Could not verify your session. Please try again.' });
  }
}

// Attaches the user when a valid token is present, otherwise carries on as a guest
async function optionalAuth(req, res, next) {
  req.user = null;
  const token = bearer(req);
  if (!token) return next();
  try {
    const out = await resolveToken(token);
    if (out.user) req.user = out.user;
  } catch { /* guest */ }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: `Access denied. Requires role: ${roles.join(' or ')}` });
    next();
  };
}

// When REQUIRE_EMAIL_VERIFICATION=true, unverified accounts cannot apply or post jobs
function requireVerifiedEmail(req, res, next) {
  if (REQUIRE_EMAIL_VERIFICATION && req.user && req.user.role !== 'admin' && !req.user.email_verified_at) {
    return res.status(403).json({ message: 'Please verify your email address first. Check your inbox for the link.', code: 'EMAIL_NOT_VERIFIED' });
  }
  next();
}

// Approved AND paid employer (admins pass through)
async function requireActiveEmployer(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  if (req.user.role === 'admin') return next();
  if (req.user.role !== 'employer') return res.status(403).json({ message: 'Access denied. Only employers can perform this action.' });
  if (req.user.status === 'pending') {
    return res.status(403).json({ message: 'Your employer account is currently pending admin approval. You cannot perform this action until approved.', code: 'EMPLOYER_PENDING' });
  }
  if (req.user.status !== 'approved') {
    return res.status(403).json({ message: `Your employer account status is ${req.user.status}.`, code: 'EMPLOYER_INACTIVE' });
  }
  try {
    const empRes = await query('SELECT payment_status FROM employers WHERE user_id = $1', [req.user.id]);
    const paymentStatus = (empRes.rows[0] && empRes.rows[0].payment_status) || 'unpaid';
    if (paymentStatus !== 'paid') {
      return res.status(403).json({ message: 'Please complete your 5,000 RWF verification payment to continue.', code: 'EMPLOYER_UNPAID', payment_status: paymentStatus });
    }
  } catch {
    return res.status(500).json({ message: 'Could not verify your payment status. Please try again.' });
  }
  next();
}

module.exports = { JWT_SECRET, generateToken, toPublicUser, authenticateToken, optionalAuth, requireRole, requireVerifiedEmail, requireActiveEmployer };
