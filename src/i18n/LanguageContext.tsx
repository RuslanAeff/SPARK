import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Language, loadLocale, getDict } from './translations';
import { getDatabase } from '../db/database';
import { suggestLanguageFromDevice } from './languageOptions';

const VALID_LANGS: Language[] = ['tr', 'en', 'az', 'ru'];

function isLanguage(v: string): v is Language {
  return (VALID_LANGS as string[]).includes(v);
}

interface LanguageContextType {
  language: Language;
  /** Kalıcı dil tercihi ve gerekiyorsa dinamik sözlük hazır. */
  isLoaded: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  tc: (categoryName: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('tr');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadLang = async () => {
      let lang: Language = 'tr';
      try {
        const db = await getDatabase();
        const result = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM settings WHERE key = 'app_language'",
        );
        lang =
          result && isLanguage(result.value)
            ? result.value
            : suggestLanguageFromDevice();
      } catch (e) {
        if (__DEV__) console.warn('[Language] load failed', e);
      }
      // AZ/RU sözlüğü ilk render'dan ÖNCE yüklenir → flash of wrong locale yok (§8.3).
      try {
        await loadLocale(lang);
      } catch (e) {
        if (__DEV__) console.warn('[Language] locale load failed', e);
      }
      setLanguageState(lang);
      setIsLoaded(true);
    };
    loadLang();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await loadLocale(lang); // dil değişiminde sözlük hazır olmadan state'i güncelleme
      const db = await getDatabase();
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_language', ?)",
        [lang],
      );
      setLanguageState(lang);
    } catch (e) {
      if (__DEV__) console.warn('[Language] save failed', e);
    }
  }, []);

  // P7: t/tc referans kimliği sadece dil değiştiğinde değişir; aksi halde her render’da
  // yeni fonksiyon üretilmesi, t/tc’yi dependency array’e koyan tüm hook’ları
  // gereksiz yere tetikliyordu.
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = getDict(language) ?? {};
      const enDict = getDict('en')!;
      const trDict = getDict('tr')!;
      let text =
        dict[key] ??
        (language !== 'en' ? enDict[key] : undefined) ??
        trDict[key] ??
        key;

      if (params) {
        Object.keys(params).forEach((param) => {
          text = text
            .replace(new RegExp(`%{${param}}`, 'g'), String(params[param]))
            .replace(new RegExp(`{${param}}`, 'g'), String(params[param]));
        });
      }
      return text;
    },
    [language],
  );

  const tc = useCallback(
    (categoryName: string): string => {
      const key = `cat_${categoryName}`;
      const dict = getDict(language) ?? {};
      const enDict = getDict('en')!;
      return (
        dict[key] ??
        (language !== 'en' ? enDict[key] : undefined) ??
        categoryName
      );
    },
    [language],
  );

  // P7: Context value nesnesi memoize — aksi halde her provider render’ında tüm
  // tüketici bileşenler gereksiz re-render yiyordu.
  const value = useMemo(
    () => ({ language, isLoaded, setLanguage, t, tc }),
    [language, isLoaded, setLanguage, t, tc],
  );

  // Çocukları hiçbir zaman null döndürme. Kök açılış perdesi `isLoaded`
  // tamamlanana kadar ekranı kapatır; böylece provider yüklenirken native
  // pencerenin bir kare görünmesi engellenir.
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
