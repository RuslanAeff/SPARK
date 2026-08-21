// S.P.A.R.K. — Merkezi Tema Mağazası (external store)
//
// Scheme ve accent tek immutable snapshot olarak yayımlanır. Böylece bir palet
// değişiminde eski vurgu + yeni scheme gibi ara kareler oluşmaz. Native uiMode'a
// dokunulmaz; Appearance.setColorScheme Android Activity recreation nedeniyle
// bu akışta özellikle kullanılmaz.

import { Appearance } from 'react-native';
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_THEME_ACCENT,
  getEffectiveColorScheme,
  normalizeThemeAccent,
  resolveTheme,
  setThemeSelectionReader,
  type AppColorScheme,
  type ThemeAccent,
  type ThemePalette,
} from './colors';

export type AppThemeStateSnapshot = Readonly<{
  scheme: AppColorScheme;
  accent: ThemeAccent;
  palette: ThemePalette;
  revision: number;
}>;

function makeSnapshot(
  scheme: AppColorScheme,
  accent: ThemeAccent,
  revision: number,
): AppThemeStateSnapshot {
  return Object.freeze({
    scheme,
    accent,
    palette: resolveTheme(scheme, accent),
    revision,
  });
}

let current = makeSnapshot(getEffectiveColorScheme(), DEFAULT_THEME_ACCENT, 0);
setThemeSelectionReader(() => ({ scheme: current.scheme, accent: current.accent }));

// DB tercihi bir kez uygulandıktan sonra native Appearance değişimleri uygulama
// içi manuel/zamanlanmış seçimlerin üzerine yazamaz.
let appSchemeManaged = false;
const listeners = new Set<() => void>();

function emit(nextScheme: AppColorScheme, nextAccent: ThemeAccent): void {
  if (nextScheme === current.scheme && nextAccent === current.accent) return;
  current = makeSnapshot(nextScheme, nextAccent, current.revision + 1);
  listeners.forEach((listener) => listener());
}

Appearance.addChangeListener(() => {
  if (appSchemeManaged) return;
  emit(getEffectiveColorScheme(), current.accent);
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AppThemeStateSnapshot {
  return current;
}

/** Scheme ve accent'i tek bildirim/revision içinde atomik uygular. */
export function setAppThemeSelection(selection: {
  scheme: AppColorScheme;
  accent: ThemeAccent;
}): void {
  appSchemeManaged = true;
  emit(selection.scheme, normalizeThemeAccent(selection.accent));
}

/** Mevcut API: yalnız scheme'i değiştirir, aktif vurgu korunur. */
export function setAppThemeScheme(next: AppColorScheme): void {
  appSchemeManaged = true;
  emit(next, current.accent);
}

/** Yalnız vurguyu değiştirir; light/dark tercihi değişmez. */
export function setAppThemeAccent(next: ThemeAccent): void {
  emit(current.scheme, normalizeThemeAccent(next));
}

/**
 * Geriye dönük scheme hook'u. Snapshot nesnesine abone olduğu için accent
 * değişiminde de yeniden render olur; dönüş tipi hâlâ yalnız light/dark'tır.
 */
export function useAppTheme(): AppColorScheme {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).scheme;
}

export function useThemeAccent(): ThemeAccent {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).accent;
}

export function useThemePalette(): ThemePalette {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).palette;
}

export function useThemeRevision(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).revision;
}

export function useAppThemeSnapshot(): AppThemeStateSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Eski hook-dışı API: yalnız scheme döndürür. */
export function getAppThemeSnapshot(): AppColorScheme {
  return current.scheme;
}

export function getThemeAccentSnapshot(): ThemeAccent {
  return current.accent;
}

export function getThemePaletteSnapshot(): ThemePalette {
  return current.palette;
}

/** Colors proxy ve atomik başlangıç tüketicileri için tam snapshot. */
export function getAppThemeStateSnapshot(): AppThemeStateSnapshot {
  return current;
}
