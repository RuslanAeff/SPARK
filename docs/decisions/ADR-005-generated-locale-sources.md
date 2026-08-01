# ADR-005: Üretilmiş locale kaynak zinciri

- **Status:** Accepted
- **Kayıt türü:** Retrospective
- **Kayda geçirildi:** 1 Ağustos 2026
- **Özgün karar tarihi:** Bilinmiyor; dört dil paritesi `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` içinde Haziran 2026 olarak kayıtlıdır.
- **Özgün commit:** Bilinmiyor

## Bağlam

SPARK TR, EN, AZ ve RU destekler. Geçmişte yeni anahtarlar doğrudan `az.json`/`ru.json` içine yazıldı ve sonraki locale derlemesinde sessizce kayboldu. Çoklu dosya kaynak zinciri açık tanımlanmazsa bir dil runtime'da fallback'e düşebilir veya üretilmiş dosya ile gerçek çeviri kaynağı ayrışabilir.

## Karar

1. TR varsayılan/reference locale'dir ve `src/i18n/translations.ts` içinde inline tutulur.
2. EN runtime fallback tabanıdır ve aynı dosyada inline bulunur. `src/i18n/locales/_en.json`, AZ/RU üretiminin İngilizce tabanıdır; inline EN ile senkron tutulmalıdır.
3. AZ ve RU insan tarafından düzenlenen kanonik çeviri kaynakları numaralı `src/i18n/locales/map-az-N.json` ve `map-ru-N.json` parçalarıdır.
4. `compilePartial.mjs` parçaları sayısal sırayla birleştirip `az-partial.json`/`ru-partial.json` üretir. Partial dosyalar da doğrudan düzenlenmez.
5. `buildLocales.mjs`, `_en.json` tabanı ile partial override'larını birleştirip runtime `az.json`/`ru.json` dosyalarını üretir. Bu iki runtime dosyası doğrudan düzenlenmez.
6. Değişiklik akışı sırasıyla:

   `translations.ts (TR + inline EN)` → `_en.json` → `map-*` → `node src/i18n/compilePartial.mjs` → `node src/i18n/buildLocales.mjs` → locale parity testi.
7. TR ve EN eager; AZ/RU seçilince dinamik import ile yüklenir. İlk görünür kare açılmadan seçili sözlüğün yüklenmesi beklenir; yanlış dil flash'ı kabul edilmez.
8. Çeviri anahtar kümeleri TR ile tam paritede tutulur. `_parityBaseline.json` yalnız kontrollü geçici borç için ratchet'tir; mevcut hedef boş baseline'dır.
9. Placeholder biçimi `{param}`'dır. Yüzde metni `%{pct}` değil `{pct}%` kullanır. Para sembolü şablona sabitlenmez; formatlanmış tutar parametre olarak verilir.

## Değişmezler

- `az.json`, `ru.json`, `az-partial.json` ve `ru-partial.json` elle değiştirilmez.
- Yeni kullanıcı metni dört dil akışında aynı çalışma kapsamında ele alınır.
- Map parça numaraları glob ile bulunur ve sayısal sırada uygulanır; daha sonraki parça aynı anahtarı override eder, bu nedenle istemsiz duplicate anahtar gözden geçirilmelidir.
- Runtime fallback sırası seçili dil → EN → TR → anahtar adıdır.
- Dil state'i sözlük yüklenmeden güncellenmez.

## Bilinen boşluk

`src/i18n/locales/_keyorder.json` depoda vardır ancak 1 Ağustos 2026 itibarıyla mevcut `compilePartial.mjs` ve `buildLocales.mjs` dosyaları onu okumaz. Bu nedenle kanonik sıralamanın build tarafından zorlandığı iddia edilmez. Sıra doğrulaması isteniyorsa script/test değişikliği ayrı iş olarak yapılmalıdır.

## Sonuçlar ve ödünleşimler

**Olumlu:** Çeviri düzeltmeleri yeniden üretimde kaybolmaz; lazy-load startup maliyetini sınırlar; parity testi yeni drift'i CI'da yakalar.

**Bedel:** Tek metin değişikliği birden fazla kaynak dosyası ve iki üretim adımı gerektirir. EN'in inline ve `_en.json` olmak üzere iki temsilinin senkron tutulması ek bakım yüküdür.

## Doğrulama

1. `node src/i18n/compilePartial.mjs`
2. `node src/i18n/buildLocales.mjs`
3. `npm test -- --runInBand src/i18n/__tests__/localeParity.test.ts`
4. `npm run typecheck`
5. Dil değişimi ve cold start için en az AZ veya RU seçili native cihaz kontrolü.

## Kanıt

- `src/i18n/translations.ts`
- `src/i18n/LanguageContext.tsx`
- `src/i18n/compilePartial.mjs`
- `src/i18n/buildLocales.mjs`
- `src/i18n/locales/_en.json`
- `src/i18n/locales/_parityBaseline.json`
- `src/i18n/locales/map-az-*.json`
- `src/i18n/locales/map-ru-*.json`
- `src/i18n/__tests__/localeParity.test.ts`
- `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` §9.1

## Yeniden değerlendirme koşulları

Tek kaynaklı bir i18n derleyicisi inline EN ile `_en.json` ikiliğini ortadan kaldırırsa veya ICU MessageFormat/çoğul desteği eklenirse yeni ADR ile kaynak ve placeholder sözleşmesi güncellenmelidir.
