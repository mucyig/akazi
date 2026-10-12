import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import AuthShell, { AuthCard, primaryBtn } from '../../components/AuthShell';
import PasswordField, { passwordOk } from '../../components/PasswordField';

export default function ResetPasswordPage() {
  const { tr } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const steps = [tr('Enter your email', 'Andika imeri yawe'), tr('Open the link we send', 'Fungura umurongo tuzakohereza'), tr('Choose a new password', 'Hitamo ijambo ry’ibanga rishya')];
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = /^[a-f0-9]{64}$/.test(token);

  const submit = async (e) => {
    e.preventDefault();
    if (!passwordOk(password)) { setError(tr('Choose a password with at least 8 characters, a letter and a number.', 'Hitamo ijambo ry’ibanga rifite inyuguti 8 nibura, inyuguti n’umubare.')); return; }
    if (password !== confirm) { setError(tr('The two passwords do not match.', 'Amagambo y’ibanga yombi ntabwo ahura.')); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const shell = (children, current = 2) => (
    <AuthShell headline={tr('Almost done.', 'Hasigaye gato.')} lead={tr('Pick something only you would know. We will sign out every other device when you save.', 'Hitamo ijambo wowe wenyine uzi. Tuzasohora izindi telefoni zose iyo ubitse.')} steps={steps} current={current}>
      {children}
    </AuthShell>
  );

  if (!valid) {
    return shell(
      <AuthCard icon={ShieldAlert} title={tr('This link is not valid', 'Uyu murongo ntukora')}
        subtitle={tr('It may be incomplete, expired or already used. Request a new one and try again.', 'Ushobora kuba utuzuye, warangiye cyangwa wakoreshejwe. Saba undi ugerageze.')}>
        <Link to="/forgot-password" className={primaryBtn}>{tr('Request a new link', 'Saba umurongo mushya')}</Link>
      </AuthCard>, 1);
  }

  if (done) {
    return shell(
      <AuthCard icon={ShieldCheck} title={tr('Password changed', 'Ijambo ry’ibanga ryahindutse')}
        subtitle={tr('You can sign in with your new password now. Other devices were signed out.', 'Ushobora kwinjira ukoresheje ijambo ry’ibanga rishya. Izindi telefoni zasohowe.')}>
        <button onClick={() => navigate('/login')} className={primaryBtn}>{tr('Go to sign in', 'Jya ku kwinjira')}</button>
      </AuthCard>, 3);
  }

  return shell(
    <AuthCard icon={ShieldCheck} title={tr('Choose a new password', 'Hitamo ijambo ry’ibanga rishya')} subtitle={tr('Use at least 8 characters with a letter and a number.', 'Koresha inyuguti 8 nibura, ibaruwa n’umubare.')}>
      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" />
          <span>{error} {/expired|invalid/i.test(error) && <Link to="/forgot-password" className="font-semibold underline">{tr('Request a new link', 'Saba umurongo mushya')}</Link>}</span>
        </div>
      )}
      <form onSubmit={submit} className="space-y-5">
        <PasswordField id="np" label={tr('New password', 'Ijambo ry’ibanga rishya')} value={password} onChange={setPassword} autoComplete="new-password" showRules />
        <div>
          <PasswordField id="cp" label={tr('Confirm new password', 'Ongera ijambo ry’ibanga rishya')} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {mismatch && <p className="mt-2 text-[13px] text-red-700">{tr('The two passwords do not match.', 'Amagambo y’ibanga yombi ntabwo ahura.')}</p>}
        </div>
        <button type="submit" disabled={loading || !password || mismatch} className={primaryBtn}>
          {loading && <Loader2 className="w-4.5 h-4.5 animate-spin" />}<span>{tr('Save new password', 'Bika ijambo ry’ibanga rishya')}</span>
        </button>
      </form>
    </AuthCard>
  );
}
