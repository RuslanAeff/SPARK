# SPARK Akademik İzlenebilirlik Kaydı

## 1. Amaç ve kapsam

Bu belge, SPARK'ın geliştirme sürecinde bir gereksinimin hangi karara, kod
değişikliğine ve doğrulama kanıtına bağlandığını göstermeyi amaçlar. Tez veya
diploma çalışmasında kullanılacak iddialar için bir indeks görevi görür; tek
başına test raporu, kullanıcı onayı veya bağımsız doğrulama değildir.

`DESIGN_BRIEF.md` yaşayan ürün ve UX kaynağıdır; teknik mimari
`docs/ARCHITECTURE.md` ve ilgili ADR'lerde tutulur. Geçmiş bir iddia yalnız bu
belgelerden birinde yazdığı için doğrulanmış sayılmaz. Her iddia mümkün olduğunda
sabit bir Git commit'ine ve yeniden üretilebilir kanıta bağlanmalıdır.

## 2. Sorumluluk ve onay ilkesi

- Ürün amacı, kabul kriteri ve nihai karar insana aittir.
- Yapay zekâ analiz, öneri, kod ve test taslağı üretebilir; bunlar açık insan
  onayı veya bağımsız doğrulama olmadan insan kararı olarak sunulamaz.
- “Uygulandı”, “test edildi”, “cihazda doğrulandı” ve “yayımlandı” ayrı
  durumlardır. Biri diğerini ima etmez.
- AI tarafından yazılan kayıt, AI katkısı alanında açıkça belirtilir.
- İnsan onayı için tarih, onayın kapsamı ve mümkünse konuşma/issue/commit
  referansı kaydedilir. Sadece “onaylandı” yazmak yeterli değildir.

## 3. Kanıt düzeyleri

| Kod | Anlam | Asgari kanıt |
|---|---|---|
| `E0` | İddia veya retrospektif anlatı | Kaynak belge ve sınırlama notu |
| `E1` | Depoda gözlemlenen uygulama | Commit hash + dosya/satır veya diff |
| `E2` | Otomatik doğrulama | Commit hash + tam komut + tarihli sonuç/CI bağlantısı |
| `E3` | Hedef cihazda doğrulama | Build kimliği + cihaz/OS + senaryo + sonuç + artefakt |
| `E4` | İnsan kabulü veya sürüm kanıtı | Açık kabul kaydı ve/veya yayımlanmış sürüm kimliği |

Bir kaydın kanıt düzeyi, sahip olduğu en yüksek numara değil, iddiayı gerçekten
destekleyen düzeydir. Örneğin typecheck başarısı görsel flicker'ın düzeldiğini
kanıtlamaz; bu iddia için `E3` gerekir.

## 4. Durum sözlüğü

`Önerildi` → `İnsan tarafından onaylandı` → `Uygulandı` → `Otomatik doğrulandı`
→ `Cihazda doğrulandı` → `Kabul edildi` → `Yayımlandı`

Bir kayıt birden fazla durumu ayrı tarihlerde taşıyabilir. “Retrospektif” etiketi,
olay sırasında tutulmayan ve daha sonra Git/dokümanlardan yeniden kurulan bilgiyi
gösterir.

## 5. SPARK gereksinim–kanıt matrisi

Aşağıdaki başlangıç satırları mevcut Git geçmişi ve `DESIGN_BRIEF.md` üzerinden
retrospektif olarak çıkarılmıştır. Bunlar bağımsız doğrulama değildir; boş kanıt
alanları tamamlanmadan akademik sonuç iddiasında kullanılmamalıdır.

