const express = require('express');
const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Returns an error message, or null when email/password look valid
function checkCredentials(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string') return 'Invalid request.';
  if (!EMAIL_RE.test(email.trim()) || email.length > 254) return 'Please enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be at most 72 characters.';
  return null;
}
function isAtLeast18(birthDate) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age -= 1;
  return age >= 18;
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Helper to generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, status: user.status },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 1. Register Employer
router.post('/register-employer', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'registration_doc', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      company_name, 
      email, 
      password, 
      phone, 
      description, 
      website, 
      location, 
      industry, 
      contact_person, 
      date_of_birth,
      terms_accepted 
    } = req.body;

    { const bad = checkCredentials(email, password); if (bad) return res.status(400).json({ message: bad }); }
    if (!email || !password || !company_name) {
      return res.status(400).json({ message: 'Company name, business email, and password are required.' });
    }
    if (!isAtLeast18(date_of_birth)) {
      return res.status(400).json({ message: 'You must be at least 18 years old to create an account.' });
    }

    if (terms_accepted !== undefined && terms_accepted !== true && terms_accepted !== 'true') {
      return res.status(400).json({ message: 'You must accept the Terms and Conditions to register.' });
    }

    // Check existing email
    const existing = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email address already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Initial status is 'pending' for employer accounts
    const userRes = await query(
      'INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, role, status, name, email, phone, created_at',
      ['employer', 'pending', contact_person || company_name, email.trim().toLowerCase(), password_hash, phone || '', true]
    );

    const newUser = userRes.rows[0];

    let logo_url = null;
    let registration_doc_url = null;

    if (req.files && req.files['logo'] && req.files['logo'][0]) {
      logo_url = `/uploads/logos/${req.files['logo'][0].filename}`;
    }
    if (req.files && req.files['registration_doc'] && req.files['registration_doc'][0]) {
      registration_doc_url = `/uploads/documents/${req.files['registration_doc'][0].filename}`;
    }

    const empRes = await query(
      `INSERT INTO employers (user_id, company_name, industry, website, location, contact_person, description, logo_url, registration_doc_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        newUser.id, 
        company_name, 
        industry || 'Hospitality & Services', 
        website || '', 
        location || '', 
        contact_person || '', 
        description || '', 
        logo_url, 
        registration_doc_url
      ]
    );

    // Notify admins about pending approval
    try {
      const admins = await query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins.rows) {
        await query(
          'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
          [
            admin.id,
            'New Employer Verification Pending',
            `${company_name} registered and submitted business verification documents.`,
            'employer_approval',
            '/admin'
          ]
        );
      }
    } catch (e) {
      console.warn('Failed to notify admins of registration', e);
    }

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Employer account registered. Your account is pending administrator review.',
      token,
      user: newUser,
      employer: empRes.rows[0]
    });
  } catch (err) {
    console.error('Employer registration error:', err);
    res.status(500).json({ message: 'Internal server error during employer registration.', error: err.message });
  }
});

// 2. Register Employee (Job Seeker)
router.post('/register-employee', upload.single('resume'), async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      phone, 
      national_id, 
      date_of_birth, 
      education_level, 
      location, 
      skills, 
      headline, 
      terms_accepted 
    } = req.body;

    { const bad = checkCredentials(email, password); if (bad) return res.status(400).json({ message: bad }); }
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Full name, email address, and password are required.' });
    }
    if (!isAtLeast18(date_of_birth)) {
      return res.status(400).json({ message: 'You must be at least 18 years old to create an account.' });
    }

    if (terms_accepted !== undefined && terms_accepted !== true && terms_accepted !== 'true') {
      return res.status(400).json({ message: 'You must accept the Terms and Conditions to register.' });
    }

    const existing = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email address already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Job seekers start approved immediately
    const userRes = await query(
      'INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, role, status, name, email, phone, created_at',
      ['employee', 'approved', name, email.trim().toLowerCase(), password_hash, phone || '', true]
    );

    const newUser = userRes.rows[0];

    let resume_url = null;
    if (req.file) {
      resume_url = `/uploads/resumes/${req.file.filename}`;
    }

    const seekerRes = await query(
      `INSERT INTO job_seekers (user_id, national_id, date_of_birth, education_level, location, headline, bio, skills, resume_url, portfolio_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        newUser.id, 
        national_id || '', 
        date_of_birth || '', 
        education_level || '', 
        location || '', 
        headline || '', 
        '', 
        skills || '', 
        resume_url, 
        ''
      ]
    );

    // Welcome notification
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
      [newUser.id, 'Welcome to Akazi!', 'Your job seeker profile is ready. Browse open positions and apply directly.', 'system', '/jobs']
    );

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Candidate account created successfully.',
      token,
      user: newUser,
      profile: seekerRes.rows[0]
    });
  } catch (err) {
    console.error('Job seeker registration error:', err);
    res.status(500).json({ message: 'Internal server error during registration.', error: err.message });
  }
});

// 3. Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const userRes = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended by administration. Please contact support.' });
    }

    let roleData = null;
    if (user.role === 'employer') {
      const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [user.id]);
      roleData = empRes.rows[0] || null;
    } else if (user.role === 'employee') {
      const seekerRes = await query('SELECT * FROM job_seekers WHERE user_id = $1', [user.id]);
      roleData = seekerRes.rows[0] || null;
    }

    const safeUser = {
      id: user.id,
      role: user.role,
      status: user.status,
      name: user.name,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    res.json({
      message: 'Login successful.',
      token,
      user: safeUser,
      profile: roleData,
      employer: user.role === 'employer' ? roleData : null
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
});

// 4. Current User Session
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let roleData = null;

    if (user.role === 'employer') {
      const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [user.id]);
      roleData = empRes.rows[0] || null;
    } else if (user.role === 'employee') {
      const seekerRes = await query('SELECT * FROM job_seekers WHERE user_id = $1', [user.id]);
      roleData = seekerRes.rows[0] || null;
    }

    const notifRes = await query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false', [user.id]);
    const unreadNotifications = parseInt(notifRes.rows[0]?.count || 0, 10);

    res.json({
      user,
      profile: roleData,
      employer: user.role === 'employer' ? roleData : null,
      unreadNotifications
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ message: 'Failed to retrieve session data.' });
  }
});

module.exports = router;
