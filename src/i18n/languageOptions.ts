import type { Language } from './translations';

/** Sıra: Azərbaycan → Türkçe → English → Русский */
export const LANGUAGE_OPTIONS: { code: Language; nativeLabel: string }[] = [
  { code: 'az', nativeLabel: 'Azərbaycan' },
  { code: 'tr', nativeLabel: 'Türkçe' },
  { code: 'en', nativeLabel: 'English' },
  { code: 'ru', nativeLabel: 'Русский' },
];

export function languageNativeLabel(code: Language): string {
  return LANGUAGE_OPTIONS.find((o) => o.code === code)?.nativeLabel ?? code;
}

/** Kayıtlı tercih yokken ilk açılışta kullanılacak cihaz dili. */
export function suggestLanguageFromDevice(): Language {
  const locale = Intl.NumberFormat().resolvedOptions().locale.toLowerCase();
  if (locale.startsWith('az')) return 'az';
  if (locale.startsWith('ru')) return 'ru';
  if (locale.startsWith('tr')) return 'tr';
  if (locale.startsWith('en')) return 'en';
  if (['kk', 'ky', 'uz', 'tg', 'tk', 'be', 'uk'].some((code) => locale.startsWith(code))) {
    return 'ru';
  }
  return 'tr';
}

/** tarix/qısa həftə günü üçün toLocaleDateString */
export function intlLocaleForLanguage(lang: Language): string {
  switch (lang) {
    case 'tr':
      return 'tr-TR';
    case 'az':
      return 'az-AZ';
    case 'ru':
      return 'ru-RU';
    case 'en':
    default:
      return 'en-US';
  }
}
