# S.P.A.R.K. 2026 Mühendislik Tarihçesi

Bu belge, 2026 içinde alınmış ve bugün kod tabanında etkisi süren mühendislik kararlarının kısa, kalıcı kaydıdır. Güncel ürün davranışının kanonik kaynağı değildir; güncel gerçek için önce kod, testler, yapılandırma ve [`DESIGN_BRIEF.md`](../../DESIGN_BRIEF.md) okunmalıdır.

## Kanıt ve tarih sınırlaması

- Kayıt **retrospective** olarak 1 Ağustos 2026'da, mevcut çalışma ağacı ile kök rehberin birebir arşivi olan [`DESIGN_BRIEF_LEGACY_2026-08-01.md`](DESIGN_BRIEF_LEGACY_2026-08-01.md) içindeki P1–P30 ve S1–S11 kayıtlarından derlenmiştir.
- Arşiv sadeleştirme öncesi kaynakla byte düzeyinde eşleştirilmiştir; SHA-256: `695cb5d14d5c92f7b78fda3fc0766f4b7be010a733d249c23dc9027ef8a9f60d`.
- Özgün kararların tek tek tarihleri ve bunları ilk getiren commit SHA'ları eldeki kayıtlarda güvenilir biçimde eşlenemedi. Aşağıdaki ay aralıkları yalnız legacy arşiv içinde açıkça belirtilen dönemlerdir; kesin commit tarihi değildir.
- Performans yüzdeleri ve sorgu sayıları ayrı benchmark artefaktına bağlanmadıkça retrospective rapor olarak okunmalıdır.
- Belge ile uygulama çelişirse uygulama kodu/config gerçeği esas alınır ve çelişki ayrıca kaydedilir; geçmiş sessizce yeniden yazılmaz.

## Dönem özeti

### Nisan 2026 — güvenlik sınırlarının kurulması (retrospective)

Gemini anahtarının saklanması ve taşınması güvenli hâle getirildi; dış veriye karşı merkezi doğrulama/sanitizasyon katmanı oluşturuldu; gereksiz Android izni ve riskli geliştirme script'i kaldırıldı. Ayrıntıların tamamı S1–S11 kaydında bulunur.

### Nisan–Mayıs 2026 — ilk performans ve kararlılık dalgaları (retrospective)

N+1 sorgular, render referans kararsızlığı, JS-thread grafik animasyonları ve eager liste render'ı azaltıldı. Tema, stil ve uzun liste davranışı için tekrar kullanılabilir kurallar oluştu. Ayrıntılar P1–P14 arasındadır.

### Mayıs–Temmuz 2026 — ürün mimarisinin olgunlaşması (retrospective)

Analiz ekranı modülerleşti; onboarding, bütçe döngüsü, borç, ek gelir, fiş bütünlüğü ve bildirim merkezi bağımsız domain sınırları kazandı. Android flicker, ilk kare sürekliliği, SQLite yaşam döngüsü ve bütçe/projeksiyon tutarlılığı üzerinde yoğunlaşıldı. Ayrıntılar P15–P30 arasındadır.

## Güvenlik bulguları S1–S11

Tüm kimlikler korunmuştur. “Kapatıldı” ifadesi özgün denetim kaydının durumudur; yeniden doğrulama için ilgili kod ve testler incelenmelidir.

