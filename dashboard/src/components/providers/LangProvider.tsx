'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type Lang = 'vi' | 'en';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (vi: string, en: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'vi',
  setLang: () => {},
  t: (vi) => vi,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('vi');
  const t = useCallback((vi: string, en: string) => lang === 'vi' ? vi : en, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

/** Inline VN/EN toggle button — place wherever needed */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 p-1 bg-surface-container border border-outline-variant rounded-full text-[11px] font-extrabold select-none">
      <button
        onClick={() => setLang('vi')}
        className={`px-2.5 py-1 rounded-full transition-all duration-200 ${
          lang === 'vi' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >VN</button>
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-full transition-all duration-200 ${
          lang === 'en' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >EN</button>
    </div>
  );
}
