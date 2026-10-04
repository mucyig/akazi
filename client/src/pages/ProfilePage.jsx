import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  User, 
  Building2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  FileText, 
  LogOut, 
  ExternalLink,
  MapPin,
  Calendar,
  GraduationCap
} from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, employer, profile, logout, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 py-10 text-zinc-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              {t('profile.title')}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t('profile.subtitle')}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-zinc-200 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('profile.signOut')}</span>
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 sm:p-8 space-y-6 text-xs">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-bold text-xl">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-950">{user.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full font-medium text-[11px] bg-zinc-100 text-zinc-800 capitalize">
                  {user.role}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
                  user.status === 'approved' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {user.status === 'approved' ? t('nav.statusApproved') : t('nav.statusPending')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
            <div>
              <span className="text-zinc-400 block text-[11px]">{t('profile.email')}</span>
              <span className="font-semibold text-zinc-900 text-xs">{user.email}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[11px]">{t('profile.phone')}</span>
              <span className="font-semibold text-zinc-900 text-xs">{user.phone || '—'}</span>
            </div>

            {user.national_id && (
              <div>
                <span className="text-zinc-400 block text-[11px]">{t('profile.nationalId')}</span>
                <span className="font-mono font-semibold text-zinc-900 text-xs">{user.national_id}</span>
              </div>
            )}

            {user.location && (
              <div>
                <span className="text-zinc-400 block text-[11px]">{language === 'rw' ? 'Aho uba' : 'Location'}</span>
                <span className="font-semibold text-zinc-900 text-xs">{user.location}</span>
              </div>
            )}

            {user.education_level && (
              <div>
                <span className="text-zinc-400 block text-[11px]">{language === 'rw' ? 'Amashuri' : 'Education'}</span>
                <span className="font-semibold text-zinc-900 text-xs">{user.education_level}</span>
              </div>
            )}

            <div>
              <span className="text-zinc-400 block text-[11px]">{t('profile.memberSince')}</span>
              <span className="font-medium text-zinc-800 text-xs">
                {new Date(user.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Employer specific info */}
          {user.role === 'employer' && employer && (
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <h3 className="font-bold text-zinc-900 text-xs uppercase tracking-wider">
                {language === 'rw' ? 'Amakuru y\'Ubucuruzi' : 'Business Details'}
              </h3>
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">{language === 'rw' ? 'Izina ry\'ubucuruzi' : 'Business Name'}:</span>
                  <span className="font-semibold text-zinc-900">{employer.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{language === 'rw' ? 'Ibyo bukora' : 'Sector'}:</span>
                  <span className="font-medium text-zinc-800">{employer.industry}</span>
                </div>
                {employer.registration_doc_url && (
                  <div className="flex justify-between pt-1">
                    <span className="text-zinc-500">{language === 'rw' ? 'Inyandiko y\'ubucuruzi' : 'Registration Doc'}:</span>
                    <a
                      href={employer.registration_doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-zinc-900 underline underline-offset-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{language === 'rw' ? 'Reba' : 'Inspect'}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resume link if candidate */}
          {user.role === 'employee' && profile?.resume_url && (
            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between p-3.5 bg-zinc-50 rounded-xl border border-zinc-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-700" />
                <span className="font-medium text-zinc-900">Curriculum Vitae (CV)</span>
              </div>
              <a
                href={profile.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline"
              >
                <span>{language === 'rw' ? 'Reba CV' : 'View CV'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