| Kimlik | Retrospective sorun | Kalıcı çözüm / bugün korunacak kural | Başlıca kanıt |
|---|---|---|---|
| S1 | Gemini API anahtarı SQLite'ta düz metindi. | Anahtar `expo-secure-store` ile OS keychain'e taşınır; eski SQLite değeri idempotent migration sonrasında silinir. | `src/services/secureKeyStore.ts` |
| S2 | Anahtar URL query parametresiyle taşınıyordu. | Gemini çağrılarında yalnız `x-goog-api-key` header'ı kullanılır; `?key=` geri getirilmez. | `src/services/geminiService.ts` |
| S3 | Tanılama logları anahtar parçalarını açığa çıkarabiliyordu. | Anahtar içeriği ve anahtarlı URL loglanmaz; geliştirmede yalnız varlık/uzunluk gibi içeriksiz sinyal kullanılabilir. | `src/services/geminiService.ts` |
| S4 | Android'de kullanılmayan `RECORD_AUDIO` izni vardı. | Uygulama ses kaydetmediği sürece izin manifest'e eklenmez; minimum izin ilkesi korunur. | `app.json` |
| S5 | Kök `refactoring.js` script'i kaynak dosyayı doğrudan okuyup yazıyordu. | Riskli runtime/refactor script'i kaldırıldı; kaynak dönüşümleri denetlenebilir araçlarla yapılır. | Silinen dosya; özgün commit bilinmiyor. |
| S6 | Harcama DAO mutasyonlarında ortak girdi doğrulaması yoktu. | Para, adet, metin, tarih ve toplu ID girdileri `inputValidation.ts` sınırından geçer; `deleteMany` sınırlıdır. | `src/utils/inputValidation.ts`, `src/db/expenseDao.ts` |
| S7 | Satıcı ve kategori isimleri sanitize edilmiyordu. | Kontrol karakterleri/boş değerler engellenir ve alan bazlı uzunluk sınırları uygulanır. | `src/db/vendorDao.ts`, `src/db/categoryDao.ts` |
| S8 | Gemini JSON'u prototype-pollution anahtarları taşıyabiliyordu. | `__proto__`, `constructor` ve `prototype` dış JSON ağacından özyinelemeli çıkarılır. | `src/services/geminiService.ts`, `src/utils/inputValidation.ts` |
| S9 | Toplu silme sınırsız sayıda SQL placeholder üretebiliyordu. | ID girişi en çok 500 öğe; SQL işlemleri 400'lük parçalara bölünür. | `src/db/expenseDao.ts`, `src/utils/inputValidation.ts` |
| S10 | EAS Project ID için kaynakta sabit fallback bulunuyordu. | İlk kayıt fallback'in kaldırıldığını söyler. **Mevcut çalışma ağacının daha sonraki durumu:** herkese açık statik `extra.eas.projectId` `app.json` içinde durur ve `EAS_PROJECT_ID` varsa `app.config.js` ile override edilir. Bu geçişin özgün commit'i bilinmiyor; Project ID secret olarak sınıflandırılmaz. | `app.json`, `app.config.js`, `.env.example` |
| S11 | Eşzamanlı model keşifleri aynı ağ isteğini çoğaltabiliyordu. | `_modelCachePromise` in-flight dedup ile çağrıları tek promise üzerinde birleştirir. | `src/services/geminiService.ts` |

## Performans ve güvenilirlik bulguları P1–P30

