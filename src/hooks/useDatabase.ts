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
        // Tema DB'den yüklenip Appearance'a yazılmadan UI çizilirse
        // `Colors` proxy'si OS'un temasını döndürüp yanlış `StyleSheet`
        // üretebiliyordu (aydınlık modda siyah kart bug'ı). Bu yüzden
        // isReady=true'dan ÖNCE temayı senkron uyguluyoruz.
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
