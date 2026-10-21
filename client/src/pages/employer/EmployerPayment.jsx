import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Smartphone, ShieldCheck, Loader2, CheckCircle2, XCircle,
  Pencil, Sparkles, Lock, BadgeCheck, Wallet, Clock, RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const prettyPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  const local = d.startsWith('250') ? '0' + d.slice(3) : (d.startsWith('7') && d.length === 9 ? '0' + d : d);
  return local.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
};

// Polling schedule: 3s intervals for 0-60s, then 5s intervals up to 180s (3 minutes)
const POLLING_SCHEDULE = [
  { untilSeconds: 60, intervalMs: 3000 },
  { untilSeconds: 180, intervalMs: 5000 },
];
const MAX_POLLING_DURATION_MS = 180 * 1000;
const EXTRA_POLLING_DURATION_MS = 60 * 1000;
const ERROR_BACKOFF_STEPS = [3000, 6000, 12000, 24000, 30000];

function withJitter(ms) {
  // +/- 20% random jitter
  const delta = ms * 0.2 * (Math.random() * 2 - 1);
  return Math.max(1000, Math.round(ms + delta));
}

export default function EmployerPayment() {
  const { employer, user, refreshUser } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [customPhone, setCustomPhone] = useState(null);
  const phone = customPhone !== null ? customPhone : (employer?.phone || user?.phone || '');
  const setPhone = setCustomPhone;
  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState('confirm'); // confirm | pending | timeout | paid | failed
  const currentPhase = employer?.payment_status === 'paid' ? 'paid' : phase;
  const [ref, setRef] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingManual, setCheckingManual] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const maxDurationRef = useRef(MAX_POLLING_DURATION_MS);
  const consecutiveErrorsRef = useRef(0);
  const currentRef = useRef(null);
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNext = useCallback((fn, delayMs) => {
    if (!isPollingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, withJitter(delayMs));
  }, []);

  const pollCycle = useCallback(async () => {
    if (!isPollingRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      // Paused while hidden; visibilitychange resumes immediately
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed >= maxDurationRef.current) {
      stopPolling();
      setPhase('timeout');
      return;
    }

    const paymentRef = currentRef.current;
    if (!paymentRef) return;

    try {
      const res = await api.get(`/payments/paypack/status/${paymentRef}`);
      consecutiveErrorsRef.current = 0; // reset error backoff on success
      const s = res?.payment?.status;
      if (s === 'paid') {
        stopPolling();
        setPhase('paid');
        await refreshUser();
        return;
      }
      if (s === 'failed') {
        stopPolling();
        setPhase('failed');
        await refreshUser();
        return;
      }

      // Still pending: check if duration expired
      const nextElapsed = Date.now() - startTimeRef.current;
      if (nextElapsed >= maxDurationRef.current) {
        stopPolling();
        setPhase('timeout');
        return;
      }

      const elapsedSec = nextElapsed / 1000;
      const tier = POLLING_SCHEDULE.find((item) => elapsedSec < item.untilSeconds) || POLLING_SCHEDULE[POLLING_SCHEDULE.length - 1];
      scheduleNext(pollCycle, tier.intervalMs);
    } catch {
      consecutiveErrorsRef.current += 1;
      const stepIdx = Math.min(consecutiveErrorsRef.current - 1, ERROR_BACKOFF_STEPS.length - 1);
      const backoffDelay = ERROR_BACKOFF_STEPS[stepIdx];
      scheduleNext(pollCycle, backoffDelay);
    }
  }, [refreshUser, scheduleNext, stopPolling]);

  const beginPolling = useCallback((paymentRef, durationMs = MAX_POLLING_DURATION_MS) => {
    stopPolling();
    currentRef.current = paymentRef;
    startTimeRef.current = Date.now();
    maxDurationRef.current = durationMs;
    consecutiveErrorsRef.current = 0;
    isPollingRef.current = true;

    // Start first poll after initial tier delay
    scheduleNext(pollCycle, POLLING_SCHEDULE[0].intervalMs);
  }, [pollCycle, scheduleNext, stopPolling]);

  // Visibility change handling
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isPollingRef.current) {
        // Run an immediate check when tab becomes active
        pollCycle();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling();
    };
  }, [pollCycle, stopPolling]);

  // Resume state on load (already paid, or a prompt still pending)
  useEffect(() => {
    const ps = employer?.payment_status;
    if (ps === 'paid') return;
    if (ps === 'pending') {
      (async () => {
        try {
          const res = await api.get('/payments/paypack/latest');
          const p = res?.payment;
          if (p && p.status === 'pending') {
            setRef(p.ref);
            setPhase('pending');
            beginPolling(p.ref);
          }
        } catch { /* ignore */ }
      })();
    }
  }, [employer?.payment_status, beginPolling]);

  const pay = async () => {
    setError('');
    const digits = String(phone).replace(/\D/g, '');
    let local = digits;
    if (digits.startsWith('2507') && digits.length === 12) {
      local = '0' + digits.slice(3);
    } else if (digits.startsWith('7') && digits.length === 9) {
      local = '0' + digits;
    }
    if (local.length < 10) {
      setError(language === 'rw' ? 'Nimero ya telefoni ntigomba kujya munsi y’imibare 10.' : 'Phone number cannot be fewer than 10 digits.');
      return;
    }
    if (local.length > 10) {
      setError(language === 'rw' ? 'Nimero ya telefoni ntigomba kurenza imibare 10.' : 'Phone number cannot exceed 10 digits.');
      return;
    }
    if (!/^07[2389]\d{7}$/.test(local)) {
      setError(language === 'rw' ? 'Nimero ya telefoni igomba gutangira na 07 (urugero 078XXXXXXX).' : 'Rwandan phone numbers must start with 07 (e.g. 078XXXXXXX).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/payments/paypack/initiate', { phone: local });
      if (res?.alreadyPaid) { setPhase('paid'); await refreshUser(); return; }
      setRef(res?.ref || null);
      setPhase('pending');
      if (res?.ref) beginPolling(res.ref);
      await refreshUser();
    } catch (e) {
      setError(e.message || t('employerPayment.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualCheck = async () => {
    if (!ref || checkingManual) return;
    setCheckingManual(true);
    setError('');
    try {
      const res = await api.get(`/payments/paypack/status/${ref}`);
      const s = res?.payment?.status;
      if (s === 'paid') {
        stopPolling();
        setPhase('paid');
        await refreshUser();
        return;
      }
      if (s === 'failed') {
        stopPolling();
        setPhase('failed');
        await refreshUser();
        return;
      }
      // If still pending, restart polling for another minute
      setPhase('pending');
      beginPolling(ref, EXTRA_POLLING_DURATION_MS);
    } catch (e) {
      setError(e.message || t('employerPayment.genericError'));
    } finally {
      setCheckingManual(false);
    }
  };

  const amount = '5,000';
  const progress = currentPhase === 'paid' ? 'w-full' : (currentPhase === 'pending' || currentPhase === 'timeout') ? 'w-11/12' : 'w-10/12';
  const Heading = currentPhase === 'paid' ? t('employerPayment.paidTitle')
    : currentPhase === 'failed' ? t('employerPayment.failedTitle')
    : currentPhase === 'timeout' ? t('employerPayment.timeoutTitle')
    : currentPhase === 'pending' ? t('employerPayment.pendingTitle')
    : t('employerPayment.title');
  const Sub = currentPhase === 'paid' ? t('employerPayment.paidDesc')
    : currentPhase === 'failed' ? t('employerPayment.failedDesc')
    : currentPhase === 'timeout' ? t('employerPayment.timeoutDesc')
    : currentPhase === 'pending' ? t('employerPayment.pendingDesc', { phone: prettyPhone(phone) })
    : t('employerPayment.subtitle');

  const body = (
    <>
      {currentPhase === 'confirm' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t('employerPayment.feeLabel')}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-zinc-950 tabular-nums">{amount}</span>
                <span className="text-sm font-semibold text-zinc-500">RWF</span>
              </p>
            </div>
            <BadgeCheck className="w-9 h-9 text-blue-700/70" />
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 grid place-items-center shrink-0"><Smartphone className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t('employerPayment.numberLabel')}</p>
                  {!editing && <p className="text-sm font-bold text-zinc-900 tabular-nums">{prettyPhone(phone) || '—'}</p>}
                </div>
              </div>
              {!editing && (
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-900 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                  <Pencil className="w-3.5 h-3.5" /> {t('employerPayment.edit')}
                </button>
              )}
            </div>
            {editing && (
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Smartphone className="w-4 h-4" /></span>
                  <input autoFocus value={phone} maxLength={10} onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const v = raw.startsWith('2507') && raw.length <= 12 ? ('0' + raw.slice(3)).slice(0, 10) : raw.slice(0, 10);
                    setPhone(v);
                  }} inputMode="tel" placeholder="078XXXXXXX"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold tabular-nums" />
                </div>
                <button onClick={() => { setEditing(false); setError(''); }} className="px-3 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold">{t('employerPayment.save')}</button>
              </div>
            )}
          </div>

          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}

          <button onClick={pay} disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-800 hover:bg-blue-900 text-white font-semibold shadow-lg shadow-blue-900/20 disabled:opacity-60 transition">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {submitting ? t('employerPayment.paying') : t('employerPayment.payBtn')}
          </button>

          <p className="text-[11px] text-zinc-400 leading-relaxed text-center">{t('employerPayment.note')}</p>
        </div>
      )}

      {currentPhase === 'pending' && (
        <div className="text-center space-y-5 py-2">
          <div className="relative mx-auto w-24 h-24 grid place-items-center">
            <span className="absolute inset-0 rounded-full border-4 border-blue-100" />
            <Loader2 className="absolute w-24 h-24 text-blue-700 animate-spin" strokeWidth={1.5} />
            <Smartphone className="w-8 h-8 text-blue-800" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{t('employerPayment.waiting')}</p>
            <p className="mt-1 text-xs text-zinc-500">{t('employerPayment.pendingTip')}</p>
          </div>
          {ref && <p className="text-[11px] text-zinc-400">Ref: <span className="font-mono">{String(ref).slice(0, 8)}…</span></p>}
          <div className="flex items-center justify-center gap-3 pt-1">
            <button onClick={() => { stopPolling(); setPhase('confirm'); setError(''); }} className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">{t('employerPayment.retry')}</button>
          </div>
        </div>
      )}

      {currentPhase === 'timeout' && (
        <div className="text-center space-y-5 py-2">
          <div className="mx-auto w-20 h-20 rounded-full bg-amber-50 grid place-items-center">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{t('employerPayment.timeoutTitle')}</p>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">{t('employerPayment.timeoutDesc')}</p>
          </div>
          {ref && <p className="text-[11px] text-zinc-400">Ref: <span className="font-mono">{String(ref).slice(0, 8)}…</span></p>}
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleManualCheck}
              disabled={checkingManual}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-800 hover:bg-blue-900 text-white font-semibold shadow-lg shadow-blue-900/20 disabled:opacity-60 transition"
            >
              {checkingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {checkingManual ? t('employerPayment.checking') : t('employerPayment.checkStatusBtn')}
            </button>
            <button
              onClick={() => { stopPolling(); setPhase('confirm'); setError(''); }}
              className="w-full py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              {t('employerPayment.retry')}
            </button>
          </div>
        </div>
      )}

      {currentPhase === 'paid' && (
        <div className="text-center space-y-5 py-2">
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-50 grid place-items-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <button onClick={() => navigate('/employer/dashboard')}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-900/20">
            <Sparkles className="w-4 h-4" /> {t('employerPayment.goDashboard')}
          </button>
        </div>
      )}

      {currentPhase === 'failed' && (
        <div className="text-center space-y-5 py-2">
          <div className="mx-auto w-20 h-20 rounded-full bg-red-50 grid place-items-center">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <button onClick={() => { stopPolling(); setPhase('confirm'); setError(''); }}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-800 hover:bg-blue-900 text-white font-semibold">
            <Lock className="w-4 h-4" /> {t('employerPayment.tryAgain')}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-[88vh] bg-zinc-50/60 py-10 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-zinc-200 shadow-xl shadow-zinc-900/5 overflow-hidden">
        <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-900 to-blue-900 px-6 sm:px-8 pt-7 pb-8 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-blue-200 uppercase">
              <Sparkles className="w-3.5 h-3.5" /> {t('employerPayment.stepLabel')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {t('employerPayment.secure')}
            </span>
          </div>
          <div className="mt-5 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-700 ${progress}`} />
          </div>
          <div className="mt-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 ring-1 ring-white/20 grid place-items-center shrink-0">
              {currentPhase === 'paid' ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                : currentPhase === 'failed' ? <XCircle className="w-6 h-6 text-red-300" />
                : currentPhase === 'timeout' ? <Clock className="w-6 h-6 text-amber-400" />
                : <Wallet className="w-6 h-6 text-blue-200" />}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{Heading}</h1>
              <p className="mt-1 text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-sm">{Sub}</p>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8">{body}</div>
      </div>
    </div>
  );
}
