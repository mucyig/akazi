// Small input-validation helpers shared by the routes.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COMMON_PASSWORDS = new Set(['password', 'password1', '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123', 'iloveyou', 'abcd1234', 'akazi2026', 'welcome1', 'letmein1', '11111111', '00000000']);

function cleanStr(v, max = 255) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// Returns an error message, or null when the email is acceptable
function checkEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

// Returns an error message, or null when the password is acceptable
function checkPassword(password, email = '') {
  if (typeof password !== 'string') return 'Invalid request.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be at most 72 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'That password is too common. Please choose another one.';
  if (email && password.toLowerCase() === String(email).trim().toLowerCase()) return 'Password cannot be the same as your email.';
  return null;
}

function checkEmailAndPassword(email, password) {
  return checkEmail(email) || checkPassword(password, email);
}

function normalizeUrl(v) {
  const s = cleanStr(v, 255);
  if (!s) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch { return null; }
}

function checkPhone(v) {
  const s = cleanStr(v, 30);
  if (!s) return '';
  return /^[+\d][\d\s()-]{6,28}$/.test(s) ? s : null;
}

// Safe JSON parse that never throws
function safeJson(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

const isPgUnique = (e) => e && e.code === '23505';

module.exports = { cleanStr, checkEmail, checkPassword, checkEmailAndPassword, normalizeUrl, checkPhone, safeJson, isPgUnique };
