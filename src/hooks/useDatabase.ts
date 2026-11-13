// S.P.A.R.K. — Database Initialization Hook
import { useState, useEffect, useCallback } from 'react';
import { initializeDatabase } from '../db/database';
import { applyThemeFromDatabase } from '../utils/themeSchedule';
import { logError } from '../utils/logError';

/**
 * BUG-07: Açılış hatası ham metin olarak ekrana taşınmaz (SQLite mesajı dosya
 * yolu/tablo adı içerebilir); yalnız `failed` bayrağı döner. `retry()` yeni bir
 * açılış denemesi başlatır — `getDatabase` reddedilen denemeyi önbellekte tutmaz.
 */
export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeDatabase();
        // `Colors` proxy'si yanlış temayla StyleSheet üretmesin diye kayıtlı
        // tema isReady=true'dan önce React store'una uygulanır.
        await applyThemeFromDatabase();
        if (mounted) {
          setFailed(false);
          setIsReady(true);
        }
      } catch (e) {
        logError('Database init error', e);
        if (mounted) setFailed(true);
      } finally {
        if (mounted) setRetrying(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [attempt]);

  const retry = useCallback(() => {
    setRetrying(true);
    setAttempt(value => value + 1);
  }, []);

  return { isReady, failed, retrying, retry };
}
