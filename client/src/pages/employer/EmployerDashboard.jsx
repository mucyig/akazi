import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  Users, 
  ShieldCheck, 
  Plus, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function EmployerDashboard() {
  const { user, employer, isActiveEmployer } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Employers need admin approval AND the paid verification fee
    if (user && user.role === 'employer' && !isActiveEmployer) {
      navigate('/employer/status', { replace: true });
      return;
    }

    async function loadData() {
      setLoading(true);
      try {
        const res = await api.get('/employers/dashboard');
        setJobs(res.jobs || []);
      } catch (err) {
        console.error('Fetch employer dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, isActiveEmployer, navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-zinc-500 py-20 px-4">
        <div className="w-7 h-7 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 py-8 text-zinc-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('nav.statusApproved')}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              {employer?.company_name || user?.name}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t('employerWorkspace.subtitle')}
            </p>
          </div>

          <div>
            <Link
              to="/employer/jobs/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('employerWorkspace.postJob')}</span>
            </Link>
          </div>
        </div>

        {/* Jobs List */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/40">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              {t('employerWorkspace.activeJobs')} ({jobs.length})
            </h2>
          </div>

          {jobs.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 space-y-3">
              <Briefcase className="w-10 h-10 text-zinc-300 mx-auto" />
              <h3 className="text-base font-bold text-zinc-900">
                {t('employerWorkspace.noJobsTitle')}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {t('employerWorkspace.noJobsDesc')}
              </p>
              <div className="pt-2">
                <Link
                  to="/employer/jobs/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('employerWorkspace.postFirstJob')}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-5 sm:p-6 hover:bg-zinc-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-950">
                        {job.title}
                      </h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        job.status === 'active' 
                          ? 'bg-zinc-100 text-zinc-800' 
                          : 'bg-zinc-200 text-zinc-600'
                      }`}>
                        {job.status === 'active' ? t('employerWorkspace.jobStatusActive') : t('employerWorkspace.jobStatusClosed')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-zinc-500">
                      <span>{job.location}</span>
                      <span>•</span>
                      <span className="capitalize">{job.job_type}</span>
                      {job.salary_range && (
                        <>
                          <span>•</span>
                          <span>{job.salary_range}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-semibold text-zinc-800">
                        {t('employerWorkspace.applicantsCount', { count: job.applicant_count || 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/employer/applicants/${job.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition shadow-2xs"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{t('employerWorkspace.reviewApplicants')}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                    </Link>

                    <Link
                      to={`/jobs/${job.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border border-zinc-200 hover:border-zinc-300 rounded-xl text-zinc-600 hover:text-zinc-900 transition"
                      title={t('home.viewJobDetails')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
