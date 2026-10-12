// Formatting helpers for Akazi

/**
 * Formats salary strings by adding comma separators to 4+ digit numbers (e.g. 150000 -> 150,000)
 * Preserves text, currency tags, and dashes.
 */
export function formatSalary(val) {
  if (!val || typeof val !== 'string') return val;
  return val.replace(/\b\d{4,}\b/g, (num) => Number(num).toLocaleString('en-US'));
}
