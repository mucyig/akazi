import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar() {
  const { user, logout, isActiveEmployer, isPendingEmployer, needsEmployerPayment, isAdmin, isEmployee } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    ['/jobs', t('nav.findJobs'), true],
    ['/applications', t('nav.myApplications'), isEmployee],
    ['/employer/dashboard', t('nav.employerHub'), isActiveEmployer],
    ['/employer/jobs/new', t('nav.postJob'), isActiveEmployer],
    ['/employer/status', t('nav.statusPending'), isPendingEmployer],
    ['/employer/payment', t('nav.completePayment'), needsEmployerPayment],
    ['/admin', t('nav.adminCenter'), isAdmin],
  ].filter((l) => l[2]);

  const cls = ({ isActive }) =>
    `py-1 text-sm font-semibold border-b-2 transition ${isActive ? 'border-blue-700 text-blue-900' : 'border-transparent text-zinc-600 hover:text-zinc-950'}`;
  const out = () => { logout(); setOpen(false); navigate('/'); };

  return (
    <header className="sticky top-0 z-30 bg-[#faf9f6]/95 backdrop-blur border-b rule">
      <div className="page flex items-center justify-between h-16">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-baseline gap-0.5" aria-label="Akazi home">
            <span className="display text-2xl font-bold text-blue-900">akazi</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            {links.map(([to, label]) => <NavLink key={to} to={to} className={cls}>{label}</NavLink>)}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex text-xs font-bold border rule rounded-full overflow-hidden">
            {['en', 'rw'].map((l) => (
              <button key={l} onClick={() => setLanguage(l)} className={`px-2.5 py-1 uppercase ${language === l ? 'bg-blue-800 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>{l}</button>
            ))}
          </div>
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/profile" className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border rule bg-white hover:border-blue-600">
                <span className="w-7 h-7 rounded-full bg-blue-800 text-white text-xs font-bold grid place-items-center">{(user.name || '?')[0].toUpperCase()}</span>
                <span className="text-sm font-semibold max-w-[110px] truncate">{user.name}</span>
              </Link>
              <button onClick={out} className="p-2 rounded-full hover:bg-zinc-200/60" aria-label={t('nav.logOut')}><LogOut className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link to="/login" className="px-3 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-950">{t('nav.signIn')}</Link>
              <Link to="/register" className="px-4 py-2 rounded-full bg-blue-800 hover:bg-blue-900 text-white text-sm font-semibold">{t('nav.createAccount')}</Link>
            </div>
          )}
          <button className="md:hidden p-2 -mr-2" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t rule bg-[#faf9f6] page py-3 flex flex-col">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className="py-3 text-base font-semibold border-b rule">{label}</NavLink>
          ))}
          {user ? (
            <>
              <Link to="/profile" onClick={() => setOpen(false)} className="py-3 font-semibold border-b rule">{t('nav.account')} · {user.name}</Link>
              <button onClick={out} className="py-3 text-left font-semibold text-red-700">{t('nav.logOut')}</button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-3">
              <Link to="/login" onClick={() => setOpen(false)} className="py-2.5 text-center rounded-full border rule font-semibold">{t('nav.signIn')}</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="py-2.5 text-center rounded-full bg-blue-800 text-white font-semibold">{t('nav.createAccount')}</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
