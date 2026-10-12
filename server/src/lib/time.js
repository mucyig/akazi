// Everything time-related is anchored to Rwanda (Africa/Kigali, UTC+2, no daylight saving).
// The server clock is the only clock that counts: never trust a date or "now" sent by a browser.
const TZ = 'Africa/Kigali';
const KIGALI_OFFSET = '+02:00';
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

const todayKigali = (now = new Date()) => ymdFmt.format(now); // 'YYYY-MM-DD'

function isValidYmd(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

// 'YYYY-MM-DD' + 'HH:mm' (24h, Kigali wall clock) -> exact instant (Date) or null
function kigaliToInstant(date, hhmm) {
  if (!isValidYmd(date) || typeof hhmm !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return null;
  return new Date(`${date}T${hhmm}:00${KIGALI_OFFSET}`);
}

function ageOn(birthYmd, todayYmd = todayKigali()) {
  const [by, bm, bd] = birthYmd.split('-').map(Number);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

// Human text such as "Mon 12 Oct 2026, 14:30 CAT"
function formatKigali(isoOrDate) {
  const d = new Date(isoOrDate);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
  return `${parts} CAT`;
}

module.exports = { TZ, todayKigali, isValidYmd, kigaliToInstant, ageOn, formatKigali };
