import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, ChevronDown, BadgeCheck, ArrowRight, X, Flag } from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { formatRelativeTime } from '../utils/time';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatSalary } from '../utils/format';
import ReportJobModal from '../components/ReportJobModal';

const GENERAL_RWANDA_JOB_TERMS = [
  'akazi mu rwanda', 'job in rwanda', 'jobs in rwanda',
  'imirimo mu rwanda', 'work in rwanda', 'imirimo',
  'akazi', 'jobs', 'job', 'mu rwanda', 'in rwanda', 'rwanda', 'kazi', 'umurimo'
];

function cleanSearchQuery(raw) {
  let cleaned = (raw || '').toLowerCase().trim();
  for (const phrase of GENERAL_RWANDA_JOB_TERMS) {
    cleaned = cleaned.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
  }
  return cleaned;
}

export default function JobsPage() {
  const { tr, language } = useLanguage();
  usePageTitle(tr("Browse Jobs", "Reba Imirimo"));
  const [params] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');
  const [loc, setLoc] = useState('all');
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [reportingJob, setReportingJob] = useState(null);

  useEffect(() => {
    api.get('/jobs').then((d) => setJobs(d.jobs || [])).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, []);

  const locations = useMemo(() => {
    const s = new Set();
    jobs.forEach((j) => (j.location || '').split(',').forEach((p) => p.trim().length > 2 && s.add(p.trim())));
    return [...s].sort();
  }, [jobs]);

  const groups = useMemo(() => {
    const rawTerm = q.toLowerCase().trim();
    const specificKeyword = cleanSearchQuery(rawTerm);
    const isGeneralRwandaSearch = rawTerm.length > 0 && specificKeyword.length === 0;

    const g = {};
    const filtered = jobs.filter((j) => {
      const where = loc === 'all' || (j.location || '').toLowerCase().includes(loc.toLowerCase());
      if (!where) return false;

      // If user typed a general term like "akazi", "akazi mu rwanda", or "job in rwanda", all jobs match
      if (!rawTerm || isGeneralRwandaSearch) return true;

      // If specific keywords remain (e.g. "driver", "accountant"), match against job details
      const searchTarget = specificKeyword || rawTerm;
      const terms = searchTarget.split(/\s+/).filter(Boolean);
      return terms.some((t) => [j.title, j.company_name, j.description, j.responsibilities, j.category].some((f) => (f || '').toLowerCase().includes(t)));
    });

    // Score and rank matches so the most relevant positions top up to the highest rank
    const scored = filtered.map((j) => {
      let score = 0;
      const target = specificKeyword || rawTerm;
      if (target) {
        const titleLower = (j.title || '').toLowerCase();
        const companyLower = (j.company_name || '').toLowerCase();
        if (titleLower.includes(target)) score += 100;
        else if (titleLower.split(/\s+/).some((w) => target.includes(w))) score += 50;
        if (companyLower.includes(target)) score += 40;
      }
      return { job: j, score };
    });

    scored.sort((a, b) => b.score - a.score);

    scored.forEach(({ job: j }) => {
      const k = String(j.employer_id ?? j.company_name ?? 'x');
      (g[k] ||= { key: k, name: j.company_name || tr("Verified Employer", "Umukoresha wemewe"), place: j.employer_location || j.location, industry: j.industry, positions: [] }).positions.push(j);
    });
    return Object.values(g);
  }, [jobs, q, loc, tr]);

  const total = groups.reduce((n, g) => n + g.positions.length, 0);
  const searching = q.trim() || loc !== 'all';
  const toggle = (k) => setOpenKeys((c) => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const QUICK_SEARCHES = [
    { label: tr("Akazi mu Rwanda", "Akazi mu Rwanda"), val: "Akazi mu Rwanda" },
    { label: tr("Kigali", "Kigali"), val: "Kigali" },
    { label: tr("Remote", "Aho uri hose"), val: "Remote" },
    { label: tr("Full-time", "Igihe cyose"), val: "Full-time" },
  ];

  return (
    <div className="page py-10 sm:py-14">
      <p className="eyebrow">{tr("Browse", "Reba")}</p>
      <h1 className="display mt-2 text-4xl font-bold text-blue-950">{tr("Open positions", "Imyanya ifunguye")}</h1>

      <div className="mt-6 flex flex-col gap-3 sticky top-16 z-20 py-3 bg-[#faf9f6]">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 flex items-center gap-2 bg-white border rule rounded-full px-4 focus-within:border-blue-700 shadow-xs">
            <Search className="w-4 h-4 text-zinc-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search 'Akazi mu Rwanda', title, or company...", "Shakisha 'Akazi mu Rwanda', umwanya cyangwa ikigo...")} className="flex-1 py-3 bg-transparent focus:outline-none" />
            {q && <button onClick={() => setQ('')} aria-label={tr("Clear search", "Siba ibyashakishijwe")}><X className="w-4 h-4 text-zinc-400" /></button>}
          </label>
          <label className="flex items-center gap-2 bg-white border rule rounded-full px-4 sm:w-60 shadow-xs">
            <MapPin className="w-4 h-4 text-zinc-400" />
            <select value={loc} onChange={(e) => setLoc(e.target.value)} className="flex-1 py-3 bg-transparent focus:outline-none" aria-label={tr("Location", "Aho biherereye")}>
              <option value="all">{tr("Anywhere in Rwanda", "Hose mu Rwanda")}</option>
              {locations.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
        </div>

        {/* Quick search tags for instant top results */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-zinc-500 font-medium">{tr("Popular:", "Ibyakunzwe:")}</span>
          {QUICK_SEARCHES.map((chip) => {
            const active = q.toLowerCase() === chip.val.toLowerCase();
            return (
              <button
                key={chip.val}
                type="button"
                onClick={() => setQ(active ? '' : chip.val)}
                className={`px-3 py-1 rounded-full border transition font-medium ${
                  active
                    ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:border-blue-700 hover:text-blue-900'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-sm text-zinc-500" aria-live="polite">
        {loading
          ? tr('Finding open positions…', 'Turimo gushaka imirimo…')
          : tr(`${total} position${total === 1 ? '' : 's'} at ${groups.length} verified employer${groups.length === 1 ? '' : 's'}`, `Imyanya ${total} ku bakoresha bemewe ${groups.length}`)}
      </p>

      {/* Shimmer skeleton loaders */}
      {loading && (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white border rule rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-200 rounded w-1/3" />
                  <div className="h-3 bg-zinc-100 rounded w-1/2" />
                </div>
                <div className="w-16 h-6 bg-zinc-100 rounded-full shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {failed && <p className="mt-8 p-4 rounded-xl bg-red-50 text-red-800 text-sm">{tr("We couldn’t load jobs. Check your connection and refresh.", "Ntitwabashije gutanga imirimo. Reba murandasi maze usubiremo.")}</p>}
      {!loading && !failed && groups.length === 0 && (
        <div className="mt-10 py-14 text-center border rule rounded-2xl bg-white">
          <p className="font-bold text-zinc-900">{tr("No positions match your search", "Nta myanya ihuye n’ibyo washatse")}</p>
          <button onClick={() => { setQ(''); setLoc('all'); }} className="mt-3 text-sm font-semibold text-blue-800 hover:underline">{tr("Clear filters", "Siba ayo wahisemo")}</button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {groups.map((g) => {
          const open = searching || openKeys.has(g.key);
          return (
            <section key={g.key} className="bg-white border rule rounded-2xl overflow-hidden">
              <button onClick={() => toggle(g.key)} aria-expanded={open} disabled={!!searching}
                className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-blue-50/50 disabled:hover:bg-transparent">
                <span className="w-12 h-12 rounded-xl bg-blue-900 text-white display text-xl font-bold grid place-items-center shrink-0">{g.name[0]}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-bold text-zinc-950">{g.name}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800"><BadgeCheck className="w-4 h-4" />{tr("Verified", "Wemewe")}</span>
                  </span>
                  <span className="block text-sm text-zinc-500 truncate">{[g.place, g.industry].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="text-sm font-semibold text-blue-900 bg-blue-50 rounded-full px-3 py-1 shrink-0">{g.positions.length} {tr('open','ifunguye')}</span>
                {!searching && <ChevronDown className={`w-5 h-5 text-zinc-400 transition ${open ? 'rotate-180' : ''}`} />}
              </button>
              {open && (
                <ul className="border-t rule">
                  {g.positions.map((j) => (
                    <li key={j.id} className="border-b rule last:border-0">
                      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50/50 group">
                        <Link to={`/jobs/${j.id}`} className="flex-1 min-w-0">
                          <span className="block font-semibold text-zinc-900 group-hover:text-blue-800">{j.title}</span>
                          <span className="block text-xs text-zinc-500 mt-0.5">{[j.location, j.job_type, formatSalary(j.salary_range), formatRelativeTime(j.created_at, language)].filter(Boolean).join(' · ')}</span>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setReportingJob(j); }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                            title={language === 'rw' ? 'Tanga raporo' : 'Report this job'}
                            aria-label={language === 'rw' ? 'Tanga raporo' : 'Report this job'}
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                          <Link to={`/jobs/${j.id}`} className="text-sm font-semibold text-blue-800 inline-flex items-center gap-1">
                            {tr('View','Reba')} <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {reportingJob && (
        <ReportJobModal
          job={reportingJob}
          onClose={() => setReportingJob(null)}
        />
      )}
    </div>
  );
}
