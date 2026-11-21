import { useCallback, useEffect, useState } from 'react';
import { SettingsDao } from '../db/settingsDao';
import { SETTINGS_KEYS } from '../db/settingsKeys';

const ONBOARDING_KEY = SETTINGS_KEYS.onboardingCompleted;
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
      publishCompleted((await SettingsDao.get(ONBOARDING_KEY)) === '1');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sharedCompleted === null) void refresh();
  }, [refresh]);

  const setOnboardingCompleted = useCallback(async (value: boolean) => {
    await SettingsDao.set(ONBOARDING_KEY, value ? '1' : '0');
    publishCompleted(value);
  }, []);

  return {
    isLoading,
    completed,
    refresh,
    setOnboardingCompleted,
  };
}
