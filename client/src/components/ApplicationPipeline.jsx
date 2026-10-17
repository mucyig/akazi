import React from 'react';
import { 
  Send, 
  Eye, 
  BookmarkCheck, 
  Calendar, 
  Award, 
  XCircle, 
  Check, 
  Clock,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, shortWhen } from '../utils/time';

/**
 * Stages:
 * 1. Applied
 * 2. Viewed by employer
 * 3. Shortlisted
 * 4. Interview
 * 5. Decision (Hired or Not Selected)
 */
export default function ApplicationPipeline({ app, compact = false }) {
  const { t, language } = useLanguage();

  if (!app) return null;

  const status = app.status || 'pending';
  const isRejected = status === 'rejected';
  const isHired = status === 'hired';
  const isInterview = status === 'approved' || status === 'interview';
  const isShortlisted = status === 'shortlisted';
  const isViewed = status === 'viewed';
  const isAppliedOnly = status === 'pending' || status === 'applied';

  // Determine stage states
  const stages = [
    {
      key: 'applied',
      label: t('applications.pipelineApplied') || 'Applied',
      date: app.created_at,
      icon: Send,
      state: isAppliedOnly ? 'active' : 'done',
    },
    {
      key: 'viewed',
      label: t('applications.pipelineViewed') || 'Viewed by employer',
      date: app.viewed_at,
      icon: Eye,
      state: isViewed
        ? 'active'
        : (app.viewed_at || isShortlisted || isInterview || isHired)
        ? 'done'
        : isRejected && app.viewed_at
        ? 'done'
        : isRejected
        ? 'skipped'
        : 'upcoming',
    },
    {
      key: 'shortlisted',
      label: t('applications.pipelineShortlisted') || 'Shortlisted',
      date: app.shortlisted_at,
      icon: BookmarkCheck,
      state: isShortlisted
        ? 'active'
        : (app.shortlisted_at || isInterview || isHired)
        ? 'done'
        : isRejected && app.shortlisted_at
        ? 'done'
        : isRejected
        ? 'skipped'
        : 'upcoming',
    },
    {
      key: 'interview',
      label: t('applications.pipelineInterview') || 'Interview',
      date: app.interview_at || (app.interview_details && JSON.parse(typeof app.interview_details === 'string' ? app.interview_details : '{}').date),
      icon: Calendar,
      state: isInterview
        ? 'active'
        : isHired
        ? 'done'
        : isRejected && (app.interview_at || app.interview_details)
        ? 'done'
        : isRejected
        ? 'skipped'
        : 'upcoming',
    },
    {
      key: 'decision',
      label: isHired
        ? (t('applications.pipelineHired') || 'Selected / Hired')
        : isRejected
        ? (t('applications.pipelineDeclined') || 'Not Selected')
        : (t('applications.pipelineDecision') || 'Decision'),
      date: app.decision_at || (isRejected || isHired ? app.status_changed_at : null),
      icon: isHired ? Award : isRejected ? XCircle : Clock,
      state: isHired ? 'hired' : isRejected ? 'rejected' : 'upcoming',
    },
  ];

  // Active stage summary
  const activeStage = stages.find((s) => s.state === 'active') || (isHired ? stages[4] : isRejected ? stages[4] : stages[0]);

  if (compact) {
    return (
      <div className="w-full">
        {/* Compact Stepper Row */}
        <div className="flex items-center gap-1 sm:gap-2">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            let dotCls = 'bg-zinc-200 text-zinc-400 border-zinc-200';
            if (stage.state === 'done') dotCls = 'bg-blue-600 text-white border-blue-600';
            else if (stage.state === 'active') dotCls = 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-400/30';
            else if (stage.state === 'hired') dotCls = 'bg-emerald-600 text-white border-emerald-600';
            else if (stage.state === 'rejected') dotCls = 'bg-zinc-200 text-zinc-600 border-zinc-300';
            else if (stage.state === 'skipped') dotCls = 'bg-zinc-100 text-zinc-300 border-zinc-200';

            return (
              <React.Fragment key={stage.key}>
                <div 
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${dotCls}`}
                  title={`${stage.label}${stage.date ? ` (${shortWhen(stage.date)})` : ''}`}
                >
                  {stage.state === 'done' ? (
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  ) : stage.state === 'active' ? (
                    <span className="relative flex h-2 w-2 mr-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                    </span>
                  ) : stage.state === 'hired' ? (
                    <Award className="w-3 h-3 text-white" />
                  ) : stage.state === 'rejected' ? (
                    <XCircle className="w-3 h-3 text-zinc-500" />
                  ) : null}
                  <span className="truncate max-w-[80px] sm:max-w-none">{stage.label}</span>
                </div>
                {!isLast && (
                  <div className={`h-[1.5px] flex-1 min-w-[8px] sm:min-w-[12px] ${
                    stage.state === 'done' ? 'bg-blue-500' : 'bg-zinc-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#fbfaf7] rounded-2xl border border-zinc-200/80 p-4 sm:p-5 space-y-4">
      {/* Live Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 pb-3">
        <div className="flex items-center gap-2">
          {activeStage.state === 'active' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100/90 text-blue-900 border border-blue-200 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
              </span>
              <span>{t('applications.liveStatusLabel') || 'Live Status'}: {activeStage.label}</span>
            </span>
          ) : isHired ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('applications.pipelineHired') || 'Selected / Hired'}</span>
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-300 text-xs font-semibold">
              <XCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span>{t('applications.pipelineDeclined') || 'Not Selected'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{activeStage.label}</span>
            </span>
          )}

          {activeStage.date && (
            <span className="text-[11px] text-zinc-500">
              {shortWhen(activeStage.date)}
            </span>
          )}
        </div>

        <div className="text-[11px] font-medium text-zinc-500">
          {language === 'rw' ? 'Intambwe igaragara muri Akazi' : 'Zero ghosting live tracking'}
        </div>
      </div>

      {/* 5-Step Pipeline Visual Stepper */}
      <div className="relative pt-2 pb-1">
        <div className="grid grid-cols-5 gap-2 relative">
          {/* Connecting line behind icons */}
          <div className="absolute top-4 left-[10%] right-[10%] h-[2px] bg-zinc-200 -z-0" />

          {stages.map((stage) => {
            const Icon = stage.icon;
            let iconWrapCls = 'bg-zinc-100 border-zinc-300 text-zinc-400';
            let titleCls = 'text-zinc-500 font-normal';

            if (stage.state === 'done') {
              iconWrapCls = 'bg-blue-700 border-blue-700 text-white shadow-xs';
              titleCls = 'text-zinc-900 font-semibold';
            } else if (stage.state === 'active') {
              iconWrapCls = 'bg-white border-blue-600 text-blue-700 ring-4 ring-blue-100 shadow-sm';
              titleCls = 'text-blue-950 font-bold';
            } else if (stage.state === 'hired') {
              iconWrapCls = 'bg-emerald-600 border-emerald-600 text-white shadow-xs';
              titleCls = 'text-emerald-950 font-bold';
            } else if (stage.state === 'rejected') {
              iconWrapCls = 'bg-zinc-200 border-zinc-300 text-zinc-600';
              titleCls = 'text-zinc-700 font-medium';
            } else if (stage.state === 'skipped') {
              iconWrapCls = 'bg-zinc-50 border-zinc-200 text-zinc-300 dashed';
              titleCls = 'text-zinc-400 line-through';
            }

            return (
              <div key={stage.key} className="flex flex-col items-center text-center relative z-10">
                {/* Node circle */}
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${iconWrapCls}`}>
                  {stage.state === 'done' ? (
                    <Check className="w-4 h-4 stroke-[2.8]" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Step Title */}
                <p className={`mt-2 text-xs leading-tight ${titleCls}`}>
                  {stage.label}
                </p>

                {/* Step Date */}
                {stage.date && stage.state !== 'skipped' && (
                  <span className="mt-1 text-[10px] text-zinc-500 hidden sm:block">
                    {formatDate(stage.date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
