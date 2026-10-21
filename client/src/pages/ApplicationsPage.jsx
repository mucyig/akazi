import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, CheckCircle2, Check, XCircle, Clock3, ArrowRight, ChevronRight, Briefcase, Sparkles, Flag } from 'lucide-react';
import { MessageButton } from '../components/ChatDock';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import InterviewLocation from '../components/InterviewLocation';
import ReportJobModal from '../components/ReportJobModal';
import { getReportedJobIds, markJobReported } from '../utils/reportedJobs';
import { formatDate, kigaliParts } from '../utils/time';
import { usePageTitle } from '../hooks/usePageTitle';

const STATUS = {
  pending: { chip: 'bg-amber-50 text-amber-900 border-amber-200', icon: Clock3, iconCls: 'text-amber-600', rail: 'bg-amber-400' },
  approved: { chip: 'bg-blue-50 text-blue-900 border-blue-200', icon: CheckCircle2, iconCls: 'text-blue-600', rail: 'bg-blue-600' },
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

export default function ApplicationsPage() {
  const { user } = useAuth();
  const { t, tr } = useLanguage();
  usePageTitle(t('applications.title'));
  const { markResultsSeen } = useNotifications();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fresh, setFresh] = useState(() => new Set()); // results that were new when this page opened
  const [reportingJob, setReportingJob] = useState(null);
  const [reportedJobIds, setReportedJobIds] = useState(() => new Set(getReportedJobIds()));

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.jobId) setReportedJobIds((prev) => new Set([...prev, Number(e.detail.jobId)]));
    };
    window.addEventListener('akazi_job_reported', handler);
    return () => window.removeEventListener('akazi_job_reported', handler);
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login?redirect=/applications'); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/applications/my');
        if (cancelled) return;
        const list = res.applications || [];
        setApplications(list);
        setFresh(new Set(list.filter((a) => a.has_new_result).map((a) => a.id)));
      } catch (err) {
        console.error('Fetch applications error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

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

  const statusText = { pending: t('applications.statusPending'), approved: t('applications.statusApproved'), rejected: t('applications.statusRejected') };
  const statusDesc = { pending: t('applications.statusPendingDesc'), approved: t('applications.statusApprovedDesc'), rejected: t('applications.statusRejectedDesc') };

  return (
    <div className="page w-full py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b rule">
          <div>
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
          <ul className="mt-8 space-y-5">
            {applications.map((app) => {
              const st = STATUS[app.status] || STATUS.pending;
              const StatusIcon = st.icon;
              const interview = parseDetails(app.interview_details);
              const isNew = fresh.has(app.id);
              return (
                <li key={app.id} className={`relative rounded-3xl border bg-white overflow-hidden transition-shadow ${isNew ? 'border-red-300 shadow-[0_0_0_4px_rgba(239,68,68,0.08)]' : 'rule'}`}>
                  <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${st.rail}`} aria-hidden="true" />
                  <div className="p-5 sm:p-7 pl-6 sm:pl-9">
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
                            <Sparkles className="w-3 h-3" />{tr('New result', 'Igisubizo gishya')}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${st.chip}`}>
                          <StatusIcon className={`w-4 h-4 ${st.iconCls}`} />{statusText[app.status]}
                        </span>
                      </div>
                    </div>

                    <p className="mt-5 text-[15px] text-zinc-700 leading-relaxed">{statusDesc[app.status]}</p>

                    <div className="mt-4"><MessageButton appId={app.id} status={app.status} /></div>

                    {app.status === 'approved' && (interview.date || app.interview_at) && (
                      <div className="mt-5"><InterviewTile app={app} interview={interview} t={t} /></div>
                    )}

                    {app.status === 'rejected' && app.rejection_reason && (
                      <div className="mt-5 rounded-2xl bg-[#f4f2ec] px-4 py-3.5 text-sm text-zinc-700">
                        <span className="font-semibold text-zinc-900">{t('applications.rejectionFeedback')}: </span>{app.rejection_reason}
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
                      {!reportedJobIds.has(Number(app.job_id)) ? (
                      <button
                        type="button"
                        onClick={() => setReportingJob({ id: app.job_id, title: app.job_title, company_name: app.company_name })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-red-600 transition"
                      >
                        <Flag className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{t('jobDetails.reportJob')}</span>
                      </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/70">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{tr('Reported', 'Yatangiwe raporo')}</span>
                        </span>
                      )}
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

      {reportingJob && (
        <ReportJobModal
          job={reportingJob}
          onClose={() => setReportingJob(null)}
          onReportSuccess={() => { if (reportingJob) { markJobReported(reportingJob.id); setReportedJobIds((prev) => new Set([...prev, Number(reportingJob.id)])); } }}
        />
      )}
    </div>
  );
}