| Kimlik | Retrospective sorun | Kalıcı çözüm / bugün korunacak kural | Başlıca kanıt |
|---|---|---|---|
| P1 | Kategori limit ilerlemesinde N+1 sorgu vardı. | Kategoriler bir kez alınır, Map ile eşlenir ve gerekli toplamlar toplu/uygun biçimde hesaplanır. | `src/hooks/useSavingsGoalData.ts` |
| P2 | `expenseDao` çalışma sırasında gereksiz dinamik import yapıyordu. | Statik import kullanılır. | `src/db/expenseDao.ts` |
| P3 | Fiş resmi tam çözünürlükte base64 gönderiliyordu. | Görsel Gemini öncesi en çok 1536 px ve JPEG %70 seviyesinde sıkıştırılır. | `src/utils/imageCompressor.ts`, `app/(tabs)/scanner.tsx` |
| P4 | Günlük harcama eşlemesi `raw.find()` ile O(n²) idi. | Gün anahtarlı Map ile O(1) lookup yapılır. | `src/hooks/useExpenses.ts` |
| P5 | Her `refreshKey` değişimi bildirim senkronunu ayrı tetikliyordu. | Ardışık yenilemeler 300 ms debounce ile birleştirilir. | `src/context/NotificationsContext.tsx` |
| P6 | Satıcı silme iki bağımsız SQL yazısıydı. | İlişkili yazılar tek transaction içinde atomik yürütülür. | `src/db/vendorDao.ts` |
| P7 | Context değerleri ve `t`/`tc` fonksiyonları her render'da kimlik değiştiriyordu. | Callback'ler `useCallback`, provider değerleri `useMemo` ile sabitlenir; sık değişen refresh state/action kanalları ayrılır. | `src/i18n/LanguageContext.tsx`, `src/context/CurrencyContext.tsx`, `src/context/RefreshContext.tsx` |
| P8 | BarChart her animasyon karesinde JS `setState` çalıştırıyordu. | Frame hesabı Reanimated `SharedValue` ve `useAnimatedProps` ile UI thread'e taşındı. | `src/components/BarChart.tsx` |
| P9 | İşlem bölümleri iç içe map ile eager render ediliyordu. | Tek akış FlatList, sayfalı DB hook'u ve referans-kararlı satır callback'leri kullanılır. | `src/hooks/useExpenses.ts`, `app/(tabs)/transactions.tsx` |
| P10 | Büyük `StyleSheet.create()` çağrıları her render'da tekrarlanıyordu. | Tema duyarlı stiller `useMemo(() => getStyles(), [scheme])` ile üretilir. | Analiz/işlemler ekranları ve ortak grafikler |
| P11 | Donut segment dizileri ve callback'leri inline üretildiğinden memo boşa düşüyordu. | Nesne/dizi/callback prop'ları parent'ta memoize edilir. | `app/(tabs)/analytics.tsx` |
| P12 | Light kartların koyu kalması ve tema değişiminde tam ekran flash vardı. | React tabanlı `themeStore` tek kaynak; uygulama teması native `Appearance.setColorScheme` ile değiştirilmez; DB tema okuması reveal öncesi ve latest-wins'tir. | `src/theme/themeStore.ts`, `src/theme/colors.ts`, `src/utils/themeSchedule.ts` |
| P13 | Seçim modunda `removeClippedSubviews` runtime toggle'ı Android satırlarını görünmez bırakıyordu. | Prop çalışma sırasında toggle edilmez; mevcut listede sabit `false`, pagination ve virtualization birlikte kullanılır. | `app/(tabs)/transactions.tsx` |
| P14 | Limit Sağlığı kartı limit başına ek sorgularla 11 roundtrip'e çıkabiliyordu. | Limit, kategori ve alt-kategori harcaması tek JOIN/GROUP sorgusunda hesaplanır. | `src/db/categoryLimitDao.ts` |
| P15 | Toast için her defasında native Modal açılması ve eski callback yarışı flicker üretiyordu. | Kalıcı React overlay host, generation/finished koruması ve modal-local host devamlılığı kullanılır; başarı toast'u tam ekranı karartmaz. | `src/components/SparkToast.tsx` ve modal kabukları |
| P16 | Dönem projeksiyonu tek büyük harcamalara aşırı duyarlıydı. | Sıfır günler dahil dense seri ve üst %20 trim ile kalan gün temposu hesaplanır; gerçek harcama değişmez, aykırı değer kullanıcıya açıklanır. | `src/utils/spendingProjection.ts`, `ProjectionCard.tsx` |
| P17 | `toISOString()` yerel takvim gününü UTC'ye kaydırabiliyordu. | Yerel `YYYY-MM-DD` üretimi `toLocalYmd` ile merkezileştirildi ve sınır günleri test edildi. | `src/utils/dateUtils.ts`, `src/utils/__tests__/dateUtils.test.ts` |
| P18 | `Colors` proxy uygulama store'u yerine eski native şemayı okuyabiliyordu. | Proxy önce `themeStore.getAppThemeSnapshot()` okur; `Appearance` yalnız güvenli ilk-yük fallback'idir. | `src/theme/colors.ts`, `src/theme/themeStore.ts` |
| P19 | Drag-to-multiselect başlarken RefreshControl unmount edilip listeyi başa sıçratıyordu. | RefreshControl bağlı kalır; drag sırasında `enabled`/scroll davranışıyla pasifleştirilir. | `app/(tabs)/transactions.tsx` |
| P20 | Soğuk açılışta native, koyu, açık ve yanlış-rotalı yüzeyler art arda görünüyordu. | Native splash + `BootSurface` aynı `#050505` yüzeyi kullanır; DB, tema, dil, para birimi, onboarding rotası ve layout hazır olunca iki frame sonrası tek fade yapılır. | `app/_layout.tsx`, provider'lar, `app.json` |
| P21 | Alt kategori açılımı analiz ScrollView'ını zıplatıyor ve Satıcılar kartını boşaltabiliyordu. | Alt kategoriler kategori kartında inline açılır; Satıcılar kartı kendi verisini korur. | Analiz orkestratörü/kartları |
| P22 | 120 Hz cihazlarda zorlanmış texture ve uzun giriş animasyonları siyah/boş kare riski yaratıyordu. | Android glow kapatıldı, giriş animasyonları kısaltıldı ve `renderToHardwareTextureAndroid` zorlaması kaldırıldı. | `AnimatedCard.tsx`, Dashboard ve Analiz ekranları |
| P23 | Analiz ekranı yaklaşık 4265 satırlık monolitti. | 16 kart `React.memo` bileşenine; stiller ve ortak tipler ayrı dosyalara taşındı. Orkestratör yalnız state/veri/dispatch sorumluluğunda kaldı. | `src/components/analytics/*`, `app/(tabs)/analytics.tsx` |
| P24 | İşlem listesinde güvenilir `getItemLayout` yoktu. | Kimliği sabit, mod-duyarlı ve runtime ölçümlü offset tablosu hem listeyi hem drag hit-testini besler. | `app/(tabs)/transactions.tsx` |
| P25 | Gemini kalem sayısı, başarısız model tekrarları ve kota/model uyumsuzlukları taramayı şişirip geciktiriyordu. | Kalem üst sınırı 500; başarısız modeller geçici cache; 400/403/404 model fallback'i; 429'da sıradaki model; stable flash önceliği; uzun JSON için 16384 token ve `thinkingBudget: 0`. | `src/services/geminiService.ts`, Gemini testleri |
| P26 | Varsayılan kategori ağacı her açılışta yaklaşık 108 sıralı sorgu çalıştırıyordu. | Tek SELECT ile Map oluşturulur; yalnız eksik/yanlış satırlar tek transaction'da yazılır; sağlıklı açılış 0 yazmadır. | `src/db/database.ts` |
| P27 | Borç entegrasyonu bütçe döngüsüne yeni toplam sorguları ekledi ve tek SQLite bağlantısında paralellik riski doğurdu. | Harcama, borç, ödeme, açık borç ve ek gelir toplamları seri okunur; nakit-akışı matematiği saf fonksiyonda hesaplanır. | `src/hooks/useBudget.ts`, `src/utils/debtMath.ts` |
| P28 | Temiz kurulumda seed transaction'ı ile onboarding SELECT'i aynı connection üzerinde yarışıp çökebiliyordu. | Seed, process-wide `getDatabase()` init promise'inin içine alındı; DB seed tamamlanmadan tüketicilere açılmaz. | `src/db/database.ts` |
| P29 | Fişin edit yolu kalemleri kaybediyor; header/items parçalı yazılıyor; kalem toplamı basılı toplamı yanlış ezebiliyordu. | Edit önce tam fişi kaydeder; header+items tek transaction; ingestion sırasında `syncExpenseTotal` çağrılmaz; kullanıcı kalemleri düzenlerse explicit edit yolu toplamı senkronlar. İndirim net/brüt semantiği düzeltildi ve scan iptali gerçek AbortSignal'a bağlandı. | `scanner.tsx`, `receiptParser.ts`, `add-expense.tsx`, `edit-items.tsx` |
| P30 | Projeksiyon takvim ayını bütçe döngüsü bütçesiyle kıyaslıyor ve borç/gelir etkisini atlıyordu. | Projeksiyon Dashboard ile aynı `periodStart/periodEnd`, `totalSpent` ve `effectiveBudget` tabanını kullanır; saf hesap testlidir. | `spendingProjection.ts`, Analiz `ProjectionCard`, `useBudget.ts` |

