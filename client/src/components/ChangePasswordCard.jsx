import React, { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, setAuthToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PasswordField, { passwordOk } from './PasswordField';

export default function ChangePasswordCard() {
  const { tr } = useLanguage();
  const { refreshUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const submit = async (e) => {
    e.preventDefault();
    if (!passwordOk(next)) { setMsg({ ok: false, text: tr('Use at least 8 characters with a letter and a number.', 'Koresha inyuguti 8 nibura, inyuguti n’umubare.') }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await api.post('/auth/change-password', { current_password: current, new_password: next });
      if (r.token) setAuthToken(r.token); // other devices are signed out; keep this one signed in
      await refreshUser();
      setCurrent(''); setNext(''); setOpen(false);
      setMsg({ ok: true, text: r.message });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 grid place-items-center"><KeyRound className="w-4.5 h-4.5" /></span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950">{tr('Password', 'Ijambo ry’ibanga')}</h3>
            <p className="text-xs text-zinc-500">{tr('Change it any time. Other devices will be signed out.', 'Nuhindura ijambo ryibanga uraza gusohorwa muri system wongere usubiremo ukoresheje ijambo rishya.')}</p>
          </div>
        </div>
        {!open && (
          <button onClick={() => { setOpen(true); setMsg(null); }} className="rounded-full border border-[#d9d5c9] hover:border-blue-600 px-4 py-1.5 text-xs font-semibold text-zinc-800 transition">
            {tr('Change', 'Hindura')}
          </button>
        )}
      </div>
      {msg && (
        <p role="status" className={`mt-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${msg.ok ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-900'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}{msg.text}
        </p>
      )}
      {open && (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <PasswordField id="cur" label={tr('Current password', 'Ijambo ry’ibanga risanzwe')} value={current} onChange={setCurrent} />
          <PasswordField id="new" label={tr('New password', 'Ijambo ry’ibanga rishya')} value={next} onChange={setNext} autoComplete="new-password" showRules />
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={busy || !current || !next} className="inline-flex items-center gap-2 rounded-full bg-blue-800 hover:bg-blue-900 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{tr('Save password', 'Bika ijambo ry’ibanga')}
            </button>
            <button type="button" onClick={() => { setOpen(false); setCurrent(''); setNext(''); }} className="text-sm font-semibold text-zinc-600 hover:text-zinc-900">{tr('Cancel', 'Bireke')}</button>
          </div>
        </form>
      )}
    </section>
  );
}
