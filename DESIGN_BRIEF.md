# S.P.A.R.K — Tasarım ve Teknik Rehber

| Alan | Değer |
|------|--------|
| **Belge amacı** | Tasarımcı, geliştirici ve yapay zekâ asistanlarının projeyi tek kaynaktan anlaması; performans, güvenlik ve tutarlı UX için yol haritası |
| **Uygulama adı** | **S.P.A.R.K.** (kişisel finans / harcama takibi) |
| **Son güncelleme** | Mayıs 2026 — **sürüm 2.3.0** (`app.json` / `package.json`); ilk açılış onboarding akışı §5.9, sürükle-çoklu-seçim + auto-scroll §5.10, Analiz modüler kart kataloğu §5.8, Ayarlar grup menüsü §5.7, performans P14–P22 (Limit Sağlığı N+1, toast flicker, projeksiyon outlier dirençi, dateUtils timezone fix, Colors proxy themeStore okuma, drag-select RefreshControl resetlemesi, splash overlay route registry, **Analiz alt kategori UX**, **120Hz scroll GPU optimizasyonu**) — §8.1; **Jest + GitHub Actions CI** §9; **Satıcı arama** §5.4; **Gizlilik politikası** §7.8 |
| **Platform** | React Native / Expo — iOS & Android |
| **Desteklenen diller** | **TR** (Türkçe — varsayılan), **EN** (İngilizce), **AZ** (Azərbaycan), **RU** (Русский) |

---

## 1. Ürün özeti

S.P.A.R.K, kullanıcıların **harcamalarını yerel olarak** kaydetmesini, **bütçe ve hedef** takibini yapmasını ve isteğe bağlı olarak **fiş/fatura görüntüsünü Google Gemini ile ayrıştırarak** hızlı giriş yapmasını sağlayan bir mobil uygulamadır.

**Temel değer önerileri**

- Çevrimdışı öncelikli: ana veri **cihaz içi SQLite**’dadır.
- Fiş tarama: kamera veya galeri → base64 → Gemini `generateContent` → yapılandırılmış fiş JSON’u → birleştirme ve kayıt.
- Analitik: kategori / satıcı / zaman dilimleri, grafikler, ısı haritası, davranışsal metrikler.
- Tasarım dili: koyu-açık tema, neon yeşil primary, cam kart hissi, **şüşevar** (bkz. §6.3) birincil CTA.

---

## 2. Teknoloji yığını

| Katman | Seçim | Not |
|--------|--------|-----|
| Çatı | **Expo SDK ~55**, **expo-router** (dosya tabanlı rota) | Giriş: `app/_layout.tsx`, sekmeler: `app/(tabs)/` |
| UI | React 19, React Native 0.83 | |
| Navigasyon | **`@react-navigation/material-top-tabs`** (altta render) + `pager-view` swipe | `app/(tabs)/_layout.tsx` — cam kart tab bar, `insets.bottom` ile jest çubuğu üstünde |
| Animasyon | **react-native-reanimated 4** (donut, kartlar, bottom-sheet), **react-native-gesture-handler** (Pan jesti), RN `Animated` / `LayoutAnimation` (analiz kartları — yol haritasında Reanimated’e taşınacak) | |
| Grafik | **react-native-svg** | Bar, donut, çizgi grafikleri, heatmap |
| Veri | **expo-sqlite** (`spark.db`), `PRAGMA journal_mode=WAL`, `foreign_keys=ON` | |
| Medya | **expo-image-picker**, **expo-file-system**, **expo-image-manipulator** | Fiş: 1536px, JPEG %70 sıkıştırma (`imageCompressor.ts`) |
| Yedek / geri yükleme | **expo-sharing** (sistem paylaş menüsü), **expo-document-picker** (JSON seçimi) | Tarih aralığı bazlı export/import — §5.3 |
| Bildirimler | **expo-notifications** + `src/services/androidNotificationsSetup.ts` | Android 13+ `POST_NOTIFICATIONS` izni, Expo Go Android’de push API yüklenmez (dinamik guard) |
| Yapay zekâ | **Google Generative Language API** (Gemini), dinamik model keşfi + in-flight dedup | Anahtar: OS keychain (`expo-secure-store`) — §7 |
| Güvenlik | **expo-secure-store** (API key), **expo-crypto** (SHA-256 hash) | API anahtarı OS anahtar zincirinde; `x-goog-api-key` HTTP header ile iletim |
| Yardımcı | maskeleme (`maskApiKey`), `secureKeyStore.ts` (migration) | SQLite → SecureStore tek seferlik otomatik taşıma |

### 2.1 Paket versiyon sabitleri (kaynak: `package.json`)

| Paket | Sürüm |
|-------|-------|
| `expo` | `~55.0.12` |
| `expo-router` | `~55.0.11` |
| `expo-sqlite` | `~55.0.14` |
| `expo-secure-store` | `~55.0.13` |
| `expo-notifications` | `~55.0.18` |
| `expo-camera` / `-image-picker` / `-image-manipulator` / `-file-system` | `~55.0.x` |
| `expo-sharing` | `~55.0.18` |
| `expo-document-picker` | `~55.0.13` |
| `react` | `19.2.0` |
| `react-native` | `0.83.4` |
| `react-native-reanimated` | `4.2.1` (+ babel plugin) |
| `react-native-gesture-handler` | `~2.30.0` |
| `react-native-safe-area-context` | `~5.6.2` |
| `react-native-svg` | `15.15.3` |
| `@react-navigation/material-top-tabs` | `^7.4.19` |
| `react-native-pager-view` | `8.0.0` |

Bir paket yükseltilince bu tablo ve ilgili davranış notları (özellikle Reanimated API’sı) §12 kurallarına göre güncellenmelidir.

---

## 3. Mimari genel bakış

```
app/                    # Ekranlar ve navigasyon (expo-router)
  _layout.tsx           # Kök Stack; SafeArea, LanguageProvider, CurrencyProvider, RefreshProvider,
                        # NotificationsProvider, ThemeScheduler, AndroidNotificationBootstrap
  (tabs)/               # Alt sekme (MaterialTopTab, altta): Dashboard, İşlemler, Tarayıcı, Analiz, Ayarlar
                        # `analytics.tsx` — modüler analiz kartları + sıra/görünürlük (`analytics_card_order`) §5.8
                        # `(tabs)/settings.tsx` artık sadece grup menüsü — detay §5.7
  add-expense.tsx       # Harcama ekle / düzenle
  edit-items.tsx        # Harcama kalemleri (ürün satırları, şüşevar CTA)
  categories.tsx, goal-settings.tsx, notifications.tsx, subscriptions.tsx,
  settings-general.tsx  # Ayarlar → Genel (dil, para birimi, tema)         §5.7
  settings-budget.tsx   # Ayarlar → Bütçe ve hedefler                      §5.7
  settings-data.tsx     # Ayarlar → Veri ve yedek (satıcılar, abonelikler) §5.7
  settings-ai.tsx       # Ayarlar → Yapay zekâ (Gemini API anahtarı)       §5.7

src/
  components/           # Ortak UI (AnimatedCard, DonutChart, SparkToast, LanguagePickerSheet, …)
  context/              # Currency, Refresh, Notifications, …
  db/                   # schema, database, DAO’lar (expense, category, vendor, goal, …)
  hooks/                # useExpenses, useBudget, useDatabase, useSavingsGoalData, …
  i18n/                 # LanguageContext, translations, locales/ (TR inline + EN/AZ/RU JSON + map-*.json)
  services/             # geminiService, secureKeyStore, receiptParser, receiptLineMerge,
                        # androidNotificationsSetup, goalFeatureSettings, pendingReceiptDraft, …
  notifications/        # buildNotifications, storage, types (feed + kural motoru)
  theme/                # colors (LightTheme/DarkTheme + Colors proxy), spacing, typography, susevar (şüşevar CTA)
  utils/                # tarih, para formatı, receiptJsonRepair, receiptLineDiscountUi,
                        # inputValidation, imageCompressor, themeSchedule, vendorPlaceholders, …
```

### 3.1 Navigasyon

Alt sekme **`createMaterialTopTabNavigator`** (`@react-navigation/material-top-tabs`) olarak kurulur ve **`tabBarPosition="bottom"`** ile altta render edilir (`app/(tabs)/_layout.tsx`). Swipe ile sekmeler arası geçiş aktiftir (`react-native-pager-view`). Tab bar cam kartlı, kenar boşluklu ve **`insets.bottom`** ile cihazın jest çubuğu üstünde kalır — her cihazda bir `insets.bottom + Spacing.xl` boşluk otomatik sağlanır.

### 3.2 Tipik fiş akışı

`scanner.tsx` → `imageCompressor.ts` (1536px, JPEG %70) → `geminiService.parseReceipt` → `receiptJsonRepair` + `cleanAndParseResponse` (+ `stripDangerousKeys`) → `receiptLineMerge.finalizeParsedReceipt` (satır indirimleri birleştirme) → `receiptParser.processReceipt` → SQLite (sanitize + `withTransactionAsync`).

### 3.3 Durum senkronizasyonu

`RefreshContext` ile liste/özet yenileme; fiş tarama sonrası `triggerRefresh`. `NotificationsContext` aynı `refreshKey`’i 300 ms debounce ile dinleyip kural motorunu çalıştırır.

---

## 4. Veri modeli (özet)

| Varlık | Açıklama |
|--------|-----------|
| `categories` | İki seviye ağaç (parent_id); ikon ve renk |
| `vendors` | Satıcı adı, opsiyonel logo, **`default_category_id`** (satıcı için kalıcı varsayılan kategori — yeni harcama ve fiş tarama otomatik doldurur) |
| `expenses` | Tutar, para birimi, tarih, satıcı/kategori FK, not, fiş URI |
| `expense_items` | Kalem adı, `turkish_name`, miktar, birim/toplam fiyat, `line_discount`, `list_line_total_before_discount` |
| `budgets` | Aylık tutar, aktif bayrak |
| `savings_goal` | Tek satır (id=1) hedef |
| `category_limits` | Ay bazlı limit |
| `subscriptions` | Tekrar eden ödeme tespiti (vendor_id, amount, period_days, next_expected_date, status: `active`/`dismissed`) — yerel detection sonuçları, kullanıcının "abonelik değil" tepkileri korunur |
| `settings` | Anahtar-değer (tema, dil, bildirim durumu, **`backup_last_*`**, **`backup_reminder_interval`**); `gemini_api_key` artık SQLite'da **değil**, OS keychain'de |

Yapay zekâ veya raporlama için: harcama toplamları çoğunlukla DAO sorguları ve `expense_items` üzerinden hesaplanır.

---

## 5. Ekranlar ve özellikler

| Bölüm | İçerik |
|--------|--------|
| **Dashboard** | Aylık toplam, **DonutChart** (kategori payları, seçim animasyonu), bütçe kartı, birikim hedefi, kategori limitleri, sık satıcılar |
| **İşlemler** | Zaman filtresi, işlem listesi |
| **Tarayıcı** | Kamera/galeri, Gemini fiş önizleme, kaydet / düzenle, **şüşevar** kayıt butonu — **satıcı için varsayılan kategori** atanmışsa Gemini'nin önerisi yerine o kullanılır (§5.4) |
| **Analiz** | Sürükle-bırak kart sırası, bar/donut, heatmap, satıcı donut + ürün lejantı (Dashboard ile uyumlu animasyon), mikro analiz |
| **Ayarlar** | **Grup menüsü** (Mayıs 2026 refactor — §5.7): ana sekme ekranı 4 grup kartı + About'tan ibaret. Her kart `slide_from_right` ile alt sayfayı açar. **Genel** (§5.7 — dil, para birimi, tema/auto-schedule), **Bütçe ve hedefler** (§5.7 — bütçe + geçmiş, hedef özellik anahtarı, kategoriler linki), **Veri ve yedek** (§5.7 — satıcı yönetimi §5.4, abonelikler linki §5.5, yedek al/geri yükle §5.3), **Yapay zekâ** (§5.7 — Gemini API anahtarı). Önceki tek-sayfa monolitik yapı kaldırıldı; tüm bilgi-modal'ları (`SettingsInfoHintModal`) ilgili alt sayfaya taşındı. |
| **Harcama / ürün** | `add-expense` (satıcı yazılınca varsayılan kategori otomatik dolar), `edit-items` (satır indirimi gösterimi, şüşevar) |
| **Abonelikler** | `app/subscriptions.tsx` — yerel veriden tespit edilen tekrar eden ödemeler, tahmini aylık toplam, "abonelik değil" gizleme — §5.5 |
| **Bildirimler** | `app/notifications.tsx` + `NotificationsContext` + `src/notifications/*` (feed, kural motoru, sessize alma türleri — yedek hatırlatması, abonelik yaklaşan ödeme, **aylık otomatik özet** dahil) |

