import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MailWarning, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// Gentle reminder for people who have not confirmed their email yet
export default function EmailVerifyBanner() {
  const { user } = useAuth();
  const { tr } = useLanguage();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || user.role === 'admin' || user.email_verified || hidden || pathname === '/verify-email') return null;

  const resend = async () => {
    setBusy(true);
    try { const r = await api.post('/auth/resend-verification', {}); setNote(r.message); } catch (e) { setNote(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-950" role="status">
      <div className="page flex items-center gap-3 py-2.5 text-sm">
        <MailWarning className="w-4.5 h-4.5 shrink-0 text-amber-600" />
        <p className="flex-1 min-w-0">
          {note || tr(`Confirm your email: we sent a link to ${user.email}.`, `Emeza imeri yawe: twohereje umurongo kuri ${user.email}.`)}
          {!note && (
            <button onClick={resend} disabled={busy} className="ml-2 font-semibold underline underline-offset-4 hover:text-amber-800 disabled:opacity-60">
              {tr('Send it again', 'Wongere wohereze')}
            </button>
          )}
        </p>
        <button onClick={() => setHidden(true)} className="p-1 rounded-full hover:bg-amber-100" aria-label={tr('Dismiss', 'Funga')}><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
