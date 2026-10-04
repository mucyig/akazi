import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function PostJobPage() {
  const { user, isActiveEmployer } = useAuth();
  const { t, language, tr} = useLanguage();
  const navigate = useNavigate();

  // Redirect employers who are not verified + paid yet
  useEffect(() => {
    if (user && user.role === 'employer' && !isActiveEmployer) {
      navigate('/employer/status', { replace: true });
    }
  }, [user, isActiveEmployer, navigate]);

  const [formData, setFormData] = useState({
    title: '',
    job_type: 'full-time',
    category: 'General Work',
    location: '',
    salary_range: '',
    working_conditions: '',
    responsibilities: '',
    requirements: '',
    deadline: ''
  });

  // Document requirement toggles
  const [requireCv, setRequireCv] = useState(true);
  const [requireId, setRequireId] = useState(true);
  const [requireCert, setRequireCert] = useState(false);
  const [requireExperience, setRequireExperience] = useState(false);

  // Custom questions (up to 3)
  const [customQuestions, setCustomQuestions] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim() || customQuestions.length >= 3) return;
    setCustomQuestions(prev => [
      ...prev,
      { id: 'q_' + Date.now(), label: newQuestionText.trim(), type: 'text', required: true }
    ]);
    setNewQuestionText('');
  };

  const handleRemoveQuestion = (id) => {
    setCustomQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError(t('postJob.errors.titleRequired'));
      return;
    }
    if (!formData.location.trim()) {
      setError(t('postJob.errors.locationRequired'));
      return;
    }
    if (!formData.responsibilities.trim()) {
      setError(t('postJob.errors.descriptionRequired'));
      return;
    }
    if (!formData.requirements.trim()) {
      setError(t('postJob.errors.requirementsRequired'));
      return;
    }

    setLoading(true);

    try {
      // Assemble custom fields array based on toggles + custom questions
      const assembledFields = [];
      if (requireCv) assembledFields.push({ id: 'require_cv', label: 'Curriculum Vitae (CV)', type: 'cv', required: true });
      if (requireId) assembledFields.push({ id: 'require_id', label: 'National ID Copy', type: 'id_doc', required: true });
      if (requireCert) assembledFields.push({ id: 'require_cert', label: 'Education Certificate / Diploma', type: 'certificate', required: true });
      if (requireExperience) assembledFields.push({ id: 'require_experience', label: 'Experience Statement', type: 'text', required: true });

      // Add custom questions
      customQuestions.forEach(q => assembledFields.push(q));

      const payload = {
        ...formData,
        description: formData.responsibilities,
        custom_fields: assembledFields
      };

      await api.post('/jobs', payload);
      navigate('/employer/dashboard');
    } catch (err) {
      console.error('Create job error:', err);
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 py-8 text-zinc-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        
        {/* Back link */}
        <Link
          to="/employer/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{language === 'rw' ? 'Subira mu mirimo yawe' : 'Back to workspace'}</span>
        </Link>

        {/* Post Job Form Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          
          <div className="p-6 sm:p-8 border-b border-zinc-100 bg-zinc-50/40">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">
              {t('postJob.title')}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {t('postJob.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 text-xs">
            {error && (
              <div className="p-3.5 bg-zinc-100 border border-zinc-300 rounded-xl flex items-start gap-2.5 text-xs text-zinc-900">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Position Title */}
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                {t('postJob.jobTitle')} <span className="text-zinc-900 font-bold">*</span>
              </label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleInputChange}
                placeholder={tr(tr("e.g. Waitress, Chef, Receptionist, Driver, Cleaner", "urugero: Umutetsi, Uwakira abashyitsi, Umushoferi, Umukozi w’isuku"), "urugero: Umutetsi, Uwakira abashyitsi, Umushoferi, Umukozi w’isuku")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
              />
            </div>

            {/* Job Type & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('postJob.jobType')} <span className="text-zinc-900 font-bold">*</span>
                </label>
                <select
                  name="job_type"
                  value={formData.job_type}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900 cursor-pointer"
                >
                  <option value="full-time">{t('postJob.fullTime')}</option>
                  <option value="part-time">{t('postJob.partTime')}</option>
                  <option value="contract">{t('postJob.contract')}</option>
                  <option value="temporary">{t('postJob.temporary')}</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('postJob.workLocation')} <span className="text-zinc-900 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  required
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder={tr(tr("e.g. Kigali, Nyarugenge", "urugero: Kigali, Nyarugenge"), "urugero: Kigali, Nyarugenge")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
                />
              </div>
            </div>

            {/* Working Conditions & Schedule */}
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                {t('postJob.workingConditions')}
              </label>
              <textarea
                rows={2}
                name="working_conditions"
                value={formData.working_conditions}
                onChange={handleInputChange}
                placeholder={t('postJob.workingConditionsPlaceholder')}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
              />
            </div>

            {/* Responsibilities */}
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                {t('postJob.responsibilities')} <span className="text-zinc-900 font-bold">*</span>
              </label>
              <textarea
                rows={3}
                name="responsibilities"
                required
                value={formData.responsibilities}
                onChange={handleInputChange}
                placeholder={t('postJob.responsibilitiesPlaceholder')}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
              />
            </div>

            {/* Requirements */}
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                {t('postJob.requirements')} <span className="text-zinc-900 font-bold">*</span>
              </label>
              <textarea
                rows={3}
                name="requirements"
                required
                value={formData.requirements}
                onChange={handleInputChange}
                placeholder={t('postJob.requirementsPlaceholder')}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
              />
            </div>

            {/* Salary Range & Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('postJob.salary')}
                </label>
                <input
                  type="text"
                  name="salary_range"
                  value={formData.salary_range}
                  onChange={handleInputChange}
                  placeholder={t('postJob.salaryPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  {t('postJob.deadline')}
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
                />
              </div>
            </div>

            {/* Document Requirements Toggles */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div>
                <h3 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">
                  {t('postJob.requiredDocsSection')}
                </h3>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  {t('postJob.requiredDocsDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 bg-zinc-50/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireCv}
                    onChange={(e) => setRequireCv(e.target.checked)}
                    className="accent-zinc-900 w-4 h-4 rounded"
                  />
                  <span className="text-xs text-zinc-800">{t('postJob.requireCv')}</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 bg-zinc-50/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireId}
                    onChange={(e) => setRequireId(e.target.checked)}
                    className="accent-zinc-900 w-4 h-4 rounded"
                  />
                  <span className="text-xs text-zinc-800">{t('postJob.requireId')}</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 bg-zinc-50/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireCert}
                    onChange={(e) => setRequireCert(e.target.checked)}
                    className="accent-zinc-900 w-4 h-4 rounded"
                  />
                  <span className="text-xs text-zinc-800">{t('postJob.requireCert')}</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-200 bg-zinc-50/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireExperience}
                    onChange={(e) => setRequireExperience(e.target.checked)}
                    className="accent-zinc-900 w-4 h-4 rounded"
                  />
                  <span className="text-xs text-zinc-800">{t('postJob.requireExperience')}</span>
                </label>
              </div>
            </div>

            {/* Custom Questions Section */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div>
                <h3 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">
                  {t('postJob.customQuestionsTitle')}
                </h3>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  {t('postJob.customQuestionsDesc')}
                </p>
              </div>

              {customQuestions.map((q, idx) => (
                <div key={q.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-xs text-zinc-800">{idx + 1}. {q.label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(q.id)}
                    className="text-zinc-400 hover:text-zinc-700 text-xs"
                  >
                    {t('postJob.remove')}
                  </button>
                </div>
              ))}

              {customQuestions.length < 3 && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder={t('postJob.questionPlaceholder')}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 text-xs bg-zinc-50/50 text-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    {t('postJob.addQuestion')}
                  </button>
                </div>
              )}
            </div>

            {/* Publish button */}
            <div className="pt-6 border-t border-zinc-100 flex items-center justify-end gap-3">
              <Link
                to="/employer/dashboard"
                className="px-4 py-2.5 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {t('common.cancel')}
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('postJob.publishing')}</span>
                  </>
                ) : (
                  <span>{t('postJob.publishButton')}</span>
                )}
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
}
