import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Code2, 
  Key, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Building2, 
  Terminal, 
  Mail, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';

export default function DeveloperPortalPage() {
  const { user } = useAuth();
  const { tr } = useLanguage();

  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Code sample language tab
  const [activeLang, setActiveLang] = useState('curl');
  // Contact modal state
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactTier, setContactTier] = useState('Commercial / Pro API');

  useEffect(() => {
    if (user) {
      loadKeys();
    }
  }, [user]);

  const loadKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await api.get('/developer/keys');
      setKeys(res.keys || []);
    } catch (err) {
      console.warn('Failed to load keys', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setCreatingKey(true);
    try {
      const res = await api.post('/developer/keys', { name: newKeyName.trim() || 'My Developer Key' });
      setCreatedKey(res.apiKey);
      setNewKeyName('');
      setSuccessMsg(tr('Your API key was generated successfully!', 'Urufunguzo rwa API rwakuwe neza!'));
      await loadKeys();
    } catch (err) {
      setErrorMsg(err.message || tr('Failed to generate key.', 'Ntibyakunze gukora urufunguzo.'));
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm(tr('Are you sure you want to revoke this API key? Applications using this key will immediately stop working.', 'Urashaka guhagarika uru rufunguzo koko? Porogaramu zose zikoresha zizahagarara.'))) {
      return;
    }
    setRevokingId(id);
    try {
      await api.delete(`/developer/keys/${id}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (createdKey && keys.find((k) => k.id === id)?.key_prefix?.startsWith(createdKey.slice(0, 10))) {
        setCreatedKey(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const openContact = (tierName) => {
    setContactTier(tierName);
    setContactModalOpen(true);
  };

  const sampleKey = createdKey || 'ak_live_7f8c12e9b04a5d3f2c18e9a6';
  const apiBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'https://akazi.rw/api/v1';

  const codeSnippets = {
    curl: `# Fetch active jobs with location filter
curl -X GET "${apiBaseUrl}/jobs?location=Kigali&limit=10" \\
  -H "X-Akazi-Key: ${sampleKey}"`,

    javascript: `// Modern Fetch (Node.js 18+ or Browser)
const response = await fetch("${apiBaseUrl}/jobs?category=Software&limit=10", {
  headers: {
    "X-Akazi-Key": "${sampleKey}"
  }
});

const data = await response.json();
console.log(\`Found \${data.total} jobs in Rwanda:\`, data.jobs);`,

    python: `import requests

url = "${apiBaseUrl}/jobs"
headers = {
    "X-Akazi-Key": "${sampleKey}"
}
params = {
    "location": "Kigali",
    "limit": 10
}

response = requests.get(url, headers=headers, params=params)
data = response.json()

for job in data.get("jobs", []):
    print(f"{job['title']} at {job['company']['name']}")
    print(f"Apply here: {job['apply_url']}\\n")`
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* Hero Header */}
      <section className="bg-gradient-to-b from-blue-950 via-blue-900 to-indigo-950 text-white pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-800/80 border border-blue-700/60 text-xs font-medium text-amber-300 mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Akazi Public API v1 · RESTful JSON</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-serif text-white">
            {tr('The Employment Infrastructure for Rwanda', 'Urubuga rw’Akazi ku Batekinisiye mu Rwanda')}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-blue-200 max-w-2xl mx-auto leading-relaxed">
            {tr(
              'Connect your Telegram channels, WhatsApp job alert bots, student career portals, or applicant tracking systems (ATS) directly to Rwanda’s verified job marketplace.',
              'Huza ubutumwa bwawe bwa Telegram, bots za WhatsApp, porogaramu z’amashuri cyangwa sisitemu z’abakozi ku isoko ry’akazi ryemewe mu Rwanda.'
            )}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a 
              href="#keys" 
              className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold text-sm shadow-md transition flex items-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>{tr('Get Free API Key', 'Bona Urufunguzo rwa API')}</span>
            </a>
            <a 
              href="#docs" 
              className="px-6 py-3 rounded-xl bg-blue-800/80 hover:bg-blue-800 text-white font-semibold text-sm border border-blue-700 transition flex items-center gap-2"
            >
              <Terminal className="w-4 h-4" />
              <span>{tr('Explore Documentation', 'Soma Ibisobanuro')}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8">

        {/* Tiers / Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          
          {/* Free Growth Tier */}
          <div className="bg-white rounded-2xl p-6 border-2 border-emerald-500/50 shadow-sm relative flex flex-col justify-between">
            <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold tracking-wide uppercase">
              {tr('Free Forever', 'Ubuntu')}
            </div>
            <div>
              <div className="flex items-center justify-between mt-2">
                <h3 className="text-xl font-bold text-slate-900">{tr('Free Growth', 'Iterambere')}</h3>
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {tr('For independent developers, Telegram bots, student portals & small apps.', 'Kubatunganya porogaramu, bots za Telegram n’ibinyamakuru.')}
              </p>
              <div className="mt-4 mb-5">
                <span className="text-3xl font-extrabold text-slate-900">0 RWF</span>
                <span className="text-xs text-slate-500 ml-1">/ {tr('month', 'ukwezi')}</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>120 requests / hour</strong> (~2,800/day)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{tr('Access to all live verified job posts', 'Kubona imirimo yose yemejwe')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{tr('Category, district & job type filtering', 'Gutoranya mu byiciro n’uturere')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{tr('Direct application links with analytics tag', 'Amasoko afite imyanya yo gusaba')}</span>
                </li>
                <li className="flex items-center gap-2 text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{tr('Attribution required: "Powered by Akazi.rw"', 'Itegeko: Kwerekana "Powered by Akazi.rw"')}</span>
                </li>
              </ul>
            </div>
            <a 
              href="#keys" 
              className="mt-6 w-full py-2.5 px-4 text-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
            >
              {tr('Get Started Free', 'Tangira ku Buntu')}
            </a>
          </div>

          {/* Commercial / Pro API */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-400 transition">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{tr('Commercial / Pro', 'Ubucuruzi Pro')}</h3>
                <Code2 className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {tr('For high-traffic portals, media outlets & recruitment firms.', 'Ku mbuga nini, ibitangazamakuru n’amasosiyete y’abakozi.')}
              </p>
              <div className="mt-4 mb-5">
                <span className="text-2xl font-bold text-slate-900">{tr('Contact Us', 'Twandikire')}</span>
                <span className="block text-xs text-slate-500">{tr('Flexible billing & custom volume', 'Ibiciro binoze ku byo ukeneye')}</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span><strong>10,000+ requests / hour</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{tr('Real-time Webhooks on new job posts', 'Ubutumwa bwa ako kanya (Webhooks)')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{tr('Rwanda salary trends & market insights', 'Imibare y’imishahara n’isoko')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{tr('Whitelisted IP addresses & dedicated limit', 'Umutekano n’uburenganzira bwihariye')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{tr('Priority email & WhatsApp support', 'Ubufasha bwa mbere bwa vuba')}</span>
                </li>
              </ul>
            </div>
            <button 
              onClick={() => openContact('Commercial / Pro API')} 
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition"
            >
              {tr('Contact for Pro', 'Saba Pro')}
            </button>
          </div>

          {/* Enterprise & ATS Integration */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-400 transition">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{tr('Enterprise & ATS', 'Ibigo Binini')}</h3>
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {tr('For corporations integrating internal HR software (BambooHR, Workday, etc.).', 'Ku masosiyete ashyira imyanya mu buryo bw’ikoranabuhanga.')}
              </p>
              <div className="mt-4 mb-5">
                <span className="text-2xl font-bold text-slate-900">{tr('Custom SLA', 'Amasezerano')}</span>
                <span className="block text-xs text-slate-500">{tr('Tailored enterprise agreement', 'Amasezerano yihariye y’ikigo')}</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{tr('Automated Job Publishing API (Inbound POST)', 'Gushyiraho akazi mu buryo bwikora')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{tr('Custom throughput & unlimited bandwidth', 'Imbaraga zihariye zitagira imbibi')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>99.9% Uptime Service Level Agreement</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{tr('Dedicated Technical Account Manager', 'Umukozi wihariye wo kugufasha')}</span>
                </li>
              </ul>
            </div>
            <button 
              onClick={() => openContact('Enterprise & ATS Integration')} 
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition"
            >
              {tr('Contact for Enterprise', 'Saba Enterprise')}
            </button>
          </div>
        </div>

        {/* Section 2: Interactive Key Management */}
        <section id="keys" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-16 scroll-mt-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                <span>{tr('API Keys Management', 'Gucunga Impfunguzo za API')}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {tr('Generate and manage your secret keys to authenticate with the Akazi API.', 'Kora kandi ucunge impfunguzo zawe zo gukoresha Akazi API.')}
              </p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-mono font-medium">
              Free Tier: 120 req/hr
            </span>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* New Key Reveal Banner */}
          {createdKey && (
            <div className="mb-6 p-5 rounded-2xl bg-amber-50 border-2 border-amber-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-950">
                    {tr('Important: Copy your API key now', 'Icyitonderwa: Koporora urufunguzo rwawe aka kanya')}
                  </h4>
                  <p className="text-xs text-amber-900 mt-1">
                    {tr('For security reasons, this key will never be shown again. Keep it safe and never share it publicly.', 'Kubw’umutekano, uru rufunguzo ntiruzongera kwerekanwa ukundi. Rurinde cyane.')}
                  </p>
                  
                  <div className="mt-3 flex items-center gap-2 bg-white rounded-xl border border-amber-300 px-3 py-2 max-w-xl">
                    <code className="text-xs font-mono text-slate-900 flex-1 truncate">{createdKey}</code>
                    <button 
                      onClick={() => copyToClipboard(createdKey)}
                      className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-blue-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? tr('Copied!', 'Byakoporowe!') : tr('Copy', 'Koporora')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {user ? (
            <div>
              {/* Key creation form */}
              <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3 mb-8">
                <input 
                  type="text"
                  placeholder={tr('Key name (e.g. My Telegram Bot, Student Portal)', 'Izina ry’urufunguzo (urugero: Bot yanjye)')}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  maxLength={60}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button 
                  type="submit"
                  disabled={creatingKey}
                  className="px-5 py-2.5 rounded-xl bg-blue-950 hover:bg-blue-900 text-white font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>{creatingKey ? tr('Generating...', 'Birakorwa...') : tr('+ Generate Free Key', '+ Kora Urufunguzo rushya')}</span>
                </button>
              </form>

              {/* Existing keys list */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {tr('Your Active API Keys', 'Impfunguzo zawe zikora')}
                </h3>
                {loadingKeys ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading keys...</div>
                ) : keys.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                    {tr('You do not have any API keys yet. Generate your first key above to start using the API.', 'Nta rufunguzo uragira. Kora urufunguzo rwawe rwa mbere hejuru.')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">{tr('Name', 'Izina')}</th>
                          <th className="py-3 px-4">{tr('Key Prefix', 'Urufunguzo')}</th>
                          <th className="py-3 px-4">{tr('Tier', 'Icyiciro')}</th>
                          <th className="py-3 px-4">{tr('Rate Limit', 'Imbibi')}</th>
                          <th className="py-3 px-4">{tr('Created', 'Igihe rwakozwe')}</th>
                          <th className="py-3 px-4 text-right">{tr('Action', 'Igikorwa')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {keys.map((k) => (
                          <tr key={k.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-medium text-slate-900">{k.name}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">{k.key_prefix}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                {k.tier}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{k.rate_limit_per_hour}/hr</td>
                            <td className="py-3 px-4 text-slate-400">
                              {new Date(k.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button 
                                onClick={() => handleRevokeKey(k.id)}
                                disabled={revokingId === k.id}
                                className="text-rose-600 hover:text-rose-800 font-medium text-xs flex items-center gap-1 ml-auto disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{revokingId === k.id ? tr('Revoking...', 'Birasibwa...') : tr('Revoke', 'Siba')}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-200">
              <Key className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                {tr('Sign in to generate your API key', 'Injira kugira ngo ubone urufunguzo rwa API')}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                {tr(
                  'API keys are free and instant. Log into your account or register in 30 seconds to generate your key.',
                  'Gufungura urufunguzo ni ubuntu kandi bifata amasegonda 30 gusa.'
                )}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link 
                  to="/login?redirect=/developers" 
                  className="px-5 py-2.5 rounded-xl bg-blue-950 text-white text-xs font-semibold hover:bg-blue-900 transition"
                >
                  {tr('Sign In', 'Injira')}
                </Link>
                <Link 
                  to="/register?role=work&redirect=/developers" 
                  className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
                >
                  {tr('Register Free', 'Fungura Konti')}
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Interactive Documentation & Code Snippets */}
        <section id="docs" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-16 scroll-mt-24">
          <div className="border-b border-slate-100 pb-5 mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              <span>{tr('API Reference & Interactive Playground', 'Ibisobanuro bya Tekiniki')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {tr('Base URL:', 'Aderesi fatizo:')} <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-blue-900 font-semibold">{apiBaseUrl}</code>
            </p>
          </div>

          {/* Code Tabs */}
          <div className="mb-8">
            <div className="flex items-center justify-between bg-slate-900 rounded-t-xl px-4 py-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {['curl', 'javascript', 'python'].map((lang) => (
                  <button 
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                      activeLang === lang 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'javascript' ? 'JavaScript (Fetch)' : 'Python'}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => copyToClipboard(codeSnippets[activeLang])}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 text-emerald-400 p-5 rounded-b-xl overflow-x-auto text-xs font-mono leading-relaxed border-x border-b border-slate-900">
              {codeSnippets[activeLang]}
            </pre>
          </div>

          {/* Endpoints List */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {tr('Available Endpoints', 'Amasoko aboneka')}
            </h3>

            {/* GET /api/v1/jobs */}
            <div className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-mono font-bold text-xs">GET</span>
                <code className="text-sm font-mono font-semibold text-slate-900">/api/v1/jobs</code>
                <span className="text-xs text-slate-500 ml-auto hidden sm:inline">{tr('List Verified Jobs', 'Urutonde rw’Imirimo')}</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {tr(
                  'Returns a paginated list of active, verified jobs in Rwanda. Sorted by newest first.',
                  'Garura imirimo yose yemejwe kandi ifunguye mu Rwanda.'
                )}
              </p>
              
              <div className="mt-3 bg-slate-50 p-3 rounded-lg text-xs font-mono text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700">{tr('Supported Query Parameters:', 'Ibyo ushobora gutoranyamo:')}</div>
                <div>• <code className="text-blue-900 font-bold">category</code> (e.g. <code>Technology</code>, <code>Hospitality</code>)</div>
                <div>• <code className="text-blue-900 font-bold">location</code> (e.g. <code>Kigali</code>, <code>Rubavu</code>)</div>
                <div>• <code className="text-blue-900 font-bold">job_type</code> (<code>full-time</code>, <code>part-time</code>, <code>internship</code>, <code>contract</code>)</div>
                <div>• <code className="text-blue-900 font-bold">workplace_type</code> (<code>on-site</code>, <code>hybrid</code>, <code>remote</code>)</div>
                <div>• <code className="text-blue-900 font-bold">search</code> (keyword search on title or company)</div>
                <div>• <code className="text-blue-900 font-bold">limit</code> (default: 20, max: 50) & <code className="text-blue-900 font-bold">offset</code></div>
              </div>
            </div>

            {/* GET /api/v1/jobs/:id */}
            <div className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-mono font-bold text-xs">GET</span>
                <code className="text-sm font-mono font-semibold text-slate-900">/api/v1/jobs/:id</code>
                <span className="text-xs text-slate-500 ml-auto hidden sm:inline">{tr('Job Details', 'Ibisobanuro byose by’Umurimo')}</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {tr(
                  'Returns the full description, responsibilities, requirements, benefits, and apply URL for a specific job ID.',
                  'Garura ibisobanuro birambuye by’umurimo runaka.'
                )}
              </p>
            </div>

            {/* GET /api/v1/categories */}
            <div className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-mono font-bold text-xs">GET</span>
                <code className="text-sm font-mono font-semibold text-slate-900">/api/v1/categories</code>
                <span className="text-xs text-slate-500 ml-auto hidden sm:inline">{tr('Categories & Counts', 'Ibyiciro n’Imibare')}</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {tr(
                  'Returns all active job categories in Rwanda along with the live count of open positions in each category.',
                  'Garura ibyiciro byose by’akazi hamwe n’umubare w’imyanya irimo ubu.'
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Terms & Attribution Rules */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 sm:p-8 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-blue-700 shrink-0 mt-1" />
          <div className="text-xs text-blue-900 leading-relaxed space-y-2">
            <h4 className="text-sm font-bold text-blue-950">
              {tr('API Terms of Use & Partner Attribution Rules', 'Amategeko y’Imikoreshereze ya API')}
            </h4>
            <p>
              {tr(
                '1. Attribution: When displaying Akazi job postings in your bot, app, or portal, you must clearly display "Powered by Akazi.rw" and link the apply action directly to the provided apply_url.',
                '1. Kwerekana Inkomoko: Iyo werekanye amatangazo y’akazi muri bot yawe cyangwa urubuga, ugomba kwerekana "Powered by Akazi.rw" no gushyiraho umurongo ujya ku ipaji yo gusaba akazi.'
              )}
            </p>
            <p>
              {tr(
                '2. Data Protection: Private candidate details, CVs, and contact information are confidential and will never be exposed via the public API.',
                '2. Kurinda Amakuru: Amakuru yitekerereje y’abashaka akazi (CV, nimero zabo) ni ibanga rikomeye kandi ntiyatangwa muri API.'
              )}
            </p>
            <p>
              {tr(
                '3. Rate Limiting: The free tier is limited to 120 requests/hour to protect system performance. Scraping or flooding the API will result in key termination.',
                '3. Imbibi zo Gukoresha: Icyiciro cy’ubuntu kigarukira ku bisabwa 120 mu isaha imwe kugira ngo serivisi yose igume ihagaze neza.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Contact Modal for Commercial / Enterprise */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">{contactTier}</h3>
              <button 
                onClick={() => setContactModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>
            
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              {tr(
                'Interested in higher rate limits, real-time webhooks, or automated inbound ATS job publishing? Contact our technical team directly:',
                'Wifuza kongera ingano y’ibyo usaba kuri API, kwakira ubutumwa bwa ako kanya cyangwa guhuza sisitemu zawe za HR? Twandikire:'
              )}
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">support@akazi.rw</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>{tr('Response time: Under 24 hours', 'Igisubizo mu masaha 24')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setContactModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                {tr('Close', 'Funga')}
              </button>
              <a 
                href={`mailto:support@akazi.rw?subject=${encodeURIComponent(`[API Inquiry] ${contactTier}`)}&body=${encodeURIComponent(`Hello Akazi Team,\n\nI am interested in the ${contactTier}. Here are details about our application and required volume:\n\n- Organization/Project Name:\n- Estimated Daily Requests:\n- Use Case (Bots, University Portal, ATS integration):\n\nThank you!`)}`}
                className="px-5 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{tr('Send Email', 'Ohereza Email')}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
