const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { query, withTransaction } = require('../db');
const { generateToken, toPublicUser, authenticateToken } = require('../middleware/auth');
const { upload, storeUpload } = require('../middleware/upload');
const storage = require('../lib/storage');
const { ageOn, isValidYmd } = require('../lib/time');
const { cleanStr, checkFullName, checkEmail, checkPassword, checkEmailAndPassword, normalizeUrl, checkPhone, validatePhone, normalizePhone, isPgUnique } = require('../lib/validate');
const { createToken, consumeToken, recentTokenCount } = require('../lib/tokens');
const { sendMailLater, link } = require('../lib/mailer');
const { audit } = require('../lib/audit');
const { isProd } = require('../lib/env');

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_TTL_MIN = 30;
const VERIFY_TTL_MIN = 60 * 24;
// Used so that unknown emails cost the same time as known ones (no user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-for-timing', 10);

const keyedLimiter = (max, windowMs, message) => rateLimit({
  windowMs, limit: max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.clientIp || req.ip,
  message: { message },
});
const forgotLimiter = keyedLimiter(8, 60 * 60 * 1000, 'Too many reset requests. Please try again later.');
const resetLimiter = keyedLimiter(20, 60 * 60 * 1000, 'Too many attempts. Please try again later.');
const verifyLimiter = keyedLimiter(30, 60 * 60 * 1000, 'Too many attempts. Please try again later.');

async function sendVerificationEmail(user) {
  const raw = await createToken(user.id, 'verify', VERIFY_TTL_MIN);
  sendMailLater({
    to: user.email,
    subject: 'Confirm your email for Akazi',
    title: `Welcome to Akazi, ${user.name.split(' ')[0]}`,
    intro: 'Please confirm your email address so we can reach you about your applications and keep your account safe.',
    ctaLabel: 'Confirm my email',
    ctaUrl: link('/verify-email', { token: raw }),
    outro: 'This link works for 24 hours. If you did not create an Akazi account you can ignore this message.',
  });
}

const passwordIssue = (v, email) => checkPassword(v, email);