### 5.1 Dil seçici (bottom-sheet)

`src/components/LanguagePickerSheet.tsx` — Modal üzerinde Reanimated kaydırma + Gesture Handler Pan jesti:

- **Açılış:** `withTiming(0, 300ms, Easing.out(cubic))` — yumuşak, yaylanmasız.
- **Kapanış:** arka plana dokunma, **tutamaçtan aşağı kaydırma** (≥96 px veya hız eşiği), radio seçimi ve Android geri — hepsi tek bir `closeWithAnimation` (cubic in) üzerinden.
- **Tema senkronu:** `useAppTheme()` (merkezî `themeStore`, §6.1.2) — OS + manuel `Appearance.setColorScheme()` her iki kanalı da yakalar; statik `Colors` proxy'sinin `StyleSheet` içinde donmasını önler.
- **Jest çubuğu:** `useSafeAreaInsets()` + ana ekrandan `hostBottomInset` prop’u; kart ile alt güvenlik alanı **tek sürekli yüzey** (`sheetShell`) — ara çizgi yok.
- **Erişilebilirlik:** her satır `accessibilityRole="radio"` + `accessibilityState.selected`.

### 5.3 Yedek al / geri yükle (Ayarlar → Backup & Restore)

**Amaç:** kullanıcının seçtiği tarih aralığındaki verileri taşınabilir tek bir JSON olarak dışa aktarmak ve aynı formatı başka bir cihazda (veya yeniden kurulumdan sonra) geri yüklemek. Görsel / fiş dosyaları kapsam dışıdır — yalnızca `receipt_uri` metaverisi korunur.

**Bileşenler:**

- `src/components/BackupSection.tsx` — preset kısayollar (**Bu ay**, **Geçen ay**, **Son 3 ay**, **Bu yıl**, **Özel**), `CustomDatePicker` ile iki tarih butonu (başlangıç / bitiş), **Export** (`susevar` tarzı primary) + **Restore** (outline) aksiyon çiftini barındırır; `useColorScheme()` + `useMemo(() => getStyles(), [scheme])` kalıbını uygular (§6.1 / §8.1 P10).
- `src/services/backupService.ts` — `buildBackupPayload`, `exportBackupToFile`, `pickAndParseBackupFile`, `importBackupPayload`, `pickAndImportBackup`. Geri yüklemenin tamamı `db.withTransactionAsync` içinde atomiktir.
- **Onay:** geri yükleme `ConfirmModal` (`tone="primary"`, `tray-arrow-down` ikonu, "Geri yükle" konfirmasyon butonu) ile kullanıcıdan açık onay alır. Yıkıcı semantik (`GlassDeleteModal` — kırmızı HUD + "Sİl" butonu) **kullanılmaz**: import veri **eklemektedir**, silmemektedir; aynı içerikli işlemler zaten `(date, total_amount, vendor_id, note)` dörtlü kontrolüyle atlanır. Export onayı da aynı şekilde `ConfirmModal` (`tray-arrow-up` ikonu) kullanır — modal seçimi semantik olarak yıkıcı/yapıcı eyleme göre yapılır, "her onay aynı modal" hatasına düşülmez. Başarı / hata durumları `SparkToast` ile sunulur.

**JSON formatı (`version: 2`):**

```json
{
  "version": 2,
  "app": "S.P.A.R.K.",
  "exportedAt": "ISO-8601",
  "range": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "data": {
    "expenses":   [{ "date", "total_amount", "currency", "note", "receipt_uri",
                     "vendor_name", "category_name",
                     "items": [{ "name", "turkish_name", "quantity", "unit_price",
                                 "total_price", "line_discount",
                                 "list_line_total_before_discount", "category_name" }] }],
    "categories": [{ "name", "icon", "color", "parent_name" }],
    "vendors":    [{ "name", "logo_uri", "default_category_name" }],
    "budgets":    [{ "monthly_amount", "currency", "start_date" }],
    "dismissed_subscriptions": [{ "vendor_name" }]
  }
}
```

**Sürüm geçmişi:** v1 → ilk sürüm; v2 → satıcı için varsayılan kategori (`vendors[*].default_category_name`) ve "abonelik değil" tepkilerinin (`dismissed_subscriptions`) taşınması eklendi. v1 yedekleri yeni uygulamada hâlâ açılır; v2 yedekler eski uygulamaya yüklenirse `UNSUPPORTED_VERSION` ile reddedilir.

**İmport kuralları (idempotent & güvenli):**

