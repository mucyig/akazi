// Formatting helpers for Akazi

/**
 * Formats salary strings by adding comma separators to 4+ digit numbers (e.g. 150000 -> 150,000)
 * Preserves text, currency tags, and dashes.
 */
export function formatSalary(val) {
  if (!val || typeof val !== 'string') return val;
  return val.replace(/\b\d{4,}\b/g, (num) => Number(num).toLocaleString('en-US'));
}

/**
 * Formats job type strings according to current language.
 * 'temporary' -> 'Temporary' in English, 'Ibiraka' in Kinyarwanda.
 */
export function formatJobType(type, language = 'en') {
  if (!type || typeof type !== 'string') return '';
  const key = type.toLowerCase().trim();
  const map = {
    'full-time': language === 'rw' ? 'Igihe cyose' : 'Full-time',
    'part-time': language === 'rw' ? 'Igihe gito' : 'Part-time',
    'contract': language === 'rw' ? 'Amasezerano' : 'Contract',
    'temporary': language === 'rw' ? 'Ibiraka' : 'Temporary',
    'day-work': language === 'rw' ? 'Ibiraka' : 'Temporary',
    'day_work': language === 'rw' ? 'Ibiraka' : 'Temporary',
    'day work': language === 'rw' ? 'Ibiraka' : 'Temporary',
    'internship': language === 'rw' ? 'Kumenyereza' : 'Internship',
    'freelance': language === 'rw' ? 'Ibiraka' : 'Freelance',
    'volunteer': language === 'rw' ? 'Ubushake' : 'Volunteer'
  };
  return map[key] || (key.charAt(0).toUpperCase() + key.slice(1));
}
