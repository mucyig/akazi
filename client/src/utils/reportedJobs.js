const STORAGE_KEY = 'akazi_reported_job_ids';

export function getReportedJobIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function isJobReported(jobId, serverReported = false) {
  if (serverReported) return true;
  if (!jobId) return false;
  const ids = getReportedJobIds();
  const num = Number(jobId);
  return ids.includes(num) || ids.includes(String(jobId));
}

export function markJobReported(jobId) {
  if (!jobId) return;
  try {
    const ids = getReportedJobIds();
    const num = Number(jobId);
    if (!ids.includes(num)) {
      ids.push(num);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      window.dispatchEvent(new CustomEvent('akazi_job_reported', { detail: { jobId: num } }));
    }
  } catch (err) {
    console.error('Failed to mark job as reported', err);
  }
}
