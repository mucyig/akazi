import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  DollarSign, 
  ShieldAlert, 
  Ban, 
  HelpCircle, 
  Clock, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const REASON_ICONS = {
  payment_fee: DollarSign,
  fraud_scam: ShieldAlert,
  offensive_content: Ban,
  misleading_expired: Clock,
  other: HelpCircle,
};

export default function ReportJobModal({ job, onClose, onReportSuccess }) {
  const { t } = useLanguage();
  const [selectedReason, setSelectedReason] = useState('payment_fee');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);

  const reasons = [
    { key: 'payment_fee', label: t('reportModal.reasons.payment_fee'), desc: t('reportModal.reasons.payment_fee_desc') },
    { key: 'fraud_scam', label: t('reportModal.reasons.fraud_scam'), desc: t('reportModal.reasons.fraud_scam_desc') },
    { key: 'offensive_content', label: t('reportModal.reasons.offensive_content'), desc: t('reportModal.reasons.offensive_content_desc') },
    { key: 'misleading_expired', label: t('reportModal.reasons.misleading_expired'), desc: t('reportModal.reasons.misleading_expired_desc') },
    { key: 'other', label: t('reportModal.reasons.other'), desc: t('reportModal.reasons.other_desc') },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReason) {
      setError(t('reportModal.selectReason'));
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await api.post(`/jobs/${job.id}/report`, {
        reason: selectedReason,
        details: details.trim() || undefined,
      });

      if (res.already_reported) {
        setAlreadyReported(true);
      } else {
        setSuccess(true);
      }

      if (onReportSuccess) {
        onReportSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-zinc-200/80 shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-100 bg-gradient-to-b from-zinc-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100/60">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                {t('reportModal.title')}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5 max-w-xs">
                {job?.title} · <span className="font-medium text-zinc-700">{job?.company_name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
            aria-label={t('reportModal.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {t('reportModal.successTitle')}
              </h3>
              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed max-w-sm mx-auto">
                {t('reportModal.successMessage')}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition"
              >
                {t('reportModal.close')}
              </button>
            </div>
          </div>
        ) : alreadyReported ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {t('reportModal.alreadyReportedTitle')}
              </h3>
              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed max-w-sm mx-auto">
                {t('reportModal.alreadyReportedMessage')}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition"
              >
                {t('reportModal.close')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200/60 text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">
                {t('reportModal.selectReason')}
              </label>
              <div className="space-y-2">
                {reasons.map((r) => {
                  const Icon = REASON_ICONS[r.key] || AlertTriangle;
                  const isSelected = selectedReason === r.key;
                  return (
                    <label
                      key={r.key}
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition select-none ${
                        isSelected 
                          ? 'border-red-500 bg-red-50/40 ring-1 ring-red-500 shadow-2xs' 
                          : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={r.key}
                        checked={isSelected}
                        onChange={() => setSelectedReason(r.key)}
                        className="mt-0.5 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-red-600' : 'text-zinc-500'}`} />
                          <span className={`text-xs font-semibold ${isSelected ? 'text-red-950' : 'text-zinc-800'}`}>
                            {r.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                          {r.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {t('reportModal.detailsLabel')}
                </label>
                <span className="text-[10px] text-zinc-400">
                  {details.length}/1000
                </span>
              </div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder={t('reportModal.detailsPlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-xs text-zinc-800 placeholder:text-zinc-400 outline-none transition resize-none leading-relaxed"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
              >
                {t('reportModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !selectedReason}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{loading ? t('reportModal.submitting') : t('reportModal.submit')}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
