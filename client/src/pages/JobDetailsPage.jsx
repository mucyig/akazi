import { formatYmd, formatRelativeTime } from '../utils/time';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  ArrowLeft, 
  FileText, 
  Briefcase,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Share2,
  Check,
  Flag
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ApplyModal from '../components/ApplyModal';
import ReportJobModal from '../components/ReportJobModal';
import { isJobReported, markJobReported } from '../utils/reportedJobs';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatSalary } from '../utils/format';

export default function JobDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [job, setJob] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [copied, setCopied] = useState(false);

  usePageTitle(job ? `${job.title} · ${job.company_name}` : (language === 'rw' ? 'Umurimo' : 'Job Details'));

  const handleShare = async () => {
    if (!job) return;
    const shareData = {
      title: `${job.title} · ${job.company_name} | Akazi`,
      text: `${job.title} at ${job.company_name} - Akazi (Jobs in Rwanda)`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard if share was cancelled or unavailable
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  useEffect(() => {
    async function loadJob() {
      setLoading(true);
      try {
        const data = await api.get(`/jobs/${id}`);
        setJob(data.job);
        setHasApplied(data.has_applied);
        setApplication(data.application);
        setHasReported(Boolean(data.has_reported || isJobReported(id)));
      } catch (err) {
        setError(err.message || 'Job opening not found.');
      } finally {
        setLoading(false);
      }
    }
    loadJob();
    const onJobReported = (e) => {
      if (e.detail?.jobId === Number(id)) setHasReported(true);
    };
    window.addEventListener('akazi_job_reported', onJobReported);
  }, [id]);

  const handleApplyClick = () => {
    if (!user) {
      navigate(`/login?redirect=/jobs/${id}`);
      return;
    }
    if (user.role !== 'employee') {
      alert(language === 'rw' 
        ? 'Konti z\'abashaka akazi nizo zishobora gusaba iyi mirimo.' 
        : 'Only Job Seeker accounts can apply for positions.');
      return;
    }
    setApplyModalOpen(true);
  };

  const handleApplySuccess = (newApp) => {
    setHasApplied(true);
    setApplication(newApp);
    setApplyModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-zinc-500 py-20 px-4">
        <div className="w-7 h-7 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-zinc-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900">
          {language === 'rw' ? 'Umurimo ntabwo ubonetse' : 'Position Not Found'}
        </h2>
        <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
          {error || (language === 'rw' ? 'Uyu murimo ushobora kuba warakuweho cyangwa warafunzwe.' : 'This job posting may have expired or been removed by the employer.')}
        </p>
        <Link 
          to="/jobs" 
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('jobDetails.back')}
        </Link>
      </div>
    );
  }

  // Parse required documents / custom fields
  const customFields = Array.isArray(job.custom_fields)
    ? job.custom_fields
    : (typeof job.custom_fields === 'string' ? JSON.parse(job.custom_fields || '[]') : []);

  // Google Jobs Schema (JSON-LD) for rich search engine ranking
  const employmentTypeMap = {
    'full-time': 'FULL_TIME',
    'part-time': 'PART_TIME',
    'contract': 'CONTRACTOR',
    'temporary': 'TEMPORARY',
    'internship': 'INTERN',
    'volunteer': 'VOLUNTEER',
  };

  const schemaJson = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: `${job.description || ''}\n\n${job.requirements || ''}`,
    identifier: {
      '@type': 'PropertyValue',
      name: job.company_name,
      value: String(job.id),
    },
    datePosted: job.created_at,
    validThrough: job.deadline ? `${job.deadline}T23:59:59+02:00` : undefined,
    employmentType: employmentTypeMap[job.job_type?.toLowerCase()] || 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company_name,
      sameAs: job.website || undefined,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location || 'Kigali',
        addressRegion: 'Kigali',
        addressCountry: 'RW',
      },
    },
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 py-8 text-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJson) }} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        {/* Breadcrumb & Share Actions */}
        <div className="flex items-center justify-between mb-5">
          <Link 
            to="/jobs" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('jobDetails.back')}</span>
          </Link>

          <div className="flex items-center gap-2">
            {!hasReported ? (
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              aria-label={t('jobDetails.reportJob')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 bg-white hover:border-red-300 hover:bg-red-50/50 hover:text-red-700 text-xs font-semibold text-zinc-700 transition active:scale-95 shadow-2xs group"
            >
              <Flag className="w-3.5 h-3.5 text-zinc-400 group-hover:text-red-600 transition-colors" />
              <span>{t('jobDetails.reportJob')}</span>
            </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'rw' ? 'Raporo yatanzwe' : 'Reported'}</span>
              </span>
            )}

          <button
            type="button"
            onClick={handleShare}
            aria-label={language === 'rw' ? 'Sangiza uyu murimo' : 'Share this job'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition active:scale-95 shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">{language === 'rw' ? 'Byakoporowe!' : 'Link copied!'}</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>{language === 'rw' ? 'Sangiza' : 'Share'}</span>
              </>
            )}
          </button>
          </div>
        </div>

        {/* Document-style Card */}
        <article className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-zinc-100 bg-gradient-to-b from-zinc-50/40 to-white">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-zinc-600" />
                  <span>{job.company_name}</span>
                  {job.employer_status === 'approved' && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <ShieldCheck className="w-3 h-3" />
                      {t('nav.statusApproved')}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
                  {job.title}
                </h1>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-3 text-xs text-zinc-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    {job.location}
                  </span>
                  <span>•</span>
                  <span className="capitalize font-medium text-zinc-800">
                    {job.job_type}
                  </span>
                  {job.category && (
                    <>
                      <span>•</span>
                      <span className="text-zinc-600">{job.category}</span>
                    </>
                  )}
                  {job.created_at && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-zinc-500">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {formatRelativeTime(job.created_at, language)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Primary Call to Action */}
              <div className="shrink-0 pt-2 sm:pt-0">
                {hasApplied ? (
                  <div className="space-y-1.5 text-right sm:text-left">
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-900 text-white font-medium text-xs rounded-xl shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{t('jobDetails.alreadyApplied')}</span>
                    </div>
                    <Link
                      to="/applications"
                      className="block text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
                    >
                      {t('jobDetails.viewApplicationStatus')}
                    </Link>
                  </div>
                ) : (job.is_expired || job.status !== 'active') ? (
                  <span className="inline-flex items-center px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-semibold">
                    {language === 'rw' ? 'Gusaba byarafunzwe' : 'Applications closed'}
                  </span>
                ) : (
                  <button
                    onClick={handleApplyClick}
                    className="w-full sm:w-auto px-7 py-3 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm rounded-xl transition shadow-xs flex items-center justify-center gap-2 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 active:scale-95"
                  >
                    <span>{t('jobDetails.applyButton')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Fact Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-zinc-100 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-100">
                <span className="text-zinc-400 block text-[11px] mb-1">{t('jobDetails.salary')}</span>
                <span className="font-semibold text-zinc-900 text-sm">
                  {formatSalary(job.salary_range) || t('jobDetails.salaryNotSpecified')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-100">
                <span className="text-zinc-400 block text-[11px] mb-1">{t('jobDetails.jobType')}</span>
                <span className="font-semibold text-zinc-900 text-sm capitalize">
                  {job.job_type}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-100">
                <span className="text-zinc-400 block text-[11px] mb-1">{language === 'rw' ? 'Byashyizweho' : 'Posted'}</span>
                <span className="font-semibold text-zinc-900 text-sm">
                  {job.created_at ? formatRelativeTime(job.created_at, language) : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-100">
                <span className="text-zinc-400 block text-[11px] mb-1">{t('jobDetails.deadline')}</span>
                <span className="font-semibold text-zinc-900 text-sm">
                  {job.deadline ? formatYmd(job.deadline) : t('jobDetails.deadlineNotSpecified')}
                </span>
              </div>
            </div>
          </div>

          {/* Body Sections */}
          <div className="p-6 sm:p-8 space-y-8 text-sm">
            
            {/* Working Conditions & Schedule */}
            {job.working_conditions && (
              <section className="space-y-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {t('jobDetails.workingConditions')}
                </h2>
                <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/60 text-zinc-800 leading-relaxed whitespace-pre-line text-sm">
                  {job.working_conditions}
                </div>
              </section>
            )}

            {/* Responsibilities */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t('jobDetails.responsibilities')}
              </h2>
              <div className="text-zinc-700 leading-relaxed whitespace-pre-line text-sm">
                {job.responsibilities || job.description}
              </div>
            </section>

            {/* Requirements */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t('jobDetails.requirements')}
              </h2>
              <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/60 text-zinc-800 leading-relaxed whitespace-pre-line text-sm">
                {job.requirements}
              </div>
            </section>

            {/* Application Requirements specified by employer */}
            {customFields.length > 0 && (
              <section className="space-y-2.5 pt-4 border-t border-zinc-100">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {t('jobDetails.requiredDocuments')}
                </h2>
                <ul className="space-y-2 text-xs text-zinc-700">
                  {customFields.map((field, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-1.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-zinc-900">{field.label}</span>
                        {field.required && (
                          <span className="ml-1.5 text-zinc-400 font-normal">({t('common.required')})</span>
                        )}
                        {field.description && (
                          <p className="text-zinc-500 mt-0.5">{field.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* About the Business */}
            <section className="pt-6 border-t border-zinc-100 space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t('jobDetails.aboutEmployer')}
              </h2>
              <div className="text-xs text-zinc-600 leading-relaxed">
                {job.employer_description || (language === 'rw' 
                  ? 'Ubucuruzi bwiyandikishije kandi bwemejwe kuri Akazi.' 
                  : 'Verified registered business on Akazi platform.')}
              </div>
            </section>

            {/* Trust & Safety Reporting Notice */}
            <section className="pt-6 border-t border-zinc-100">
              {!hasReported ? (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start sm:flex-center gap-2.5 text-zinc-600">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                    <span>{t('jobDetails.reportNotice')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(true)}
                    className="inline-flex items-center gap-1.5 font-semibold text-red-600 hover:text-red-700 hover:underline shrink-0"
                  >
                    <Flag className="w-3.5 h-3.5 text-red-500" />
                    <span>{t('jobDetails.reportLink')}</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-4 flex items-center gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{language === 'rw' ? 'Wamaze gutanga raporo kuri iri tangazo. Itsinda riracyarisuzuma.' : 'You have reported this job listing. Our moderation team is actively reviewing it.'}</span>
                </div>
              )}
            </section>

            {/* Bottom Apply Action */}
            <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-zinc-500">
                {!user ? t('jobDetails.signInToApply') : ''}
              </p>
              
              {!hasApplied && (job.is_expired || job.status !== 'active') ? (
                <span className="inline-flex items-center px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-semibold">
                  {language === 'rw' ? 'Gusaba byarafunzwe' : 'Applications closed'}
                </span>
              ) : !hasApplied ? (
                <button
                  onClick={handleApplyClick}
                  className="w-full sm:w-auto px-8 py-3 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm rounded-xl transition shadow-xs focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  {t('jobDetails.applyButton')}
                </button>
              ) : (
                <Link
                  to="/applications"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:underline"
                >
                  <span>{t('jobDetails.viewApplicationStatus')}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

          </div>
        </article>

      </div>

      {/* Dynamic Conversational Application Modal */}
      {applyModalOpen && (
        <ApplyModal
          job={job}
          onClose={() => setApplyModalOpen(false)}
          onSuccess={handleApplySuccess}
        />
      )}

      {/* Community Report Modal */}
      {reportModalOpen && (
        <ReportJobModal
          job={job}
          onClose={() => setReportModalOpen(false)}
          onReportSuccess={() => { setHasReported(true); markJobReported(job?.id); }}
        />
      )}
    </div>
  );
}
