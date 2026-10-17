import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Clock3, 
  ArrowRight, 
  ChevronRight, 
  Briefcase, 
  Sparkles,
  Eye,
  BookmarkCheck,
  Calendar,
  Award,
  Radio
} from 'lucide-react';
import { MessageButton } from '../components/ChatDock';
import ApplicationPipeline from '../components/ApplicationPipeline';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import InterviewLocation from '../components/InterviewLocation';
import { formatDate, kigaliParts } from '../utils/time';
import { usePageTitle } from '../hooks/usePageTitle';

const STATUS = {
  pending: { chip: 'bg-amber-50 text-amber-900 border-amber-200', icon: Clock3, iconCls: 'text-amber-600', rail: 'bg-amber-400' },
  applied: { chip: 'bg-amber-50 text-amber-900 border-amber-200', icon: Clock3, iconCls: 'text-amber-600', rail: 'bg-amber-400' },
  viewed: { chip: 'bg-blue-50 text-blue-900 border-blue-200', icon: Eye, iconCls: 'text-blue-600', rail: 'bg-blue-500' },
  shortlisted: { chip: 'bg-emerald-50 text-emerald-900 border-emerald-200', icon: BookmarkCheck, iconCls: 'text-emerald-600', rail: 'bg-emerald-500' },
  approved: { chip: 'bg-blue-50 text-blue-900 border-blue-200', icon: Calendar, iconCls: 'text-blue-600', rail: 'bg-blue-600' },
  interview: { chip: 'bg-blue-50 text-blue-900 border-blue-200', icon: Calendar, iconCls: 'text-blue-600', rail: 'bg-blue-600' },
  hired: { chip: 'bg-emerald-50 text-emerald-950 border-emerald-300', icon: Award, iconCls: 'text-emerald-700', rail: 'bg-emerald-600' },
  rejected: { chip: 'bg-zinc-100 text-zinc-700 border-zinc-200', icon: XCircle, iconCls: 'text-zinc-500', rail: 'bg-zinc-300' },
};

const parseDetails = (d) => {
  if (!d) return {};
  if (typeof d !== 'string') return d;
  try { return JSON.parse(d); } catch { return {}; }
};

