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