| Kimlik | Gereksinim / problem | Karar veya sözleşme | Uygulama referansı | Doğrulama referansı | İnsan/cihaz kabulü | Düzey | Retrospektif sınırlama |
|---|---|---|---|---|---|---|---|
| `SPK-DOM-001` | Analiz projeksiyonu Dashboard ile aynı bütçe dönemini kullanmalı | Takvim ayı yerine bütçe döngüsü ve `effectiveBudget` esas alınır | Commit `5248b98`; `app/(tabs)/analytics.tsx`, `src/utils/spendingProjection.ts` | `src/utils/__tests__/spendingProjection.test.ts`; tarihli komut çıktısı eklenecek | Cihaz kaydı eklenecek | `E1` | Kayıt olaydan sonra commit ve rehberden çıkarıldı |
| `SPK-DOM-002` | Fiş indirimi ve toplamı küçük kullanıcı düzeltmelerinde binary float artığı üretmemeli; basılı toplam AI kalem farkıyla ezilmemeli | Toplam/indirim minor-unit tamsayılarıyla hesaplanır; DAO yazmaları para hassasiyetine normalize edilir; explicit item mutasyonu ve header senkronu atomiktir. İlk ingestion basılı toplamı korur; eski REAL artıkları başlığı yeniden yorumlamayan tek seferlik migration ile temizlenir | Mevcut çalışma ağacı; `src/utils/{moneyMath,receiptMoney}.ts`, `src/db/{database,expenseDao}.ts`, `src/services/{geminiService,receiptLineMerge,receiptParser}.ts`, `app/{add-expense,edit-items}.tsx` | `AI-2026-08-09-RECEIPT-MONEY-001`: typecheck exit 0; tam Jest 43/43 suite ve 310/310 test; Android Metro export 1.923 modül | Örnek fişte `3,17` indirim, `55,93` toplam, `0,20` değişiklik, yeniden açma ve upgrade migration'ı hedef cihazda bekleniyor | `E0` | Otomatik testler saf hesap ve mock DAO/migration sözleşmesini doğrular; gerçek Expo SQLite upgrade ve ekran kabulü henüz cihazda kaydedilmedi |
| `SPK-REL-001` | Temiz kurulumda DB seed ve eşzamanlı okuma çakışmamalı | DB tüketicileri seed tamamlanana kadar ortak init promise'ini bekler | Commit `5865af8`; `src/db/database.ts` | Temiz-kurulum otomasyonu veya logu eklenecek | Cihaz/build kaydı eklenecek | `E1` | Kök neden açıklaması `DESIGN_BRIEF.md` P28'e dayanır |
| `SPK-I18N-001` | AZ/RU çevirileri derlemede kaybolmamalı | Üretilmiş locale dosyaları doğrudan düzenlenmez; `map-*` + derleme + parity testi kullanılır | `src/i18n/compilePartial.mjs`, `src/i18n/buildLocales.mjs` | `src/i18n/__tests__/localeParity.test.ts`; CI bağlantısı eklenecek | İnsan dil kontrolü ayrı kaydedilecek | `E1` | Geçmişteki sessiz kayıp rehberde retrospektif anlatılmıştır |
| `SPK-UX-001` | Soğuk açılışta ve sekmeler arası geçişte tema/yüzey flicker'ı olmamalı; mounted Tarayıcı aktif temadan sapmamalı | Native splash ve JS boot yüzeyi tek gate; uygulama teması React store üzerinden uygulanır; aynı palet React Navigation context'ine taşınır; lazy scene/placeholder opak tema yüzeyidir | Mevcut çalışma ağacı; `app/{_layout,(tabs)/_layout}.tsx`, `app/(tabs)/scanner.tsx`, `src/theme/{themeStore,navigationTheme}.ts` | `AI-2026-08-09-THEME-CONTINUITY-001`: navigation theme, tab scene ve Scanner regresyonları dahil typecheck exit 0; tam Jest 46/46 suite ve 314/314 test; Android Metro export 1.924 modül | Standalone APK'da cold start, light/dark, Dashboard→Tarayıcı doğrudan dokunma, ilk lazy ziyaret, swipe ve runtime tema değişimi video-kare kontrolü zorunlu | `E0` | Otomatik testler React yüzey sözleşmesini doğrular; native PagerView kompozisyonu, sistem penceresi ve tek karelik flicker cihaz kanıtı olmadan “çözüldü” sayılamaz |
| `SPK-NOTIF-001` | Bildirimler güvenli tekli ve toplu silinebilmeli | Swipe yalnız sil aksiyonunu açar; uzun basma seçim modudur; toplu DB mutasyonu atomiktir | Mevcut çalışma ağacı; `app/notifications.tsx`, `src/notifications/storage.ts` | Test dosyaları ve tam sonuç eklenecek | Gerçek cihaz gesture testi eklenecek | `E0` | Bu kayıt mevcut kodu işaretler; commit/CI/cihaz kabulü bekleniyor |
| `SPK-NOTIF-002` | Fiş bildirimi kullanıcı tarafından düzeltilen son satıcıyı göstermeli; okunmamış durum kartı domine etmemeli | `receipt-saved-{expenseId}` kayıtları tek batch DAO sorgusuyla kanonik harcamaya uzlaştırılır; düzenleme sonrası hedefli yenileme yapılır. Satıcı başlığa taşınır; unread durumu ince sınır/ton, güçlü başlık, küçük nokta ve erişilebilir etiketle gösterilir | Mevcut çalışma ağacı; `app/{add-expense,notifications}.tsx`, `src/notifications/{buildNotifications,receiptNotifications}.ts`, `src/db/expenseDao.ts` | `AI-2026-08-02-NOTIFICATION-QUALITY-001`: odaklı 4/4 suite ve 31/31 test; typecheck; tam Jest 38/38 suite ve 249/249 test; Android export 1.919 modül | Düzenlemeden önce kaydedilen fişte son satıcı, eski feed'in focus-sync onarımı, açık/koyu unread/read, detay, swipe ve seçim modu cihaz kontrolü bekleniyor | `E0` | Bildirim/DAO testleri mock kullanır; gerçek SQLite yaşam döngüsü ve cihaz görsel kabulü commit/build kimliğiyle henüz kanıtlanmadı |
| `SPK-DOC-001` | Proje bilgisi yaşayan rehber, tarihçe ve tez kanıtı olarak ayrılmalı | Tek-kaynak sahipliği; ürün, mimari, ADR, tarihçe ve evidence belgeleri farklı sorumluluk taşır | Mevcut çalışma ağacı; `DESIGN_BRIEF.md`, `AGENTS.md`, `docs/` | `AI-2026-08-01-DOCS-001`: legacy SHA-256, 20 Markdown dosyasında 0 kırık göreli bağlantı, temiz `git diff --check`, typecheck ve 30/30 Jest suite | İnsan belge incelemesi bekleniyor | `E0` | Doğrulama kirli ve commit'e bağlanmamış çalışma ağacında yapıldı; ürün testleri belge içeriğinin akademik doğruluğunu kanıtlamaz |
| `SPK-ANA-001` | Analiz kartları kayıt varken yeni takvim ayında sıfır görünmemeli | Aylık Analiz, Dashboard ile aynı çözülmüş bütçe döngüsünü; karşılaştırma da önceki bütçe döngüsünü kullanır. Geç tamamlanan eski sorgu yeni dönem sonucunu ezemez | Mevcut çalışma ağacı; `app/(tabs)/analytics.tsx`, `src/utils/analyticsPeriod.ts`, `src/hooks/useExpenses.ts`, çapraz-ay heatmap bileşenleri | `AI-2026-08-01-ANALYTICS-001`: `npm run typecheck` exit 0; tam Jest 32/32 suite, 207/207 test; Android Metro export başarılı | Hedef cihazda 23 Tem–22 Ağu senaryosu bekleniyor | `E0` | Kod ve yerel test henüz commit/build kimliğine bağlı değildir; 526,82 tutarı cihaz DB'sinde bu oturumda doğrudan okunmadı |
| `SPK-UX-002` | Ürün fiyat grafiğinde seçilen değer diğer gözlemleri örtmemeli ve öngörülebilir biçimde kapatılabilmeli | Kayan tooltip yerine grafik dışında sabit inceleme şeridi; çakışmayan seçim bantları; yeniden dokunma, açık kapatma ve bağlam değişiminde sıfırlama; hassas para gösterimi | Mevcut çalışma ağacı; `src/components/LineChart.tsx`, `src/components/ItemAnalyticsModal.tsx`, `DESIGN_BRIEF.md` | `AI-2026-08-01-PRICE-CHART-001`: `npm run typecheck` exit 0; tam Jest 33/33 suite, 213/213 test; Android Metro export başarılı | Hedef cihazda yoğun nokta, sheet scroll, açık/koyu tema ve TalkBack kontrolü bekleniyor | `E0` | Kullanıcı ekran görüntüleri başlangıç durumunu gösterir; otomatik test gerçek cihaz gesture ve görsel yerleşimini tek başına kanıtlamaz |
| `SPK-ANA-002` | Yıllık analiz, döneme uymayan kartla veya aynı satıcının tekrarlarıyla bilgi değerini düşürmemeli | Yıllıkta ay sonu projeksiyonu render edilmez; en yüksek işlemler her satıcının en yüksek tek gerçek işlemi olarak DAO'da seçilir ve kart bu kuralı açık başlık/açıklamayla belirtir. Diğer dönemlerde genel işlem sıralaması korunur | Mevcut çalışma ağacı; `app/(tabs)/analytics.tsx`, `src/db/expenseDao.ts`, `src/hooks/useExpenses.ts`, `src/components/analytics/{ProjectionCard,TopTxCard}.tsx` | `AI-2026-08-02-ANALYTICS-DENSITY-001`: typecheck exit 0; tam Jest 37/37 suite, 236/236 test; Android export 1.918 modül | Aynı yıllık aralıkta tekrarlı kira ve farklı satıcılarla yıl/ay geçişi; kart sırası ve açık/koyu tema kontrolü bekleniyor | `E0` | DAO testi SQL sözleşmesini mock ile doğrular; gerçek cihaz SQLite sonucu ve uzun başlık yerleşimi insan kabulü bekler |
| `SPK-UX-003` | Uzun ürün fiyat geçmişi, grafiği nokta kalabalığına dönüştürmeden finansal gerçeği korumalı | Ardışık aynı fiyat/satıcı koşuları sınırlarıyla sıkıştırılır; gerekirse ilk/son, kaynak konumu ve gerçek kova uçları korunarak en fazla 32 gerçek gözlem çizilir; görsel işaretler 12'ye seyreltilir, tek geniş yüzey en yakın gözlemi seçer, ham geçmiş erişilebilir kalır ve sadeleştirme sayıları açıklanır | Mevcut çalışma ağacı; `src/utils/priceHistorySeries.ts`, `src/components/{ItemAnalyticsModal,LineChart}.tsx`, `DESIGN_BRIEF.md` | `AI-2026-08-02-ANALYTICS-DENSITY-001`: saf seri ve component testleri dahil tam Jest 37/37 suite, 236/236 test; typecheck ve Android export başarılı | 2, 23, 32 ve 100+ kayıtlı ürünlerde seçim, sheet scroll, büyük font ve TalkBack kontrolü bekleniyor | `E0` | X ekseni gerçek gün aralıkları yerine kronolojik gözlem sırasını sürdürür; otomatik test gerçek cihaz jest ve görsel yoğunluğu tek başına kanıtlamaz |
| `SPK-UX-004` | Kayıtlı hedef yokken silme eylemi sunulmamalı; hedef silme kategori limitlerini kaybettirmemeli | Silme görünürlüğü form metnine değil kalıcı hedef varlığına bağlıdır; DAO gerçek satır değişimini bildirir; boş/stale durumda uyarı verilir ve hedef ile limit yaşam döngüleri ayrılır | Mevcut çalışma ağacı; `app/goal-settings.tsx`, `src/db/{goalDao,categoryLimitDao}.ts`, dört dil kaynağı | `AI-2026-08-09-GOAL-DELETE-001`: typecheck exit 0; hedef/locale odaklı 3/3 suite ve 16/16 test; tam Jest 48/48 suite ve 319/319 test | Hedef yok, hedef+limit var ve hızlı çift dokunma senaryoları standalone cihazda bekleniyor | `E0` | Component testleri React durum/DAO sözleşmesini mock'lar; gerçek SQLite ve modal dokunma davranışı cihaz kabulü bekler |
| `SPK-UX-005` | Birikim hedefi isteğe bağlı olarak daha görünür olmalı; açık borç önceliğini bozmamalı, aynı hedefi tekrarlamamalı ve limitleri hedefe bağlamamalı | Varsayılan kapalı yerel tercih yalnız aktif/tamamlanmamış hedefi borç uyarısından sonra kompakt gösterir; tam kart aynı anda gizlenir, tamamlanan hedef standart karta döner. Hedef yüzeyleri yalnız ilk kalıcı tercih yüklemesinde bekler; sonraki yenilemeler mevcut kartı korur. Hesap ve katkı sheet'i iki görünümde ortaktır; haptic hatası tamamlanmış finansal yazmayı geri çeviremez | Mevcut çalışma ağacı; `app/{(tabs)/index,settings-budget}.tsx`, `src/components/SavingsGoal{Card,PulseCard,ContributionSheet}.tsx`, `src/services/goalFeatureSettings.ts`, `src/utils/{savingsGoalProgress,dashboardGoalPresentation}.ts`, dört dil kaynağı | `AI-2026-08-09-GOAL-FOCUS-001`: odaklı 8/8 suite ve 41/41 test; typecheck exit 0; tam Jest 55/55 suite ve 349/349 test; final Android Metro export 1.928 modül; `git diff --check` temiz | Standalone APK'da açık/koyu tema, dört dil, büyük font, borç+hedef önceliği, tercih kalıcılığı, aktif/tamamlanmış/gecikmiş hedef ve hızlı katkı bekleniyor | `E0` | Testler sunum/tercih/hesap sözleşmesini doğrular; gerçek SQLite, font ölçekleme, haptic ve fiziksel dokunma yerleşimi cihaz kabulü bekler |
| `SPK-ANA-003` | Sıfır harcama, seri ve hedef-altı istatistikleri kısmi gün veya yapay hedef nedeniyle yanıltıcı olmamalı | Yalnız tamamlanmış günler sayılır; bugün payda ve gün sınıflarından çıkarılır, bugünkü harcama aktif seriyi keser. Takip-temelli uzun dönem ilk gerçek kayıtta başlar; geçmiş aralık serisi dönem sonunda ölçülür. Sabit günlük hedef yalnız aktif kanonik aylık bütçe döngüsünde kullanılır | Mevcut çalışma ağacı; `app/(tabs)/analytics.tsx`, `src/utils/spendingStats.ts`, `src/components/analytics/StreakCard.tsx`, `src/components/StreakDetailsSheet.tsx` | `AI-2026-08-02-SPENDING-STATS-001`: typecheck exit 0; tam Jest 41/41 suite ve 287/287 test; Android Metro export 1.921 modül | Aylık/yıllık/geçmiş aralık geçişleri, bugün işlemli/işlemsiz durum ve görünen metinler hedef cihazda bekleniyor | `E0` | Testler saf takvim ve hesap sözleşmesini doğrular; commit/build kimliği ve cihaz kabulü yoktur |
| `SPK-NOTIF-003` | Uygulama içi bildirimler Android sistem tepsisine açılış flicker'ı, içerik sızıntısı veya çift teslim oluşturmadan taşınmalı | Feed yetkili kalır; native aktivasyon reveal sonrasıdır ve Expo Go native importtan önce guard edilir. Yerelleştirilmiş sessiz `updates` ile yüksek öncelikli `alerts` kanalları `PRIVATE` kilit ekranı kullanır; içeriksiz ledger, kanonik revision kontrolü ve recovery teslimi tekrar güvenli yapar; izin durumu tercihlerden OS ayarına bağlanır | Mevcut çalışma ağacı; `app/{_layout,notifications}.tsx`, `src/context/NotificationsContext.tsx`, `src/services/androidNotificationsSetup.ts`, `src/notifications/{storage,presentation}.ts` | `AI-2026-08-02-ANDROID-SYSTEM-NOTIFICATIONS-001`: typecheck exit 0; tam Jest 41/41 suite ve 287/287 test; Android Metro export 1.921 modül | Fiziksel standalone APK'da cold start, izin, iki kanal, kilit ekranı, resume/yeniden başlatma, silme ve warm/cold tap doğrulaması bekleniyor | `E0` | Expo Go bu native davranışları kanıtlamaz; OS schedule ile SQLite yazımı mutlak atomik değildir ve ani süreç ölümü penceresi cihazda ayrıca sınanmalıdır |

