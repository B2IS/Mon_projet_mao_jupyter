/**
 * I18nContext.tsx — Système de traduction SIGEPP-DPE (FR/EN)
 * Sans dépendance externe lourde : Context React + useState localStorage
 */

'use client';

import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { TRANSLATIONS, type Lang, type TranslationKey } from './translations';

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, fallback?: string) => string;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Application FRANÇAIS uniquement (version anglaise retirée à la demande).
  const lang: Lang = 'fr';

  useEffect(() => {
    document.documentElement.lang = 'fr';
  }, []);

  const setLang = useCallback((_l: Lang) => { /* no-op : FR uniquement */ }, []);
  const toggleLang = useCallback(() => { /* no-op : FR uniquement */ }, []);

  const t = useCallback(
    (key: TranslationKey, fallback?: string) => {
      return TRANSLATIONS[lang][key] ?? fallback ?? key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be inside I18nProvider');
  return ctx;
}
