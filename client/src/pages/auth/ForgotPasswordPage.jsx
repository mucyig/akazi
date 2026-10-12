import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck, AlertCircle, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import AuthShell, { AuthCard, inputCls, primaryBtn } from '../../components/AuthShell';

export default function ForgotPasswordPage() {
  const { tr } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = [tr('Enter your email', 'Andika imeri yawe'), tr('Open the link we send', 'Fungura umurongo tuzakohereza'), tr('Choose a new password', 'Hitamo ijambo ry’ibanga rishya')];

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      headline={tr('Locked out? It happens to everyone.', 'Wafunzwe? Bibaho kuri bose.')}
      lead={tr('We will email you a private link. It works once and expires in 30 minutes.', 'Turakohereza umurongo wihariye. Ukoreshwa rimwe kandi urangira nyuma y’iminota 30.')}
      steps={steps} current={sent ? 1 : 0}
    >
      {sent ? (
        <AuthCard icon={MailCheck} title={tr('Check your email', 'Reba imeri yawe')}
          subtitle={tr(`If an account exists for ${email}, a reset link is on its way. It can take a minute, and it may land in spam.`, `Niba konti ibaho kuri ${email}, umurongo urimo kuza. Bishobora gufata umunota, kandi ushobora kujya muri spam.`)}>
          <div className="space-y-3">
            <button type="button" onClick={() => { setSent(false); }} className="w-full rounded-full border border-[#d9d5c9] bg-white hover:border-blue-600 py-3.5 text-[15px] font-semibold text-zinc-800 transition">
              {tr('Use a different email', 'Koresha indi meri')}
            </button>
            <Link to="/login" className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-blue-800 hover:text-blue-950">
              <ArrowLeft className="w-4 h-4" />{tr('Back to sign in', 'Subira ku kwinjira')}
            </Link>
          </div>
        </AuthCard>
      ) : (
        <AuthCard icon={KeyRound} title={tr('Reset your password', 'Hindura ijambo ry’ibanga ')}
          subtitle={tr('Enter the email you signed up with and we will send you a reset link.', 'Andika imeri wiyandikishijeho tukohereze umurongo wo kongera gushyiraho ijambo ry’ibanga.')}>
          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" /><span>{error}</span>
            </div>
          )}
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="fp-email" className="block text-sm font-semibold text-zinc-800 mb-1.5">{tr('Email address', 'Imeri')}</label>
              <div className="relative">
                <Mail className="w-4.5 h-4.5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="fp-email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr('name@example.com', 'izina@urugero.com')} className={`${inputCls} pl-11`} />
              </div>
            </div>
            <button type="submit" disabled={loading || !email} className={primaryBtn}>
              {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : null}
              <span>{tr('Send reset link', 'Ohereza umurongo')}</span>
            </button>
          </form>
          <Link to="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-950">
            <ArrowLeft className="w-4 h-4" />{tr('Back to sign in', 'Subira ku kwinjira')}
          </Link>
        </AuthCard>
      )}
    </AuthShell>
  );
}
