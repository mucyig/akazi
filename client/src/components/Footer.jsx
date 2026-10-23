import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { tr } = useLanguage();
  return (
    <footer className="mt-20 bg-blue-950 text-blue-100">
      <div className="page py-12 grid gap-10 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <p className="display text-3xl font-bold text-white">akazi</p>
          <p className="mt-3 max-w-xs text-sm text-blue-200 leading-relaxed">
            {tr("Work, found properly. Verified employers and real conversations, made in Kigali.", "Gushaka akazi neza. Abakoresha bemewe n’ibiganiro nyabyo, byakorewe i Kigali.")}
          </p>
        </div>
        <div className="text-sm space-y-2">
          <p className="eyebrow !text-amber-300">{tr("Job seekers", "Abashaka akazi")}</p>
          <Link className="block hover:text-white transition" to="/jobs">{tr("Browse jobs", "Reba imirimo")}</Link>
          <Link className="block hover:text-white transition" to="/register?role=work">{tr("Create profile", "Fungura konti")}</Link>
        </div>
        <div className="text-sm space-y-2">
          <p className="eyebrow !text-amber-300">{tr("Employers", "Abakoresha")}</p>
          <Link className="block hover:text-white transition" to="/register?role=hire">{tr("Start hiring", "Tangira gushaka abakozi")}</Link>
          <Link className="block hover:text-white transition" to="/login">{tr("Sign in", "Injira")}</Link>
        </div>
        <div className="text-sm space-y-2">
          <p className="eyebrow !text-amber-300">{tr('Legal & API', 'Amategeko na API')}</p>
          <Link className="block hover:text-white transition" to="/terms">{tr('Terms of Use', 'Amategeko yo gukoresha')}</Link>
          <Link className="block hover:text-white transition" to="/privacy">{tr('Privacy Policy', 'Politiki y’ibanga')}</Link>
          <div className="pt-1">
            <Link 
              className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-white bg-blue-900/60 hover:bg-blue-900 border border-blue-800 hover:border-blue-700 rounded-lg px-2.5 py-1.5 font-medium transition" 
              to="/developers"
            >
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-400 text-blue-950 rounded font-black tracking-wider uppercase">API</span>
              <span>{tr('Developer Portal', 'API y’abatekinisiye')}</span>
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-blue-900 py-4 text-center text-xs text-blue-300 flex flex-wrap items-center justify-center gap-3">
        <span>© {new Date().getFullYear()} Akazi · {tr('Kigali, Rwanda','Kigali, u Rwanda')}</span>
        <span>•</span>
        <Link to="/developers" className="text-blue-300 hover:text-amber-300 transition underline decoration-blue-800 underline-offset-4">
          {tr('Public Developer API', 'API y’abatekinisiye')}
        </Link>
      </div>
    </footer>
  );
}
