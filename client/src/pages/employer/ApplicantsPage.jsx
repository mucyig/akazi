import { MessageButton } from '../../components/ChatDock';
import FileLink from '../../components/ProtectedFile';
import ApplicationPipeline from '../../components/ApplicationPipeline';
import { kigaliDatePlusDays, todayKigali, formatDateTime } from '../../utils/time';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft, 
  FileText, 
  Calendar, 
  ExternalLink,
  X,
  BookmarkCheck,
  Award
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import InterviewLocation from '../../components/InterviewLocation';

export default function ApplicantsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, isActiveEmployer } = useAuth();
  const { t, language, tr } = useLanguage();

  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Modals state
  const [interviewModalApp, setInterviewModalApp] = useState(null);
  const [interviewForm, setInterviewForm] = useState({
    date: kigaliDatePlusDays(2),
    time: '09:00',
    format: 'In-person Meeting',
    location_or_link: '',
    notes: ''
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [declineModalApp, setDeclineModalApp] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  const [hireModalApp, setHireModalApp] = useState(null);
  const [hireNotes, setHireNotes] = useState('');

  // Redirect employers who are not verified + paid yet
  useEffect(() => {
    if (user && user.role === 'employer' && !isActiveEmployer) {
      navigate('/employer/status', { replace: true });
    }
  }, [user, isActiveEmployer, navigate]);

  const fetchApplicants = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const res = await api.get(`/applications/job/${jobId}`);
      setJob(res.job);
      setApplicants(res.applicants || []);
    } catch (err) {
      console.error('Failed to load applicants', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [jobId]);

  const handleShortlist = async (app) => {
    try {
      await api.patch(`/applications/${app.id}/shortlist`, {});
      await fetchApplicants();
    } catch (err) {
      alert(err.message || t('common.error'));
    }
  };

  const handleOpenInterview = (app) => {
    setInterviewModalApp(app);
    setInterviewForm({
      date: kigaliDatePlusDays(2),
      time: '09:00',
      format: 'In-person Meeting',
      location_or_link: job?.location || '',
      notes: ''
    });
  };

  const handleConfirmInterview = async (e) => {
    e.preventDefault();
    if (!interviewModalApp) return;
    setModalSubmitting(true);
    try {
      await api.patch(`/applications/${interviewModalApp.id}/approve-interview`, interviewForm);
      setInterviewModalApp(null);
      await fetchApplicants();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConfirmDecline = async (e) => {
    e.preventDefault();
    if (!declineModalApp) return;
    setModalSubmitting(true);
    try {
      await api.patch(`/applications/${declineModalApp.id}/reject`, { rejection_reason: declineReason });
      setDeclineModalApp(null);
      setDeclineReason('');
      await fetchApplicants();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleOpenHire = (app) => {
    setHireModalApp(app);
    setHireNotes('Congratulations! You have been selected for this position. Our hiring team will contact you regarding onboarding.');
  };

  const handleConfirmHire = async (e) => {
    e.preventDefault();
    if (!hireModalApp) return;
    setModalSubmitting(true);
    try {
      await api.patch(`/applications/${hireModalApp.id}/hire`, { decision_notes: hireNotes });
      setHireModalApp(null);
      setHireNotes('');
      await fetchApplicants();
    } catch (err) {
      alert(err.message || t('common.error'));
    } finally {
      setModalSubmitting(false);
    }
  };

  // Counts for pipeline tabs
  const counts = {
    all: applicants.length,
    applied: applicants.filter((a) => a.status === 'pending' || a.status === 'applied').length,
    viewed: applicants.filter((a) => a.status === 'viewed').length,
    shortlisted: applicants.filter((a) => a.status === 'shortlisted').length,
    interview: applicants.filter((a) => a.status === 'approved' || a.status === 'interview').length,
    hired: applicants.filter((a) => a.status === 'hired').length,
    declined: applicants.filter((a) => a.status === 'rejected').length,
  };

  const filteredApplicants = applicants.filter((app) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'applied') return app.status === 'pending' || app.status === 'applied';
    if (activeTab === 'viewed') return app.status === 'viewed';
    if (activeTab === 'shortlisted') return app.status === 'shortlisted';
    if (activeTab === 'interview') return app.status === 'approved' || app.status === 'interview';
    if (activeTab === 'hired') return app.status === 'hired';
    if (activeTab === 'declined') return app.status === 'rejected';
    return true;
  });

  const tabList = [
    { id: 'all', label: t('applicantReview.tabAll') || 'All', count: counts.all },
    { id: 'applied', label: t('applicantReview.tabApplied') || 'Applied', count: counts.applied },
    { id: 'viewed', label: t('applicantReview.tabViewed') || 'Viewed', count: counts.viewed },
    { id: 'shortlisted', label: t('applicantReview.tabShortlisted') || 'Shortlisted', count: counts.shortlisted },
    { id: 'interview', label: t('applicantReview.tabInterview') || 'Interview', count: counts.interview },
    { id: 'hired', label: t('applicantReview.tabHired') || 'Hired', count: counts.hired },
    { id: 'declined', label: t('applicantReview.tabDeclined') || 'Declined', count: counts.declined },
  ];

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
        
        {/* Back Link */}
        <Link
          to="/employer/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('applicantReview.back')}</span>
        </Link>

        {/* Page Header */}
        <div className="pb-4 border-b border-zinc-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
                {t('applicantReview.title', { jobTitle: job?.title || 'Job' })}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('applicantReview.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200">
                {applicants.length} {t('employerWorkspace.applicantsCount', { count: applicants.length })}
              </span>
            </div>
          </div>

          {/* Pipeline Tabs Bar */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {tabList.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setActiveTab(tb.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTab === tb.id
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
                }`}
              >
                <span>{tb.label}</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  activeTab === tb.id ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {tb.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Applicants List */}
        {filteredApplicants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500 space-y-3 shadow-xs">
            <Users className="w-10 h-10 text-zinc-300 mx-auto" />
            <h3 className="text-base font-bold text-zinc-900">
              {activeTab === 'all' 
                ? t('applicantReview.emptyTitle')
                : (language === 'rw' ? 'Nta bakandida bari muri iki cyiciro.' : `No candidates in "${activeTab}" stage.`)}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {activeTab === 'all' ? t('applicantReview.emptyDesc') : (language === 'rw' ? 'Hitamo ikindi cyiciro cyangwa utegereze ubusabe bushya.' : 'Switch to another tab to view candidates in other pipeline stages.')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplicants.map((app) => {
              const data = typeof app.submitted_data === 'string' 
                ? JSON.parse(app.submitted_data || '{}') 
                : (app.submitted_data || {});
              const files = typeof app.uploaded_files === 'string' 
                ? JSON.parse(app.uploaded_files || '[]') 
                : (app.uploaded_files || []);
              const interview = typeof app.interview_details === 'string'
                ? JSON.parse(app.interview_details || '{}')
                : (app.interview_details || {});

              const isPending = app.status === 'pending' || app.status === 'applied';
              const isViewed = app.status === 'viewed';
              const isShortlisted = app.status === 'shortlisted';
              const isInterview = app.status === 'approved' || app.status === 'interview';
              const isHired = app.status === 'hired';
              const isDeclined = app.status === 'rejected';

              return (
                <div 
                  key={app.id}
                  className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden"
                >
                  {/* Candidate header card */}
                  <div className="p-5 sm:p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-zinc-50/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-950">
                          {app.applicant_name || data.candidate_name}
                        </h3>
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          isHired 
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : isInterview 
                            ? 'bg-blue-100 text-blue-900 border border-blue-300' 
                            : isShortlisted
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isViewed
                            ? 'bg-sky-50 text-sky-800 border border-sky-200'
                            : isDeclined
                            ? 'bg-zinc-100 text-zinc-500'
                            : 'bg-zinc-100 text-zinc-800'
                        }`}>
                          {isHired && (t('applicantReview.statusHired') || 'Hired')}
                          {isInterview && (t('applicantReview.statusApproved') || 'Interview Scheduled')}
                          {isShortlisted && (t('applicantReview.statusShortlisted') || 'Shortlisted')}
                          {isViewed && (t('applicantReview.statusViewed') || 'Viewed')}
                          {isPending && (t('applicantReview.statusPending') || 'Applied')}
                          {isDeclined && (t('applicantReview.statusRejected') || 'Declined')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-4 mt-2 text-xs text-zinc-600">
                        <div>
                          <span className="text-zinc-400">{t('applicantReview.gender')}: </span>
                          <span className="font-medium text-zinc-900 capitalize">{app.applicant_gender || data.gender || '—'}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">{t('applicantReview.phone')}: </span>
                          <span className="font-medium text-zinc-900">{app.applicant_phone || data.phone || '—'}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">{t('applicantReview.email')}: </span>
                          <span className="font-medium text-zinc-900">{app.applicant_email || data.email || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contextual Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Shortlist action (available on applied or viewed) */}
                      {(isPending || isViewed) && (
                        <button
                          onClick={() => handleShortlist(app)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs inline-flex items-center gap-1.5"
                          title="Move candidate to shortlist"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          <span>{t('applicantReview.shortlistBtn') || 'Shortlist'}</span>
                        </button>
                      )}

                      {/* Invite to Interview (available on applied, viewed, or shortlisted) */}
                      {(isPending || isViewed || isShortlisted) && (
                        <button
                          onClick={() => handleOpenInterview(app)}
                          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition shadow-xs inline-flex items-center gap-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{t('applicantReview.scheduleInterviewBtn')}</span>
                        </button>
                      )}

                      {/* Reschedule (on interview) */}
                      {isInterview && (
                        <button
                          onClick={() => handleOpenInterview(app)}
                          className="px-3.5 py-2 border border-zinc-300 text-zinc-800 hover:bg-zinc-50 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{t('applicantReview.rescheduleInterviewBtn') || 'Reschedule'}</span>
                        </button>
                      )}

                      {/* Hire / Extend Offer (on shortlisted or interview) */}
                      {(isShortlisted || isInterview) && (
                        <button
                          onClick={() => handleOpenHire(app)}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition shadow-xs inline-flex items-center gap-1.5"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>{t('applicantReview.hireBtn') || 'Extend Offer / Hire'}</span>
                        </button>
                      )}

                      {/* Decline (available on all except already declined or already hired) */}
                      {!isDeclined && !isHired && (
                        <button
                          onClick={() => {
                            setDeclineModalApp(app);
                            setDeclineReason('');
                          }}
                          className="px-3 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-xl text-xs font-medium transition"
                        >
                          {t('applicantReview.declineBtn')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Candidate Pipeline Progress Stepper */}
                  <div className="px-5 py-3 bg-zinc-50/60 border-b border-zinc-100">
                    <ApplicationPipeline app={app} compact={true} />
                  </div>

                  {/* Body: Experience, Answers & Files */}
                  <div className="p-5 sm:p-6 space-y-4 text-xs">
                    
                    {/* Education & Experience */}
                    {(data.education_level || data.experience_summary) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {data.education_level && (
                          <div>
                            <span className="text-zinc-400 block text-[11px] mb-0.5">{t('applicantReview.education')}</span>
                            <span className="font-medium text-zinc-800">{data.education_level}</span>
                          </div>
                        )}
                        {data.experience_summary && (
                          <div>
                            <span className="text-zinc-400 block text-[11px] mb-0.5">{t('applicantReview.experience')}</span>
                            <p className="text-zinc-700 leading-relaxed whitespace-pre-line">{data.experience_summary}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Note to employer */}
                    {data.cover_note && (
                      <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100">
                        <span className="text-zinc-400 block text-[11px] mb-1">
                          {language === 'rw' ? 'Ubutumwa bw\'usaba akazi' : 'Candidate Note'}
                        </span>
                        <p className="text-zinc-700 leading-relaxed">{data.cover_note}</p>
                      </div>
                    )}

                    {/* Custom answers */}
                    {data.answers && Object.keys(data.answers).length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                        <span className="font-semibold text-zinc-900 block text-[11px]">
                          {language === 'rw' ? 'Ibisubizo by\'ibibazo by\'umukoresha:' : 'Answers to Employer Questions:'}
                        </span>
                        {Object.entries(data.answers).map(([key, val]) => (
                          <div key={key} className="text-zinc-700">
                            <span className="text-zinc-500">• </span>
                            <span>{val}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Submitted documents */}
                    <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center gap-3">
                      <span className="font-medium text-zinc-500">{t('applicantReview.submittedDocuments')}:</span>
                      
                      {app.resume_url ? (
                        <FileLink fileKey={app.resume_url} icon={false} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-900 hover:bg-zinc-50 font-medium transition">
                          <FileText className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Curriculum Vitae (CV)</span>
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </FileLink>
                      ) : (
                        <span className="text-zinc-400">{t('applicantReview.noDocs')}</span>
                      )}

                      {files.map((f, i) => (
                        <FileLink key={i} fileKey={f.key || f.url} icon={false} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-900 hover:bg-zinc-50 font-medium transition">
                          <FileText className="w-3.5 h-3.5 text-zinc-600" />
                          <span>{f.name || 'Attachment'}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </FileLink>
                      ))}
                    </div>

                    <MessageButton appId={app.id} status={app.status} />

                    {/* Scheduled Interview Details Card */}
                    {isInterview && interview.date && (
                      <div className="mt-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
                        <div className="flex items-center gap-2 text-zinc-900 font-semibold text-xs">
                          <Calendar className="w-4 h-4 text-blue-700" />
                          <span>{t('applications.interviewCardTitle')}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-zinc-700">
                          <div>
                            <span className="text-zinc-400 block text-[11px]">{t('applications.date')}:</span>
                            <span className="font-medium">{app.interview_at ? formatDateTime(app.interview_at) : `${interview.date} ${interview.time}`}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-zinc-400 block text-[11px]">{t('applications.location')}:</span>
                            <InterviewLocation value={interview.location_or_link} fallback="—" />
                          </div>
                          {interview.notes && (
                            <div>
                              <span className="text-zinc-400 block text-[11px]">{t('applications.notes')}:</span>
                              <span>{interview.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hired / Offer Extended Card */}
                    {isHired && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                          <Award className="w-4 h-4 text-emerald-700" />
                          <span>{t('applicantReview.statusHired') || 'Hired / Offer Extended'}</span>
                        </div>
                        {app.decision_notes && (
                          <p className="text-emerald-900">{app.decision_notes}</p>
                        )}
                      </div>
                    )}

                    {/* Decline Reason */}
                    {isDeclined && app.rejection_reason && (
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 text-xs">
                        <span className="font-medium text-zinc-900">{t('applications.rejectionFeedback')}: </span>
                        <span>{app.rejection_reason}</span>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Schedule Interview Modal */}
      {interviewModalApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  {t('applicantReview.interviewModalTitle')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {interviewModalApp.applicant_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInterviewModalApp(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmInterview} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">
                    {t('applicantReview.interviewDate')} <span className="text-zinc-900 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={todayKigali()}
                    value={interviewForm.date}
                    onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">
                    {t('applicantReview.interviewTime')} <span className="text-zinc-900 font-bold">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    step="300"
                    value={interviewForm.time}
                    onChange={(e) => setInterviewForm({ ...interviewForm, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">{tr('Rwanda time (CAT, 24-hour)', 'Isaha yo mu Rwanda (CAT, amasaha 24)')}</p>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('applicantReview.interviewLocation')} <span className="text-zinc-900 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={interviewForm.location_or_link}
                  onChange={(e) => setInterviewForm({ ...interviewForm, location_or_link: e.target.value })}
                  placeholder={tr("e.g. Hotel Reception Desk, or Google Meet URL", "urugero: Ku meza yakira abashyitsi, cyangwa umurongo wa Google Meet")}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('applicantReview.interviewNotes')}
                </label>
                <textarea
                  rows={3}
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                  placeholder={t('applicantReview.interviewNotesPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setInterviewModalApp(null)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {modalSubmitting ? t('common.loading') : t('applicantReview.confirmInterviewBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extend Offer / Hire Candidate Modal */}
      {hireModalApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>{t('applicantReview.hireModalTitle') || 'Extend Offer / Hire Candidate'}</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {hireModalApp.applicant_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHireModalApp(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmHire} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('applicantReview.hireNotesLabel') || 'Offer Message or Next Steps (Optional)'}
                </label>
                <textarea
                  rows={4}
                  value={hireNotes}
                  onChange={(e) => setHireNotes(e.target.value)}
                  placeholder={t('applicantReview.hireNotesPlaceholder') || 'e.g. Welcome to the team! Our HR team will reach out with contract details...'}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setHireModalApp(null)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {modalSubmitting ? t('common.loading') : (t('applicantReview.confirmHireBtn') || 'Confirm Offer & Notify Candidate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decline Candidate Modal */}
      {declineModalApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-base font-bold text-zinc-950">
                {t('applicantReview.declineModalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setDeclineModalApp(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDecline} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('applicantReview.declineReasonLabel')}
                </label>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder={t('applicantReview.declineReasonPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeclineModalApp(null)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {modalSubmitting ? t('common.loading') : t('applicantReview.confirmDeclineBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
