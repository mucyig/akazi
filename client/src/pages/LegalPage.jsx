import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Ban, Lock, Eye, UserCheck, Printer, Info, TriangleAlert } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { COMPANY, HIGHLIGHTS, TERMS, PRIVACY } from '../legal/legalContent';
import { formatYmd } from '../utils/time';

const ICONS = { shield: ShieldCheck, ban: Ban, lock: Lock, eye: Eye, user: UserCheck };

function Block({ b }) {
  if (b.type === 'p') return <p className="text-[16px] leading-[1.75] text-zinc-700">{b.text}</p>;
  if (b.type === 'ul') {
    return (
      <ul className="space-y-2.5">
        {b.items.map((it) => (
          <li key={it} className="flex gap-3 text-[16px] leading-[1.7] text-zinc-700">
            <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (b.type === 'callout') {
    const warn = b.tone === 'warn';
    const Icon = warn ? TriangleAlert : Info;
    return (
      <div className={`flex gap-3 rounded-2xl border px-4 py-3.5 text-[15px] leading-relaxed ${warn ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-blue-200 bg-blue-50 text-blue-950'}`}>
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${warn ? 'text-amber-600' : 'text-blue-600'}`} />
        <p>{b.text}</p>
      </div>
    );
  }
  if (b.type === 'table') {
    return (
      <div className="overflow-hidden rounded-2xl border rule bg-white">
        <table className="hidden w-full text-left text-[14.5px] md:table">
          <thead className="bg-[#f4f2ec] text-xs font-bold uppercase tracking-wider text-zinc-500">
            <tr>{b.head.map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#ece9df]">
            {b.rows.map((r) => (
              <tr key={r[0]} className="align-top">
                <td className="w-44 px-5 py-4 font-semibold text-blue-950">{r[0]}</td>
                <td className="px-5 py-4 text-zinc-600">{r[1]}</td>
                <td className="px-5 py-4 text-zinc-700">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="divide-y divide-[#ece9df] md:hidden">
          {b.rows.map((r) => (
            <div key={r[0]} className="space-y-1.5 p-4 text-[14.5px]">
              <p className="font-semibold text-blue-950">{r[0]}</p>
              <p className="text-zinc-600">{r[1]}</p>
              <p className="text-zinc-700"><span className="font-semibold">{b.head[2]}: </span>{r[2]}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function LegalPage({ which = 'terms' }) {
  const { language, tr } = useLanguage();
  const doc = which === 'privacy' ? PRIVACY : TERMS;
  const lang = language === 'rw' ? 'rw' : 'en';
  const [active, setActive] = useState(doc.sections[0].id);

  const ids = useMemo(() => doc.sections.map((s) => s.id), [doc]);

  // Start at the top when switching between Terms and Privacy
  useEffect(() => { window.scrollTo(0, 0); setActive(doc.sections[0].id); }, [doc]);

  // Highlight the section being read
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-15% 0px -75% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);

  const go = (id) => (e) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
    setActive(id);
  };

  return (
    <div className="pb-8">
      {/* Header */}
      <header className="border-b rule bg-[#f4f2ec] print:bg-white">
        <div className="page py-10 sm:py-14">
          <p className="eyebrow">{tr('Legal', 'Amategeko')}</p>
          <h1 className="display mt-3 text-4xl font-semibold leading-[1.08] text-blue-950 sm:text-5xl">
            {tr('The rules, in plain words.', 'Amategeko, mu magambo yoroshye.')}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
            {tr('What you can expect from Akazi, what we expect from you, and how we look after your information.', 'Ibyo ushobora kwitega kuri Akazi, ibyo tugutegerejeho, n’uko turinda amakuru yawe.')}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-[#d9d5c9] bg-white p-1" role="tablist">
              {[TERMS, PRIVACY].map((d) => {
                const on = d.id === doc.id;
                return (
                  <Link key={d.id} to={`/${d.id}`} role="tab" aria-selected={on}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition ${on ? 'bg-blue-800 text-white' : 'text-zinc-700 hover:text-blue-900'}`}>
                    {d.label[lang]}
                  </Link>
                );
              })}
            </div>
            <span className="text-sm text-zinc-500">{tr('Last updated', 'Byavuguruwe')}: <strong className="font-semibold text-zinc-700">{formatYmd(COMPANY.updated)}</strong></span>
            <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#d9d5c9] bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-blue-600 print:hidden">
              <Printer className="h-4 w-4" />{tr('Print or save as PDF', 'Sohora cyangwa ubike nka PDF')}
            </button>
          </div>
        </div>
      </header>

      <div className="page">
        {/* The short version */}
        <section aria-labelledby="short" className="-mt-0 py-10">
          <div className="rounded-3xl bg-blue-950 p-6 text-white sm:p-9">
            <h2 id="short" className="display text-2xl font-semibold sm:text-3xl">{tr('The short version', 'Muri make')}</h2>
            <ul className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
              {HIGHLIGHTS.map((h) => {
                const Icon = ICONS[h.icon];
                return (
                  <li key={h.en} className="flex gap-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="pt-1 text-[15.5px] leading-relaxed text-blue-50">{h[lang]}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs text-blue-300">
              {tr('This summary helps you read the full text below. If they differ, the full text applies.', 'Uru ruhurirane rugufasha gusoma inyandiko yuzuye hasi. Nihagira itandukaniro, inyandiko yuzuye ni yo igenderwaho.')}
            </p>
          </div>
          {lang === 'rw' && (
            <p className="mt-4 rounded-xl bg-[#f4f2ec] px-4 py-3 text-sm text-zinc-600">
              Inyandiko yuzuye iri mu Cyongereza. Niba hari ikintu utumva neza, twandikire kuri <a className="font-semibold text-blue-800 underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
            </p>
          )}
        </section>

        <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          {/* Contents */}
          <nav aria-label={tr('Contents', 'Ibikubiyemo')} className="print:hidden">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:hidden">
              {doc.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} onClick={go(s.id)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${active === s.id ? 'border-blue-700 bg-blue-800 text-white' : 'border-[#d9d5c9] bg-white text-zinc-700'}`}>
                  {s.title[lang]}
                </a>
              ))}
            </div>
            <div className="sticky top-24 hidden lg:block">
              <p className="eyebrow mb-3">{tr('Contents', 'Ibikubiyemo')}</p>
              <ol className="space-y-0.5 border-l-2 border-[#e4e1d8]">
                {doc.sections.map((s, i) => {
                  const on = active === s.id;
                  return (
                    <li key={s.id}>
                      <a href={`#${s.id}`} onClick={go(s.id)}
                        className={`-ml-[2px] flex gap-2.5 border-l-2 py-1.5 pl-4 pr-2 text-[14px] leading-snug transition ${on ? 'border-blue-700 font-semibold text-blue-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}>
                        <span className={`w-5 shrink-0 tabular-nums ${on ? 'text-blue-700' : 'text-zinc-400'}`}>{i + 1}.</span>
                        <span>{s.title[lang]}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </div>
          </nav>

          {/* Text */}
          <article className="min-w-0 max-w-[46rem]">
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-28 border-t rule py-9 first:border-t-0 first:pt-0">
                <h2 className="display flex items-baseline gap-3 text-[1.65rem] font-semibold leading-tight text-blue-950">
                  <span className="text-lg font-bold tabular-nums text-blue-400">{String(i + 1).padStart(2, '0')}</span>
                  {s.title[lang]}
                </h2>
                <div className="mt-5 space-y-4">
                  {s.blocks.map((b, k) => <Block key={k} b={b} />)}
                </div>
              </section>
            ))}

            <div className="mt-6 rounded-3xl border rule bg-white p-6 sm:p-8 print:hidden">
              <h2 className="display text-2xl font-semibold text-blue-950">{tr('Questions or requests?', 'Ufite ibibazo cyangwa ibyo ushaka gusaba?')}</h2>
              <p className="mt-2 text-zinc-600">{tr('Ask about these rules, see or delete your data, or report an employer.', 'Baza ku mategeko, reba cyangwa usibe amakuru yawe, cyangwa utange raporo ku mukoresha.')}</p>
              <a href={`mailto:${COMPANY.email}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-900">
                {COMPANY.email}
              </a>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}