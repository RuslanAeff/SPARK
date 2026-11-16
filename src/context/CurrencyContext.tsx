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
import {
  DISPLAY_CURRENCIES,
  CURRENCY_META,
  isDisplayCurrency,
  type DisplayCurrency,
} from '../utils/currencyMeta';
import { logError } from '../utils/logError';
import { setAppCurrency } from '../db/appCurrencyDao';
import { SettingsDao } from '../db/settingsDao';

const SETTINGS_KEY = 'display_currency';

// Tek kaynak: src/utils/currencyMeta.ts. Geriye dönük uyumluluk için buradan yeniden
// export edilir — mevcut tüketiciler ('../context/CurrencyContext'): add-expense,
// settings-general, onboarding.
export { DISPLAY_CURRENCIES, CURRENCY_META };
export type { DisplayCurrency };

interface CurrencyContextType {
  currency: DisplayCurrency;
  /** Kalıcı görüntüleme para birimi SQLite'dan okundu. */
  isLoaded: boolean;
  setCurrency: (c: DisplayCurrency) => Promise<boolean>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>('PLN');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const value = await SettingsDao.get(SETTINGS_KEY);
        if (value && isDisplayCurrency(value)) {
          setCurrencyState(value);
        }
      } catch (e) {
        logError('Currency load failed', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // BUG-01 6b: para birimi bir etikettir; değişiklik bütün kayıtların etiketini
  // tek transaction'da günceller. Başarısızlık sessiz başarı gibi görünmez.
  const setCurrency = useCallback(async (c: DisplayCurrency): Promise<boolean> => {
    try {
      await setAppCurrency(c);
      setCurrencyState(c);
      return true;
    } catch (e) {
      logError('Currency save failed', e);
      return false;
    }
  }, []);

  // P7: Provider value memoize — currency / setCurrency referansı sabit kalırken
  // üst katmandaki her render’da tüketicilerin yeniden çalışmasını engeller.
  const value = useMemo(
    () => ({ currency, isLoaded, setCurrency }),
    [currency, isLoaded, setCurrency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}
