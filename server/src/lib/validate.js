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

// Validates that a person provides at least two names (e.g. First and Last name).
function checkFullName(name) {
  if (name === undefined || name === null) return 'Full name is required.';
  const cleaned = cleanStr(name, 120);
  if (!cleaned) return 'Full name is required.';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return 'Please enter at least two names (e.g. first and last name).';
  }
  if (parts.some((p) => p.length < 2)) {
    return 'Each name must be at least 2 characters long.';
  }
  if (!/^[a-zA-Z\u00C0-\u024F\s'-]+$/.test(cleaned)) {
    return 'Names can only contain letters, hyphens, and apostrophes.';
  }
  return null;
}

// Normalizes Rwandan phone numbers to clean 10-digit local format: 07XXXXXXXX
function normalizePhone(v) {
  const s = cleanStr(v, 30);
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  let local = digits;
  if (/^2507\d{8}$/.test(digits)) {
    local = '0' + digits.slice(3);
  } else if (/^7\d{8}$/.test(digits)) {
    local = '0' + digits;
  }
  return /^07[2389]\d{7}$/.test(local) ? local : null;
}

// Validates Rwandan phone numbers: must not exceed or go below 10 digits
function validatePhone(v) {
  const s = cleanStr(v, 30);
  if (!s) return 'Phone number is required.';
  const digits = s.replace(/\D/g, '');
  let local = digits;
  if (/^2507\d{8}$/.test(digits)) {
    local = '0' + digits.slice(3);
  } else if (/^7\d{8}$/.test(digits)) {
    local = '0' + digits;
  }
  if (local.length < 10) {
    return 'Phone number cannot be fewer than 10 digits.';
  }
  if (local.length > 10) {
    return 'Phone number cannot exceed 10 digits.';
  }
  if (!/^07[2389]\d{7}$/.test(local)) {
    return 'Please enter a valid Rwandan phone number starting with 07 (e.g. 078XXXXXXX).';
  }
  return null;
}

function checkPhone(v) {
  return normalizePhone(v);
}

// Safe JSON parse that never throws
function safeJson(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

const isPgUnique = (e) => e && e.code === '23505';

module.exports = { 
  cleanStr, 
  checkFullName,
  checkEmail, 
  checkPassword, 
  checkEmailAndPassword, 
  normalizeUrl, 
  checkPhone, 
  validatePhone, 
  normalizePhone, 
  safeJson, 
  isPgUnique 
};
