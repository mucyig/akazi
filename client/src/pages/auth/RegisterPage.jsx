import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Briefcase, Building2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const EDU = ['Primary', 'Secondary (O-Level)', 'A-Level / TVET', "Bachelor's degree", "Master's or higher"];
const INDUSTRY = ['Technology', 'Hospitality & Tourism', 'Health', 'Education', 'Agriculture', 'Finance', 'Construction', 'Logistics', 'Retail', 'Other'];
const isAtLeast18 = (birthDate) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || '')) return false;
  const [year, month, day] = birthDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age -= 1;
  return age >= 18;
};
const getMaxBirthDate = () => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 18);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

// type: text | email | tel | password | date | textarea | choice | file | role
const OPT_RW = {
  'Primary': 'Amashuri abanza', 'Secondary (O-Level)': 'Ayisumbuye (O-Level)', 'A-Level / TVET': 'A-Level / Imyuga (TVET)', "Bachelor's degree": 'Impamyabumenyi ya Kaminuza', "Master's or higher": 'Icyiciro cya gatatu cyangwa hejuru',
  'Technology': 'Ikoranabuhanga', 'Hospitality & Tourism': 'Amahoteli n’ubukerarugendo', 'Health': 'Ubuzima', 'Education': 'Uburezi', 'Agriculture': 'Ubuhinzi n’ubworozi', 'Finance': 'Imari', 'Construction': 'Ubwubatsi', 'Logistics': 'Ubwikorezi', 'Retail': 'Ubucuruzi', 'Other': 'Ibindi',
};
const RW = {
  'e.g. Sarah Uwase': 'urugero: Sarah Uwase', 'you@example.com': 'wowe@urugero.com', '+250 7XX XXX XXX': '+250 7XX XXX XXX', '16 digits': 'imibare 16',
  'Exactly 16 digits.': 'Imibare 16 neza.', 'National ID must be exactly 16 digits.': 'Indangamuntu igomba kuba imibare 16 neza.',
  'e.g. Kigali, Gasabo': 'urugero: Kigali, Gasabo', 'At least 8 characters': 'Nibura inyuguti 8', 'Use at least 8 characters.': 'Koresha nibura inyuguti 8.',
  'e.g. Apex Technologies Ltd': 'urugero: Apex Technologies Ltd', 'e.g. Nyarugenge, Kigali': 'urugero: Nyarugenge, Kigali', 'Full name': 'Amazina yombi',
  'hr@company.rw': 'abakozi@ikigo.rw', 'A short description…': 'Ubusobanuro bugufi…', 'We verify every employer before they can post jobs.': 'Dusuzuma buri mukoresha mbere y’uko ashyiraho akazi.',
  'Click to choose a file': 'Kanda uhitemo dosiye', 'max 10 MB': 'ntarengwa 10 MB', 'File is larger than 10 MB.': 'Dosiye irengeje 10 MB.',
  'Please answer this question to continue.': 'Subiza iki kibazo kugira ngo ukomeze.', 'Enter a valid email address.': 'Andika imeri yemewe.', 'Please accept the Terms and Conditions.': 'Emera amategeko n’amabwiriza.',
  'You must be at least 18 years old to create an account.': 'Ugomba kuba ufite nibura imyaka 18 kugira ngo ufungure konti.',
  'Something went wrong. Please try again.': 'Hari ikitagenze neza. Ongera ugerageze.', 'Step': 'Intambwe', 'press Enter ↵': 'kanda Enter ↵',
  'What brings you to Akazi?': 'Ni iki kikuzanye kuri Akazi?', 'I’m looking for work': 'Ndashaka akazi', 'Find jobs and apply in minutes': 'Shaka imirimo usabe mu minota mike',
  'I’m hiring': 'Ndashaka abakozi', 'Post jobs and meet verified candidates': 'Shyiraho imirimo ubone abakandida bemewe',
  'Good work is easier to find when both sides are verified.': 'Akazi karoroha kuboneka iyo impande zombi zemewe.',
  'Every employer is checked by our team. Every message starts with a real approval. Join in under two minutes.': 'Buri mukoresha asuzumwa n’itsinda ryacu. Buri kiganiro gitangira ku kwemererwa nyako. Iyandikishe mu minota itarenze ibiri.',
  'Verified employers only': 'Abakoresha bemewe gusa', 'Chat opens when you are approved': 'Ikiganiro gifungurwa umaze kwemerwa', 'Available in English and Kinyarwanda': 'Biboneka mu Cyongereza no mu Kinyarwanda',
  'Our team will review your documents before you can post jobs. You’ll be notified.': 'Itsinda ryacu rizasuzuma inyandiko zawe mbere y’uko ushyiraho akazi. Uzabimenyeshwa.',
  'Your profile is ready. You can start applying right away.': 'Konti yawe yiteguye. Ushobora gutangira gusaba akazi ako kanya.',
  'I agree to the Akazi Terms and Conditions and confirm my details are accurate.': 'Nemeye amategeko n’amabwiriza ya Akazi kandi nemeza ko amakuru yanjye ari ukuri.',
  'Create my account': 'Fungura konti', 'Back': 'Subira inyuma', 'Skip': 'Simbuka', 'Next': 'Komeza', 'Sign in': 'Injira', 'Already have an account?': 'Usanzwe ufite konti?',
  'Almost done': 'Turarangiza', 'Upload': 'Shyiramo',
};
const SEEKER = [
  { key: 'name', q: { en: "What's your full name?", rw: 'Witwa nde mu mazina yombi?' }, type: 'text', ph: 'e.g. Sarah Uwase', req: true },
  { key: 'email', q: { en: "What's your email address?", rw: 'Imeri yawe ni iyihe?' }, type: 'email', ph: 'you@example.com', req: true },
  { key: 'phone', q: { en: "What's your phone number?", rw: 'Nimero yawe ya telefoni ni iyihe?' }, type: 'tel', ph: '+250 7XX XXX XXX', req: true },
  { key: 'national_id', q: { en: "What's your National ID number?", rw: 'Nimero y’indangamuntu yawe ni iyihe?' }, type: 'text', ph: '16 digits', req: true, hint: 'Exactly 16 digits.', check: (v) => /^\d{16}$/.test(v.replace(/\s/g, '')) || 'National ID must be exactly 16 digits.' },
  { key: 'date_of_birth', q: { en: 'When were you born?', rw: 'Wavutse ryari?' }, type: 'date', req: true },
  { key: 'location', q: { en: 'Where do you live?', rw: 'Utuye he?' }, type: 'text', ph: 'e.g. Kigali, Gasabo', req: true },
  { key: 'education_level', q: { en: "What's your highest education level?", rw: 'Ni ayahe mashuri wize cyane?' }, type: 'choice', options: EDU, req: true },
  { key: 'resume', q: { en: 'Do you have a CV? Upload it (optional).', rw: 'Ufite CV? Yishyiremo (si itegeko).' }, type: 'file', accept: '.pdf,.doc,.docx' },
  { key: 'password', q: { en: 'Create a password', rw: 'Hitamo ijambo ry’ibanga' }, type: 'password', ph: 'At least 8 characters', req: true, check: (v) => v.length >= 8 || 'Use at least 8 characters.' },
];
const EMPLOYER = [
  { key: 'company_name', q: { en: "What's your company name?", rw: 'Ikigo cyanyu cyitwa iki?' }, type: 'text', ph: 'e.g. Apex Technologies Ltd', req: true },
  { key: 'industry', q: { en: 'What industry are you in?', rw: 'Mukora mu rihe shami?' }, type: 'choice', options: INDUSTRY, req: true },
  { key: 'location', q: { en: 'Where is your company located?', rw: 'Ikigo cyanyu giherereye he?' }, type: 'text', ph: 'e.g. Nyarugenge, Kigali', req: true },
  { key: 'contact_person', q: { en: "What's your name (the contact person)?", rw: 'Witwa nde (ukuriye itumanaho)?' }, type: 'text', ph: 'Full name', req: true },
  { key: 'date_of_birth', q: { en: "What's the contact person's date of birth?", rw: 'Uhagarariye ikigo yavukiye ryari?' }, type: 'date', req: true },
  { key: 'phone', q: { en: "What's the company phone number?", rw: 'Nimero ya telefoni y’ikigo ni iyihe?' }, type: 'tel', ph: '+250 7XX XXX XXX', req: true },
  { key: 'email', q: { en: "What's your business email?", rw: 'Imeri y’ikigo ni iyihe?' }, type: 'email', ph: 'hr@company.rw', req: true },
  { key: 'description', q: { en: 'Tell candidates what your company does.', rw: 'Bwira abakandida ibyo ikigo cyanyu gikora.' }, type: 'textarea', ph: 'A short description…', req: true },
  { key: 'website', q: { en: 'Do you have a website? (optional)', rw: 'Mufite urubuga? (si itegeko)' }, type: 'url', ph: 'https://' },
  { key: 'registration_doc', q: { en: 'Upload your business registration document.', rw: 'Shyiramo icyemezo cy’iyandikisha ry’ikigo.' }, type: 'file', accept: '.pdf,.jpg,.jpeg,.png', req: true, hint: 'We verify every employer before they can post jobs.' },
  { key: 'password', q: { en: 'Create a password', rw: 'Hitamo ijambo ry’ibanga' }, type: 'password', ph: 'At least 8 characters', req: true, check: (v) => v.length >= 8 || 'Use at least 8 characters.' },
];

