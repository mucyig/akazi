import React, { useState } from 'react';
import { Eye, EyeOff, Check, Circle } from 'lucide-react';
import { inputCls } from './AuthShell';
import { useLanguage } from '../context/LanguageContext';

export const passwordRules = (v) => ({
  length: v.length >= 8,
  letter: /[A-Za-z]/.test(v),
  number: /\d/.test(v),
});
export const passwordOk = (v) => Object.values(passwordRules(v)).every(Boolean);

export default function PasswordField({ label, value, onChange, autoComplete = 'current-password', showRules = false, id, placeholder, required = true }) {
  const { tr } = useLanguage();
  const [show, setShow] = useState(false);
  const rules = passwordRules(value);
  const items = [
    ['length', tr('8 or more characters', 'Inyuguti 8 cyangwa zirenga')],
    ['letter', tr('A letter', 'Inyuguti')],
    ['number', tr('A number', 'Umubare')],
  ];
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-semibold text-zinc-800 mb-1.5">{label}</label>}
      <div className="relative">
        <input
          id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} required={required} placeholder={placeholder} maxLength={72}
          className={`${inputCls} pr-12`}
        />
        <button
          type="button" onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
          aria-label={show ? tr('Hide password', 'Hisha ijambo ry’ibanga') : tr('Show password', 'Erekana ijambo ry’ibanga')}
        >
          {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
        </button>
      </div>
      {showRules && (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5" aria-live="polite">
          {items.map(([k, text]) => (
            <li key={k} className={`flex items-center gap-1.5 text-[13px] ${rules[k] ? 'text-blue-700 font-medium' : 'text-zinc-500'}`}>
              {rules[k] ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}{text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