1. **Kategoriler:** kökler önce, çocuklar sonra işlenir. `(name, parent_id)` mevcutsa eşlenir; değilse `is_system = 0` ile oluşturulur.
2. **Satıcılar:** `findOrCreate` stratejisi (`name` lower-case). Logo URI varsa kopyalanır. **v2:** `default_category_name` belirtilmişse, mevcut DB'deki o satırın `default_category_id` boşsa `COALESCE(default_category_id, ?)` ile yazılır — kullanıcının elle değiştirdiği değer ezilmez.
3. **Harcamalar:** `(date, total_amount, vendor_id, note)` dörtlüsü mevcutsa **atlanır** (summary.expensesSkipped artar); aksi halde eklenir. Kalemler ilgili `expense_id` altına taşınır.
4. **Bütçeler:** aynı `start_date` için aktif kayıt varsa dokunulmaz; yoksa eklenir.
5. **v2 — Dismissed abonelikler:** `subscriptions` tablosuna `status='dismissed'` ile yazılır (mevcut kayıt varsa status'a güncellenir). Aktif abonelikler import sonrası `syncSubscriptions()` ile yeniden tespit edilir.
6. Tüm girdiler `inputValidation.ts` (sanitize + `stripDangerousKeys`) üzerinden geçirilir (§7.7).
7. **Atomiklik:** `withTransactionAsync` — ilk hata tüm değişiklikleri geri alır, kısmi import yoktur.

**Export akışı:** `buildBackupPayload` → `JSON.stringify` → `expo-file-system`’in `new File(Paths.cache, ...)` + `file.write(...)` API’si. **Android:** `StorageAccessFramework` ile kullanıcıya klasör seçtirip dosyayı doğrudan kaydeder; iptal edilirse `Sharing.shareAsync` fallback. **iOS:** her zaman paylaş ekranı. Dosya adı: `spark-backup_<start>_<end>.json`.

**Son yedek bilgisi & hatırlatıcı:** Başarılı her dışa aktarımda `recordBackupSuccess()` ile `settings` tablosuna `backup_last_at`, `backup_last_count`, `backup_last_item_count`, `backup_last_range_start/end` yazılır. `BackupSection` üst kısmında **"Son yedek: 22 Nis 2026 14:30 · 87 işlem · 412 kalem"** kartı gösterilir. Hatırlatıcı seçenekleri: **Kapalı / Haftalık / Aylık** (`backup_reminder_interval`). `runNotificationSync` her tetiklendiğinde `isBackupOverdue()` kontrol eder ve `notif_backup_due_*` üretir; aynı interval içinde tekrar göndermez (`rules.backupRemindedAt`).

**Versiyonlama:** `BACKUP_FORMAT_VERSION = 2`; import, `payload.version > BACKUP_FORMAT_VERSION` olduğunda `UNSUPPORTED_VERSION` fırlatır → kullanıcıya "uygulamayı güncelleyin" uyarısı.

**Konfigürasyon:** `expo-sharing` plugin’i `app.json → plugins` içinde; `expo-document-picker` native ayar gerektirmez. Her iki paket de `~55.0.x` (§2.1 tablosu).

### 5.4 Satıcı için varsayılan kategori

**Amaç:** kullanıcının belirli bir satıcı için (örn. Migros, Netflix, Spotify) kalıcı bir kategori belirleyebilmesi. Sonraki harcamalarda — manuel girişte ve fiş taramada — Gemini önerisi yerine bu kategori otomatik kullanılır.

**Veri yolu:**

- Şema: `vendors.default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL`. Kategori silinirse referans otomatik temizlenir.
- DAO: `VendorDao.setDefaultCategory(id, categoryId | null)`, `findOrCreate(name, { defaultCategoryId })`.
- **Otomatik öğrenme:** `add-expense` üzerinden ilk kez oluşturulan satıcılar, kullanıcının seçtiği kategoriyi default olarak alır. Sonraki seansta aynı satıcıyı yazınca alt rozet görünür: **"Bu satıcı için varsayılan: Market"**.
- **Fiş tarama (`receiptParser.ts`):** `processReceipt` ve `getPrefillFromParsedReceipt` önce `VendorDao.findByName(vendor)` çağırır; `default_category_id` varsa Gemini'nin per-item `suggested_category` çoğunluğunu kullanmaz, doğrudan kullanıcı tercihini uygular.

**UI:**

- Settings → Satıcı Yönetimi → tile **dokunma** artık doğrudan logo seçici yerine **`VendorOptionsSheet`** açar: "Logo değiştir", "Varsayılan kategori belirle" (alt başlıkta mevcut seçim), "Satıcıyı sil" (kırmızı, en altta).
- Tile sol-altta küçük yeşil rozet (`auto-fix` ikonu): bu satıcı için varsayılan kategori atanmış göstergesi.
- Long-press hâlâ doğrudan silme onay modalını açar (mevcut kullanıcıların kas hafızası korunur).
- `add-expense` ekranında satıcı yazıldıktan ~250 ms sonra varsayılan kategori varsa kategori chip'i otomatik seçilir; küçük "auto-fix" rozeti kullanıcıya bilgilendirme yapar. Kullanıcı manuel olarak başka kategori seçerse override etmeyiz.

**Satıcı arama (Mayıs 2026):** `settings-data.tsx` Satıcı Yönetimi kartında satıcı sayısı ≥ 6 ise kartın üstünde arama çubuğu (`magnify` ikonu + `TextInput`) belirir. Arama durumu `vendorSearch` state'inde; `filteredVendors = useMemo(...)` ile anlık filtreleme. 0 sonuç durumunda `vendor_no_results` i18n boş durumu. Arama çubuğu 5 veya daha az satıcıda gizli — yeni kullanıcıda arayüz kirletilmez. i18n: `vendor_search_placeholder`, `vendor_no_results` (TR/EN/AZ/RU). Dosya: `app/settings-data.tsx`.

### 5.5 Abonelikler / tekrar eden ödeme tespiti

**Amaç:** kullanıcı tarafından yapay zekâ ile değil, **yerel SQLite** verisi üzerinde çalışan istatistiksel bir motor ile düzenli ödemelerin (Netflix, Spotify, fitness, kira, internet vb.) otomatik tespiti; tahmini aylık eşdeğerin gösterilmesi; yaklaşan ödeme bildirimi.

**Algoritma (`src/services/subscriptionDetector.ts`):**

- Lookback penceresi: son **220 gün**.
- Her satıcı için son N harcama tarihe göre dizilir; ardışık aralıklar gün cinsinden hesaplanır.
- Bilinen periyot bantları: **haftalık 6–8**, **aylık 27–33**, **iki aylık 56–64**, **üç aylık 85–95**, **yıllık 350–380**.
- Sondan geriye doğru en uzun aynı banda düşen ardışık zincir bulunur. **En az 3 ödeme** ve tüm aralıkların aynı bantta olması gerekir.
- Tutarlar arasında **maks. %15 sapma** toleransı; bu eşiği aşan zincir elenir.
- Geçen kayıtlar `subscriptions` tablosuna `upsert` edilir; **dismissed** statüsü her zaman korunur (kullanıcı tekrar uyarılmaz).
- `next_expected_date = last_seen_date + period.centerDays`.

**Veri modeli:** `subscriptions(vendor_id UNIQUE, amount, currency, period_days, last_seen_date, next_expected_date, occurrences, status, updated_at)`.

**Ekran (`app/subscriptions.tsx`):** üstte **tahmini aylık toplam** (haftalık/yıllık aboneliklerin aylık eşdeğerleri toplanır), altta liste (vendor logosu yerine kategori rozeti, periyot etiketi, **kalan gün**, "abonelik değil" gizleme aksiyonu). Gizlenmiş kayıtlar collapsable bölümde "Tekrar göster" aksiyonuyla geri alınabilir.

**Bildirim:** `next_expected_date` 0–3 gün arasında olan aktif abonelikler için `notif_sub_due_t/_b` üretilir. Aynı tarih için satıcı başına bir kez (`rules.subscriptionDueLast`).

**Sessize alma:** yeni `subscription` mute kanalı bildirim merkezindeki seçenekler arasına eklendi.

### 5.6 Aylık otomatik özet bildirimi

**Amaç:** Her ayın ilk haftasında bir defaya mahsus, kullanıcının önceki ay performansını özetleyen bir bildirim göstermek.

**Tetikleme:** `runNotificationSync` her çalıştığında `dayOfMonth <= 7` ise önceki ay anahtarı (`YYYY-MM`) `rules.monthSummary` içinde işaretli değilse:

1. `ExpenseDao.getTotalByDateRange` → önceki ayın toplam harcaması.
2. `BudgetDao.getForMonth(prevYm)` → önceki ayın aktif bütçesi (yoksa en son aktif bütçe fallback).
3. `ExpenseDao.getCategorySpending` → en yüksek harcanan kategori ve payı.

Bütçe varsa `notif_month_summary_b`, yoksa `notif_month_summary_no_budget_b` template'i kullanılır. Bildirim aylık bütçe kanalında (`mute: budget`) sessize alınır — özet de finansal bir "bütçe kapanışı" olduğu için aynı kanal seçildi.

**State:** `RulesState.monthSummary: Record<YYYY-MM, boolean>`. Aynı ay için tekrar gönderim yapılmaz.

### 5.2 Bildirim merkezi

- **Feed:** `src/notifications/storage.ts`, kalıcı JSON (ayarlar tablosunda), `MAX_FEED = 40`.
- **Kurallar:** bütçe %80/%100/aşım, kategori limiti yaklaşma/aşım, hedef riski, fiş taslağı bekliyor, API key yok, tarama/ağ hatası, yeni ay bütçe yok, **yedek hatırlatması** (§5.3), **abonelik yaklaşan ödemesi** (§5.5), **aylık otomatik özet** (§5.6).
- **Sessize alma:** tür bazlı — `budget`, `category_limit`, `goal`, `receipt`, **`subscription`**, **`backup`**, `system`.
- **Android kurulumu:** `ensureAndroidNotificationSetup()` (kanal + `POST_NOTIFICATIONS` izni). **Expo Go Android** üzerinde `expo-notifications` push API’si yüklenmez; kod `isRunningInExpoGo()` guard’ı ile dinamik import kullanır.

### 5.7 Ayarlar grup menüsü (Mayıs 2026 refactor)

**Sebep:** tek-sayfa monolitik Ayarlar ekranı 1124 satıra ulaşmış, 9 heterojen bölüm (bütçe, API key, dil, para, tema, satıcılar, hedef toggle + kategoriler + abonelikler, yedek, hakkında) tek scroll'da listeleniyordu. iOS-tarzı gruplandırılmış navigasyon ile sadeleştirildi; ana sekme artık ~210 satırlık bir grup menüsü.

**Yapı:**

```
app/(tabs)/settings.tsx        # Sadece grup kartları + About
  ├─ /settings-general         # Dil, para birimi, tema (auto-schedule + manuel)
  ├─ /settings-budget          # Bütçe + geçmiş, hedef özellik anahtarı, kategoriler linki
  ├─ /settings-data            # Satıcı yönetimi (§5.4), abonelikler linki (§5.5), yedek (§5.3)
  └─ /settings-ai              # Gemini API anahtarı
```

**Navigasyon:** her alt sayfa `app/_layout.tsx` Stack'ine `presentation: 'card'` + `animation: 'slide_from_right'` ile eklenir (mevcut `notifications` / `subscriptions` ekranlarıyla aynı kalıp). Geri butonu yuvarlak `surfaceLight` zeminli (`width/height: 40`); başlık `Typography.headlineMedium` + `extraBold` ailesinde.

**Ana grup kartı kalıbı:**

- Solda **renkli ikon kutusu** (`width/height: 48`, `BorderRadius.lg`, arka plan `<rengin>+'22'` veya `Colors.primaryGlow`).
- Ortada başlık (`bodyLarge` + `bold`) + tek satır açıklama (`bodySmall` + `textSecondary`).
- Sağda `chevron-right`.
- Stagger giriş: `FadeInDown.delay(80 + i * 70).duration(420)`.
- Tema kalıbı: `useAppTheme()` + `useMemo(() => getStyles(), [scheme])` (§6.1.2 — P12 zorunluluğu).

**Grup → renk eşlemesi:**

| Grup | İkon | Renk | İkon BG |
|------|------|------|---------|
| Genel | `tune-variant` | `Colors.primary` | `Colors.primaryGlow` |
| Bütçe ve hedefler | `wallet-outline` | `Colors.chartOrange` | `chartOrange + '22'` |
| Veri ve yedek | `database-outline` | `Colors.chartGreen` | `chartGreen + '22'` |
| Yapay zekâ | `robot-outline` | `Colors.chartPurple` | `chartPurple + '22'` |

**i18n:** anahtarlar `settings_group_<key>` ve `settings_group_<key>_desc` (4 dil: TR/EN/AZ/RU). Geri butonu için `settings_back`.

**Çapraz referanslar (eski path → yeni):** `scanner.tsx` — API anahtarı eksik akışında `router.push('/settings')` yerine **doğrudan `/settings-ai`** çağrılır (kullanıcı bir tık daha derine inmek zorunda kalmasın).

**Yeni Ayarlar bölümü ekleme kuralı:**

1. İçerik mevcut 4 grupta makul yere düşüyorsa orada konumlandır (yeni alt sayfa açma).
2. Yeni grup gerekiyorsa: yeni `app/settings-<key>.tsx` dosyası, Stack.Screen kaydı, `settings_group_<key>` + `..._desc` i18n anahtarı (4 dil), ana settings'teki `groups[]` array'ine bir kayıt.
3. Bilgi-modal'ları (`SettingsInfoHintModal`) ait olduğu alt sayfada tanımlanmalıdır; ana grup menüsüne eklenmemelidir.
4. Modal seçimi semantik: yıkıcı aksiyon (sil) → `GlassDeleteModal`; yapıcı/nötr onay (kaydet, içe aktar, dışa aktar, dil değiştir) → `ConfirmModal` (`tone="primary"`). Bu kurala §5.3 import onayında uyulmamış olduğu Mayıs 2026'da düzeltildi.

### 5.8 Analiz kartları sistemi (Mayıs 2026 — v2.2)

Tüm Analiz ekranı tek bir `analytics.tsx` içinde **modüler kart kataloğu** olarak organize edilir. Kartlar kullanıcı tarafından eklenebilir/kaldırılabilir/sıralanabilir; düzen `settings.analytics_card_order` anahtarında JSON olarak saklanır.

**Katalog (`ALL_CARDS`):**

| id | Kart | İkon | Cam? | Veri kaynağı |
|---|---|---|---|---|
| `chart` | Günlük/yıllık çubuk grafik | `chart-bar` | ✓ | `useDailySpending` / `getYearlyTotals` |
| `projection` | Ay sonu projeksiyonu | `crystal-ball` | ✓ | `currentTotal` + `useBudget` |
| `monthly_compare` | Dönem karşılaştırması | `swap-horizontal` | — | `loadPrevTotal()` |
| `budget` | Bütçe durumu | `wallet-outline` | ✓ | `useBudget` |
| `goal` | Birikim hedefi | `flag-checkered` | ✓ | `GoalDao.get()` |
| `limits_health` | Kategori limit sağlığı | `gauge` | — | `CategoryLimitDao` + kategori harcaması |
| `subscriptions` | Aktif abonelikler özeti | `sync-circle` | — | `SubscriptionDao.getActive()` |
| `silent_spend` | Sessiz harcamalar | `water-outline` | — | `ExpenseDao.getSilentSpendItems()` |
| `categories` | Yatay kategori chip'leri + **inline alt kategori bölümü** (P21) | `shape-outline` | — | `useCategorySpending` |
| `time_of_day` | 7×4 saat dilimi heatmap | `clock-time-eight-outline` | — | `ExpenseDao.getTimeOfDayMatrix()` |
| `streak` | Harcama istatistikleri | `fire` | — | `streakData` (dailyData + budget) |
| `donut` | Davranışsal donut (needs/wants + week/weekend) | `chart-donut` | ✓ | `useBehavioralAnalytics` |
| `heatmap` | Aylık takvim heatmap | `calendar-month` | — | `dailyData` |
| `top_tx` | En yüksek 8 işlem | `podium-gold` | — | `useTopTransactions` |
| `price_watch` | Ürün bazlı fiyat değişimleri | `tag-arrow-up` | — | `ExpenseDao.getPriceHistory()` |
| `vendors` | Satıcılar / alt-kategoriler | `store-outline` | — | `useVendorSpending` |

**Tasarım kalıbı (her kart):**

- `<AnimatedCard delay={N} style={styles.section[, primaryCard]}>`
- Kompakt header: ikon kapsülü (`28×28`, `BorderRadius round`, accent rengi `+ '1F'` arka plan) + UPPERCASE `sectionTitle` + sağ rozet (`days`, `count`, `peak` vb.).
- Hero rakam (varsa): `36px / bold / -0.5 letter-spacing`, `numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}`.
- Görsel öğe (track / donut / liste / grid).
- Outcome paneli (varsa): tam genişlik 2-satır blok (icon + title + sub) — yüzde değil **somut tutar**.
- Boş durumlar: 36px outline ikon + `*EmptyTitle` + `*EmptyHint`.

**Renk semantik:**

- Safe / başarılı → `Colors.success`
- Yaklaşıyor → `Colors.warning`
- Aşıldı / gecikmiş → `Colors.danger`
- No-budget / nötr / abonelik özeti → `Colors.primary` veya `Colors.info`
- Sessiz harcama → `Colors.warning`

**Veri yükleme:**

- Her kartın bir `loadX()` async fonksiyonu (`onRefresh` ve `runAnalyticsRefresh` ikisinde de çağrılır) **veya** mevcut `useExpenses` hook'u.
- Türetilmiş özetler `useMemo` ile (`projectionInfo`, `subscriptionInfo`, `limitsHealthInfo`, `goalInfo`, `timeOfDayInfo`, `silentSpendInfo`).

**Yeni kart ekleme adımları:**

1. Veri katmanı: ya yeni DAO metodu (`ExpenseDao.*`) ya `loadXxx()` async + `useState`.
2. `useMemo` ile özet → `{ available: false } | { available: true, ...stats }` patern'i.
3. `ALL_CARDS` listesine `{ id, icon, labelKey: 'card_<id>' }` kaydı.
4. Varsayılan açık olacaksa `DEFAULT_ACTIVE` array'ine ekle.
5. `renderCard` içinde yeni `if (id === '<id>')` bloğu — boş durum + dolu durum.
6. Stil bloğu: `// ── A<n>: <Name> ──` yorumu altında küçük ön ekli (`projX`, `subsX`, `goalX`...) keylerle.
7. i18n: `card_<id>` etiketi + alanlar; **TR + EN** `translations.ts` inline, **AZ + RU** `locales/*.json`. Çakışan generic anahtardan kaçın → `<feature>_card_*` öneki tercih edilir (mevcut `subscriptions_*` çakışması bu nedenle `subs_card_*` olarak ayrıldı).

**Migration kuralı (`loadCardConfig`):**

Kayıtlı `active+hidden` setine **`ALL_CARDS`'da olup ikisinde de bulunmayan** her kart eklenir; `DEFAULT_ACTIVE`'daysa aktife sondan, değilse gizliye. Sonuç DB'ye geri yazılır → kullanıcı eski sürümden geldikten sonra yeni kartlar otomatik görünür. Geçersiz/eski ID'ler de filtrelenir.

**`time_of_day` özel notu:** SQLite `expenses.date` saat tutmadığından, kart `created_at`'i `strftime('%w'/%H', ..., 'localtime')` ile gruplar. Kart altında **disclaimer** zorunlu (`timeofday_disclaimer` — "Harcamanın kayıt anına göre"); aksi halde kullanıcı bunu gerçek harcama saati sanır.

**`silent_spend` özel notu:** Filtre: `purchase_count ≥ 3` ve `avg_price ≤ 30`. JS'te `normalizeItemKey` ile gruplama (SQL `LOWER()` Türkçe/Lehçe karakterleri bozar). Satıra tıklayınca mevcut `ItemAnalyticsModal` açılır.

**`projection` özel notu:** Sadece `timeframe === 'month'` modunda anlamlı; diğer timeframe'lerde `projection_only_month` boş durumu. `dayOfMonth < 2` ise `projection_too_early`. Outcome metni daima **mutlak tutar** (`formatCurrency` / görüntüleme para birimi); yüzdeyle özetlenmez.

### 5.9 Onboarding akışı (Mayıs 2026 — v2.3)

İlk açılış deneyimi 4 ekranlı yatay pager ile yönetilir (`app/onboarding.tsx`):

1. **Karşılama:** büyük logo, tek cümle değer önerisi, 3 mini özellik etiketi ve şüşevar "Başlayalım".
2. **Dil:** TR / EN / AZ / RU büyük kartlar; sistem dili varsayılan seçilir, kullanıcı anında değiştirebilir.
3. **Bütçe (opsiyonel):** aylık tutar alanı + görüntüleme para birimi seçici; "Sonra ekleyeyim" ile atlanabilir.
4. **Bitti:** check animasyonu, "İlk fişini tara" (`/(tabs)/scanner`) ve "Önce keşfedeyim" (`/(tabs)`).

**Flag ve yönlendirme sözleşmesi**

- Kalıcılık anahtarı: `settings.onboarding_completed` (`'1'` tamamlandı, yoksa göster).
- Okuma/yazma: `src/hooks/useOnboardingStatus.ts`.
- Başlangıç guard'ı: `app/_layout.tsx` — `useDatabase().isReady` + onboarding flag yüklendikten sonra tek sefer route kararı verilir; tamamlanmamışsa `router.replace('/onboarding')` ile geri stack kirlenmeden onboarding açılır.
- `Skip`, "Bitti" CTA’ları aynı flag'i set eder; onboarding yalnız bir kez görünür.

**UX kuralları**

- Skip daima görünür; kullanıcı hiçbir adımda zorlanmaz.
- Kamera izni onboarding'de istenmez; yalnız tarama CTA’sında (scanner akışı) neden açıklamasıyla istenir.

### 5.10 İşlemler — sürükle-çoklu-seçim + otomatik kaydırma (v2.3)

`app/(tabs)/transactions.tsx` toplu seçim deneyimi Word/Apple Notes tarzı **drag-to-multiselect**'i destekler:

- **Tetikleyici:** Bir satıra long-press → seçim modu açılır + ilk satır seçilir + `dragSelectingRef.current = true`.
- **Sürükleme:** Parmak basılı tutulup hareket ettikçe altındaki her satır seçim setine **eklemeli** olarak alınır (kazara silmeyi engellemek için geri alma yok).
- **Auto-scroll:** Parmak ekranın üst veya alt 90px kenar bandında ise `setInterval(16ms)` ile `scrollToOffset` çağrılır (~14 px/tick ≈ 50 satır/sn).
- **Haptik:** Her yeni seçimde `Haptics.selectionAsync()`.

**Teknik notlar (önemli regresyon kaynakları):**

1. **PanResponder capture:** `TransactionRow` zaten `Pressable` olduğu için touch event'leri yutar; PanResponder'ın `onMoveShouldSetPanResponderCapture` ile **capture fazında** intercept etmesi şarttır, normal bubble fazı yetmez.
2. **`scrollEnabled={!dragSelecting}`:** Drag aktifken FlatList kullanıcı scroll'unu kapatır; auto-scroll programatik `scrollToOffset` ile yürür.
3. **`RefreshControl`:** Drag aktifken `refreshControl` prop'unu **`undefined`'a düşürmeyin** — bu FlatList'in iç scroll yapısını sıfırlar ve liste en üste sıçrar. Doğru yöntem: kontrol her zaman bağlı, `enabled={!dragSelecting}` ile kapatılır (Android-only prop, iOS sessizce yutar).
4. **Pixel-perfect satır tespiti:** Sabit yükseklik tahmini (header 32 / row 72) yeterli değil — gerçek cihazda off-by-one'a yol açıyor. İlk render'da `onLayout` ile `measuredRef = { header, row, headerLocked, rowLocked }` doldurulur; `findExpenseIdAtListY()` cumulative scan ile bu değerleri kullanır.
5. `rowsRef.current = rows` her render güncellenir — PanResponder closure stale veriye gitmez.

**State + ref'ler:** `dragSelecting` (state, FlatList prop'ları için) + `dragSelectingRef` (ref, PanResponder closure için), `flatListRef`, `wrapperRef` (PanResponder mount + `measure` ile pageY için), `scrollOffsetRef`, `listLayoutRef`, `lastTouchedIdRef`, `autoScrollDir`.

Yeni satır tipleri eklenirse (`{ kind: 'row' | 'header' | ... }`) `findExpenseIdAtListY` cumulative scan'ine yükseklik kaydı eklenmelidir.
- Tasarım dili: şüşevar CTA + cam kart + Reanimated geçişler + tema mağazası (`useAppTheme` + `useMemo(getStyles, [scheme])`).

---

## 6. Tasarım sistemi

### 6.1 Renk ve tipografi

- Token’lar: `src/theme/colors.ts`, `spacing.ts`, `typography.ts`.
- `colors.ts` **iki tam palet** (`LightTheme`, `DarkTheme`) + **`Colors` proxy** export eder. Proxy, çağrıldığı anda `getEffectiveColorScheme()` çözümünü yapar; bu nedenle modül yüklenirken bir kez değerlendirilen `StyleSheet.create({ color: Colors.x })` kalıbı **tema değişiminde güncellenmez**. Tema duyarlı olan her component `scheme = useAppTheme()` + `useMemo(() => getStyles(), [scheme])` kalıbını uygulamak **zorundadır** (§6.1.2).
- Koyu tema: `background` ~ `#050505`, **primary** neon yeşil (`#00FF66`); açık tema: daha yumuşak yeşil ve açık yüzeyler.
- Font ailesi: **Inter** (ağırlıklar 400–800); stil isimleri `Typography.*` ile tutarlı.