// 1. Register employer
router.post('/register-employer', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'registration_doc', maxCount: 1 }]), async (req, res) => {
  const stored = [];
  try {
    const b = req.body || {};
    const email = cleanStr(b.email, 254).toLowerCase();
    const company_name = cleanStr(b.company_name, 150);
    const bad = checkEmailAndPassword(email, b.password);
    if (bad) return res.status(400).json({ message: bad });
    if (!company_name || company_name.length < 2) return res.status(400).json({ message: 'Company name must be at least 2 characters.' });
    if (!isValidYmd(b.date_of_birth) || ageOn(b.date_of_birth) < 18) return res.status(400).json({ message: 'You must be at least 18 years old to create an account.' });
    if (b.terms_accepted !== true && b.terms_accepted !== 'true') return res.status(400).json({ message: 'You must accept the Terms and Conditions to register.' });
    const phoneErr = validatePhone(b.phone);
    if (phoneErr) return res.status(400).json({ message: phoneErr });
    const phone = normalizePhone(b.phone);
    const website = normalizeUrl(b.website);
    if (website === null) return res.status(400).json({ message: 'Please enter a valid website address (for example https://example.rw).' });

    const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ message: 'An account with this email address already exists.' });

    const password_hash = await bcrypt.hash(b.password, 11);
    let logo_key = null; let doc_key = null;
    if (req.files?.logo?.[0]) { logo_key = await storeUpload(req.files.logo[0], 'logos'); stored.push(logo_key); }
    if (req.files?.registration_doc?.[0]) { doc_key = await storeUpload(req.files.registration_doc[0], 'documents'); stored.push(doc_key); }

    const contact = cleanStr(b.contact_person, 120);
    if (contact) {
      const contactErr = checkFullName(contact);
      if (contactErr) return res.status(400).json({ message: `Contact person: ${contactErr}` });
    }
    const { user, employer } = await withTransaction(async (q) => {
      const u = await q(
        `INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted, password_changed_at)
         VALUES ('employer','pending',$1,$2,$3,$4,true,NULL) RETURNING id, role, status, name, email, phone, email_verified_at, created_at`,
        [contact || company_name, email, password_hash, phone]
      );
      const e = await q(
        `INSERT INTO employers (user_id, company_name, industry, website, location, contact_person, description, logo_url, registration_doc_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [u.rows[0].id, company_name, cleanStr(b.industry, 100) || 'Hospitality & Services', website, cleanStr(b.location, 255), contact, cleanStr(b.description, 2000), logo_key, doc_key]
      );
      return { user: u.rows[0], employer: e.rows[0] };
    });

    try {
      const admins = await query("SELECT id FROM users WHERE role = 'admin'");
      for (const a of admins.rows) {
        await query('INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)',
          [a.id, 'New Employer Verification Pending', `${company_name} registered and submitted business verification documents.`, 'employer_approval', '/admin']);
      }
    } catch (e) { console.warn('Failed to notify admins of registration', e.message); }

    sendVerificationEmail(user).catch(() => {});
    res.status(201).json({
      message: 'Employer account registered. Your account is pending administrator review.',
      token: generateToken(user), user: toPublicUser(user), employer,
    });
  } catch (err) {
    if (stored.length) await storage.remove(stored);
    if (isPgUnique(err)) return res.status(409).json({ message: 'An account with this email address already exists.' });
    console.error('Employer registration error:', err.message);
    res.status(500).json({ message: 'Something went wrong while creating your account. Please try again.' });
  }
});

// 2. Register job seeker
router.post('/register-employee', upload.single('resume'), async (req, res) => {
  const stored = [];
  try {
    const b = req.body || {};
    const email = cleanStr(b.email, 254).toLowerCase();
    const name = cleanStr(b.name, 120);
    const bad = checkEmailAndPassword(email, b.password);
    if (bad) return res.status(400).json({ message: bad });
    const nameErr = checkFullName(name);
    if (nameErr) return res.status(400).json({ message: nameErr });
    if (!isValidYmd(b.date_of_birth) || ageOn(b.date_of_birth) < 18) return res.status(400).json({ message: 'You must be at least 18 years old to create an account.' });
    if (b.terms_accepted !== true && b.terms_accepted !== 'true') return res.status(400).json({ message: 'You must accept the Terms and Conditions to register.' });
    const phoneErr = validatePhone(b.phone);
    if (phoneErr) return res.status(400).json({ message: phoneErr });
    const phone = normalizePhone(b.phone);
    const g = cleanStr(b.gender, 40).toLowerCase();
    const gender = g === '' || g.startsWith('other') ? 'other' : g === 'male' ? 'male' : g === 'female' ? 'female' : null;
    if (!gender) return res.status(400).json({ message: 'Please choose a valid gender option.' });

    const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ message: 'An account with this email address already exists.' });

    const password_hash = await bcrypt.hash(b.password, 11);
    let resume_key = null;
    if (req.file) { resume_key = await storeUpload(req.file, 'resumes'); stored.push(resume_key); }

    const { user, profile } = await withTransaction(async (q) => {
      const u = await q(
        `INSERT INTO users (role, status, name, email, password_hash, phone, terms_accepted)
         VALUES ('employee','approved',$1,$2,$3,$4,true) RETURNING id, role, status, name, email, phone, email_verified_at, created_at`,
        [name, email, password_hash, phone]
      );
      const p = await q(
        `INSERT INTO job_seekers (user_id, gender, date_of_birth, education_level, location, headline, bio, skills, resume_url, portfolio_url)
         VALUES ($1,$2,$3,$4,$5,$6,'',$7,$8,'') RETURNING *`,
        [u.rows[0].id, gender, b.date_of_birth, cleanStr(b.education_level, 100), cleanStr(b.location, 255), cleanStr(b.headline, 255), cleanStr(b.skills, 1000), resume_key]
      );
      await q('INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)',
        [u.rows[0].id, 'Welcome to Akazi!', 'Your job seeker profile is ready. Browse open positions and apply directly.', 'system', '/jobs']);
      return { user: u.rows[0], profile: p.rows[0] };
    });

    sendVerificationEmail(user).catch(() => {});
    res.status(201).json({ message: 'Candidate account created successfully.', token: generateToken(user), user: toPublicUser(user), profile });
  } catch (err) {
    if (stored.length) await storage.remove(stored);
    if (isPgUnique(err)) return res.status(409).json({ message: 'An account with this email address already exists.' });
    console.error('Job seeker registration error:', err.message);
    res.status(500).json({ message: 'Something went wrong while creating your account. Please try again.' });
  }
});

// 3. Login (with per-account lockout and constant-time behaviour for unknown emails)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || password.length > 200) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const r = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
    const user = r.rows[0];
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.max(1, Math.ceil((new Date(user.locked_until) - Date.now()) / 60000));
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or reset your password.` });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const fails = (user.failed_logins || 0) + 1;
      if (fails >= MAX_FAILED_LOGINS) {
        await query("UPDATE users SET failed_logins = 0, locked_until = NOW() + ($1 || ' minutes')::interval WHERE id = $2", [String(LOCK_MINUTES), user.id]);
        audit({ user: { id: user.id }, clientIp: req.clientIp }, 'login.locked', 'user', user.id);
      } else {
        await query('UPDATE users SET failed_logins = $1 WHERE id = $2', [fails, user.id]);
      }
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended by administration. Please contact support.' });
    }
    if (user.failed_logins || user.locked_until) await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);

    let roleData = null;
    if (user.role === 'employer') roleData = (await query('SELECT * FROM employers WHERE user_id = $1', [user.id])).rows[0] || null;
    else if (user.role === 'employee') roleData = (await query('SELECT * FROM job_seekers WHERE user_id = $1', [user.id])).rows[0] || null;

    res.json({
      message: 'Login successful.', token: generateToken(user), user: toPublicUser(user),
      profile: roleData, employer: user.role === 'employer' ? roleData : null,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// 4. Current session
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let roleData = null;
    if (user.role === 'employer') roleData = (await query('SELECT * FROM employers WHERE user_id = $1', [user.id])).rows[0] || null;
    else if (user.role === 'employee') roleData = (await query('SELECT * FROM job_seekers WHERE user_id = $1', [user.id])).rows[0] || null;
    const n = await query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false', [user.id]);
    res.json({ user: toPublicUser(user), profile: roleData, employer: user.role === 'employer' ? roleData : null, unreadNotifications: n.rows[0].count });
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve session data.' });
  }
});