## 6. Yeni izlenebilirlik kaydı şablonu

Her yeni özellik, hata düzeltmesi veya araştırma için aşağıdaki blok kopyalanır.

### `<KAYIT-KİMLİĞİ>` — `<kısa başlık>`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | `<YYYY-AA-GG, Europe/Warsaw>` |
| Kaydı açan | `<insan / issue / gözlem>` |
| İnsan tarafından onaylanan kapsam | `<onaylanan davranış ve sınırlar>` |
| Gereksinim | `<ölçülebilir kullanıcı/teknik gereksinim>` |
| Kabul kriterleri | `<Given/When/Then veya madde listesi>` |
| Başlangıç durumu | `<yeniden üretim adımları ve gözlenen sonuç>` |
| Karar/ADR | `<ADR kimliği veya gerekçeli karar>` |
| AI katkısı | `<analiz/kod/test/doküman; araç/model kaydı referansı>` |
| İnsan katkısı | `<gereksinim, seçim, inceleme, manuel test>` |
| Uygulama | `<commit hash ve dosyalar>` |
| Otomatik doğrulama | `<tam komut, exit code, tarih, log/CI URI>` |
| Cihaz doğrulaması | `<build, cihaz, OS, senaryo, sonuç, ekran/video URI>` |
| Nihai insan kabulü | `<kim, tarih, kapsam, referans>` |
| Gizlilik kontrolü | `<temizlendi / redakte edildi / paylaşım kısıtı>` |
| Kalan risk | `<bilinen sınırlama ve takip işi>` |
| Kanıt düzeyi | `<E0–E4>` |
| Retrospektif sınırlama | `<olay sırasında tutulmayan/veri kaybı olan alanlar>` |

