import { translations, type Language } from '../translations';
import azJson from '../locales/az.json';
import ruJson from '../locales/ru.json';
import baseline from '../locales/_parityBaseline.json';

// AZ/RU artık runtime'da lazy-load (translations objesi yalnız tr/en içerir, §8.3);
// parite kontrolü için JSON'ları doğrudan oku.
const dicts: Record<Language, Record<string, string>> = {
  tr: translations.tr as unknown as Record<string, string>,
  en: translations.en as unknown as Record<string, string>,
  az: azJson as Record<string, string>,
  ru: ruJson as Record<string, string>,
};

/**
 * i18n anahtar paritesi — TR (varsayılan, kaynak) ile EN/AZ/RU karşılaştırması.
 *
 * Bir dilde TR'de olan bir anahtar eksikse runtime'da fallback'e düşer (kullanıcı
 * yanlış dilde metin görür). Bu test her YENİ çeviri eklemesini koruma altına alır.
 *
 * Ratchet (mandal) modeli: `locales/_parityBaseline.json` bilinen mevcut AZ/RU
 * eksiklerini dondurur (teknik borç). Test yalnızca baseline'da OLMAYAN yeni
 * eksik anahtarlarda kırmızıya düşer → borç büyüyemez, sadece küçülebilir.
 *
 * Drift bulunca eksik anahtarı ekle:
 *   EN  → translations.ts `en` inline + locales/_en.json
 *   AZ  → locales/map-az-*.json   (sonra: node compilePartial.mjs && node buildLocales.mjs)
 *   RU  → locales/map-ru-*.json   (sonra: node compilePartial.mjs && node buildLocales.mjs)
 * Bir anahtar çevrildiğinde _parityBaseline.json'dan da çıkarılmalı (aşağıdaki
 * "baseline güncel" testi bayatlamış girdileri yakalar).
 */

const REFERENCE: Language = 'tr';
const TARGETS: Language[] = ['en', 'az', 'ru'];
const base = baseline as Record<string, string[]>;

const refKeys = Object.keys(dicts[REFERENCE]);

function missingFor(lang: Language): string[] {
  const langKeys = new Set(Object.keys(dicts[lang]));
  return refKeys.filter((k) => !langKeys.has(k));
}

describe('i18n locale key parity', () => {
  it('reference locale (tr) has keys', () => {
    expect(refKeys.length).toBeGreaterThan(0);
  });

  it('en has full parity with tr (no baseline allowed)', () => {
    expect(missingFor('en')).toEqual([]);
  });

  // Yeni drift koruması: baseline dışı eksik anahtar = hata.
  it.each(TARGETS)('%s has no NEW missing keys vs tr', (lang) => {
    const allowed = new Set(base[lang] ?? []);
    const newlyMissing = missingFor(lang).filter((k) => !allowed.has(k));
    expect(newlyMissing).toEqual([]);
  });

  // Mandalın sıkışması: çevrilmiş bir anahtar baseline'da kalmamalı.
  it.each(TARGETS)('%s baseline has no stale (already-translated) entries', (lang) => {
    const stillMissing = new Set(missingFor(lang));
    const stale = (base[lang] ?? []).filter((k) => !stillMissing.has(k));
    expect(stale).toEqual([]);
  });

  it.each(TARGETS)('%s has no keys absent from tr (orphan)', (lang) => {
    const refSet = new Set(refKeys);
    const extra = Object.keys(dicts[lang]).filter((k) => !refSet.has(k));
    expect(extra).toEqual([]);
  });
});