// 5. Forgot password: always answers the same way, whether or not the email exists
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const generic = { message: 'If an account with that email exists, we have sent a link to reset the password. It is valid for 30 minutes.' };
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (checkEmail(email)) return res.json(generic);
  res.json(generic); // respond first: timing must not reveal whether the account exists
  try {
    const r = await query("SELECT id, name, email, status FROM users WHERE lower(email) = $1", [email]);
    const user = r.rows[0];
    // The browser always gets the same answer; in development the terminal says what really happened
    const why = (m) => { if (!isProd) console.log(`[Reset:dev] ${email}: ${m}`); };
    if (!user) return why('no account has this email, so nothing was sent. Register it first, or try the email you signed up with.');
    if (user.status === 'suspended') return why('account is suspended, so nothing was sent.');
    if ((await recentTokenCount(user.id, 'reset', 60)) >= 3) return why('3 reset emails were already requested in the last hour, so nothing was sent.'); // max 3 emails per hour per account
    const raw = await createToken(user.id, 'reset', RESET_TTL_MIN);
    sendMailLater({
      to: user.email,
      subject: 'Reset your Akazi password',
      title: 'Reset your password',
      intro: 'We received a request to reset the password for your Akazi account. Choose a new one with the button below. The link works once and expires in 30 minutes.',
      ctaLabel: 'Choose a new password',
      ctaUrl: link('/reset-password', { token: raw }),
      outro: 'If you did not ask for this, you can ignore this email. Your password will not change.',
    });
    audit({ user: { id: user.id }, clientIp: req.clientIp }, 'password.reset_requested', 'user', user.id);
  } catch (e) { console.error('Forgot password error:', e.message); }
});

