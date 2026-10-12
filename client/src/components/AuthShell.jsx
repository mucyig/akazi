import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

// Shared frame for sign-in, password reset and email confirmation screens.
// Left: a calm green panel (optionally showing the steps of the flow). Right: the form.
export default function AuthShell({ headline, lead, steps, current = 0, children }) {
  return (
    <div className="grid lg:grid-cols-[5fr_6fr] min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between bg-blue-950 text-white p-12 xl:p-16">
        <div className="absolute -right-28 -bottom-28 w-80 h-80 rounded-full bg-amber-500" aria-hidden="true" />
        <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-blue-950" aria-hidden="true" />
        <Link to="/" className="relative flex items-baseline gap-0.5 w-fit" aria-label="Akazi home">
          <span className="display text-3xl font-bold">akazi</span>
          <span className="w-2 h-2 rounded-full bg-amber-500" />
        </Link>

        <div className="relative max-w-md">
          <h1 className="display text-4xl xl:text-[2.6rem] font-semibold leading-[1.1]">{headline}</h1>
          {lead && <p className="mt-5 text-blue-200 leading-relaxed">{lead}</p>}
          {steps && (
            <ol className="mt-10 space-y-5">
              {steps.map((s, i) => {
                const done = i < current; const active = i === current;
                return (
                  <li key={s} className="flex items-center gap-4">
                    <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-sm font-bold border ${done ? 'bg-blue-400 border-blue-400 text-blue-950' : active ? 'bg-white border-white text-blue-950' : 'border-blue-700 text-blue-300'}`}>
                      {done ? <Check className="w-4 h-4" /> : i + 1}
                    </span>
                    <span className={`text-[15px] ${active ? 'text-white font-semibold' : done ? 'text-blue-200' : 'text-blue-400'}`}>{s}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="relative text-xs text-blue-300">Kigali, Rwanda</p>
      </aside>

      <main className="flex items-center justify-center px-5 sm:px-8 py-12">
        <div className="w-full max-w-md anim-fade-up">{children}</div>
      </main>
    </div>
  );
}

export function AuthCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 grid place-items-center mb-5"><Icon className="w-6 h-6" /></div>
      )}
      <h2 className="display text-3xl font-semibold text-blue-950 leading-tight">{title}</h2>
      {subtitle && <p className="mt-2 text-[15px] text-zinc-600 leading-relaxed">{subtitle}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}

export const inputCls = 'w-full rounded-xl border border-[#d9d5c9] bg-white px-4 py-3 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15 transition';
export const primaryBtn = 'w-full inline-flex items-center justify-center gap-2 rounded-full bg-blue-800 hover:bg-blue-900 active:bg-blue-950 text-white font-semibold text-[15px] py-3.5 transition disabled:opacity-60 disabled:cursor-not-allowed';
