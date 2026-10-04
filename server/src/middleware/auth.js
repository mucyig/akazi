const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'akazi_super_secure_jwt_secret_key_2026_dev_prod';

// Verify JWT token and attach user to request
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    // Fetch fresh user data from db
    const userRes = await query('SELECT id, role, status, name, email, phone FROM users WHERE id = $1', [decoded.id]);
    if (!userRes.rows || userRes.rows.length === 0) {
      return res.status(401).json({ message: 'User account no longer exists.' });
    }

    const { password_hash, ...user } = userRes.rows[0];
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended by administration.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired session token.' });
  }
}

// Optional auth for public routes (attaches user if valid token present)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const userRes = await query('SELECT id, role, status, name, email FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows && userRes.rows.length > 0) {
      req.user = userRes.rows[0];
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

// Check role(s)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// Require approved employer
function requireApprovedEmployer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  if (req.user.role === 'admin') {
    // Admins can manage employer resources if needed
    return next();
  }
  if (req.user.role !== 'employer') {
    return res.status(403).json({ message: 'Access denied. Only employers can perform this action.' });
  }
  if (req.user.status === 'pending') {
    return res.status(403).json({
      message: 'Your employer account is currently pending admin approval. You cannot perform this action until approved.',
      code: 'EMPLOYER_PENDING'
    });
  }
  if (req.user.status !== 'approved') {
    return res.status(403).json({ message: `Your employer account status is ${req.user.status}.` });
  }
  next();
}

// Require an employer that is BOTH admin-approved AND has paid the verification fee
async function requireActiveEmployer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  if (req.user.role === 'admin') {
    // Admins can manage employer resources if needed
    return next();
  }
  if (req.user.role !== 'employer') {
    return res.status(403).json({ message: 'Access denied. Only employers can perform this action.' });
  }
  if (req.user.status === 'pending') {
    return res.status(403).json({
      message: 'Your employer account is currently pending admin approval. You cannot perform this action until approved.',
      code: 'EMPLOYER_PENDING'
    });
  }
  if (req.user.status !== 'approved') {
    return res.status(403).json({ message: `Your employer account status is ${req.user.status}.`, code: 'EMPLOYER_INACTIVE' });
  }

  // Approved businesses must also settle the 5,000 RWF verification fee
  try {
    const empRes = await query('SELECT payment_status FROM employers WHERE user_id = $1', [req.user.id]);
    const paymentStatus = (empRes.rows[0] && empRes.rows[0].payment_status) || 'unpaid';
    if (paymentStatus !== 'paid') {
      return res.status(403).json({
        message: 'Please complete your 5,000 RWF verification payment to continue.',
        code: 'EMPLOYER_UNPAID',
        payment_status: paymentStatus
      });
    }
  } catch (e) {
    return res.status(500).json({ message: 'Could not verify your payment status. Please try again.' });
  }

  next();
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  optionalAuth,
  requireRole,
  requireApprovedEmployer,
  requireActiveEmployer
};