// 6. Reset password with the emailed token
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body || {};
    const issue = passwordIssue(password);
    if (issue) return res.status(400).json({ message: issue });
    const userId = await consumeToken(token, 'reset');
    if (!userId) return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.', code: 'INVALID_TOKEN' });

    const hash = await bcrypt.hash(password, 11);
    const upd = await query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW(), failed_logins = 0, locked_until = NULL,
              email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
       WHERE id = $2 RETURNING name, email`,
      [hash, userId]
    );
    await query("DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = 'reset'", [userId]);
    audit({ user: { id: userId }, clientIp: req.clientIp }, 'password.reset_completed', 'user', userId);
    if (upd.rows[0]) {
      sendMailLater({
        to: upd.rows[0].email, subject: 'Your Akazi password was changed', title: 'Your password was changed',
        intro: 'The password for your Akazi account was just changed and all other devices were signed out.',
        outro: 'If this was not you, reset your password again right away and contact us.',
      });
    }
    res.json({ message: 'Your password has been changed. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ message: 'Could not reset the password. Please try again.' });
  }
});

// 7. Change password while signed in
router.post('/change-password', authenticateToken, resetLimiter, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string') return res.status(400).json({ message: 'Enter your current password.' });
    const issue = passwordIssue(new_password, req.user.email);
    if (issue) return res.status(400).json({ message: issue });
    const r = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!r.rows[0] || !(await bcrypt.compare(current_password, r.rows[0].password_hash))) {
      return res.status(400).json({ message: 'Your current password is not correct.' });
    }
    const hash = await bcrypt.hash(new_password, 11);
    await query('UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    audit(req, 'password.changed', 'user', req.user.id);
    // Old tokens (including this browser's) stop working, so hand back a fresh one
    const fresh = await query('SELECT id, role FROM users WHERE id = $1', [req.user.id]);
    res.json({ message: 'Password updated. Other devices were signed out.', token: generateToken(fresh.rows[0]) });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Could not change the password. Please try again.' });
  }
});

// 8. Email verification
router.post('/verify-email', verifyLimiter, async (req, res) => {
  try {
    const userId = await consumeToken(req.body?.token, 'verify');
    if (!userId) return res.status(400).json({ message: 'This confirmation link is invalid or has expired.', code: 'INVALID_TOKEN' });
    await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1', [userId]);
    res.json({ message: 'Your email address is confirmed.' });
  } catch (err) {
    console.error('Verify email error:', err.message);
    res.status(500).json({ message: 'Could not confirm your email. Please try again.' });
  }
});

router.post('/resend-verification', authenticateToken, verifyLimiter, async (req, res) => {
  try {
    if (req.user.email_verified_at) return res.json({ message: 'Your email is already confirmed.' });
    if ((await recentTokenCount(req.user.id, 'verify', 2)) >= 1) {
      return res.status(429).json({ message: 'We just sent a link. Please wait a couple of minutes before asking again.' });
    }
    await sendVerificationEmail(req.user);
    res.json({ message: `We sent a new confirmation link to ${req.user.email}.` });
  } catch (err) {
    console.error('Resend verification error:', err.message);
    res.status(500).json({ message: 'Could not send the email. Please try again.' });
  }
});

module.exports = router;