## 7. Doğrulama kanıtı biçimi

### Otomatik test kaydı

```text
Commit/build: <hash veya build kimliği>
Tarih/saat dilimi: <ISO-8601>
Ortam: <OS, Node, paket yöneticisi>
Komut: <tam ve yeniden çalıştırılabilir komut>
Exit code: <0/non-zero>
Özet: <suite/test sayısı, typecheck sonucu>
Artefakt: <CI URL veya depo içi log yolu>
Kapsamadığı iddialar: <ör. görsel kalite, gerçek cihaz gesture'ı>
```

### Cihaz doğrulama kaydı

```text
Build: <APK/IPA/EAS build kimliği ve commit>
Cihaz: <üretici/model; kişisel cihaz adı kullanmayın>
OS: <sürüm>
Uygulama modu: <release/development/Expo Go>
Ön koşullar: <tema, dil, DB durumu, ağ>
Adımlar: <numaralı senaryo>
Beklenen: <ölçülebilir sonuç>
Gözlenen: <sonuç>
Artefakt: <redakte edilmiş video/screenshot/log>
İnceleyen ve tarih: <insan>
```

## 8. Gizlilik ve araştırma etiği

- Gemini API anahtarı, token, EAS secret, credential, cihaz UUID'si, mutlak kullanıcı
  yolu ve kişisel finans verisi bu kayda yazılmaz.
