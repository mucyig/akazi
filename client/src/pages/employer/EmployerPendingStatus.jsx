import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  FileText, 
  LogOut, 
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ShieldCheck,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function EmployerPendingStatus() {
  const { user, employer, isActiveEmployer, needsEmployerPayment, logout } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  // Fully active employers go straight to their workspace
  useEffect(() => {
    if (isActiveEmployer) navigate('/employer/dashboard', { replace: true });
  }, [isActiveEmployer, navigate]);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const isRejected = user?.status === 'rejected';

  // Verified by admin, but the 5,000 RWF fee is still outstanding → prompt to pay
  if (needsEmployerPayment) {
    return (
      <div className="min-h-[88vh] bg-zinc-50/60 py-12 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-zinc-200 shadow-xl shadow-zinc-900/5 overflow-hidden">
          <div className="relative bg-gradient-to-br from-emerald-700 via-emerald-800 to-zinc-900 px-6 sm:px-8 py-9 text-white text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 ring-1 ring-white/20 grid place-items-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-300" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-100 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> {t('employerStatus.verifiedBadge')}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('employerStatus.approvedTitle')}</h1>
            <p className="mt-2 text-xs sm:text-sm text-emerald-100/90 max-w-sm mx-auto leading-relaxed">{t('employerStatus.approvedSubtitle')}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/70">{t('employerStatus.oneTimeFee')}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-zinc-950 tabular-nums">5,000</span>
                  <span className="text-sm font-semibold text-zinc-500">RWF</span>
                </p>
              </div>
              <Wallet className="w-9 h-9 text-emerald-700/70" />
            </div>

            <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-white text-xs text-zinc-600">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-400">{t('employerStatus.businessName')}</span>
                <span className="font-semibold text-zinc-900">{employer?.company_name || user?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{t('employerStatus.status')}</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> {t('employerStatus.statusVerifiedText')}</span>
              </div>
            </div>

            <button onClick={() => navigate('/employer/payment')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-800 hover:bg-blue-900 text-white font-semibold shadow-lg shadow-blue-900/20 transition">
              {t('employerStatus.payNow')} <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-1 text-center">
              <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900">
                <LogOut className="w-3.5 h-3.5" /> {t('employerStatus.signOut')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] bg-zinc-50/50 py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        
        {/* Status Header */}
        <div className="p-6 sm:p-8 border-b border-zinc-100 bg-zinc-50/60 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto mb-4 shadow-xs">
            {isRejected ? (
              <AlertTriangle className="w-7 h-7 text-red-400" />
            ) : (
              <Clock className="w-7 h-7 text-zinc-100" />
            )}
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-zinc-200/70 text-zinc-800 mb-3">
            {isRejected ? t('employerStatus.statusRejectedText') : t('employerStatus.statusPendingText')}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">
            {isRejected ? t('employerStatus.statusRejectedText') : t('employerStatus.title')}
          </h1>

          <p className="text-xs sm:text-sm text-zinc-500 mt-2 max-w-md mx-auto leading-relaxed">
            {isRejected 
              ? (user?.rejection_reason || (language === 'rw' ? 'Konti y\'ubucuruzi ntiyemejwe kubera inyandiko zidahagije.' : 'Your business registration could not be verified.'))
              : t('employerStatus.subtitle')}
          </p>
        </div>

        {/* Details & Explanation */}
        <div className="p-6 sm:p-8 space-y-6 text-xs text-zinc-600">
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 leading-relaxed text-zinc-700">
            {t('employerStatus.explanation')}
          </div>

          {/* Business Info Summary */}
          <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <span className="text-zinc-400">{t('employerStatus.businessName')}</span>
              <span className="font-semibold text-zinc-900">{employer?.company_name || user?.name}</span>
            </div>

            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <span className="text-zinc-400">{t('employerStatus.status')}</span>
              <span className="font-medium text-zinc-900 capitalize">{user?.status || 'pending'}</span>
            </div>

            {employer?.registration_doc_url && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-zinc-400">{t('employerStatus.submittedDoc')}</span>
                <a
                  href={employer.registration_doc_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{language === 'rw' ? 'Reba inyandiko' : 'View file'}</span>
                </a>
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="space-y-1.5">
            <h3 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">
              {t('employerStatus.whatNext')}
            </h3>
            <p className="text-zinc-500 leading-relaxed">
              {t('employerStatus.whatNextDesc')}
            </p>
          </div>

          <div className="pt-2 text-[11px] text-zinc-400">
            {t('employerStatus.supportNote')}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
            <Link
              to="/jobs"
              className="text-xs text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
            >
              {language === 'rw' ? 'Reba imirimo ifunguye' : 'Browse available jobs'}
            </Link>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('employerStatus.signOut')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
