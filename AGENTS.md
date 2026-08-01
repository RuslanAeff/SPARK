# AGENTS.md — S.P.A.R.K. katkı sözleşmesi

Bu dosya, S.P.A.R.K. deposunda çalışan insan ve yapay zekâ destekli geliştiriciler için ortak başlangıç noktasıdır. Araçtan bağımsızdır; Codex, Claude Code ve diğer ajanlar aynı kuralları izlemelidir.

## Önce okunacaklar

Görevin kapsamına göre şu sırayı kullan:

1. `DESIGN_BRIEF.md` — ürün amacı, kapsam ve tasarım ilkeleri.
2. `docs/ARCHITECTURE.md` — sistem sınırları, veri modeli ve ana akışlar.
3. `docs/DEVELOPMENT_GUIDE.md` — uygulama kuralları ve geliştirme akışı.
4. `docs/QUALITY_AND_SECURITY.md` — doğrulama, güvenlik ve fiziksel cihaz sınırları.
5. `docs/decisions/README.md` — önemli mimari kararların gerekçeleri.

Geçmişte kapatılmış bulgular için `docs/history/ENGINEERING_HISTORY_2026.md` kullanılır. Tarihçe belgesi güncel mimarinin kaynağı değildir.

## Tek gerçek kaynakları

| Bilgi | Kanonik kaynak |
|---|---|
| Paketler, script'ler ve uygulama sürümü | `package.json` |
| Expo yapılandırması, izinler ve Android `versionCode` | `app.json` ve `app.config.js` |
| EAS profilleri | `eas.json` |
| Veritabanı şeması ve migration'lar | `src/db/schema.ts` ve `src/db/database.ts` |
| CI adımları | `.github/workflows/ci.yml` |
| Ürün ve UX niyeti | `DESIGN_BRIEF.md` |
| Gerçek çalışma davranışı | Ürün kodu ve testler |

Belge ile kod çelişirse tahmin yürütme. Çelişkiyi belirt, kod/config gerçeğini doğrula ve ilgili belgeyi aynı çalışma kapsamında güncelle.

## Değişmez geliştirme kuralları

### Tema ve ilk görünür kare

- Uygulama içi tema için `Appearance.setColorScheme(...)` kullanma. Bu çağrı Android Activity yeniden oluşturma ve açılış flicker'ını geri getirebilir.
- Tema duyarlı bileşenlerde `useAppTheme()` kullan; stilleri şema bağımlı `useMemo` ile üret.
- İlk görünür kareyi etkileyen DB tercihleri, kök başlangıç/reveal kapısı tamamlanmadan UI'a sızmamalıdır.

### Veritabanı ve finansal bütünlük

- Birden fazla yazma içeren işlemleri `withTransactionAsync(...)` içinde atomik yap.
- Şema değişikliğinde geriye dönük migration ekle; backup export/import biçimini de birlikte değerlendir.
- Aynı SQLite bağlantısındaki prepared sorguları gelişigüzel paralelleştirme. Mevcut seri erişim kararını değiştirmeden önce `ADR-002`yi oku.
- Borç kaydı, borç ödemesi, harcama ve ek gelir farklı finansal olaylardır. Borç ödemesi tüketim değildir; kayıt silme ve düzeltmelerinde türetilmiş bütçe etkisi mevcut kayıtlardan yeniden hesaplanmalıdır.
- Fiş kalemleri düzenlenirken basılı fiş toplamının korunması kararını değiştirmeden önce ilgili ADR'yi ve testleri incele.

### Güvenlik ve dış veri

- Gemini API anahtarı yalnız `expo-secure-store` içinde tutulur; SQLite'a, loglara veya URL query parametresine yazılmaz.
- Gemini isteğinde anahtar `x-goog-api-key` header'ında gönderilir.
- Fiş, backup ve diğer dış girdiler `src/utils/inputValidation.ts` sınırlarından geçirilir.
- Secret, kişisel dosya yolu veya ham kullanıcı verisini dokümana, teste ya da ekran görüntüsüne ekleme.

### i18n

- Kullanıcıya görünen yeni metinler TR, EN, AZ ve RU akışına eklenir.
- `az.json` ve `ru.json` üretilmiş çıktılardır; doğrudan düzenlenmez.
- Çeviri kaynağını uygun `map-{az,ru}-*.json` dosyasına ekle; ardından `compilePartial.mjs` ve `buildLocales.mjs` akışını uygula.
- Dize içinde `%{param}` kullanma; yüzde için `{param}%` biçimini kullan.

### UI, hareket ve bildirimler

- Yeni alt sayfalarda ortak `src/components/BottomSheetModal.tsx` bileşenini tercih et.
- Yeni animasyonlarda Reanimated kullan; mevcut legacy `Animated` kullanımlarını gerekçesiz topluca dönüştürme.
- Birincil CTA için `src/theme/susevar.ts` tasarım sözleşmesini koru.
- Expo Go Android'de bildirim API'leri için mevcut çalışma ortamı guard'ını koru.
- Liste gesture, seçim ve refresh davranışlarını birlikte değiştiriyorsan cihaz testi kabul kriterine ekle.

## Çalışma akışı

1. `git status --short` ile mevcut kullanıcı değişikliklerini belirle; ilgisiz değişiklikleri geri alma veya üzerine yazma.
2. Görevin etkilediği domain, ADR ve kod yollarını oku.
3. Kapsamı küçük ve doğrulanabilir tut; çapraz katmanlı işlerde kabul kriterlerini önceden yaz.
4. Uygulama değişikliklerinden sonra en az `npm run typecheck` ve ilgili Jest testlerini çalıştır. Uygun olduğunda tam `npm test -- --ci --coverage=false` çalıştır.
5. Gesture, splash, tema, native modal, SQLite yaşam döngüsü ve APK davranışını yalnız Jest sonucuyla doğrulanmış sayma; fiziksel cihaz veya uygun build kontrolünü ayrıca kaydet.
6. Mimari karar değiştiyse ilgili ADR'yi; kalıcı katkı kuralı değiştiyse bu dosyayı veya geliştirme rehberini aynı değişiklikte güncelle.

## Tez ve AI katkı kaydı

Mimari veya kullanıcı deneyimini anlamlı biçimde değiştiren işlerde:

- `docs/evidence/TRACEABILITY.md` içinde gereksinim–karar–kod–test–sonuç bağlantısını güncelle.
- AI katkısı kullanıldıysa `docs/evidence/AI_COLLABORATION_LOG.md` içinde insan kararı ile AI önerisini birbirinden ayır.
- Otomatik test, cihaz doğrulaması ve kullanıcı kabulünü ayrı kanıt türleri olarak kaydet.
- Geçmişe dönük kayıtları kanıt bulunmadan kesin gerçek gibi yazma; `retrospective` ve sınırlama notu ekle.

## İletişim ve güvenli değişiklik

- Kullanıcıyla Türkçe iletişim kur.
- Belirsiz ama düşük riskli ayrıntılarda kod kanıtına dayanarak ilerle; kapsamı veya ürünü değiştirecek kararlarda kullanıcı onayı al.
- Silme, geçmişi yeniden yazma, dış sisteme gönderme, yayınlama veya secret yönetimi gibi işlemleri açık onay olmadan yapma.
