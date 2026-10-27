import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  Users, 
  ShieldCheck, 
  Plus, 
  ExternalLink,
  ChevronRight,
  BadgeCheck,
  Clock,
  AlertCircle,
  Building2,
  Upload,
  X,
  FileText,
  Camera
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatRelativeTime } from '../../utils/time';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatSalary, formatJobType } from '../../utils/format';

export default function EmployerDashboard() {
  const { user, employer, isActiveEmployer, refreshUser } = useAuth();
  const { t, language } = useLanguage();
  usePageTitle(t('nav.employerHub'));
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [employerData, setEmployerData] = useState(employer || null);
  const [loading, setLoading] = useState(true);

  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [verificationFile, setVerificationFile] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [submittingApply, setSubmittingApply] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applyError, setApplyError] = useState('');

  // Logo Modal state
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submittingLogo, setSubmittingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState('');
  const [logoErr, setLogoErr] = useState('');

  const loadData = async () => {
    try {
      const res = await api.get('/employers/dashboard');
      setJobs(res.jobs || []);
      if (res.employer) {
        setEmployerData(res.employer);
      }
    } catch (err) {
      console.error('Fetch employer dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Employers need admin approval AND the paid registration fee
    if (user && user.role === 'employer' && !isActiveEmployer) {
      navigate('/employer/status', { replace: true });
      return;
    }

    setLoading(true);
    loadData();
  }, [user, isActiveEmployer, navigate]);

  const handleApplyVerification = async (e) => {
    e.preventDefault();
    setSubmittingApply(true);
    setApplyError('');
    setApplyMessage('');

    try {
      const fd = new FormData();
      if (verificationFile) {
        fd.append('verification_doc', verificationFile);
      }
      if (verificationNotes.trim()) {
        fd.append('notes', verificationNotes.trim());
      }

      const res = await api.post('/employers/apply-verification', fd, true);
      setApplyMessage(res.message || 'Application submitted successfully.');
      setTimeout(() => {
        setShowApplyModal(false);
        setApplyMessage('');
        setVerificationFile(null);
        setVerificationNotes('');
      }, 2000);
      await loadData();
      if (refreshUser) refreshUser();
    } catch (err) {
      setApplyError(err.message || 'Failed to submit verification application.');
    } finally {
      setSubmittingApply(false);
    }
  };

  const handleUploadLogo = async (e) => {
    e.preventDefault();
    if (!logoFile) return;
    setSubmittingLogo(true);
    setLogoErr('');
    setLogoMsg('');

    try {
      const fd = new FormData();
      fd.append('logo', logoFile);
      const res = await api.post('/employers/logo', fd, true);
      setLogoMsg(res.message || 'Logo uploaded successfully!');
      setTimeout(() => {
        setShowLogoModal(false);
        setLogoMsg('');
        setLogoFile(null);
        setLogoPreview(null);
      }, 1500);
      await loadData();
      if (refreshUser) refreshUser();
    } catch (err) {
      setLogoErr(err.message || 'Failed to upload company logo.');
    } finally {
      setSubmittingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-zinc-500 py-20 px-4">
        <div className="w-7 h-7 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  const isVerified = !!employerData?.is_verified;
  const tickStatus = employerData?.verification_tick_status || 'unverified';

  return (
    <div className="min-h-screen bg-zinc-50/50 py-8 text-zinc-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              {employerData?.logo_url ? (
                <img
                  src={employerData.logo_url}
                  alt={employerData.company_name}
                  className="w-16 h-16 rounded-2xl object-contain border border-zinc-200 bg-white p-1.5 shadow-2xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-white font-bold text-2xl grid place-items-center shadow-2xs">
                  {(employerData?.company_name || employer?.company_name || user?.name || 'C')[0]}
                </div>
              )}
              <button
                onClick={() => setShowLogoModal(true)}
                className="absolute -bottom-1 -right-1 p-1.5 bg-white border border-zinc-200 rounded-full text-zinc-700 hover:text-blue-600 hover:border-blue-400 shadow-xs transition"
                title={language === 'rw' ? 'Hindura ikimenyetso cy\'ikigo' : 'Upload or change company logo'}
                aria-label={language === 'rw' ? 'Hindura ikimenyetso cy\'ikigo' : 'Upload or change company logo'}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{language === 'rw' ? 'Ubucuruzi Bwemejwe' : 'Verified Business'}</span>
                  </span>
                ) : tickStatus === 'applied' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{language === 'rw' ? 'Gusaba Ikimenyetso Byasuzumwe' : 'Verification Tick Under Review'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200">
                    <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{language === 'rw' ? 'Konti Yanditswe' : 'Registered Employer'}</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-zinc-950 flex items-center gap-2">
                <span>{employerData?.company_name || employer?.company_name || user?.name}</span>
                {isVerified && (
                  <BadgeCheck className="w-6 h-6 text-blue-600 shrink-0 inline" title="Verified Business Tick" />
                )}
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-500">
                <span>{employerData?.industry || employer?.industry}</span>
                <span>•</span>
                <button
                  onClick={() => setShowLogoModal(true)}
                  className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold hover:underline"
                >
                  <Upload className="w-3 h-3" />
                  <span>
                    {employerData?.logo_url 
                      ? (language === 'rw' ? 'Hindura ikimenyetso (Logo)' : 'Change logo') 
                      : (language === 'rw' ? 'Shyiramo ikimenyetso cy\'ikigo (Logo)' : 'Upload company logo')}
                  </span>
                </button>
              </div>
            </div>
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

        {/* Verified Business Tick Status Card */}
        {isVerified ? (
          <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200/60 p-4 sm:p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <BadgeCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                {language === 'rw' ? 'Ubucuruzi Bwemejwe n\'Akazi' : 'Akazi Verified Business'}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {language === 'rw' 
                  ? 'Ikigo cyawe gifite ikimenyetso cy\'ubucuruzi bwemejwe (Verified Tick) ku myanya yose n\'umwirondoro.' 
                  : 'Your business displays the official Verified Tick badge across all search results and active job posts.'}
              </p>
            </div>
          </div>
        ) : tickStatus === 'applied' ? (
          <div className="bg-amber-50/60 rounded-2xl border border-amber-200/80 p-5 shadow-xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                {language === 'rw' ? 'Ubusabe bwo Kwemezwa Burimo Gusuzumwa' : 'Verification Tick Application Under Review'}
              </h3>
              <p className="text-xs text-amber-800/90 mt-0.5">
                {language === 'rw'
                  ? 'Inyandiko zawe zoherejwe. Itsinda ryacu ririmo gusuzuma ibyangombwa byawe by\'ubucuruzi. Uzabona ubutumwa nitumara kubyemeza.'
                  : 'Your business verification application is currently being reviewed by administrators. You will be notified once reviewed.'}
              </p>
            </div>
          </div>
        ) : tickStatus === 'rejected' ? (
          <div className="bg-rose-50/60 rounded-2xl border border-rose-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950">
                  {language === 'rw' ? 'Ubusabe bwo Kwemezwa Ntabwo Bwemejwe' : 'Verification Tick Not Approved'}
                </h3>
                <p className="text-xs text-rose-800 mt-0.5 max-w-xl">
                  {employerData?.verification_tick_notes || (language === 'rw' ? 'Inyandiko z\'ubucuruzi ntizabashije kwemezwa.' : 'Business verification credentials could not be validated.')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowApplyModal(true)}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl shrink-0 transition shadow-xs"
            >
              {language === 'rw' ? 'Ongera Usabe' : 'Update & Re-apply'}
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white rounded-2xl border border-blue-100 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  {language === 'rw' ? 'Saba Ikimenyetso cy\'Ubucuruzi Bwemejwe (Verified Tick)' : 'Apply for the Verified Business Tick'}
                </h3>
                <p className="text-xs text-zinc-600 mt-1 max-w-xl">
                  {language === 'rw' 
                    ? 'Ongera icyizere mu bakandida b\'indashyikirwa. Garagaza ikimenyetso cyemewe iruhande rw\'izina ry\'ikigo cyawe ku myanya yose y\'akazi ushyiraho.'
                    : 'Build trust with qualified candidates. Display the official Akazi verified tick next to your company name on all job posts and searches.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowApplyModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shrink-0 transition shadow-xs flex items-center gap-1.5 justify-center"
            >
              <BadgeCheck className="w-4 h-4" />
              <span>{language === 'rw' ? 'Saba Ikimenyetso' : 'Apply for Verified Tick'}</span>
            </button>
          </div>
        )}

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
                      <span>{formatJobType(job.job_type, language)}</span>
                      {job.salary_range && (
                        <>
                          <span>•</span>
                          <span>{formatSalary(job.salary_range)}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-semibold text-zinc-800">
                        {t('employerWorkspace.applicantsCount', { count: job.applicant_count || 0 })}
                      </span>
                      {job.created_at && (
                        <>
                          <span>•</span>
                          <span>{formatRelativeTime(job.created_at, language)}</span>
                        </>
                      )}
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

      {/* Modal: Apply for Verified Business Tick */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-zinc-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowApplyModal(false)}
              className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-950">
                  {language === 'rw' ? 'Saba Ikimenyetso cy\'Ubucuruzi Bwemejwe' : 'Apply for Verified Business Tick'}
                </h3>
                <p className="text-xs text-zinc-500">
                  {employerData?.company_name || employer?.company_name}
                </p>
              </div>
            </div>

            {applyMessage ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                {applyMessage}
              </div>
            ) : (
              <form onSubmit={handleApplyVerification} className="space-y-4">
                {applyError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                    {applyError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-800 mb-1">
                    {language === 'rw' 
                      ? 'Inyandiko y\'iyandikisha (Icyemezo cya RDB / TIN / Uruhushya)' 
                      : 'Business Verification Document (RDB Certificate / Tax Clearance / License)'}
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-2">
                    {employerData?.registration_doc_url 
                      ? (language === 'rw' 
                          ? 'Inyandiko wateguye mu kwiyandikisha irahari. Ushobora gushyiramo indi nshya cyangwa ugakoresha isanzwe.' 
                          : 'You already submitted a document during registration. You can upload an updated one, or leave this blank to use your existing registration file.')
                      : (language === 'rw' 
                          ? 'Shyiramo inyandiko ifite format ya PDF, PNG, cyangwa JPG.' 
                          : 'Upload your official document in PDF, PNG, or JPG format.')}
                  </p>

                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 hover:border-blue-500 rounded-2xl cursor-pointer bg-zinc-50/50 hover:bg-blue-50/20 transition">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-6 h-6 text-zinc-400 mb-1" />
                        <p className="text-xs text-zinc-600 font-medium">
                          {verificationFile ? verificationFile.name : (language === 'rw' ? 'Kanda hano uhitemo dosiye' : 'Click to select document')}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">PDF, PNG, JPG (max 10MB)</p>
                      </div>
                      <input 
                        type="file" 
                        accept=".pdf,.png,.jpg,.jpeg" 
                        className="hidden" 
                        onChange={(e) => setVerificationFile(e.target.files?.[0] || null)} 
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800 mb-1">
                    {language === 'rw' ? 'Ibisobanuro by\'inyongera (Ubwishyu / TIN / Umwirondoro)' : 'Additional Notes (TIN number / Company info)'}
                  </label>
                  <textarea
                    rows={3}
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder={language === 'rw' ? 'Urugero: Twanditswe muri RDB, TIN yacu ni...' : 'e.g., Registered with RDB as ABC Ltd, TIN 123456789...'}
                    className="w-full text-xs p-3 rounded-xl border border-zinc-200 focus:outline-none focus:border-blue-600 bg-zinc-50/30"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition"
                  >
                    {language === 'rw' ? 'Kureka' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingApply}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    {submittingApply ? (language === 'rw' ? 'Birimo koherezwa...' : 'Submitting...') : (language === 'rw' ? 'Ohereza Ubusabe' : 'Submit Application')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Upload Company Logo */}
      {showLogoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-zinc-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => { setShowLogoModal(false); setLogoFile(null); setLogoPreview(null); }}
              className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-950">
                  {language === 'rw' ? 'Shyiramo ikimenyetso cy\'ikigo' : 'Upload Company Logo'}
                </h3>
                <p className="text-xs text-zinc-500">
                  {employerData?.company_name || employer?.company_name}
                </p>
              </div>
            </div>

            {logoMsg ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                {logoMsg}
              </div>
            ) : (
              <form onSubmit={handleUploadLogo} className="space-y-4">
                {logoErr && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                    {logoErr}
                  </div>
                )}

                <div className="flex flex-col items-center justify-center">
                  {logoPreview ? (
                    <div className="mb-4 relative">
                      <img src={logoPreview} alt="Logo preview" className="w-24 h-24 rounded-2xl object-contain border border-zinc-200 bg-white p-2 shadow-xs" />
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        className="absolute -top-2 -right-2 bg-zinc-900 text-white rounded-full p-1 hover:bg-red-600 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : employerData?.logo_url ? (
                    <div className="mb-4 text-center">
                      <p className="text-[11px] text-zinc-500 mb-1">{language === 'rw' ? 'Ikimenyetso gisanzwe:' : 'Current Logo:'}</p>
                      <img src={employerData.logo_url} alt="Current logo" className="w-20 h-20 rounded-2xl object-contain border border-zinc-200 bg-white p-2 mx-auto shadow-xs" />
                    </div>
                  ) : null}

                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 hover:border-blue-500 rounded-2xl cursor-pointer bg-zinc-50/50 hover:bg-blue-50/20 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-zinc-400 mb-1" />
                      <p className="text-xs text-zinc-600 font-medium">
                        {logoFile ? logoFile.name : (language === 'rw' ? 'Hitamo ifoto y\'ikimenyetso' : 'Choose logo image file')}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">PNG, JPG or WEBP (Square recommended)</p>
                    </div>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowLogoModal(false); setLogoFile(null); setLogoPreview(null); }}
                    className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition"
                  >
                    {language === 'rw' ? 'Kureka' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLogo || !logoFile}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    {submittingLogo ? (language === 'rw' ? 'Birimo kubikwa...' : 'Saving...') : (language === 'rw' ? 'Bika Ikimenyetso' : 'Upload Logo')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
