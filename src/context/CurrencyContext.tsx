// S.P.A.R.K. — Görüntüleme para birimi (tutarlar aynı kalır, sadece etiket/symbol)
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { getDatabase } from '../db/database';

const SETTINGS_KEY = 'display_currency';

export const DISPLAY_CURRENCIES = ['PLN', 'USD', 'EUR', 'AZN', 'TRY'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const CURRENCY_META: Record<
  DisplayCurrency,
  { label: string; symbol: string; shortLabel: string }
> = {
  PLN: { label: 'Polonya Zlotisi', symbol: 'zł', shortLabel: 'PLN' },
  USD: { label: 'ABD Doları', symbol: '$', shortLabel: 'USD' },
  EUR: { label: 'Euro', symbol: '€', shortLabel: 'EUR' },
  AZN: { label: 'Azerbaycan Manatı', symbol: '₼', shortLabel: 'AZN' },
  TRY: { label: 'Türk Lirası', symbol: '₺', shortLabel: 'TL' },
};

function isDisplayCurrency(v: string): v is DisplayCurrency {
  return DISPLAY_CURRENCIES.includes(v as DisplayCurrency);
}

interface CurrencyContextType {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>('PLN');

  useEffect(() => {
    (async () => {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM settings WHERE key = ?',
          [SETTINGS_KEY]
        );
        if (row?.value && isDisplayCurrency(row.value)) {
          setCurrencyState(row.value);
        }
      } catch (e) {
        console.warn('[Currency] load failed', e);
      }
    })();
  }, []);

  const setCurrency = useCallback(async (c: DisplayCurrency) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [SETTINGS_KEY, c]
      );
      setCurrencyState(c);
    } catch (e) {
      console.warn('[Currency] save failed', e);
    }
  }, []);

  // P7: Provider value memoize — currency / setCurrency referansı sabit kalırken
  // üst katmandaki her render’da tüketicilerin yeniden çalışmasını engeller.
  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}

/** Provider dışında (ör. saf util) için güvenli varsayılan */
export function useCurrencySafe(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      currency: 'PLN',
      setCurrency: async () => {},
    };
  }
  return ctx;
}
