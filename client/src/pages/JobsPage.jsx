import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, ChevronDown, BadgeCheck, ArrowRight, X } from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function JobsPage() {
  const { tr } = useLanguage();
  const [params] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');
  const [loc, setLoc] = useState('all');
  const [openKeys, setOpenKeys] = useState(() => new Set());

  useEffect(() => {
    api.get('/jobs').then((d) => setJobs(d.jobs || [])).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, []);

  const locations = useMemo(() => {
    const s = new Set();
    jobs.forEach((j) => (j.location || '').split(',').forEach((p) => p.trim().length > 2 && s.add(p.trim())));
    return [...s].sort();
  }, [jobs]);

  const groups = useMemo(() => {
    const term = q.toLowerCase().trim();
    const g = {};
    jobs.filter((j) => {
      const hit = !term || [j.title, j.company_name, j.description, j.responsibilities].some((f) => (f || '').toLowerCase().includes(term));
      const where = loc === 'all' || (j.location || '').toLowerCase().includes(loc.toLowerCase());
      return hit && where;
    }).forEach((j) => {
      const k = String(j.employer_id ?? j.company_name ?? 'x');
      (g[k] ||= { key: k, name: j.company_name || tr("Verified Employer", "Umukoresha wemewe"), place: j.employer_location || j.location, industry: j.industry, positions: [] }).positions.push(j);
    });
    return Object.values(g);
  }, [jobs, q, loc]);

  const total = groups.reduce((n, g) => n + g.positions.length, 0);
  const searching = q.trim() || loc !== 'all';
  const toggle = (k) => setOpenKeys((c) => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="page py-10 sm:py-14">
      <p className="eyebrow">{tr(tr("Browse", "Reba"), "Reba")}</p>
      <h1 className="display mt-2 text-4xl font-bold text-blue-950">{tr(tr("Open positions", "Imyanya ifunguye"), "Imyanya ifunguye")}</h1>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sticky top-16 z-20 py-3 bg-[#faf9f6]">
        <label className="flex-1 flex items-center gap-2 bg-white border rule rounded-full px-4 focus-within:border-blue-700">
          <Search className="w-4 h-4 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(tr("Search by job or company", "Shakisha ku mwanya cyangwa ikigo"), "Shakisha ku mwanya cyangwa ikigo")} className="flex-1 py-3 bg-transparent focus:outline-none" />
          {q && <button onClick={() => setQ('')} aria-label={tr(tr("Clear search", "Siba ibyashakishijwe"), "Siba ibyashakishijwe")}><X className="w-4 h-4 text-zinc-400" /></button>}
        </label>
        <label className="flex items-center gap-2 bg-white border rule rounded-full px-4 sm:w-60">
          <MapPin className="w-4 h-4 text-zinc-400" />
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="flex-1 py-3 bg-transparent focus:outline-none" aria-label={tr(tr("Location", "Aho biherereye"), "Aho biherereye")}>
            <option value="all">{tr(tr("Anywhere in Rwanda", "Hose mu Rwanda"), "Hose mu Rwanda")}</option>
            {locations.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
      </div>

      <p className="mt-2 text-sm text-zinc-500" aria-live="polite">{loading ? tr('Loading…', 'Biraje…') : tr(`${total} position${total === 1 ? '' : 's'} at ${groups.length} verified employer${groups.length === 1 ? '' : 's'}`, `Imyanya ${total} ku bakoresha bemewe ${groups.length}`)}</p>

      {failed && <p className="mt-8 p-4 rounded-xl bg-red-50 text-red-800 text-sm">{tr(tr("We couldn’t load jobs. Check your connection and refresh.", "Ntitwabashije gutanga imirimo. Reba murandasi maze usubiremo."), "Ntitwabashije gutanga imirimo. Reba murandasi maze usubiremo.")}</p>}
      {!loading && !failed && groups.length === 0 && (
        <div className="mt-10 py-14 text-center border rule rounded-2xl bg-white">
          <p className="font-bold text-zinc-900">{tr(tr("No positions match your search", "Nta myanya ihuye n’ibyo washatse"), "Nta myanya ihuye n’ibyo washatse")}</p>
          <button onClick={() => { setQ(''); setLoc('all'); }} className="mt-3 text-sm font-semibold text-blue-800 hover:underline">{tr(tr("Clear filters", "Siba ayo wahisemo"), "Siba ayo wahisemo")}</button>
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
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800"><BadgeCheck className="w-4 h-4" />{tr(tr("Verified", "Wemewe"), "Wemewe")}</span>
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
                      <Link to={`/jobs/${j.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50/50 group">
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-zinc-900 group-hover:text-blue-800">{j.title}</span>
                          <span className="block text-xs text-zinc-500 mt-0.5">{[j.location, j.job_type, j.salary_range].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="text-sm font-semibold text-blue-800 inline-flex items-center gap-1">{tr('View','Reba')} <ArrowRight className="w-4 h-4" /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
