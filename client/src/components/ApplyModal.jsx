import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  ShieldCheck,
  User,
  Phone,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';

export default function ApplyModal({ job, onClose, onSuccess }) {
  const { user, profile } = useAuth();
  const { t, language, tr} = useLanguage();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);

  // Step 1: Candidate personal information
  const [candidateInfo, setCandidateInfo] = useState({
    fullName: user?.name || '',
    nationalId: user?.national_id || profile?.national_id || '',
    phone: user?.phone || '',
    email: user?.email || '',
    location: user?.location || profile?.district || '',
    education: user?.education_level || profile?.education_level || ''
  });

  // Step 2: Documents & Custom Questions
  const [useProfileResume, setUseProfileResume] = useState(!!profile?.resume_url);
  const [resumeFile, setResumeFile] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [customAnswers, setCustomAnswers] = useState({});
  const [experienceText, setExperienceText] = useState('');
  const [coverNote, setCoverNote] = useState('');

  // Step 3: Terms acceptance
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Parse custom questions / document requirements from job
  const customFields = Array.isArray(job.custom_fields)
    ? job.custom_fields
    : (typeof job.custom_fields === 'string' ? JSON.parse(job.custom_fields || '[]') : []);

  // Determine if job explicitly requires CV, ID, or Cert
  const requiresCv = customFields.some(f => f.id === 'require_cv' || f.type === 'cv') || true; // standard requirement
  const requiresId = customFields.some(f => f.id === 'require_id' || f.type === 'id_doc');
  const requiresCert = customFields.some(f => f.id === 'require_cert' || f.type === 'certificate');
  const textQuestions = customFields.filter(f => !['require_cv', 'require_id', 'require_cert', 'require_experience'].includes(f.id));

  const handleCustomFieldChange = (fieldId, value) => {
    setCustomAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleNextStep = () => {
    setError('');
    if (step === 1) {
      if (!candidateInfo.fullName.trim()) {
        setError(t('apply.errors.nameRequired'));
        return;
      }
      if (!candidateInfo.nationalId.trim()) {
        setError(t('apply.errors.nationalIdRequired'));
        return;
      }
      if (!candidateInfo.phone.trim()) {
        setError(t('apply.errors.phoneRequired'));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Validate documents & questions
      if (requiresCv && !useProfileResume && !resumeFile) {
        setError(t('apply.errors.cvRequired'));
        return;
      }
      if (requiresId && !idFile) {
        setError(t('apply.errors.idDocRequired'));
        return;
      }
      for (const q of textQuestions) {
        if (q.required && (!customAnswers[q.id] || customAnswers[q.id].toString().trim() === '')) {
          setError(t('apply.errors.customQuestionRequired'));
          return;
        }
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!agreedToTerms) {
      setError(t('apply.errors.termsRequired'));
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('job_id', job.id);

      const submittedData = {
        candidate_name: candidateInfo.fullName,
        national_id: candidateInfo.nationalId,
        phone: candidateInfo.phone,
        email: candidateInfo.email,
        location: candidateInfo.location,
        education_level: candidateInfo.education,
        experience_summary: experienceText,
        cover_note: coverNote,
        answers: customAnswers
      };

      formData.append('submitted_data', JSON.stringify(submittedData));

      if (!useProfileResume && resumeFile) {
        formData.append('resume', resumeFile);
      }

      if (idFile) {
        formData.append('attachments', idFile);
      }
      if (certFile) {
        formData.append('attachments', certFile);
      }

      const res = await api.post('/applications', formData, true);
      setSubmittedSuccessfully(true);
      if (onSuccess) {
        setTimeout(() => onSuccess(res.application), 300);
      }
    } catch (err) {
      console.error('Submit application error:', err);
      setError(err.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden border border-zinc-200">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between bg-zinc-50/50">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {job.company_name}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 leading-snug">
              {job.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Header */}
        {!submittedSuccessfully && (
          <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <span className="font-semibold text-zinc-900">
              {t('apply.stepIndicator', { current: step, total: 3 })}: {' '}
              <span className="font-normal text-zinc-600">
                {step === 1 && t('apply.step1Title')}
                {step === 2 && t('apply.step2Title')}
                {step === 3 && t('apply.step3Title')}
              </span>
            </span>
            <div className="flex items-center gap-1">
              <span className={`w-2.5 h-1.5 rounded-full ${step >= 1 ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
              <span className={`w-2.5 h-1.5 rounded-full ${step >= 2 ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
              <span className={`w-2.5 h-1.5 rounded-full ${step >= 3 ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
            </div>
          </div>
        )}

        {/* Modal Body */}
        {submittedSuccessfully ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">
              {t('apply.successTitle')}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
              {t('apply.successDesc', { company: job.company_name })}
            </p>

            <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/applications"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition"
              >
                {t('apply.goToApplications')}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-medium transition"
              >
                {t('apply.close')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {error && (
              <div className="mb-5 p-3.5 bg-zinc-100 border border-zinc-300 rounded-xl flex items-start gap-2.5 text-xs text-zinc-900">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Candidate Personal Info */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500">
                  {t('apply.step1Desc')}
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-zinc-700 mb-1">
                      {t('apply.fullName')} <span className="text-zinc-900 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={candidateInfo.fullName}
                      onChange={(e) => setCandidateInfo({ ...candidateInfo, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">
                        {t('apply.nationalId')} <span className="text-zinc-900 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        value={candidateInfo.nationalId}
                        onChange={(e) => setCandidateInfo({ ...candidateInfo, nationalId: e.target.value })}
                        placeholder="119..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 font-mono"
                        required
                      />
                      <span className="text-[10px] text-zinc-400 mt-0.5 block">
                        {t('apply.nationalIdHelp')}
                      </span>
                    </div>

                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">
                        {t('apply.phone')} <span className="text-zinc-900 font-bold">*</span>
                      </label>
                      <input
                        type="tel"
                        value={candidateInfo.phone}
                        onChange={(e) => setCandidateInfo({ ...candidateInfo, phone: e.target.value })}
                        placeholder="078..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                        required
                      />
                      <span className="text-[10px] text-zinc-400 mt-0.5 block">
                        {t('apply.phoneHelp')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">
                        {t('apply.location')}
                      </label>
                      <input
                        type="text"
                        value={candidateInfo.location}
                        onChange={(e) => setCandidateInfo({ ...candidateInfo, location: e.target.value })}
                        placeholder={tr(tr("e.g. Nyarugenge, Kigali", "urugero: Nyarugenge, Kigali"), "urugero: Nyarugenge, Kigali")}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">
                        {t('apply.education')}
                      </label>
                      <input
                        type="text"
                        value={candidateInfo.education}
                        onChange={(e) => setCandidateInfo({ ...candidateInfo, education: e.target.value })}
                        placeholder={t('apply.educationPlaceholder')}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition"
                  >
                    <span>{t('apply.nextStep')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Documents & Employer Questions */}
            {step === 2 && (
              <div className="space-y-5 text-xs">
                <p className="text-zinc-500">
                  {t('apply.step2Desc')}
                </p>

                {/* CV / Resume */}
                <div className="p-3.5 rounded-xl bg-zinc-50/60 border border-zinc-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-zinc-900">
                      {t('apply.cvDocument')} <span className="text-zinc-900 font-bold">*</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-zinc-500">{t('apply.cvHelp')}</p>

                  {profile?.resume_url && (
                    <div className="space-y-1.5 mb-2">
                      <label className="flex items-center gap-2 text-xs text-zinc-800 cursor-pointer">
                        <input
                          type="radio"
                          name="cvChoice"
                          checked={useProfileResume}
                          onChange={() => setUseProfileResume(true)}
                          className="accent-zinc-900"
                        />
                        <span>{language === 'rw' ? 'Koresha CV iri kuri konti yawe' : 'Use saved resume from your profile'}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-800 cursor-pointer">
                        <input
                          type="radio"
                          name="cvChoice"
                          checked={!useProfileResume}
                          onChange={() => setUseProfileResume(false)}
                          className="accent-zinc-900"
                        />
                        <span>{language === 'rw' ? 'Shyiraho indi CV nshya' : 'Upload a specific CV for this application'}</span>
                      </label>
                    </div>
                  )}

                  {(!profile?.resume_url || !useProfileResume) && (
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setResumeFile(e.target.files[0])}
                      className="block w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-zinc-900 file:text-white hover:file:bg-zinc-800 cursor-pointer"
                    />
                  )}
                </div>

                {/* National ID Copy (if requested or optional) */}
                <div className="p-3.5 rounded-xl bg-zinc-50/60 border border-zinc-200/80 space-y-1.5">
                  <label className="font-semibold text-zinc-900 block">
                    {t('apply.idDocument')} {requiresId && <span className="text-zinc-900 font-bold">*</span>}
                  </label>
                  <p className="text-[11px] text-zinc-500">{t('apply.idHelp')}</p>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setIdFile(e.target.files[0])}
                    className="block w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-zinc-200 file:text-zinc-900 hover:file:bg-zinc-300 cursor-pointer"
                  />
                </div>

                {/* Custom employer questions */}
                {textQuestions.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="font-semibold text-zinc-900 border-b border-zinc-100 pb-1">
                      {language === 'rw' ? 'Ibibazo by\'Umukoresha' : 'Employer Questions'}
                    </div>

                    {textQuestions.map((q) => (
                      <div key={q.id} className="space-y-1">
                        <label className="block text-zinc-700 font-medium">
                          {q.label} {q.required && <span className="text-zinc-900 font-bold">*</span>}
                        </label>
                        {q.type === 'textarea' ? (
                          <textarea
                            rows={2}
                            value={customAnswers[q.id] || ''}
                            onChange={(e) => handleCustomFieldChange(q.id, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                            placeholder={language === 'rw' ? 'Igisubizo cyawe...' : 'Your answer...'}
                          />
                        ) : (
                          <input
                            type="text"
                            value={customAnswers[q.id] || ''}
                            onChange={(e) => handleCustomFieldChange(q.id, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                            placeholder={q.placeholder || (language === 'rw' ? 'Igisubizo cyawe...' : 'Your answer...')}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Note to employer */}
                <div className="space-y-1 pt-1">
                  <label className="block font-medium text-zinc-700">
                    {t('apply.extraNote')}
                  </label>
                  <textarea
                    rows={2}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder={t('apply.extraNotePlaceholder')}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('apply.prevStep')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition"
                  >
                    <span>{t('apply.nextStep')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-5 text-xs">
                <p className="text-zinc-500">
                  {t('apply.step3Desc')}
                </p>

                {/* Summary Card */}
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-400 block text-[10px]">{t('apply.fullName')}</span>
                      <span className="font-semibold text-zinc-900">{candidateInfo.fullName}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px]">{t('apply.nationalId')}</span>
                      <span className="font-mono text-zinc-900">{candidateInfo.nationalId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px]">{t('apply.phone')}</span>
                      <span className="text-zinc-900">{candidateInfo.phone}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px]">{t('apply.location')}</span>
                      <span className="text-zinc-900">{candidateInfo.location || '—'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-200 text-zinc-600 text-[11px] space-y-1">
                    <div>
                      <span className="font-medium text-zinc-900">CV / Resume: </span>
                      {useProfileResume ? 'Saved profile CV' : (resumeFile ? resumeFile.name : 'None')}
                    </div>
                    {idFile && (
                      <div>
                        <span className="font-medium text-zinc-900">National ID Doc: </span>
                        {idFile.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Truthfulness Agreement */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="accent-zinc-900 w-4 h-4 mt-0.5 rounded cursor-pointer"
                    required
                  />
                  <span className="text-xs text-zinc-800 leading-snug">
                    {t('apply.termsAgreement')}
                  </span>
                </label>

                {/* Actions */}
                <div className="pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('apply.prevStep')}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('apply.submitting')}</span>
                      </>
                    ) : (
                      <span>{t('apply.submitApplication')}</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
