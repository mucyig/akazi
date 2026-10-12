import React, { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { api } from '../services/api';

// Documents are private. Ask the server for a short-lived link (it checks that you are allowed), then open it.
export async function openProtectedFile(key) {
  // Open the tab immediately so pop-up blockers allow it, then point it at the signed link
  const tab = window.open('', '_blank');
  try {
    const { url } = await api.get(`/files/url?key=${encodeURIComponent(key)}`);
    if (tab) { tab.opener = null; tab.location.href = url; } else window.location.href = url;
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
}

export default function FileLink({ fileKey, children, className = '', icon = true, onError }) {
  const [busy, setBusy] = useState(false);
  if (!fileKey) return null;
  const click = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await openProtectedFile(fileKey); } catch (err) { (onError || ((m) => window.alert(m)))(err.message || 'Could not open the file.'); } finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={click} disabled={busy} className={className} aria-busy={busy}>
      {children}
      {icon && (busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />)}
    </button>
  );
}
