// S.P.A.R.K. — Merkezi Tema Mağazası (external store)
//
// Problem: Native Appearance ile uygulama içi tema tercihini aynı kanalda
// yönetmek Android'de Activity yeniden oluşturulmasına ve tam ekran parlamaya
// yol açabiliyor.
//
// Çözüm: İki kanallı, tek doğruluk kaynağı bir store:
//   1) OS değişimi:    Appearance.addChangeListener  (fiziksel/system tema)
//   2) Uygulama teması: setAppThemeScheme()           (themeSchedule setter'ları)
// Componentler `useAppTheme()` ile bu store'a subscribe olur; native pencerenin
// uiMode'u değişmeden aynı React ağacı güncellenir.

import { Appearance } from 'react-native';
import { useSyncExternalStore } from 'react';
import { getEffectiveColorScheme } from './colors';

type Scheme = 'light' | 'dark';

let currentScheme: Scheme = getEffectiveColorScheme();
// DB'deki manuel/otomatik tema bir kez uygulandıktan sonra uygulamanın teması
// native Appearance olaylarından bağımsız yönetilir. `Appearance.setColorScheme`
// Android'de AppCompat night-mode değiştirip Activity recreation tetikleyebildiği
// için uygulama içi tema seçiminde kesinlikle kullanılmaz.
let appSchemeManaged = false;
const listeners = new Set<() => void>();

Appearance.addChangeListener(() => {
  if (appSchemeManaged) return;
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

/** Uygulamanın manuel/zamanlanmış temasını yalnız React store'unda uygular.
 * Android native uiMode/Activity recreation yok; subscriber'lar aynı karede
 * güncellenir. */
export function setAppThemeScheme(next: Scheme): void {
  appSchemeManaged = true;
  if (next === currentScheme) return;
  currentScheme = next;
  listeners.forEach((l) => l());
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
