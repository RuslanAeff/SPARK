// S.P.A.R.K. — Merkezi Tema Mağazası (external store)
//
// Problem: `Appearance.setColorScheme()` Android/Expo Go üzerinde
// `Appearance.addChangeListener` event'ini her zaman tetiklemiyor
// (bilinen React Native quirk'i). Dolayısıyla `useColorScheme()` hook'u
// programatik tema değişimlerinde geride kalıyor → kartlar eski (dark)
// `StyleSheet`'e takılıp aydınlık modda siyah görünüyor.
//
// Çözüm: İki kanallı, tek doğruluk kaynağı bir store:
//   1) OS değişimi:    Appearance.addChangeListener  (fiziksel/system tema)
//   2) Manuel değişim: themeStore.notify()           (themeSchedule setter'ları)
// Componentler `useAppTheme()` ile bu store'a subscribe olur ve
// `Appearance.setColorScheme()` çağrıldığı anda re-render alır.

import { Appearance } from 'react-native';
import { useSyncExternalStore } from 'react';
import { getEffectiveColorScheme } from './colors';

type Scheme = 'light' | 'dark';

let currentScheme: Scheme = getEffectiveColorScheme();
const listeners = new Set<() => void>();

Appearance.addChangeListener(() => {
  const next = getEffectiveColorScheme();
  if (next !== currentScheme) {
    currentScheme = next;
    listeners.forEach((l) => l());
  }
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Scheme {
  return currentScheme;
}

/** themeSchedule ya da doğrudan `Appearance.setColorScheme()` çağrıldıktan
 *  sonra çağrılır. Store'u ve tüm subscriber'ları eşzamanlı yeniler. */
export function notifyThemeChanged(): void {
  const next = getEffectiveColorScheme();
  if (next !== currentScheme) {
    currentScheme = next;
    listeners.forEach((l) => l());
  }
}

/** Uygulama genelinde tek doğruluk kaynağı olan tema hook'u.
 *  `useColorScheme()` yerine bunu kullanın — OS + manuel her iki kanalı da dinler. */
export function useAppTheme(): Scheme {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Hook dışı yerlerde senkron okuma için. */
export function getAppThemeSnapshot(): Scheme {
  return currentScheme;
}
