import { useCallback, useEffect, useState } from 'react';
import { getDatabase } from '../db/database';

const ONBOARDING_KEY = 'onboarding_completed';

export function useOnboardingStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [ONBOARDING_KEY],
      );
      setCompleted(row?.value === '1');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setOnboardingCompleted = useCallback(async (value: boolean) => {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [ONBOARDING_KEY, value ? '1' : '0'],
    );
    setCompleted(value);
  }, []);

  return {
    isLoading,
    completed,
    refresh,
    setOnboardingCompleted,
  };
}
