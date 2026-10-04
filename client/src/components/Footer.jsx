import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { tr } = useLanguage();
  return (
    <footer className="mt-20 bg-blue-950 text-blue-100">
      <div className="page py-12 grid gap-10 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="display text-3xl font-bold text-white">akazi</p>
          <p className="mt-3 max-w-xs text-sm text-blue-200 leading-relaxed">{tr(tr("Work, found properly. Verified employers and real conversations, made in Kigali.", "Gushaka akazi neza. Abakoresha bemewe n’ibiganiro nyabyo, byakorewe i Kigali."), "Gushaka akazi neza. Abakoresha bemewe n’ibiganiro nyabyo, byakorewe i Kigali.")}</p>
        </div>
        <div className="text-sm space-y-2">
          <p className="eyebrow !text-amber-300">{tr(tr("Job seekers", "Abashaka akazi"), "Abashaka akazi")}</p>
          <Link className="block hover:text-white" to="/jobs">{tr(tr("Browse jobs", "Reba imirimo"), "Reba imirimo")}</Link>
          <Link className="block hover:text-white" to="/register?role=work">{tr(tr("Create profile", "Fungura konti"), "Fungura konti")}</Link>
        </div>
        <div className="text-sm space-y-2">
          <p className="eyebrow !text-amber-300">{tr(tr("Employers", "Abakoresha"), "Abakoresha")}</p>
          <Link className="block hover:text-white" to="/register?role=hire">{tr(tr("Start hiring", "Tangira gushaka abakozi"), "Tangira gushaka abakozi")}</Link>
          <Link className="block hover:text-white" to="/login">{tr(tr("Sign in", "Injira"), "Injira")}</Link>
        </div>
      </div>
      <div className="border-t border-blue-900 py-4 text-center text-xs text-blue-300">© {new Date().getFullYear()} Akazi · {tr('Kigali, Rwanda','Kigali, u Rwanda')}</div>
    </footer>
  );
}
