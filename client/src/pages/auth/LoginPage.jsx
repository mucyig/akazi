import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Briefcase, 
  Lock, 
  Mail, 
  AlertCircle, 
  Loader2,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { t, language, tr} = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/jobs';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      const user = data.user;

      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'employer') {
        if (user.status === 'approved') {
          navigate('/employer/dashboard');
        } else {
          navigate('/employer/status');
        }
      } else {
        navigate(redirectPath);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || (language === 'rw' 
        ? 'Imeyili cyangwa ijambobanga ntabwo bihuye.' 
        : 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-zinc-50/50 flex flex-col justify-center py-12 px-4 sm:px-6">
      
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-bold">
            <Briefcase className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-950">Akazi</span>
        </Link>
        <h1 className="mt-4 text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
          {t('auth.loginTitle')}
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {t('auth.loginSubtitle')}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Main Login Card */}
        <div className="bg-white py-8 px-6 shadow-xs border border-zinc-200 rounded-2xl sm:px-8 space-y-5">
          
          {error && (
            <div className="p-3.5 bg-zinc-100 border border-zinc-300 rounded-xl flex items-start gap-2.5 text-xs text-zinc-900">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr(tr("name@example.com", "izina@urugero.com"), "izina@urugero.com")}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('auth.signingIn')}</span>
                  </>
                ) : (
                  <span>{t('auth.signInBtn')}</span>
                )}
              </button>
            </div>
          </form>

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-zinc-100 text-center text-xs text-zinc-500">
            <span>{t('auth.noAccount')} </span>
            <Link to="/register" className="font-semibold text-zinc-950 underline underline-offset-2">
              {t('auth.registerPrompt')}
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
