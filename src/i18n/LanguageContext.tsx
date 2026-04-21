import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { translations, Language } from './translations';
import { getDatabase } from '../db/database';

const VALID_LANGS: Language[] = ['tr', 'en', 'az', 'ru'];

function isLanguage(v: string): v is Language {
  return (VALID_LANGS as string[]).includes(v);
}

interface LanguageContextType {
  language: Language;
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
      try {
        const db = await getDatabase();
        const result = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM settings WHERE key = 'app_language'",
        );
        if (result && isLanguage(result.value)) {
          setLanguageState(result.value);
        }
      } catch (e) {
        if (__DEV__) console.warn('[Language] load failed', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadLang();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
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
      const dict = translations[language];
      const enDict = translations.en;
      const trDict = translations.tr;
      let text =
        (dict as any)[key] ??
        (language !== 'en' ? (enDict as any)[key] : undefined) ??
        (trDict as any)[key] ??
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
      const dict = translations[language];
      return (
        (dict as any)[key] ??
        (language !== 'en' ? (translations.en as any)[key] : undefined) ??
        categoryName
      );
    },
    [language],
  );

  // P7: Context value nesnesi memoize — aksi halde her provider render’ında tüm
  // tüketici bileşenler gereksiz re-render yiyordu.
  const value = useMemo(
    () => ({ language, setLanguage, t, tc }),
    [language, setLanguage, t, tc],
  );

  // Prevent flicker during load
  if (!isLoaded) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
