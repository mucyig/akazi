import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck, MailX, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import AuthShell, { AuthCard, primaryBtn } from '../../components/AuthShell';

export default function VerifyEmailPage() {
  const { tr } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('working'); // working | ok | bad
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // the link works once, so only ask once (React dev mode runs effects twice)
    ran.current = true;
    api.post('/auth/verify-email', { token })
      .then(() => { setState('ok'); refreshUser(); })
      .catch((e) => { setState('bad'); setMessage(e.message); });
  }, [token, refreshUser]);

  return (
    <AuthShell headline={tr('One small step for a safer account.', 'Intambwe ntoya igana kuri konti irinzwe.')} lead={tr('Confirming your email lets us reach you about applications and keeps your account yours.', 'Kwemeza imeri bituma tubasha kukugezaho amakuru y’ubusabe no kurinda konti yawe.')}>
      {state === 'working' && (
        <AuthCard title={tr('Confirming your email…', 'Turemeza imeri yawe…')}>
          <Loader2 className="w-7 h-7 animate-spin text-blue-700" />
        </AuthCard>
      )}
      {state === 'ok' && (
        <AuthCard icon={MailCheck} title={tr('Email confirmed', 'Imeri yemejwe')} subtitle={tr('Thank you. Your account is ready.', 'Murakoze. Konti yawe irarangiye.')}>
          <Link to={user ? '/jobs' : '/login'} className={primaryBtn}>{user ? tr('Browse jobs', 'Reba akazi') : tr('Sign in', 'Injira')}</Link>
        </AuthCard>
      )}
      {state === 'bad' && (
        <AuthCard icon={MailX} title={tr('This link did not work', 'Uyu murongo ntiwakoze')} subtitle={message || tr('It may have expired or been used already.', 'Ushobora kuba warangiye cyangwa wakoreshejwe.')}>
          <Link to={user ? '/profile' : '/login'} className={primaryBtn}>{user ? tr('Go to my account', 'Jya kuri konti yanjye') : tr('Sign in to get a new link', 'Injira ubone umurongo mushya')}</Link>
        </AuthCard>
      )}
    </AuthShell>
  );
}