### 6.1.1 Tema zamanlayıcı (`ThemeScheduler`)

- `src/components/ThemeScheduler.tsx` kökte mount edilir; **60 s aralıkta** `src/utils/themeSchedule.ts` üzerinden DB’deki tema ayarlarını okur ve `Appearance.setColorScheme()` ile uygular.
- `loadThemeSettings` / `setAutoThemeSchedule` / `setManualTheme` ayarlar ekranı tarafından kullanılır; **otomatik tema** gün doğumu/batımı (veya kullanıcı saatleri) bazında geçiş yapar.
- `AutoThemeScheduleToggle` ve `ThemeScheduler` bileşenleri tüm tema tercih UI’sını yönetir.
- **İlk açılış senkronu:** `useDatabase` hook'u `isReady=true` vermeden **önce** `applyThemeFromDatabase()`'i `await` eder. Böylece ilk render zaten doğru temayla yapılır ve Dashboard'ta (aydınlık modda) kartların bir an siyah görünüp sonradan düzelmesi ("flash of dark") olayı yaşanmaz.

### 6.1.2 Merkezi tema mağazası (`src/theme/themeStore.ts`) — **single source of truth**

#### Sebep-sonuç zinciri (çözülen regresyon, P12)

Aydınlık modda bazı kartlar (Dashboard "Quick Stats", `BudgetCard`, Analiz "Bütçe Durumu" vb.) **siyah** görünüyor, kullanıcı sekme değiştirip geri dönünce düzeliyordu. Sebep zinciri:

1. Uygulama açılır → `ThemeScheduler` mount olur → `applyThemeFromDatabase()` **async** tetiklenir (SQLite okuması).
2. DB cevabı gelene kadar `Appearance.getColorScheme()` **OS değerini** (çoğu Android cihazda `dark`) döndürür.
3. İlk render sırasında `Colors` proxy dark değerini çözer → `StyleSheet.create({ backgroundColor: Colors.cardSurface })` karanlık `#1C1C1E`'yi hash'leyerek donar.
4. DB okunur → `Appearance.setColorScheme('light')` çağrılır. **Bilinen RN quirk'i:** Android/Expo Go üzerinde programatik `setColorScheme` çağrıları `Appearance.addChangeListener`'ı her zaman tetiklemez → `useColorScheme()` güncellenmez → component re-render **almaz**.
5. Sekme değişip geri dönülünce `useFocusEffect` yeni bir render zinciri başlatır, `Colors` proxy bu kez `light` çözüp kart beyazlaşır → kullanıcı "bir süre sonra düzeldi" olarak algılar.
6. Ekstra tetikleyici (Dashboard): `statsCard.backgroundColor = Colors.cardSurface` override'ı `AnimatedCard`'ın iç `StyleSheet`'indeki değeri **iki kez** donduruyordu; tek kanal olsa bile kaçış daha zorlaşıyordu.

#### Çözüm mimarisi

`themeStore` `useSyncExternalStore` tabanlı iki kanallı bir external store'dur:

1. **OS kanalı** — `Appearance.addChangeListener`: sistem teması ya da `Appearance.setColorScheme` OS tarafından normal çalıştığında dinler.
2. **Manuel kanal** — `notifyThemeChanged()`: `applyThemeFromDatabase` **her** `Appearance.setColorScheme(...)` çağrısından hemen sonra bunu tetikler. Store yeni `getEffectiveColorScheme()` sonucunu alır, listener'lara imza atar, tüm `useAppTheme()` aboneleri senkron re-render olur.

Böylece iki kanal birbirini tamamlar: OS kanalı `Appearance.addChangeListener`'ı tetikleyemese bile manuel kanal devreye girer. Hiçbir ekranda "stale scheme" olmaz.

#### Zorunlu kullanım kalıbı

```tsx
import { useAppTheme } from '../theme/themeStore';

export default function MyCard() {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  // …
}

const getStyles = () => StyleSheet.create({
  card: { backgroundColor: Colors.cardSurface }, // Proxy render anında çözer
});
```

- `Colors` proxy `StyleSheet.create()` çağrıldığında **o anki** şemayı döner; `useMemo` deps'inde `scheme` olduğu için şema değişince `StyleSheet` fresh üretilir.
- `useColorScheme()` **sadece** üçüncü-parti kütüphanelere zorunlu olduğunda kullanılır. Yeni kodda varsayılan `useAppTheme()`'dir.

