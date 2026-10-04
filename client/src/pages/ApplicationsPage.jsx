import { MessageButton } from '../components/ChatDock';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Briefcase
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import InterviewLocation from '../components/InterviewLocation';

export default function ApplicationsPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/applications');
      return;
    }

    async function loadData() {
      setLoading(true);
      try {
        const res = await api.get('/applications/my');
        setApplications(res.applications || []);
      } catch (err) {
        console.error('Fetch applications error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, navigate]);

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              {t('applications.title')}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t('applications.subtitle')}
            </p>
          </div>

          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-200 hover:border-zinc-900 rounded-xl text-xs font-semibold text-zinc-800 transition"
          >
            <span>{t('applications.exploreJobsBtn')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500 space-y-3 shadow-xs">
            <Briefcase className="w-10 h-10 text-zinc-300 mx-auto" />
            <h3 className="text-base font-bold text-zinc-900">
              {t('applications.emptyTitle')}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {t('applications.emptyDesc')}
            </p>
            <div className="pt-2">
              <Link
                to="/jobs"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition"
              >
                <span>{t('applications.exploreJobsBtn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const interview = typeof app.interview_details === 'string'
                ? JSON.parse(app.interview_details || '{}')
                : (app.interview_details || {});

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden"
                >
                  {/* Top Bar */}
                  <div className="p-5 sm:p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                        {app.company_name}
                      </div>
                      <Link
                        to={`/jobs/${app.job_id}`}
                        className="text-lg font-bold text-zinc-950 hover:underline"
                      >
                        {app.job_title}
                      </Link>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          {app.job_location}
                        </span>
                        <span>•</span>
                        <span>
                          {t('applications.appliedOn', { date: new Date(app.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) })}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        app.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : app.status === 'rejected'
                          ? 'bg-zinc-100 text-zinc-500'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}>
                        {app.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {app.status === 'approved' && t('applications.statusApproved')}
                        {app.status === 'rejected' && t('applications.statusRejected')}
                        {app.status === 'pending' && t('applications.statusPending')}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 sm:p-6 space-y-4 text-xs">
                    
                    {/* Status explanation */}
                    <p className="text-zinc-600 leading-relaxed">
                      {app.status === 'pending' && t('applications.statusPendingDesc')}
                      {app.status === 'approved' && t('applications.statusApprovedDesc')}
                      {app.status === 'rejected' && t('applications.statusRejectedDesc')}
                    </p>

                    <MessageButton appId={app.id} status={app.status} />

                    {/* Interview details if scheduled */}
                    {app.status === 'approved' && interview.date && (
                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                        <div className="flex items-center gap-2 font-bold text-zinc-900 text-xs">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          <span>{t('applications.interviewCardTitle')}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs text-zinc-700">
                          <div>
                            <span className="text-zinc-400 block text-[11px]">{t('applications.date')} & {t('applications.time')}:</span>
                            <span className="font-semibold text-zinc-900">{interview.date} at {interview.time}</span>
                          </div>

                          <div className="min-w-0">
                            <span className="text-zinc-400 block text-[11px]">{t('applications.location')}:</span>
                            <InterviewLocation value={interview.location_or_link} fallback="To be specified" />
                          </div>
                        </div>

                        {interview.notes && (
                          <div className="pt-2 border-t border-zinc-200/80 text-xs">
                            <span className="text-zinc-400 block text-[11px] mb-0.5">{t('applications.notes')}:</span>
                            <p className="text-zinc-700 leading-relaxed">{interview.notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feedback if rejected */}
                    {app.status === 'rejected' && app.rejection_reason && (
                      <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 text-xs">
                        <span className="font-semibold text-zinc-900">{t('applications.rejectionFeedback')}: </span>
                        <span>{app.rejection_reason}</span>
                      </div>
                    )}

                    {/* Link to Job */}
                    <div className="pt-2 flex justify-end">
                      <Link
                        to={`/jobs/${app.job_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline"
                      >
                        <span>{t('home.viewJobDetails')}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
