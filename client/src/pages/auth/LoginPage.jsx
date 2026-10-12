import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import AuthShell, { AuthCard, inputCls, primaryBtn } from '../../components/AuthShell';
import PasswordField from '../../components/PasswordField';

export default function LoginPage() {
  const { login } = useAuth();
  const { t, tr } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('redirect') || '/jobs';
  // Only ever return to a page on this site
  const redirectPath = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/jobs';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await login(email, password);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'employer') navigate(user.status === 'approved' ? '/employer/dashboard' : '/employer/status');
      else navigate(redirectPath);
    } catch (err) {
      setError(err.message || tr('Invalid email or password.', 'Imeyili cyangwa ijambobanga ntabwo bihuye.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      headline={tr('Good to see you again.', 'Muraho neza, twishimiye kongera kubabona.')}
      lead={tr('Your applications, interviews and messages are right where you left them.', 'Ubusabe bwawe, ibiganiro n’ubutumwa biri aho wabisize.')}
    >
      <AuthCard title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-600" /><span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-zinc-800 mb-1.5">{t('auth.email')}</label>
            <div className="relative">
              <Mail className="w-4.5 h-4.5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={tr('name@example.com', 'izina@urugero.com')} className={`${inputCls} pl-11`} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-zinc-800">{t('auth.password')}</span>
              <Link to="/forgot-password" className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4">
                {tr('Forgot password?', 'Wibagiwe ijambo ry’ibanga?')}
              </Link>
            </div>
            <PasswordField id="password" value={password} onChange={setPassword} />
          </div>
          <button type="submit" disabled={loading} className={primaryBtn}>
            {loading ? (<><Loader2 className="w-4.5 h-4.5 animate-spin" /><span>{t('auth.signingIn')}</span></>) : <span>{t('auth.signInBtn')}</span>}
          </button>
        </form>
        <p className="mt-8 pt-6 border-t rule text-center text-sm text-zinc-600">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-blue-800 underline underline-offset-4">{t('auth.registerPrompt')}</Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