#### Bağımlı sözleşmeler

- `src/utils/themeSchedule.ts` — `applyThemeFromDatabase()` içinde `Appearance.setColorScheme(...)`'dan sonra `notifyThemeChanged()` çağrılır. `setManualTheme` ve `setAutoThemeSchedule` bu fonksiyonu dolaylı tetiklediği için güvenlidir. `Appearance.setColorScheme` çağıran **yeni bir yol** eklenirse (örn. hızlı eylemler, quick tile), aynı satırdan sonra `notifyThemeChanged()` çağrılmak zorundadır.
- `src/hooks/useDatabase.ts` — `initializeDatabase()` sonrasında `await applyThemeFromDatabase()` **önce** çalışır, ancak sonra `setIsReady(true)` gelir. Böylece `RootLayout` ilk kez Stack'i monte ettiğinde `Appearance` zaten doğru şemaya ayarlanmış olur ve "flash of dark" yaşanmaz.
- `app/_layout.tsx` — `Stack` **`isReady=true` kapısının arkasında** mount edilmek zorundadır (`if (!isReady) return <Splash/>`). Stack'i her zaman mount edip splash'i overlay yapmak P12 regresyonunu geri getirir: `(tabs)` ekranı `applyThemeFromDatabase()` tamamlanmadan doğar, kartlar OS şemasıyla `StyleSheet`'lerini donduruyor ve aydınlık modda siyah görünüyor. Onboarding yönlendirmesi zaten `useEffect` içinde `isReady=true && !onboardingLoading` koşuluna bağlı olduğu için Stack mount edildikten sonra `router.replace('/onboarding')` güvenle çalışır — Stack'i erken mount etmenin route registration için gerekli olduğu varsayımı **yanlıştır**.

### 6.2 Bileşenler (seçme)

AnimatedCard, BudgetCard, SpendingHeatmap, BarChart, DonutChart, LineChart, CustomDatePicker, GlassDeleteModal, SparkToast, VendorAvatar, CategoryPill, ErrorBoundary, …

### 6.3 Birincil CTA — “Şüşevar” (`src/theme/susevar.ts`)

- **Ürün adı:** şüşevar · **Kod adı:** `susevar` (`susevarButton`, `susevarButtonText`, …).
- Ana kayıt eylemi: yeşil dolgu, pill, beyaz kalın **uppercase** metin, hafif beyaz border ve gölge; basılıda opaklık düşüşü.
- Tehlike aksiyonları (sil, sıfırla) şüşevar ile karıştırılmamalı.
- Tam metin tanımı yapay zekâ aktarımı için `SUSEVAR_PROMPT_TR` sabitinde.

### 6.4 Tasarım ilkeleri (kısa)

- Haptic: önemli onaylarda.
- Boş durumlar: net CTA.
- Grafiklerde okunabilir etiket ve kontrast.
- Erişilebilirlik: dokunma alanları, `accessibilityLabel` (ör. donut merkez temizleme).

---

## 7. Güvenlik — tamamlanan iyileştirmeler ve mimari kurallar

> Bu bölüm Nisan 2026 güvenlik denetimine dayanır. Tüm kritik ve yüksek önem açıkları kapatılmıştır.

### 7.1 Kritik açıklar (S1–S3) — Kapatıldı

| # | Açık | Çözüm | İlgili dosyalar |
|---|------|-------|------------------|
| S1 | **API anahtarı düz metin SQLite** | `expo-secure-store` ile OS anahtar zincirine (keychain) taşındı. İlk açılışta otomatik migration: SQLite'dan okur → SecureStore'a yazar → SQLite'dan **siler** (idem-potent) | `src/services/secureKeyStore.ts` (yeni), `geminiService.ts` |
| S2 | **API key URL query string'de** | `?key=` parametresi tamamen kaldırıldı; her HTTP isteğinde `x-goog-api-key` header'ı kullanılıyor. Proxy log'ları ve ağ izleme araçları artık anahtarı göremez | `geminiService.ts` — `discoverModels()`, `callGeminiModel()` |
| S3 | **API key log sızıntısı** | Key'in ilk/son 4 karakteri artık loglanmıyor; yalnızca `present (N chars)` bilgisi var. URL'deki `?key=***` diagnostic logu da kaldırıldı | `geminiService.ts` — `parseReceipt()` |

### 7.2 Yüksek ve orta açıklar (S4–S11) — Kapatıldı

| # | Açık | Çözüm | İlgili dosyalar |
|---|------|-------|------------------|
| S4 | **Gereksiz `RECORD_AUDIO` izni** | `app.json` Android izinlerinden kaldırıldı. Uygulama ses kaydı yapmıyor — minimum izin prensibi artık sağlanıyor | `app.json` |
| S5 | **`refactoring.js` runtime riski** | `fs.readFileSync`/`writeFileSync` kullanan, `analytics.tsx` üzerinde doğrudan manipülasyon yapan node.js script'i kök dizinden silindi | — (silindi) |
| S6 | **DAO girdi doğrulama eksikliği** | Merkezi `inputValidation.ts` modülü oluşturuldu. `expenseDao`'nun `create()` (tutar/para birimi/not), `addItem()` (isim/adet/birim fiyat/indirim) ve `deleteMany()` (ID dizisi boyut sınırı + 400'lük chunk'lar) fonksiyonlarına uygulandı | `src/utils/inputValidation.ts` (yeni), `src/db/expenseDao.ts` |
| S7 | **Vendor/Category isim sanitizasyonu yok** | `sanitizeText(name, maxLen)` ile kontrol karakter temizliği, uzunluk sınırı (vendor 200, category 100 karakter) ve boş isim engeli eklendi | `src/db/vendorDao.ts`, `src/db/categoryDao.ts` |
| S8 | **Gemini JSON proto-pollution** | `coerceParsedReceipt()` fonksiyonuna `stripDangerousKeys()` eklendi. `__proto__`, `constructor`, `prototype` gibi tehlikeli anahtarlar tüm nesne ağacında özyinelemeli olarak temizleniyor | `src/services/geminiService.ts`, `src/utils/inputValidation.ts` |
| S9 | **`deleteMany` toplu silme — sınır yok** | `sanitizeIdArray(ids, 500)` + 400'lük SQL chunk'lara bölme. SQLite ~999 placeholder limiti koruması | `src/db/expenseDao.ts`, `src/utils/inputValidation.ts` |
| S10 | **EAS Project ID kaynak kodda sabit** | `app.config.js` ile ortam değişkeninden (`EAS_PROJECT_ID`) okunuyor; `app.json`'dan kaldırıldı | `app.config.js` (yeni), `app.json`, `.env.example` (yeni) |
| S11 | **Model cache yarış durumu** | `_modelCachePromise` ile in-flight dedup: eşzamanlı `discoverModels()` çağrıları tek network isteğine birleşir | `src/services/geminiService.ts` |

### 7.3 Güvenlik katmanı — `inputValidation.ts` API referansı

`src/utils/inputValidation.ts` — tüm DAO ve servisler bu modülü kullanır:

| Fonksiyon | Kullanım | Kural |
|-----------|----------|-------|
| `sanitizeAmount(value)` | Parasal tutarlar | NaN, Infinity, negatif, >999M reddedilir |
| `sanitizeQuantity(value)` | Ürün adet | ≤0 reddedilir, >999K sınırlanır |
| `sanitizeUnitPrice(value)` | Birim / toplam fiyat | NaN, Infinity, \|abs\|>999M reddedilir |
| `sanitizeText(value, maxLen)` | İsim, not, para birimi kodu | trim, kontrol karakterleri temizliği, uzunluk kırpma |
| `sanitizeDate(value)` | Tarih alanları | YYYY-MM-DD + yıl 2000–2100 aralığı |
| `sanitizeIdArray(ids, maxLen)` | Toplu silme ID'leri | Tip kontrolü, varsayılan 500 öğe sınırı |
| `stripDangerousKeys(obj)` | Dış API yanıtları | `__proto__`/`constructor`/`prototype` özyinelemeli silme |

### 7.4 Güvenlik kuralları — yeni katkılar için

1. **Hiçbir zaman** API anahtarını SQLite'a yazmayın; daima `secureKeyStore.ts` kullanın.
2. **Hiçbir zaman** API anahtarını URL'ye eklemeyin; `x-goog-api-key` header'ı kullanın.
3. Dış kaynaktan (Gemini, network, kullanıcı girişi) gelen tüm veriler `inputValidation.ts` fonksiyonlarından geçirilmeli.
4. `console.log` ile hassas veri (API key, base64 görüntü, kullanıcı finansal verisi) loglanmamalı; `__DEV__` guard'ı mecburi.

### 7.5 Mevcut durum tablosu

| Konu | Durum | Not |
|------|-------|-----|
| **Gemini API anahtarı** | ✅ OS Keychain | `expo-secure-store` — `secureKeyStore.ts` sarmalayıcı |
| **Ağ iletişimi** | ✅ HTTPS + Header Auth | her istekte `x-goog-api-key` header |
| **Tanılama logları** | ✅ Temizlendi | `__DEV__` guard'lı; hassas veri yok |
| **Android izinleri** | ✅ Minimum | Kamera, Galeri; `RECORD_AUDIO` kaldırıldı |
| **DAO girdi doğrulama** | ✅ Aktif | `inputValidation.ts` entegre |
| **İsim sanitizasyonu** | ✅ Aktif | Vendor 200, Category 100, text 500 karakter |
| **Toplu silme sınırı** | ✅ Aktif | 500 ID, 400'lük SQL chunk'lar |
| **Proto-pollution** | ✅ Aktif | `stripDangerousKeys` Gemini yanıtında |
| **EAS Project ID** | ✅ Ortam değişkeni | `app.config.js` — `EAS_PROJECT_ID` |
| **Model cache** | ✅ Race-free | in-flight promise dedup |
| **Fiş görüntüsü base64** | ⚠️ İzleniyor | Log'lara sızmaması için dikkat gerekli |
| **SQLite bütünlük** | ⚠️ Takip etmek | `PRAGMA integrity_check` opsiyonel eklenebilir |
| **Gizlilik politikası** | ✅ Yayında | `https://ruslanaeff.github.io/privacy-policy.html` — GitHub Pages, TR+EN, dark-themed HTML |

### 7.6 Loglama politikası

1. **Hassas veri:** API anahtarı, base64 görüntü, kullanıcı finansal verisi (not, tutar, satıcı adı), Gemini yanıt gövdesi — **asla** loglanmaz.
2. Tüm `console.log` / `warn` / `error` çağrıları **`if (__DEV__)` guard** altında veya sadece **kısa, anonim hata kodu** içermelidir (ör. `console.warn('[NOTIF] sync failed')`).
3. `Error` nesnesinin tamamı üretimde loglanmaz; gerekirse `err.message`’ın ilk 100 karakteri.
4. `ErrorBoundary` üretimde stack göstermez; `__DEV__` dışında yalnızca kullanıcı dostu mesaj.
5. Yeni PR kontrol listesi: “bu dosyada eklenen log’lar `__DEV__` altında mı?”

### 7.8 Gizlilik politikası

**URL:** `https://ruslanaeff.github.io/privacy-policy.html` (GitHub Pages — `RuslanAeff/ruslanaeff0.github.io` reposu, `main` branch root).

**Kapsam (Mayıs 2026):** TR + EN iki dilli, karanlık temalı tek HTML sayfası. İçerik: tüm veriler yalnızca cihazda (SQLite), Gemini API — kullanıcının kendi anahtarıyla doğrudan Google'a, üçüncü taraf paylaşımı yok, kamera/galeri/bildirim izinleri isteğe bağlı, iletişim `ruslan.eliyev124@gmail.com`.

**Uygulama içi erişim:** `app/(tabs)/settings.tsx` About bölümünde `shield-check-outline` ikonu + `t('privacy_policy')` metni → `Linking.openURL(url)`. i18n anahtarı: `privacy_policy` (TR/EN/AZ/RU). `app.json → extra.privacyPolicyUrl` alanında da kayıtlı.

