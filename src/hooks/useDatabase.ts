// S.P.A.R.K. — Database Initialization Hook
import { useState, useEffect } from 'react';
import { initializeDatabase } from '../db/database';
import { applyThemeFromDatabase } from '../utils/themeSchedule';

export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeDatabase();
        // `Colors` proxy'si yanlış temayla StyleSheet üretmesin diye kayıtlı
        // tema isReady=true'dan önce React store'una uygulanır.
        await applyThemeFromDatabase();
        if (mounted) setIsReady(true);
      } catch (e) {
        console.error('Database init error:', e);
        if (mounted) setError(e instanceof Error ? e.message : 'Database initialization failed');
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  return { isReady, error };
}
