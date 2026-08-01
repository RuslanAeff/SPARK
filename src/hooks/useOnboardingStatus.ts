import { useCallback, useEffect, useState } from 'react';
import { getDatabase } from '../db/database';

const ONBOARDING_KEY = 'onboarding_completed';
let sharedCompleted: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

function publishCompleted(value: boolean) {
  sharedCompleted = value;
  listeners.forEach((listener) => listener(value));
}

export function useOnboardingStatus() {
  const [isLoading, setIsLoading] = useState(sharedCompleted === null);
  const [completed, setCompleted] = useState(sharedCompleted ?? false);

  useEffect(() => {
    const listener = (value: boolean) => {
      setCompleted(value);
      setIsLoading(false);
    };
    listeners.add(listener);
    if (sharedCompleted !== null) listener(sharedCompleted);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [ONBOARDING_KEY],
      );
      publishCompleted(row?.value === '1');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sharedCompleted === null) void refresh();
  }, [refresh]);

  const setOnboardingCompleted = useCallback(async (value: boolean) => {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [ONBOARDING_KEY, value ? '1' : '0'],
    );
    publishCompleted(value);
  }, []);

  return {
    isLoading,
    completed,
    refresh,
    setOnboardingCompleted,
  };
}