**Güncelleme kuralı:** Yeni izin eklenir, veri toplama değişir veya üçüncü taraf servis eklenir → HTML dosyası repo'da güncellenmeli, `app.json` sürümü ve "Last updated" satırı artırılmalıdır.

### 7.7 DAO girdi boru hattı — **tüm mutasyonlar**

`create`, `addItem`, `update`, `updateItem`, `upsert`, `setMonthlyBudget`, `updateLogo` ve `deleteMany` **aynı sanitizasyonlardan** geçmelidir:

- `sanitizeAmount` — tüm para miktarları (bütçe, limit, hedef, harcama, birim fiyat, indirim).
- `sanitizeText(value, maxLen)` — isim, not, başlık, para kodu (TR/EN’de bile).
- `sanitizeDate` — `YYYY-MM-DD`; ay anahtarları için `YYYY-MM` regex kontrolü.
- `sanitizeIdArray(ids, 500)` — toplu silme, `IN (?...)` placeholder kontrolü; 400’lük SQL chunk’ları.
- `stripDangerousKeys` — dış API (Gemini), kullanıcı import’u gibi dış kaynak JSON’larında.

Yeni bir DAO yazarken önce `normalizeXxxPatch` yardımcısı tanımlanıp hem `create` hem `update` bu yardımcıya bağlanmalıdır.

## 8. Performans — tamamlanan iyileştirmeler ve kalan yol haritası

> Bu bölüm Nisan–Mayıs 2026 performans denetimine dayanır. **P1–P13** kapatıldı (P1–P6 ilk dalga, P7–P11 ikinci dalga, P12 tema mağazası + ilk render senkronu, P13 işlemler listesi Android clip).

### 8.1 Tamamlanan performans iyileştirmeleri (P1–P13)

| # | Sorun | Çözüm | İlgili dosyalar |
|---|-------|-------|------------------|
| P1 | **N+1 sorgu — `useCategoryLimitsProgress`** | `CategoryDao.getAll()` → Map O(1) lookup + `Promise.all` paralel harcama hesabı. 20+ sıralı sorgu → 3 sorgu | `src/hooks/useSavingsGoalData.ts` |
| P2 | **Dinamik import overhead** | `await import('./categoryDao')` → dosya başında statik import | `src/db/expenseDao.ts` |
| P3 | **Fiş görüntüsü tam çözünürlük base64** | `expo-image-manipulator` ile max 1536px + JPEG %70 sıkıştırma. Payload ~%60-80 küçülme | `src/utils/imageCompressor.ts` (yeni), `app/(tabs)/scanner.tsx` |
| P4 | **`useDailySpending` O(n²) lookup** | `raw.find()` → `Map` tabanlı O(1). 60+ gün aralığında belirgin hızlanma | `src/hooks/useExpenses.ts` |
| P5 | **Bildirim sync — her `refreshKey`'de tetiklenir** | 300ms `useRef` debounce. Ardışık `triggerRefresh()` çağrıları tek senkronizasyona birleşir | `src/context/NotificationsContext.tsx` |
| P6 | **Vendor silme — iki ayrı SQL, transaction yok** | `withTransactionAsync` ile atomik silme. Yarıda kalma riski yok | `src/db/vendorDao.ts` |
| P7 | **`LanguageContext` value + `t`/`tc` her render’da yeni referans** | `t` / `tc` → `useCallback([language])`, provider `value` → `useMemo([language, t, tc, setLanguage])`. Aynı şekilde `CurrencyContext` ve `RefreshContext` value’ları `useMemo` ile sabitlendi. `t` / `tc`-e abone tüm bileşenler artık yalnız dil değişikliğinde re-render yiyor. | `src/i18n/LanguageContext.tsx`, `src/context/CurrencyContext.tsx`, `src/context/RefreshContext.tsx` |
| P8 | **`BarChart` her animasyon frame’inde `setState`** | `Animated.Value` + `addListener` + `setState` kaldırıldı; **Reanimated `SharedValue` + `useAnimatedProps`** ile animasyon UI thread’e taşındı. Her bar kendi worklet’inde `height`/`y` hesaplar — JS tarafı 0 frame re-render yapar. | `src/components/BarChart.tsx` |
| P9 | **İşlem listesi iç içe `sections.map` + tüm satırların eager render’ı** | Liste **tek boyutlu akışa düzleştirildi** (`{ kind: 'header' | 'row' }`); FlatList virtualization’ı gerçek satırlar üzerinde çalışıyor. Ayrıca yeni `usePaginatedExpenses(60)` hook’u DB’den **offset tabanlı sayfalı** çeker; `onEndReached` ile kullanıcı kaydırdıkça sonraki sayfa eklenir. Satır callback’leri ref pattern ile referans-kararlı (React.memo etkili). | `src/hooks/useExpenses.ts`, `app/(tabs)/transactions.tsx`, `src/components/TransactionRow.tsx` |
| P10 | **`getStyles()` her render’da `StyleSheet.create` üretiyor** | `const styles = useMemo(() => getStyles(), [scheme])` — `Colors` proxy tema şemasına göre çözüldüğünden yalnız tema değiştiğinde yeniden üretilir. Analiz ekranı ve işlemler ekranı ciddi boyutlu `StyleSheet`’lere sahip; bu değişiklik frame-başına gereksiz `create` çağrılarını eler. | `app/(tabs)/analytics.tsx`, `app/(tabs)/transactions.tsx`, `src/components/BarChart.tsx` |
| P11 | **Analitik donut `segments={data.map(...)}` inline** | Her render’da yeni dizi+nesne referansları üretildiği için `DonutChart` içindeki `useMemo([segments])` hiç isabet etmiyor, `AnimatedSegment` bağımlı effect’leri tekrar başlıyordu. Segment dizileri (`nwSegments` / `wwSegments`) ve `onSelect` callback’leri memoize edildi — donut artık yalnız veri gerçekten değiştiğinde yeniden hesaplanıyor. | `app/(tabs)/analytics.tsx` |
| P12 | **Aydınlık modda kartların içi siyah — "flash of dark" + stale scheme** | Sebep-sonuç zinciri: (1) `ThemeScheduler.applyThemeFromDatabase()` **async** DB okuması yaptığı için ilk render'da `Colors` proxy OS'un dark temasını çözüp `StyleSheet`'e donduruyordu; (2) DB okununca `Appearance.setColorScheme('light')` çağrılıyor **ama Android/Expo Go'da `useColorScheme()` hook'u bu programatik değişimi her zaman tetiklemiyor** (RN bilinen quirk'i) → component re-render almıyor, eski StyleSheet ekranda kalıyor; (3) sekme değiştirip dönünce `useFocusEffect` render'ı yeniliyor ve kart beyazlaşıyor. Dashboard'ta ekstra tetikleyici: `statsCard.backgroundColor = Colors.cardSurface` override'ı AnimatedCard'ın arka planını ikinci bir StyleSheet'e dondurup kaçış yolunu kapatıyordu. **Çözüm:** (a) Merkezi `themeStore` (`src/theme/themeStore.ts`) `useSyncExternalStore` tabanlı çift kanallı (`Appearance.addChangeListener` + manuel `notifyThemeChanged()`); (b) `themeSchedule` her `Appearance.setColorScheme()` sonrası store'u notify ediyor; (c) `useDatabase` hook'u `isReady=true` vermeden **önce** `await applyThemeFromDatabase()` ile teklik senkronu sağlıyor → ilk render zaten doğru temayla çıkıyor; (d) tüm tema-bağımlı component'ler `useColorScheme()` yerine `useAppTheme()` + `useMemo(() => getStyles(), [scheme])` kullanıyor; (e) Dashboard'taki çift-kaynak background override kaldırıldı. Detay §6.1.2. | `src/theme/themeStore.ts` (yeni), `src/utils/themeSchedule.ts`, `src/hooks/useDatabase.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/analytics.tsx`, `app/(tabs)/transactions.tsx`, `app/(tabs)/settings.tsx`, `app/notifications.tsx`, `src/components/AnimatedCard.tsx`, `src/components/BudgetCard.tsx`, `src/components/SpendingHeatmap.tsx`, `src/components/BudgetHistoryCard.tsx`, `src/components/SavingsGoalCard.tsx`, `src/components/CategoryLimitsSection.tsx`, `src/components/SpendingTrend.tsx`, `src/components/DonutChart.tsx`, `src/components/BarChart.tsx`, `src/components/LineChart.tsx`, `src/components/CategoryPill.tsx`, `src/components/VendorAvatar.tsx`, `src/components/TransactionRow.tsx`, `src/components/ItemAnalyticsModal.tsx`, `src/components/BackupSection.tsx`, `src/components/CustomDatePicker.tsx`, `src/components/GlassCheckButton.tsx`, `src/components/LanguagePickerSheet.tsx`, `src/components/SettingsInfoHint.tsx` |