export default function RegisterPage() {
  const { registerEmployee, registerEmployer } = useAuth();
  const { language } = useLanguage();
  const L = language === 'rw' ? 'rw' : 'en';
  const x = (e) => (L === 'rw' && RW[e]) || e;
  const opt = (o) => (L === 'rw' && OPT_RW[o]) || o;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('role') === 'hire' ? 'employer' : params.get('role') === 'work' ? 'employee' : null;

  const [role, setRole] = useState(initial);
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [files, setFiles] = useState({});
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const steps = role === 'employer' ? EMPLOYER : SEEKER;
  const total = steps.length + 1; // + final confirm screen
  const isFinal = role && step === steps.length;
  const cur = role && !isFinal ? steps[step] : null;
  const val = cur ? (cur.type === 'file' ? files[cur.key] : data[cur.key] || '') : '';

  useEffect(() => { inputRef.current?.focus(); }, [step, role]);

  const validate = () => {
    if (!cur) return true;
    const empty = cur.type === 'file' ? !files[cur.key] : !String(data[cur.key] || '').trim();
    if (cur.req && empty) { setError(x('Please answer this question to continue.')); return false; }
    if (!empty && cur.check) {
      const r = cur.check(String(data[cur.key]));
      if (r !== true) { setError(x(r)); return false; }
    }
    if (cur.type === 'email' && !empty && !/^\S+@\S+\.\S+$/.test(data[cur.key])) { setError(x('Enter a valid email address.')); return false; }
    if (cur.key === 'date_of_birth' && !isAtLeast18(data[cur.key])) { setError(x('You must be at least 18 years old to create an account.')); return false; }
    return true;
  };

  const next = () => { setError(''); if (validate()) setStep((s) => s + 1); };
  const back = () => { setError(''); if (step === 0) setRole(null); else setStep((s) => s - 1); };

  const submit = async () => {
    if (!terms) { setError(x('Please accept the Terms and Conditions.')); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, String(v).trim()));
      if (role === 'employer') fd.append('registration_doc', files.registration_doc);
      else if (files.resume) fd.append('resume', files.resume);
      fd.append('terms_accepted', 'true');
      if (role === 'employer') { await registerEmployer(fd); navigate('/employer/status'); }
      else { await registerEmployee(fd); navigate('/jobs'); }
    } catch (e) {
      setError(x(e.message) || x('Something went wrong. Please try again.'));
    } finally { setLoading(false); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && cur && cur.type !== 'textarea') { e.preventDefault(); next(); }
  };

  const setField = (v) => setData((d) => ({ ...d, [cur.key]: v }));
  const field = 'w-full text-2xl sm:text-3xl font-semibold bg-transparent border-0 border-b-2 border-zinc-300 focus:border-blue-600 focus:outline-none py-3 placeholder:text-zinc-300';

  return (
    <div className="min-h-[calc(100vh-5rem)] grid lg:grid-cols-[2fr_3fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-blue-950 text-white p-12">
        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-200">AKAZI</p>
          <h1 className="mt-10 text-4xl font-extrabold leading-tight">{x('Good work is easier to find when both sides are verified.')}</h1>
          <p className="mt-5 text-blue-200 leading-relaxed">{x('Every employer is checked by our team. Every message starts with a real approval. Join in under two minutes.')}</p>
        </div>
        <ul className="space-y-3 text-sm text-blue-100">
          {['Verified employers only', 'Chat opens when you are approved', 'Available in English and Kinyarwanda'].map(x).map((t) => (
            <li key={t} className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-300" />{t}</li>
          ))}
        </ul>
      </aside>

      <section className="flex flex-col px-6 sm:px-12 lg:px-20 py-8">
        {role && (
          <div className="mb-10" aria-label="Progress">
            <div className="h-1.5 rounded-full bg-zinc-200 overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
            <p className="mt-2 text-xs text-zinc-500">{x('Step')} {step + 1} / {total}</p>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto lg:mx-0">
          <div key={`${role}-${step}`} className="anim-fade-up">
            {!role && (
              <>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950">{x('What brings you to Akazi?')}</h2>
                <div className="mt-8 grid sm:grid-cols-2 gap-4">
                  {[['employee', Briefcase, x('I’m looking for work'), x('Find jobs and apply in minutes')],
                    ['employer', Building2, x('I’m hiring'), x('Post jobs and meet verified candidates')]].map(([r, Icon, title, sub]) => (
                    <button key={r} onClick={() => { setRole(r); setStep(0); setError(''); }}
                      className="text-left p-6 rounded-2xl border-2 border-zinc-200 bg-white hover:border-blue-600 hover:shadow-md transition">
                      <Icon className="w-7 h-7 text-blue-700" />
                      <p className="mt-4 font-bold text-zinc-950">{title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{sub}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {cur && (
              <>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 mb-6">{cur.q[L]}</h2>
                {['text', 'email', 'tel', 'password', 'date', 'url'].includes(cur.type) && (
                  <input ref={inputRef} type={cur.type} value={val} max={cur.type === 'date' ? getMaxBirthDate() : undefined} placeholder={x(cur.ph)} onChange={(e) => setField(e.target.value)} onKeyDown={onKey} className={field} autoComplete="off" />
                )}
                {cur.type === 'textarea' && (
                  <textarea ref={inputRef} rows={4} value={val} placeholder={x(cur.ph)} onChange={(e) => setField(e.target.value)} className="w-full text-lg border-2 border-zinc-300 rounded-xl p-4 focus:border-blue-600 focus:outline-none bg-white" />
                )}
                {cur.type === 'choice' && (
                  <div className="grid gap-2.5">
                    {cur.options.map((o) => (
                      <button key={o} type="button" onClick={() => { setField(o); setError(''); }}
                        className={`text-left px-4 py-3 rounded-xl border-2 font-medium transition ${val === o ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-zinc-200 bg-white hover:border-zinc-400'}`}>{opt(o)}</button>
                    ))}
                  </div>
                )}
                {cur.type === 'file' && (
                  <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-zinc-300 bg-white cursor-pointer hover:border-blue-600">
                    <Upload className="w-7 h-7 text-blue-700" />
                    <span className="font-medium text-zinc-800">{files[cur.key] ? files[cur.key].name : x('Click to choose a file')}</span>
                    <span className="text-xs text-zinc-500">{cur.accept.replaceAll('.', '').toUpperCase().replaceAll(',', ', ')} · {x('max 10 MB')}</span>
                    <input ref={inputRef} type="file" accept={cur.accept} className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size > 10 * 1024 * 1024) { setError(x('File is larger than 10 MB.')); return; } setError(''); setFiles((x) => ({ ...x, [cur.key]: f })); }} />
                  </label>
                )}
                {cur.hint && <p className="mt-3 text-sm text-zinc-500">{x(cur.hint)}</p>}
              </>
            )}

            {isFinal && (
              <>
                <h2 className="text-3xl font-extrabold text-zinc-950">{x('Almost done')}</h2>
                <p className="mt-2 text-zinc-600">{role === 'employer' ? x('Our team will review your documents before you can post jobs. You’ll be notified.') : x('Your profile is ready. You can start applying right away.')}</p>
                <label className="mt-6 flex items-start gap-3 p-4 rounded-xl border border-zinc-200 bg-white cursor-pointer">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-blue-700" />
                  <span className="text-sm text-zinc-700">{x('I agree to the Akazi Terms and Conditions and confirm my details are accurate.')}</span>
                </label>
              </>
            )}

            {error && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{error}</p>}

            {role && (
              <div className="mt-8 flex items-center gap-3">
                <button type="button" onClick={back} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-zinc-700 hover:bg-zinc-100 font-medium"><ArrowLeft className="w-4 h-4" />{x('Back')}</button>
                {isFinal ? (
                  <button type="button" onClick={submit} disabled={loading} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold disabled:opacity-60">
                    {loading ? '…' : x('Create my account')}<Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button type="button" onClick={next} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold">
                    {cur && !cur.req && !(cur.type === 'file' ? files[cur.key] : data[cur.key]) ? x('Skip') : x('Next')}<ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {!isFinal && <span className="hidden sm:inline text-xs text-zinc-400">{x('press Enter ↵')}</span>}
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 text-sm text-zinc-500">{x('Already have an account?')} <Link to="/login" className="font-semibold text-blue-700 hover:underline">{x('Sign in')}</Link></p>
      </section>
    </div>
  );
}
