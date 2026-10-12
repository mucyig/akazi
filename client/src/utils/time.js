// Every time shown or compared in Akazi is Rwanda time (Africa/Kigali, UTC+2, no daylight saving),
// and "now" comes from the server clock, never from the visitor's device.
export const TZ = 'Africa/Kigali';

let skewMs = 0; // server time minus device time

// Called once when the app opens (and again every few minutes)
export async function syncClock() {
  try {
    const t0 = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    if (!res.ok) return;
    const { now } = await res.json();
    const t1 = Date.now();
    skewMs = new Date(now).getTime() - (t0 + t1) / 2;
  } catch { /* keep the last known offset */ }
}

export const nowMs = () => Date.now() + skewMs;
export const nowDate = () => new Date(nowMs());

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts });
const fDate = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const fDateShort = fmt({ day: 'numeric', month: 'short' });
const fTime = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
const fYmd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fLong = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const toDate = (v) => (v instanceof Date ? v : new Date(v));
const valid = (d) => !Number.isNaN(d.getTime());

// "12 Oct 2026"
export function formatDate(v) { const d = toDate(v); return valid(d) ? fDate.format(d) : ''; }
// "14:30 CAT"
export function formatTime(v) { const d = toDate(v); return valid(d) ? `${fTime.format(d)} CAT` : ''; }
// "Mon, 12 Oct 2026, 14:30 CAT"
export function formatDateTime(v) { const d = toDate(v); return valid(d) ? `${fLong.format(d)} CAT` : ''; }

// "YYYY-MM-DD" for today in Rwanda, according to the server clock
export const todayKigali = () => fYmd.format(nowDate());
export const kigaliDatePlusDays = (days) => fYmd.format(new Date(nowMs() + days * 86400000));

// A plain "YYYY-MM-DD" (like a job deadline) shown without any timezone shifting
export function formatYmd(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return '';
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00+02:00`);
  return valid(d) ? fDate.format(d) : '';
}

// Is the instant on the same Rwanda calendar day as "now"?
export const isTodayKigali = (v) => fYmd.format(toDate(v)) === todayKigali();
export const shortWhen = (v) => (isTodayKigali(v) ? fTime.format(toDate(v)) : fDateShort.format(toDate(v)));

// Whole minutes between the server's "now" and an instant
export const minutesAgo = (v) => Math.max(1, Math.round((nowMs() - toDate(v).getTime()) / 60000));

// Age in whole years on a Rwanda date. birthYmd = "YYYY-MM-DD"
export function ageOnToday(birthYmd) {
  const [by, bm, bd] = birthYmd.split('-').map(Number);
  const [ty, tm, td] = todayKigali().split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

// Pieces for a calendar tile: { weekday: 'Mon', day: '12', month: 'Oct', time: '14:30' }
export function kigaliParts(v) {
  const d = toDate(v);
  if (!valid(d)) return null;
  const p = Object.fromEntries(fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, day: p.day, month: p.month, time: `${p.hour}:${p.minute}` };
}

// Relative time formatted cleanly in Kinyarwanda or English (e.g. "Iminsi 2 ishize" / "2 days ago")
export function formatRelativeTime(v, lang = 'en') {
  const d = toDate(v);
  if (!valid(d)) return '';
  const diffMs = Math.max(0, nowMs() - d.getTime());
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  const isRw = lang === 'rw';

  if (minutes < 2) {
    return isRw ? 'Ubu nyine' : 'Just now';
  }
  if (minutes < 60) {
    return isRw ? `Iminota ${minutes} ishize` : `${minutes}m ago`;
  }
  if (hours < 24) {
    if (hours === 1) return isRw ? 'Isaha 1 ishize' : '1 hour ago';
    return isRw ? `Amasaha ${hours} ashize` : `${hours} hours ago`;
  }
  if (days < 7) {
    if (days === 1) return isRw ? 'Umunsi 1 ushize' : '1 day ago';
    return isRw ? `Iminsi ${days} ishize` : `${days} days ago`;
  }

  const weeks = Math.floor(days / 7);
  if (days < 30) {
    if (weeks === 1) return isRw ? 'Icyumweru 1 gishize' : '1 week ago';
    return isRw ? `Ibyumweru ${weeks} bishize` : `${weeks} weeks ago`;
  }

  const months = Math.floor(days / 30);
  if (days < 365) {
    if (months <= 1) return isRw ? 'Ukwezi 1 gushize' : '1 month ago';
    return isRw ? `Amezi ${months} ashize` : `${months} months ago`;
  }

  const years = Math.floor(days / 365);
  if (years <= 1) return isRw ? 'Umwaka 1 ushize' : '1 year ago';
  return isRw ? `Imyaka ${years} ishize` : `${years} years ago`;
}