- Ekran görüntülerinde bildirim çubuğu, kişi/satıcı isimleri, tutarlar ve dosya
  yolları paylaşım amacına göre redakte edilir.
- Konuşma dökümünün tamamı yerine kararın özeti ve kontrollü referansı tutulur.
- Tez ekine girecek AI çıktıları insan tarafından doğrulanır; hatalı veya reddedilen
  öneriler de seçici biçimde silinmek yerine sonuçlarıyla kaydedilir.
- Hash kullanılıyorsa neyin hash'lendiği, algoritma ve oluşturma tarihi belirtilir;
  hash, içeriğin doğruluğunu değil yalnız bütünlüğünü destekler.

## 9. Retrospektif kayıt sınırlaması

Geçmiş commitlerden sonradan oluşturulan kayıtlar şu riskleri açıkça taşımalıdır:

- O sırada değerlendirilen fakat kayda geçmeyen alternatifler bilinmeyebilir.
- Commit mesajı insan niyetini eksik veya hatalı özetleyebilir.
- Daha sonra güncellenen `DESIGN_BRIEF.md`, olay anındaki bilgiyi yansıtmayabilir.
- Test dosyasının varlığı, testin ilgili committe gerçekten çalıştırıldığını göstermez.
- Bugünkü cihaz sonucu, geçmiş build'in davranışının kanıtı değildir.

Bu nedenle retrospektif satırlar `E0` veya `E1` ile başlatılır; tarihli CI, cihaz ve
insan kabul kanıtı bulunmadıkça daha yüksek düzeye çıkarılmaz.
