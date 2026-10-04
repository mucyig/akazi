import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';


export default function HomePage() {
  const { tr } = useLanguage();
  const STEPS = [
    [tr("Create a profile", "Fungura konti yawe"), tr("Answer a few simple questions, one at a time. It takes about two minutes.", "Subiza ibibazo bike byoroshye, kimwe kimwe. Bifata iminota nka ibiri.")],
    [tr("Apply to verified employers", "Saba akazi ku bakoresha bemewe"), tr("Every company is checked by our team before it can post a single job.", "Buri kigo gisuzumwa n’itsinda ryacu mbere y’uko gishyiraho akazi.")],
    [tr("Talk when you are approved", "Vugana nyuma yo kwemerwa"), tr("Once an employer approves you, they message you first. No spam, no cold DMs.", "Umukoresha amaze kukwemera, ni we ugutangiza ikiganiro. Nta butumwa bubangamira.")],
  ];

  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ activeJobs: 0, approvedEmployers: 0 });
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const fetchHomeData = async () => {
      try {
        const [jobsRes, statsRes] = await Promise.all([
          api.get('/jobs'),
          api.get('/stats')
        ]);

        if (cancelled) return;

        setJobs(jobsRes.jobs || []);
        setStats(statsRes.stats || { activeJobs: 0, approvedEmployers: 0 });
      } catch (err) {
        if (!cancelled) {
          setJobs([]);
          setStats({ activeJobs: 0, approvedEmployers: 0 });
        }
      }
    };

    fetchHomeData();
    const id = setInterval(fetchHomeData, 30000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const companies = stats.approvedEmployers || new Set(jobs.map((j) => j.employer_id ?? j.company_name)).size;
  const openPositions = stats.activeJobs || jobs.length;
  const go = (e) => { e.preventDefault(); navigate(`/jobs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); };

  return (
    <>
      <section className="page pt-14 sm:pt-24 pb-14 grid lg:grid-cols-[1.4fr_1fr] gap-12 items-end">
        <div>
          <p className="eyebrow">{tr(tr("Jobs in Rwanda", "Akazi mu Rwanda"), "Akazi mu Rwanda")}</p>
          <h1 className="display mt-4 text-4xl sm:text-6xl font-bold leading-[1.05] text-blue-950">{tr(tr("Find work you can trust, from people who’ve been checked.", "Shaka akazi wizeye, gatanzwe n’abantu bemewe."), "Shaka akazi wizeye, gatanzwe n’abantu bemewe.")}</h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-600 leading-relaxed">{tr(tr("Akazi connects Rwandan job seekers with verified employers. Apply, get approved, and start the conversation.", "Akazi guhuza abashaka akazi mu Rwanda n’abakoresha bemewe. Saba akazi, wemererwe, maze utangire ikiganiro."), "Akazi guhuza abashaka akazi mu Rwanda n’abakoresha bemewe. Saba akazi, wemererwe, maze utangire ikiganiro.")}</p>
          <form onSubmit={go} className="mt-8 flex max-w-xl bg-white border-2 border-blue-900 rounded-full p-1.5 pl-5 items-center gap-2">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(tr("Job title or company", "Umwanya cyangwa ikigo"), "Umwanya cyangwa ikigo")} aria-label={tr(tr("Search jobs", "Shakisha imirimo"), "Shakisha imirimo")} className="flex-1 min-w-0 py-2 bg-transparent focus:outline-none" />
            <button className="px-5 py-2.5 rounded-full bg-blue-800 hover:bg-blue-900 text-white font-semibold text-sm">{tr(tr("Search", "Shakisha"), "Shakisha")}</button>
          </form>
        </div>
        <dl className="grid grid-cols-2 border-t-2 border-blue-900">
          {[[openPositions, tr("open positions", "imyanya ifunguye")], [companies, tr("verified employers", "abakoresha bemewe")]].map(([n, l]) => (
            <div key={l} className="pt-4 pr-4">
              <dt className="display text-5xl font-bold text-blue-900">{n}</dt>
              <dd className="mt-1 text-sm text-zinc-600">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-white border-y rule">
        <div className="page py-14">
          <div className="flex items-end justify-between mb-6">
            <h2 className="display text-3xl font-bold text-blue-950">{tr(tr("Latest openings", "Imyanya mishya"), "Imyanya mishya")}</h2>
            <Link to="/jobs" className="text-sm font-semibold text-blue-800 inline-flex items-center gap-1 hover:underline">{tr('All jobs','Imirimo yose')} <ArrowRight className="w-4 h-4" /></Link>
          </div>
          {jobs.length === 0 ? <p className="text-zinc-500">{tr(tr("No openings yet. Check back soon.", "Nta myanya ihari ubu. Ongera urebe vuba."), "Nta myanya ihari ubu. Ongera urebe vuba.")}</p> : (
            <ul className="border-t rule">
              {jobs.slice(0, 6).map((j) => (
                <li key={j.id} className="border-b rule">
                  <Link to={`/jobs/${j.id}`} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 py-4 group">
                    <span className="flex-1 font-bold text-zinc-950 group-hover:text-blue-800">{j.title}</span>
                    <span className="text-sm text-zinc-600 sm:w-56 truncate">{j.company_name}</span>
                    <span className="text-sm text-zinc-500 inline-flex items-center gap-1 sm:w-44"><MapPin className="w-3.5 h-3.5" />{j.location}</span>
                    <ArrowRight className="hidden sm:block w-4 h-4 text-zinc-400 group-hover:text-blue-800" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="page py-16">
        <p className="eyebrow">{tr(tr("How it works", "Uko bikora"), "Uko bikora")}</p>
        <ol className="mt-6 grid md:grid-cols-3 gap-10">
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <span className="display text-5xl font-bold text-amber-500">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-bold text-blue-950">{t}</h3>
              <p className="mt-2 text-zinc-600 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {!user && (
        <section className="page">
          <div className="rounded-3xl bg-blue-900 text-white p-8 sm:p-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <h2 className="display text-3xl font-bold max-w-md">{tr(tr("Hiring? Meet candidates who are ready to start.", "Urashaka abakozi? Menya abakandida biteguye gutangira."), "Urashaka abakozi? Menya abakandida biteguye gutangira.")}</h2>
            <Link to="/register?role=hire" className="self-start px-6 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold">{tr(tr("Start hiring", "Tangira gushaka abakozi"), "Tangira gushaka abakozi")}</Link>
          </div>
        </section>
      )}
    </>
  );
}
