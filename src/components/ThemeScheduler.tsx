// S.P.A.R.K. — DB’deki otomatik/manuel tema ayarını uygular; saat geçişi ve ön plana dönüşte yeniler
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { applyThemeFromDatabase } from '../utils/themeSchedule';

const TICK_MS = 60_000;

export default function ThemeScheduler() {
  useEffect(() => {
    const interval = setInterval(() => {
      void applyThemeFromDatabase();
    }, TICK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void applyThemeFromDatabase();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);
  return null;
}