| P13 | **`FlatList` `removeClippedSubviews` toggle bug'ı (Android)** | Toplu seçim modu girişinde `removeClippedSubviews={!selectionMode}` ifadesi `true → false` geçince Android'de bazı satırların native view'leri "clipped" durumda takılı kalıyor → satırlar yer tutar ama **görünmez ve dokunulmaz** oluyordu (tarih başlıkları virtualization dışı olduğu için görünmeye devam ediyor, kullanıcı "satırlar kayboldu" olarak algılıyor). Bilinen RN Android quirk'i: prop runtime'da değiştirilince clip'lenmiş subview'ler otomatik geri yüklenmiyor. **Çözüm:** prop sabit `false` yapıldı; `usePaginatedExpenses(60)` ile DB seviyesinde sayfalama zaten aktif olduğundan virtualization'ın tek başına yükü yeterli. | `app/(tabs)/transactions.tsx` |
| P14 | **Limit Sağlığı kartı N+1** (`loadCategoryLimits`) | Eski akış: limit listesi (1 SQL) + tüm kategoriler (1 SQL) + her limit için `getSpentForCategoryInRange` (alt kategori sorgusu + harcama toplamı = 2 SQL/limit). 5 limit için **11 SQL roundtrip**. Yeni `CategoryLimitDao.getForMonthWithSpending(month, start, end)` tek sorguda limit + kategori meta + alt kategoriler dahil aralık harcamasını JOIN/GROUP ile döner → **1 SQL**. Pull-to-refresh ve ekran açılış gecikmesi belirgin azaldı. | `src/db/categoryLimitDao.ts`, `app/(tabs)/analytics.tsx` |
| P15 | **`SparkToast` flicker — aynı içerik tetiklendiğinde popup yere düşüp tekrar açılıyor** | Aynı toast mesajı bir form-kaydet akışında 2 kez (handler + sonraki state effect'i) çağrıldığında, `_show` her seferinde animasyon değerlerini sıfırlayıp yeniden başlatıyordu → kullanıcıya yanıp sönme olarak görünüyor. **Çözüm:** `activeKeyRef = "${type}\|${message}\|${submessage}"`; aynı key aktifken sadece auto-dismiss timer ve `progW` (progress bar) sıfırlanır, animasyon/state'e dokunulmaz. Toast kapandığında `activeKeyRef = null`. | `src/components/SparkToast.tsx` |
| P16 | **Ay sonu projeksiyonu — outlier'a aşırı duyarlı** | Naive `currentTotal / dayOfMonth × totalDaysInMonth` kira/fatura/elektronik gibi tek seferlik büyük harcamalardan sonra abartılı projeksiyon veriyor (ör. 5. günde 2.000 zł kira → ay sonu 12.000+ zł tahmini). **Çözüm:** Ay başından bugüne sparse `dailyData` 0 günler dahil dense diziye genişletilir, sıralanır, **üst %20 trim** edilir; kalanın ortalaması `trimmedDailyPace` olur. Projeksiyon = `currentTotal + daysLeft × trimmedDailyPace`. `currentSpent` (gerçek harcanan) ve track-bar "şu ana kadar" segmenti değişmez; sadece **kalan gün için tahmin** gürültüden arındırılır. `hasOutlier = naivePace > trimmedPace × 1.5` flag'i ileride bilgi rozeti için döner. | `app/(tabs)/analytics.tsx` (`projectionInfo` useMemo) |
| P17 | **`dateUtils` timezone bug — `toISOString()` UTC'ye çeviriyor** | `getToday()`, `getEndOfMonth()`, `normalizeToYYYYMMDD()` `Date.toISOString().split('T')[0]` kullanıyordu. UTC+3 cihazlarda gece yarısı civarında "bugün" ertesi günü dönebiliyor; `getEndOfMonth(Şubat 2026)` `28` yerine `27` veriyordu. Yan etki: yanlış güne kaydedilen harcamalar, projeksiyon kartında 1 gün eksik hesap, ay sonu rapor karışmaları. **Çözüm:** Yerel takvim gününü garanti eden `toLocalYmd(date)` helper'ı eklendi (`${y}-${MM}-${DD}` padStart) ve üç yerde de çağrılır oldu. `__tests__/dateUtils.test.ts` regresyon testi ekledi (Şubat 28/29, Aralık 31, Nisan 30 doğrulamaları). | `src/utils/dateUtils.ts`, `src/utils/__tests__/dateUtils.test.ts`, `app/onboarding.tsx` (yeni dosyada da `new Date().toISOString().slice(0,7)` tekrar üretilmişti, `getStartOfMonth().substring(0,7)` ile değiştirildi) |
| P18 | **`Colors` proxy `Appearance.getColorScheme()` stale dönüyor (P12 nüksü)** | `_layout.tsx` Stack'i splash sırasında daima mount edildikten sonra (route registry erişimi için zorunlu), tema henüz DB'den okunmadan render edilen kartlar OS scheme'ini yakalıyor. Android'de `Appearance.setColorScheme()` sonrası `Appearance.getColorScheme()` her zaman güncellenmiyor → aydınlık modda bazı kartlar (özellikle koşullu render edilen budget kartı) siyah donuyor. **Çözüm:** `Colors` proxy artık `themeStore.getAppThemeSnapshot()` üzerinden okuyor (lazy `require` ile circular import güvenli, ilk modül yükleme sırasında Appearance fallback). themeStore manuel `notifyThemeChanged()` ve OS değişimi her ikisini de takip ettiği için stale dönmez. | `src/theme/colors.ts` |
| P19 | **Drag-to-multiselect başlangıç sıçraması** | `transactions.tsx` çoklu seçim drag akışında, drag aktivasyonunda `refreshControl={dragSelecting ? undefined : <RefreshControl/>}` ile prop tamamen kaldırılıyordu → FlatList iç scroll yapısını sıfırlıyor → liste birden en üste sıçrıyor (kullanıcı görünüm: "elini bırakmadan aşağı sürüklerken birden başa atıyor"). **Çözüm:** `RefreshControl` her zaman bağlı; drag aktifken Android'in `enabled={!dragSelecting}` prop'u ile pull-to-refresh kapatılıyor. Mount/unmount yaşanmadığı için scroll state korunuyor. iOS'ta `enabled` prop ignore edilir; orada `scrollEnabled={!dragSelecting}` zaten parmak scroll'u keserek refresh tetikleyicisini de pasifleştiriyor. | `app/(tabs)/transactions.tsx` |
| P20 | **İlk açılış splash'inde Stack mount edilmiyor → `router.replace('/onboarding')` kilitleniyor** | Eski `_layout.tsx` `if (!isReady || ...) return <Splash/>` ile Stack'i tamamen render etmiyor; bu durumda `router.replace('/onboarding')` çağrısı henüz tanımlı olmayan route'u arıyor → uygulama splash'te sonsuz dönüyor. **Çözüm:** Stack daima render edilir, splash bir **overlay** olarak (`StyleSheet.absoluteFillObject`, `zIndex: 100`) `showSplash` koşuluyla üzerine bindirilir. Yönlendirme effect'i `onboardingHandledRef` guard'ı ile tek sefer çalışır. Provider'lar (Language/Currency/...) ve route registry hep mount, splash bittiğinde overlay kalkar. | `app/_layout.tsx` |
| P21 | **Analiz — alt kategori seçiminde ScrollView zıplaması ve boş Satıcılar kartı** | Alt kategoriler (`subcats`) daha önce Satıcılar kartı içinde koşullu gösteriliyordu. Kategoriye tıklanınca kartın yüksekliği ani değişiyor → ScrollView layout yeniden hesaplıyor → kullanıcı sayfanın istemediği bir yerine sıçrıyordu. Ek sorun: "Diğer" kategorisinde `subcats.length === 0` olduğu için Satıcılar kartı da boşalıyordu. **Çözüm:** Alt kategori bölümü `categories` kartının içine taşındı — seçili kategori altında `FadeInDown`/`FadeOutUp` animasyonlu inline genişleyen bölüm. `subcats.length === 0` ise `t('no_sub_categories')` boş durumu gösteriliyor. Satıcılar kartı her zaman satıcıları gösteriyor. | `app/(tabs)/analytics.tsx` |
| P22 | **120Hz cihazlarda scroll sırasında FPS/Hz düşüşü** | `AnimatedCard` `elevation` gölgesi her kaydırma frame'inde CPU'da yeniden rasterize ediliyordu. Android glow efekti GPU bant genişliği tüketiyordu. **Çözüm:** (1) `AnimatedCard` → `renderToHardwareTextureAndroid` — kart bir kez GPU texture'ına alınır, scroll sırasında CPU rasterize yapılmaz (en büyük kazanım). (2) Ana `ScrollView`'lara `overScrollMode="never"` — Android sınır glow efekti kaldırıldı. | `src/components/AnimatedCard.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/analytics.tsx` |

### 8.2 Performans kuralları — yeni katkılar için

1. DAO'larda döngüsel tek-tek sorgu yazmayın; toplu veriyi `getAll()` + `Map` ile ön-yükleyin.
2. Paralel bağımsız sorguları `Promise.all` ile çalıştırın.
3. Harici API'ye gönderilecek görüntüleri `imageCompressor.ts` üzerinden sıkıştırın.
4. `Context` değişikliklerinde gereksiz DB sorgularını önlemek için debounce kullanın.
5. İki veya daha fazla ilişkili SQL işlemini `withTransactionAsync` içine alın.
6. Liste verilerinde sık yapılan arama (lookup) için `Array.find()` yerine `Map` kullanın.
7. Her `Context.Provider` `value`’su **zorunlu `useMemo`** — callback’ler **zorunlu `useCallback`** (§8.4).
8. Animasyonu JS thread’den çıkarın: `react-native-reanimated` `SharedValue` + `useAnimatedProps`; `Animated.addListener → setState` kalıbı **yasak** (P8).
9. Uzun listelerde (>50 satır) **tek akış FlatList** + pagination; bölüm başlıklı yapılarda verileri düzleştirip `kind` ayrımı kullanın (P9, §8.5).
10. `StyleSheet.create()` render başına çağrılmaz: `useMemo(() => getStyles(), [scheme])` (P10). `scheme` değişmediği sürece tek örnek paylaşılır.
11. `React.memo`’lu çocuklara verilen **prop dizileri / nesneleri / callback’ler** `useMemo` / `useCallback` ile sabitlenmeli — aksi halde memo etkisizdir (P11).
12. Tema-bağımlı her component **`useColorScheme()` değil** `useAppTheme()` kullanır (P12, §6.1.2). `Colors` proxy'sinin bayat `StyleSheet`'te donmaması için `scheme` değişkeni `useMemo([scheme])` deps'ine verilir. `Appearance.setColorScheme()` çağıran her yeni yol (menü, otomatik tema, vb.) sonunda **`notifyThemeChanged()`** tetiklenmelidir — aksi halde Android/Expo Go'da re-render kaybolur ve siyah-kart regresyonu döner.
13. DB'den okunan kullanıcı tercihleri UI'ı etkiliyorsa (tema, dil, para birimi) ilk render'dan **önce** `await` edilmeli (`useDatabase`). Aksi halde "flash of dark / wrong locale / wrong currency" yaşanır (P12).

### 8.3 Kalan yol haritası

P1–P13 denetim bulguları tamamlandıktan sonra orta öncelikli olarak takip edilmesi önerilen maddeler:

| Alan | Gözlem | Öneri |
|------|--------|-------|
| **Locale bundle** | `translations.ts` (TR+EN inline) startup’ta yüklenir | `import()` ile **lazy-load** + cache |
| **Gemini** | Büyük `maxOutputTokens`, sıralı model denemesi | Başarısız modelleri kısa süre önbellekle; `items` uzunluğunu `slice(0, 500)` |
| **Startup** | DB init + dil yükü tamamlanana kadar siyah | Kritik olmayanları `InteractionManager.runAfterInteractions` ile ertele |
| **Analiz ekranı boyutu** | `app/(tabs)/analytics.tsx` 2000+ satır | Her `card` id’si için ayrı alt bileşen + `React.memo` — P11 sonrası inline JSX maliyeti düşmeye devam eder |
| **Liste — sabit yükseklik** | `TransactionRow` varyant yükseklikleri (seçim modu +1px vb.) | Sabit satır yüksekliği ölçüp `getItemLayout` eklenerek scroll’un tahmin maliyeti sıfırlanabilir |

### 8.4 Context performans kuralları (uygulandı — P7)

1. **`value={{ ... }}` her zaman `useMemo`** — aksi takdirde provider her render’da tüm tüketicileri günceller. `LanguageContext`, `CurrencyContext`, `RefreshContext` bu kurala uygun; referans alın.
2. **`t` / `tc` / callback’ler `useCallback`** — bağımlılık olarak yalnızca gerçekten değişen alanlar. `t` / `tc` yalnız `[language]`’e bağlıdır.
3. Çok sık değişen (ör. `refreshKey`) ile seyrek değişen alanları **ayrı context’e** böl — bu proje bu ayrımı zaten uygular (`RefreshContext` ayrıdır).
4. Yeni context yazarken tüketicinin gerçekten hangi alana abone olduğunu düşün; gerekirse seçici hook (`useLanguageCode()`) üret.

### 8.5 Liste kuralları (uygulandı — P9)

1. Bölüm başlıklı listelerde satırları **düzleştir**; bölüm içinde `items.map()` yazma. İşlemler ekranı `{ kind: 'header' | 'row' }` deseni kullanır; yeni listelerde bu deseni tekrar kullanın.
2. Memoize edilmiş satır bileşenlerine **inline state bağımlı callback** verme; `useRef` pattern ile stateRef oluştur, `useCallback([])` ile referansı sabitle — `app/(tabs)/transactions.tsx`-teki `handleRowPress` / `handleRowLongPress` örneğini izle.
3. Büyük veri kümeleri **DB seviyesinde sayfalı** çekilmeli. Standart hook: `usePaginatedExpenses(pageSize)` — `items`, `loadMore`, `hasMore`, `refresh` döner; `FlatList` `onEndReached={loadMore}` + `onEndReachedThreshold ≈ 0.6`.
4. `initialNumToRender` / `windowSize` / `maxToRenderPerBatch` / `updateCellsBatchingPeriod` açıkça ayarlanmalı — `TransactionsScreen` değerleri referans alınmalı. Sabit yükseklikli satırlarda ek olarak `getItemLayout` eklenmelidir (yol haritası).
5. `keyExtractor`, `renderItem`, `ListEmptyComponent`, `ListFooterComponent` **stabil referans** (modül seviyesi veya `useCallback` / `useMemo`).
6. **FlashList** şu anda bağımlılık listesinde yok; 1000+ satıra ölçülebilir şekilde ulaşılırsa eklenebilir. Bu aşamada `FlatList` + virtualization + pagination yeterlidir.
7. **`removeClippedSubviews` Android'de runtime toggle'lanmamalı** (P13). Mode/state değişikliğine bağlı `true ↔ false` geçişi clip'lenmiş native view'leri gözden kaybediyor. Sabit değer kullanın; satır görünürlüğüne mod bağımlı bir prop gerekiyorsa list mount sırasında bir kez belirleyin (`useState` ile sabit) veya başka bir mekanizma (key reset ile remount) tercih edin.

---

## 9. Güvenilirlik, test ve kalite

- **TypeScript:** her commit’ten önce `npx tsc --noEmit`. PR kontrol listesi zorunlu madde.
- **Linter:** kod eklerken `ReadLints` / editör uyarıları sıfır bırakılmalı.
- **Otomatik test (kuruldu — v2.3):** **Jest** (`jest-expo` preset) ile birim test altyapısı; `npm test`, `npm run test:watch`, `npm run typecheck` script'leri. Kapsanan kritik yardımcılar: `formatCurrency`, `dateUtils`, `itemNameNormalizer`, `inputValidation` — **47 test, 4 suite**. Bileşen/E2E için **React Native Testing Library** + **Maestro** önerisi açık (DAO ve hook'ların üstüne genişletilebilir). **GitHub Actions CI** (`.github/workflows/ci.yml`): her `push` ve `pull_request` üzerinde Node 20 ile `npm ci` → `npm run typecheck` → `npm test --ci`. Test/CI değiştiğinde §12 bakım kuralına göre `package.json` script'leri ve workflow dosyası birlikte güncellenmelidir.
- **Hata sınırı:** `ErrorBoundary` analiz ekranında aktif; kök `app/_layout.tsx`-e de sarmalama yol haritasındadır (güvenlik bulguları §7.10 ile paralel).
- **i18n:** Yeni metinler `translations.ts` / `locales/*.json` içinde **dört dilde** (TR/EN/AZ/RU) anahtarlarıyla eklenmelidir; eksik çeviri fallback olarak TR’ye düşer.

