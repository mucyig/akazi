import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('akazi_lang') || 'en';
  });

  const setLanguage = (lang) => {
    if (lang === 'en' || lang === 'rw') {
      setLanguageState(lang);
      localStorage.setItem('akazi_lang', lang);
    }
  };

  const t = (path, params = {}) => {
    const keys = path.split('.');
    let current = translations[language];

    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        // Fallback to English if translation is missing
        let fallback = translations['en'];
        for (const fbKey of keys) {
          if (fallback && fallback[fbKey] !== undefined) {
            fallback = fallback[fbKey];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    // Replace parameter placeholders: e.g. {count}, {company}, {date}
    return current.replace(/\{(\w+)\}/g, (_, k) => {
      return params[k] !== undefined ? params[k] : `{${k}}`;
    });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tr: (en, rw) => (language === 'rw' && rw ? rw : en) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