## Kalıcı mimari kararlar

Bu geçmişten çıkarılan, yeni katkılarda tekrar tartışılmadan önce okunması gereken kararlar:

1. [ADR-001 — Tema ve başlangıç yüzeyi sürekliliği](../decisions/ADR-001-theme-and-startup-continuity.md)
2. [ADR-002 — SQLite eşzamanlılık ve transaction sınırları](../decisions/ADR-002-sqlite-concurrency-and-transactions.md)
3. [ADR-003 — Finansal olaylar ve nakit-akışı modeli](../decisions/ADR-003-financial-cash-flow-domain.md)
4. [ADR-004 — Basılı fiş toplamı bütünlüğü](../decisions/ADR-004-receipt-total-integrity.md)
5. [ADR-005 — Üretilmiş locale kaynak zinciri](../decisions/ADR-005-generated-locale-sources.md)

## Bilinen belge boşlukları

- S10'un ilk ve güncel anlatımı farklıdır; mevcut config durumu yukarıda açıkça kaydedildi, özgün geçiş commit'i bilinmiyor.
- `_keyorder.json` mevcut olsa da bugünkü `compilePartial.mjs` ve `buildLocales.mjs` tarafından okunmuyor. Bu nedenle sıralamanın build tarafından zorlandığı varsayılmamalıdır; ADR-005 bunu bilinen boşluk olarak tutar.
- Gesture, splash, native modal, SQLite yaşam döngüsü ve APK davranışı için Jest tek başına fiziksel cihaz kanıtı değildir.