function InterviewTile({ app, interview, t }) {
  const parts = app.interview_at ? kigaliParts(app.interview_at) : null;
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
      <p className="text-sm font-semibold text-blue-950">{t('applications.interviewCardTitle')}</p>
      <div className="mt-3 flex items-stretch gap-4">
        {parts ? (
          <div className="shrink-0 w-[4.5rem] rounded-xl bg-white border border-blue-200 text-center overflow-hidden">
            <div className="bg-blue-800 text-white text-xs font-semibold py-1">{parts.month}</div>
            <div className="display text-3xl font-bold text-blue-950 leading-none pt-2">{parts.day}</div>
            <div className="text-xs text-zinc-500 pb-2 pt-1">{parts.weekday}</div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2.5 text-sm">
          <div>
            <span className="block text-xs text-zinc-500">{t('applications.date')} & {t('applications.time')}</span>
            <span className="font-semibold text-zinc-900 text-base">
              {parts ? <>{parts.time} <span className="text-xs font-semibold text-blue-700">CAT</span></> : `${interview.date} ${interview.time}`}
            </span>
            {parts && <span className="block text-xs text-zinc-500">Rwanda time</span>}
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-zinc-500">{t('applications.location')}</span>
            <InterviewLocation value={interview.location_or_link} fallback="To be specified" />
          </div>
        </div>
      </div>
      {interview.notes && (
        <p className="mt-4 pt-3 border-t border-blue-200/70 text-sm text-zinc-700 leading-relaxed">
          <span className="font-semibold text-zinc-900">{t('applications.notes')}: </span>{interview.notes}
        </p>
      )}
    </div>
  );
}

function HiredTile({ app, t }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-emerald-600" />
        <p className="text-sm font-bold text-emerald-950">{t('applications.offerDetailsTitle') || 'Job Offer & Next Steps'}</p>
      </div>
      <p className="mt-2 text-sm text-emerald-900 leading-relaxed">
        {app.decision_notes || 'Congratulations! The employer has selected you for this position. Please check your messages or email for onboarding details.'}
      </p>
    </div>
  );
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  const { t, tr } = useLanguage();
  usePageTitle(t('applications.title'));
  const { markResultsSeen } = useNotifications();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fresh, setFresh] = useState(() => new Set()); // results that were new when this page opened

  const fetchApplications = useCallback(async (isPolling = false) => {
    if (!user) return;
    try {
      const res = await api.get('/applications/my');
      const list = res.applications || [];
      setApplications(list);
      if (!isPolling) {
        setFresh(new Set(list.filter((a) => a.has_new_result).map((a) => a.id)));
      }
    } catch (err) {
      console.error('Fetch applications error:', err);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate('/login?redirect=/applications'); return; }
    setLoading(true);
    fetchApplications(false);

    // Live status polling every 15s to catch status transitions without refreshing
    const tick = () => {
      if (document.visibilityState === 'visible') {
        fetchApplications(true);
      }
    };
    const interval = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user, navigate, fetchApplications]);

  // Once the candidate has had a moment to see the "New" badges, clear the red dot
  useEffect(() => {
    if (fresh.size === 0) return undefined;
    const timer = setTimeout(markResultsSeen, 1500);
    return () => clearTimeout(timer);
  }, [fresh, markResultsSeen]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-zinc-500 py-20 px-4" role="status">
        <div className="w-7 h-7 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  const statusText = {
    pending: t('applications.statusPending') || 'Submitted',
    applied: t('applications.statusPending') || 'Submitted',
    viewed: t('applications.statusViewed') || 'Viewed by Employer',
    shortlisted: t('applications.statusShortlisted') || 'Shortlisted',
    approved: t('applications.statusApproved') || 'Interview Scheduled',
    interview: t('applications.statusApproved') || 'Interview Scheduled',
    hired: t('applications.statusHired') || 'Offer Extended / Selected',
    rejected: t('applications.statusRejected') || 'Not Selected',
  };

  const statusDesc = {
    pending: t('applications.statusPendingDesc'),
    applied: t('applications.statusPendingDesc'),
    viewed: t('applications.statusViewedDesc') || 'The employer has opened and examined your application details.',
    shortlisted: t('applications.statusShortlistedDesc') || 'Congratulations! You are shortlisted in the top candidate pool.',
    approved: t('applications.statusApprovedDesc'),
    interview: t('applications.statusApprovedDesc'),
    hired: t('applications.statusHiredDesc') || 'Congratulations! The employer has selected you for this position.',
    rejected: t('applications.statusRejectedDesc'),
  };

  return (
    <div className="page w-full py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b rule">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold mb-2">
              <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>{tr('Live Status & No Ghosting Guarantee', 'Ibisubizo by\'ako kanya bitarimo kuburirwa irengero')}</span>
            </div>
            <h1 className="display text-4xl font-semibold text-blue-950">{t('applications.title')}</h1>
            <p className="mt-2 text-zinc-600">{t('applications.subtitle')}</p>
          </div>
          <Link to="/jobs" className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-[#d9d5c9] bg-white hover:border-blue-600 px-5 py-2.5 text-sm font-semibold text-zinc-800 transition">
            {t('applications.exploreJobsBtn')}<ArrowRight className="w-4 h-4" />
          </Link>
        </header>

        {applications.length === 0 ? (
          <div className="mt-10 rounded-3xl border rule bg-white p-12 text-center">
            <Briefcase className="w-10 h-10 text-blue-300 mx-auto" />
            <h2 className="display text-2xl font-semibold text-blue-950 mt-4">{t('applications.emptyTitle')}</h2>
            <p className="text-zinc-600 max-w-sm mx-auto mt-2">{t('applications.emptyDesc')}</p>
            <Link to="/jobs" className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-800 hover:bg-blue-900 text-white px-6 py-3 text-sm font-semibold transition">
              {t('applications.exploreJobsBtn')}<ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-6">
            {applications.map((app) => {
              const st = STATUS[app.status] || STATUS.pending;
              const StatusIcon = st.icon;
              const interview = parseDetails(app.interview_details);
              const isNew = fresh.has(app.id);

              return (
                <li key={app.id} className={`relative rounded-3xl border bg-white overflow-hidden transition-shadow ${isNew ? 'border-red-300 shadow-[0_0_0_4px_rgba(239,68,68,0.08)]' : 'rule'}`}>
                  <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${st.rail}`} aria-hidden="true" />
                  <div className="p-5 sm:p-7 pl-6 sm:pl-9 space-y-5">
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-blue-800">{app.company_name}</p>
                        <Link to={`/jobs/${app.job_id}`} className="display text-2xl font-semibold text-zinc-950 hover:underline underline-offset-4 leading-snug block mt-0.5">{app.job_title}</Link>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                          <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-zinc-400" />{app.job_location}</span>
                          <span>{t('applications.appliedOn', { date: formatDate(app.created_at) })}</span>
                        </p>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                        {isNew && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500 text-white text-xs font-bold px-2.5 py-1">
                            <Sparkles className="w-3 h-3" />{tr('New update', 'Ibisubizo bishya')}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${st.chip}`}>
                          <StatusIcon className={`w-4 h-4 ${st.iconCls}`} />{statusText[app.status] || statusText.pending}
                        </span>
                      </div>
                    </div>

                    {/* 5-Step Pipeline Stepper */}
                    <ApplicationPipeline app={app} />

                    {/* Status explanation */}
                    <p className="text-[15px] text-zinc-700 leading-relaxed">{statusDesc[app.status] || statusDesc.pending}</p>

                    {/* Chat button if active */}
                    <MessageButton appId={app.id} status={app.status} />

                    {/* Rich Cards based on status */}
                    {(app.status === 'approved' || app.status === 'interview') && (interview.date || app.interview_at) && (
                      <InterviewTile app={app} interview={interview} t={t} />
                    )}

                    {app.status === 'hired' && (
                      <HiredTile app={app} t={t} />
                    )}

                    {app.status === 'rejected' && app.rejection_reason && (
                      <div className="rounded-2xl bg-[#f4f2ec] px-4 py-3.5 text-sm text-zinc-700">
                        <span className="font-semibold text-zinc-900">{t('applications.rejectionFeedback')}: </span>{app.rejection_reason}
                      </div>
                    )}

                    {/* Bottom link to view job opening */}
                    <div className="pt-2 flex justify-end">
                      <Link to={`/jobs/${app.job_id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-800 hover:text-blue-950">
                        {t('home.viewJobDetails')}<ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