### 9.1 i18n workflow (TR + EN + AZ + RU)

**Dosya yapısı — `src/i18n/`:**

| Dosya | Rol |
|-------|-----|
| `translations.ts` | **TR** (varsayılan) satır içi; `en` dahil tüm diller `as const`-castle birleştirilir; export: `Language`, `Translations`, `translations` |
| `locales/_en.json` | EN kaynak sözlüğü (TR anahtar kümesiyle senkron) |
| `locales/_keyorder.json` | Anahtarların kanonik sıralaması — diff’leri temiz tutar |
| `locales/az.json`, `locales/ru.json` | Derlenmiş tam çeviriler (uygulama bunları okur) |
| `locales/az-partial.json`, `locales/ru-partial.json` | İnsan tarafından dokunulan kısmi çeviriler |
| `locales/map-az-*.json`, `locales/map-ru-*.json` | Konu bazlı çeviri haritaları (kategori, bildirim, sheet, …) |
| `languageOptions.ts` | `LANGUAGE_OPTIONS` (kod + yerel ad) — picker bu listeyi kullanır |
| `compilePartial.mjs` | `map-*` + `*-partial` birleştirip `az.json`/`ru.json` üretir |
| `buildLocales.mjs` | EN kaynak taraması + tüm dillerin `_keyorder.json`-a göre sıralanması |

**Yeni anahtar eklerken (öneri akış):**

1. Anahtarı `translations.ts` içinde **TR** ve **EN** olarak ekle (diğer diller için `_en.json` ile senkron kal).
2. Anahtarı uygun `map-az-*.json` / `map-ru-*.json` dosyasına ekle (yoksa yeni bir `map-az-N.json` oluştur).
3. `node src/i18n/compilePartial.mjs` ile `az.json` / `ru.json` yeniden üretilir.
4. `node src/i18n/buildLocales.mjs` ile anahtar sırası ve kaynak sözlük doğrulanır.
5. Eksik çeviri runtime’da `en` → `tr` fallback’ine düşer; ancak CI’da eksik anahtar **uyarı** bırakmalı.

**Kural:** UI’da `t('tab_dashboard')` gibi kullan; **bu repoda dize literali hardcode** etme. Yeni tanımlayıcı anahtar isimleri `snake_case` ve alan ön ekiyle (`settings_*`, `notif_*`, `cat_*`, `language_*`).

---

## 10. Yapay zekâ / dış geliştirici için önerilen çalışma sırası

1. Bu belgeyi, `package.json`, `app.json` ve `app.config.js` ile hizala (§2.1 versiyon tablosu).
2. **Güvenlik (büyük ölçüde TAMAMLANDI):** Kritik (S1–S3) ve yüksek (S4–S11) açıklar kapatıldı; orta/kalan maddeler §7.7 boru hattının yayılmasıyla ilgili — §7’yi oku.
3. **Performans (P1–P13 TAMAMLANDI):** Context memoization (§8.4), liste düzleştirme + pagination (§8.5), Reanimated bar/donut, `useMemo(getStyles, [scheme])` kalıbı ve **merkezi tema mağazası** (§6.1.2 / P12), işlemler `removeClippedSubviews` (P13) — §8.1 tabloya bak. Yol haritasında kalanlar orta öncelikli (§8.3).
4. **UX tutarlılığı:** Yeni birincil butonlarda **`susevar`** kullanımı — §6.3’ü oku.
5. **Fiş pipeline:** `geminiService.ts`, `receiptJsonRepair.ts`, `receiptLineMerge.ts` — değişikliklerden önce geriye dönük uyumluluğu kontrol et; `stripDangerousKeys` ve `items` kapsaması §7.2 / §7.7.
6. **Girdi/çıktı güvenliği:** Tüm DAO mutasyonları `inputValidation.ts` üzerinden — §7.3 + §7.7.
7. **i18n ve erişilebilirlik:** Yeni metinler **TR/EN/AZ/RU** dördü için eklenmelidir — §9.1 workflow’u.
8. **Ortam değişkenleri:** EAS bulut derlemeleri için `EAS_PROJECT_ID` **secret** olarak tanımlanmalı; kaynak kod fallback literali **release için kaldırılmalıdır** (§7.5 “EAS Project ID” ve §12).
9. **Yedek / geri yükleme:** Ayarlar ekranındaki BackupSection (§5.3). Yeni tablo/kolon eklenirse `backupService.ts` (hem export sorgularında hem import INSERT’lerinde) ve JSON şeması versiyonu birlikte güncellenmelidir.

---

## 11. Ek: tasarımcıya notlar (özet)

- Neon primary bazı ekranlarda güçlü; alternatif ton veya doygunluk testi yapılabilir.  
- Kart yüzeyi, border ve radius ekranlar arasında `theme` token’larından sapmadan tutulmalı.  
- Modal / toast / silme akışlarında ortak “cam” ve tehlike rengi (`danger`) dili korunmalı.

---

## 12. Belge bakımı

- Kodda köklü mimari değişiklik (yeni depolama, yeni API, yeni sekme, yeni dil) olduğunda bu dosyanın **Teknoloji yığını (§2/§2.1)**, **Mimari (§3)**, **Ekranlar (§5)** ve **Güvenlik/Performans (§7/§8)** bölümleri güncellenmelidir.
- Tasarım token veya şüşevar tanımı değişirse **§6** ve `src/theme/susevar.ts` birlikte gözden geçirilmelidir.
- **i18n anahtarları** eklenir/değişirse **§9.1** workflow’u takip edilip `compilePartial.mjs` + `buildLocales.mjs` çalıştırılmalıdır.
- **EAS / ortam** ayarları değişirse `.env.example`, `app.config.js`, `eas.json` ve §7.5 tablo satırları **aynı commit’te** güncellenmelidir.
- Tema rengi, tipografi veya `Colors` proxy davranışı değişirse §6.1 ve §6.1.2 yeniden doğrulanmalıdır. Her yeni component `useAppTheme() + useMemo(() => getStyles(), [scheme])` kalıbını kullanmalıdır; aksi halde `Colors` proxy değerleri `StyleSheet` içinde donar ve aydınlık/karanlık geçişlerinde siyah-kart regresyonu (P12) tekrar doğar.
- `Appearance.setColorScheme(...)` çağıran **yeni** bir yol (hızlı eylem, widget, bildirim merkezi, vb.) eklenirse aynı satırdan sonra **mutlaka** `notifyThemeChanged()` (`src/theme/themeStore.ts`) tetiklenmelidir. Aksi halde Android/Expo Go'da `useAppTheme()` aboneleri re-render almaz → P12 regresyonu geri döner.
- DB'den okunan kullanıcı tercihleri ilk render'ı etkiliyorsa (tema, dil, para birimi) `useDatabase`'in `isReady=true` adımından **önce** `await` edilmelidir (§6.1.1 "İlk açılış senkronu").
- Yeni bir `Context.Provider` eklenirse §8.4 / §7 ve §8.1’deki P7 satırı güncellenmeli (`value` memoize edilmiş mi, hangi deps).
- Yeni bir grafik animasyonu eklenirse §8.1 P8 deseni (`SharedValue` + `useAnimatedProps`) kullanılıp burada referans gösterilmelidir.
- Yeni bir uzun liste ekranı eklenirse `usePaginatedExpenses` gibi bir sayfalı hook’a (veya eşdeğerine) bağlanmalı ve §8.5 listesine eklenmelidir.
- **Yedek formatı (§5.3) değişirse:** `BACKUP_FORMAT_VERSION` artırılmalı, eski sürümü **geriye dönük okuyabilecek** importer dalları korunmalı; DB şemasına yeni tablo/kolon eklenirse hem `buildBackupPayload` hem `importBackupPayload` ve DESIGN_BRIEF §5.3 JSON şeması tek commit’te güncellenmelidir. Yeni bağımlılık (`expo-sharing` / `expo-document-picker`) sürümü §2.1 tablosuna yazılmalıdır.
- **Analiz kartları (§5.8) değişirse:** `app/(tabs)/analytics.tsx` içindeki `ALL_CARDS`, `DEFAULT_ACTIVE`, `loadCardConfig` migrasyonu, `renderCard` dalları ve ilgili DAO/i18n bu bölümle aynı commit’te güncellenmelidir; mağaza sürümü için `app.json` `expo.version` + Android `versionCode` artışı unutulmamalıdır.
- **Onboarding akışı (§5.9) değişirse:** `app/onboarding.tsx`, `src/hooks/useOnboardingStatus.ts`, `app/_layout.tsx` başlangıç check'i ve ilgili i18n anahtarları tek commit içinde birlikte güncellenmelidir.
- **Drag-to-multiselect (§5.10) değişirse:** `app/(tabs)/transactions.tsx` içindeki `dragSelecting`/`dragSelectingRef`, `findExpenseIdAtListY`, PanResponder capture handler'ları ve `RefreshControl` `enabled` prop'u tutarlı kalmalıdır. Yeni satır tipleri eklenirse cell yüksekliği `measuredRef`'e + cumulative scan'e eklenmelidir. **`refreshControl` prop'unu drag aktifken `undefined`'a düşürmeyin** (P19) — FlatList iç state resetler.
- **Otomatik test/CI (§9 sonu) değişirse:** `package.json` script'leri (`test`, `test:watch`, `typecheck`), `jest` preset alanı, `.github/workflows/ci.yml` ve §9 metni birlikte güncellenmeli; yeni test dosyaları `src/**/__tests__/**/*.test.ts` glob'una düşmelidir.
- **`Colors` proxy okuma kaynağı (§8.1 P18) değişirse:** `src/theme/colors.ts` lazy `require('./themeStore').getAppThemeSnapshot` zincirine dokunulurken circular import güvenliği (try/catch fallback) korunmalı; aksi halde uygulama init zamanında çakılır.

---

*Bu rehber, S.P.A.R.K projesinde tutarlı ürün ve mühendislik kararları alınması; özellikle otomasyon ve yapay zekâ araçlarına bağlam sağlanması için hazırlanmıştır.*
