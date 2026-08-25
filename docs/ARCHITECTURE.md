# SPARK Mimarisi

Bu belge SPARK'ın kalıcı mimari sınırlarını ve domain değişmezlerini tanımlar. Mevcut deponun nasıl düzenlendiğini açıklar; kesin bağımlılık sürümlerini, yayın numaralarını veya üretilen metrikleri tekrar etmez.

## Kaynak sahipliği

Dokümantasyon ile çalıştırılabilir yapılandırma çelişirse aşağıdaki çalıştırılabilir kaynak yetkilidir ve bu belge düzeltilmelidir.

| Konu | Yetkili kaynak |
|---|---|
| Bağımlılıklar ve çalıştırılabilir script'ler | [`package.json`](../package.json) ve `package-lock.json` |
| Expo uygulama metaverisi ve native izinler | [`app.json`](../app.json) ve [`app.config.js`](../app.config.js) |
| EAS derleme profilleri | [`eas.json`](../eas.json) |
| Rotalar ve sunum davranışı | [`app/`](../app) |
| Veritabanı şeması ve başlatma | [`src/db/schema.ts`](../src/db/schema.ts) ve [`src/db/database.ts`](../src/db/database.ts) |
| Tasarım token'ları ve çalışma zamanı teması | [`src/theme/`](../src/theme) |
| Çeviri anahtarları ve locale artifact'leri | [`src/i18n/`](../src/i18n) |
| Otomatik doğrulama | [`package.json`](../package.json) ve [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |

Geliştirme kuralları [`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md), kalite ve güvenlik sınırları [`QUALITY_AND_SECURITY.md`](QUALITY_AND_SECURITY.md) içindedir.

## Sistem bağlamı

SPARK, iOS ve Android için çevrimdışı öncelikli bir kişisel finans uygulamasıdır. Birincil veri deposu cihaz içi SQLite veritabanıdır. İsteğe bağlı fiş tanıma, sıkıştırılmış görseli Google Gemini'ye gönderir; uygulamanın geri kalanı API anahtarı veya ağ bağlantısı olmadan kullanılabilir.

Başlıca çalışma zamanı sınırları şunlardır:

```text
Kullanıcı / cihaz
    |
    v
Expo Router ekranları (app/)
    |
    +--> UI bileşenleri, context'ler ve hook'lar
    |        |
    |        +--> domain yardımcıları ve bildirim kuralları
    |        +--> servisler ve DAO'lar
    |
    +--> SQLite (birincil yerel veri)
    +--> SecureStore (Gemini API anahtarı)
    +--> cihaz kamerası, galeri, dosya ve bildirim API'leri
    +--> Gemini API (isteğe bağlı fiş ayrıştırma ve açık kullanıcı eyleminde ürün eşleşme önerisi)
```

## Depo katmanları

### Rotalar ve ekran orkestrasyonu — `app/`

Dosya tabanlı navigasyonun sahibi Expo Router'dır. [`app/_layout.tsx`](../app/_layout.tsx) composition root'tur: veritabanını başlatır, açılış yüzeyini korur, onboarding durumunu çözer, provider'ları kurar, kök stack'i yapılandırır ve global hata/toast yüzeylerini barındırır.

`(tabs)` grubu beş ana alanı içerir:

- Dashboard
- İşlemler
- Tarayıcı
- Analiz
- Ayarlar

İkincil rotalar harcama düzenleme, fiş kalemleri, kategoriler, hedefler, bildirimler, abonelikler ve gruplandırılmış ayar sayfalarını kapsar. Ekranlar veri ile navigasyonu koordine etmelidir; yeniden kullanılabilir sunum `src/components` altında bulunmalıdır.

### Sunum — `src/components/`

Paylaşılan UI, grafikler, modal'lar, sheet'ler, geri bildirim yüzeyleri ve analiz kartları burada bulunur. Analiz bilinçli olarak bölünmüştür: [`app/(tabs)/analytics.tsx`](<../app/(tabs)/analytics.tsx>) veri ile kart sırasını orkestre eder; ayrı memoize kartlar ve ortak stiller [`src/components/analytics/`](../src/components/analytics) altında yer alır. Ayarlar ana menüsünün ve alt sayfalarının kart-dışı bölüm/gezinme satırı sözleşmesi [`src/components/SettingsList.tsx`](../src/components/SettingsList.tsx) içinde ortaktır; ekranlar kendi kalıcı kart kabuklarını üretmez, yalnız gerçek seçim/giriş kontrollerini sınırlı yüzey olarak korur.

### Uygulama durumu — `src/context/` ve `src/hooks/`

Context'ler dil, para birimi, yenileme invalidation'ı ve bildirimler gibi ekranlar arası durumu sunar. Hook'lar DAO'ları ve domain yardımcılarını ekranların kullanacağı duruma dönüştürür. Provider değerleri ve dışarı açılan callback'ler referans bakımından kararlı kalmalıdır; geliştirme rehberine bakın.

### Kalıcılık — `src/db/`

Veritabanı modülü paylaşılan SQLite bağlantısının, başlatmanın, bütünlük kontrolünün, şema oluşturmanın, uyumluluk migration'larının ve ilk kategori seed işleminin sahibidir. DAO modülleri tabloya özgü okuma ve mutasyonları yönetir. Ürün kimliği çözümü ve kullanıcı kontrollü alias/merge/split mutasyonları [`src/db/productIdentityDao.ts`](../src/db/productIdentityDao.ts) içinde kalır; ekranlar bu ilişkileri doğrudan SQL ile değiştirmez.

SQLite WAL modu ve foreign-key enforcement ile yapılandırılır. Başlatma, veritabanı promise'ının arkasında serileştirilir; böylece istemciler ilk kurulum seed işlemi sürerken sorgu çalıştıramaz.

### Domain ve entegrasyon servisleri — `src/services/`

Servisler fiş ayrıştırma, Gemini iletişimi, yedekleme/import, güvenli anahtar saklama, abonelik tespiti, bütçe döngüsü ayarları, Android bildirim kurulumu ve bekleyen tarama durumunu içerir. Servisler DAO'ları ve platform API'lerini koordine edebilir ancak aşağıdaki domain değişmezlerini korumalıdır.

### Bildirim motoru — `src/notifications/`

Bildirim tipleri, kural değerlendirmesi, feed kalıcılığı ve serileştirilmiş mutasyonlar bildirim ekranından ayrıdır. React context uygulamaya dönük işlemleri sunar; ekran depolama kurallarını kendi içinde uygulamamalıdır.

### Saf politika ve biçimlendirme — `src/utils/`

Tarih aralıkları, bütçe döngüsü matematiği, borca göre düzeltilmiş bütçe, tamamlanmış-gün harcama istatistikleri, minor-unit para matematiği, para biçimlendirme, doğrulama, fiş onarımı, birim-duyarlı ürün canonicalization'ı ve tema zamanlama yardımcıları burada bulunur. Saf iş kuralları React ve SQLite import'larından bağımsız kalmalı, böylece doğrudan test edilebilmelidir.

### Çapraz kesen yapılandırma — `src/theme/` ve `src/i18n/`

Tema token'ları ve çalışma zamanı tema mağazası ortak altyapıdır. Tema seçimi
iki bağımsız eksenden oluşur: `light`/`dark` görünüm şeması ve
`green`/`blue`/`orange`/`purple`/`red` vurgu kimliği. Mağazanın dışarı verdiği
tek immutable snapshot; şema, vurgu, bunlardan çözülen tam palet ve değişiklik
revision'ını birlikte taşır. Böylece yalnız vurgu değiştiğinde de stiller,
birincil CTA'lar, seçili kontroller ve aktif navigasyon renkleri aynı React
ağacında güncellenir.

Nötr yüzey token'ları görünüm şemasına; `primary`, `primaryAction`,
`onPrimary` ve tonal vurgu token'ları seçilen vurguya bağlıdır.
`primaryAction`/`onPrimary` çifti dolu eylem kontrastının yetkili kaynağıdır.
Başarı, tehlike, uyarı ve bilgi semantiği; kategori renkleri, grafik serileri,
uygulama ikonu ve splash renkleri vurgu seçiminden bağımsızdır. Uygulama içindeki
tipografik `LivingSparkWordmark`, bu sabit native marka varlıklarından ayrıdır ve
tema snapshot'ındaki vurgu tonlarını kontrollü bir UI kimliği olarak kullanır.
Dashboard ve Ayarlar aynı bileşeni tüketir; harf geometrisi sabitken yalnız iç
SVG ışık/çekirdek katmanları Reanimated ile hareket eder. Sekme odağı,
uygulama-önplan durumu ve sistem hareket azaltma tercihi animasyon kapısıdır.
Ortam hareketleri üç UI-thread döngüsüdür; bu saatlerden iki karşıt yatay akış,
yarım fazlı iki merkez dalgası ve iki dolaşan sis çekirdeği olmak üzere altı
eliptik primitive türetilir. Sert dikdörtgen bant yerine yalnız tema paletinin
koyu/ana/açık tonlarını kullanan radial-gradient çekirdekleri hareket eder.
İmzanın tek Pressable yüzeyine dokunma ayrıca sürekli
döngü eklemeden, aynı SVG kırpma sınırı içinde merkezden sola ve sağa ayrılan
kısa, yeniden başlatılabilir bir tepki üretir. Bu kontrol navigasyon veya
finansal durum değişikliği yapmaz. Saf `resolveWordmarkMotionProfile`, aydınlık
temada temel uç rengini ana vurguya eşitler ve sis hareketini `S`–`K` kapsamına
genişletir; karanlık temanın onaylanmış koyu uç ve daha merkezî hareket profilini
değiştirmez.

[`src/theme/navigationTheme.ts`](../src/theme/navigationTheme.ts), aynı çözülmüş
paleti React Navigation context'ine taşır; stack, pager, scene wrapper ve lazy
placeholder yüzeyleri ekran component'leriyle aynı arka planı kullanır. Vurgu
değişimi navigator'ı anahtarla yeniden mount etmez; mevcut rota ve geçiş durumu
korunurken theme context'i güncellenir. Çeviri anahtarları varsayılan ürün dili
olarak Türkçeyi; ayrıca İngilizce, Azerbaycanca ve Rusça sözlükleri kullanır.
Üretilen locale artifact'leri bağımsız doğruluk kaynağı değildir; geliştirme
rehberindeki i18n akışına bakın.

## Açılış yaşam döngüsü

İlk kareyi etkileyen durum tutarlı hâle gelmeden görünür uygulama açılmamalıdır.

1. Native splash modül başlatılırken tutulur.
2. SQLite açılır; WAL ve foreign key'ler etkinleştirilir, hızlı bütünlük kontrolü yapılır, şema garanti edilir, uyumluluk değişiklikleri ve gerekli seed işi tamamlanır.
3. Kalıcı görünüm şeması ve vurgu tercihi aynı DB readiness adımında okunur ve
   tek tema snapshot'ı olarak atomik uygulanır; onboarding durumu, dil ve para
   birimi de çözülür.
4. Provider'lar native pencere ve splash ile eşleşen koyu bir açılış yüzeyinin arkasında mount edilir.
5. Hedef rota perde opakken kesinleştirilir.
6. Layout commit'lerinden sonra native splash gizlenir ve uygulama tek kontrollü fade ile gösterilir.
7. Android bildirim kurulumu yalnız açılış perdesi kalktıktan sonra başlar.

İlk kareyi etkileyen tercihler veya startup provider'ları değiştiğinde bu readiness gate güncellenmelidir. Native görünüm değişiklikleri bu akış sırasında Android activity'sini yeniden oluşturmamalıdır.

Perde kalktıktan sonraki navigasyon da aynı süreklilik sözleşmesine tabidir. Root, aktif SPARK paletini React Navigation `ThemeProvider` üzerinden yayınlar. Material tab scene'leri ve lazy içerik bekleme yüzeyleri ayrıca aktif tema arka planını açıkça taşır; lazy yükleme performans için korunurken varsayılan açık navigator rengi görünür olamaz.

Görünüm ve vurgu, `settings` içindeki gizli olmayan cihaz-yerel tercihlerdir.
Geçersiz veya eksik vurgu SPARK yeşiline normalize edilir. Bu tercih yeni tablo,
şema migration'ı veya backup format artışı gerektirmez; taşınabilir finansal
backup'ın parçası değildir. Çalışma zamanı değişikliği
`Appearance.setColorScheme(...)` çağırmaz ve Android Activity yeniden
oluşturmasına dayanmaz.

## Domain modeli

| Varlık | Rol ve değişmez |
|---|---|
| `categories` | İkon, renk ve sistem sahipliği metaverisi bulunan iki seviyeli kategori ağacı. |
| `vendors` | Kanonik satıcı kaydı; manuel ve taranmış harcamalarda kullanılan varsayılan kategori tutabilir. |
| `expenses` | Finansal işlem başlığı. Kaydedilmiş fiş toplamı tüketim toplamıdır. |
| `expense_items` | Harcamaya bağlı isteğe bağlı fiş satır ayrıntısı; ham `name`/`turkish_name`, ayrı kullanıcı görünüm etiketi, `measurement_unit` ve nullable kanonik ürün bağlantısını taşır; harcama silinince kalemler cascade ile silinir. |
| `canonical_products` | Ölçü birimine bağlı, taşınabilir UID'li ürün kimliği ve kullanıcıya dönük kanonik ad/metaveri. Yerel eşleşme anahtarı kullanıcı etiketi değildir. |
| `product_aliases` | Normalize edilmiş fiş etiketini aynı ölçüdeki kanonik ürüne bağlayan deterministik, AI veya kullanıcı kaynaklı öğrenilmiş eşleşme. Alias+ölçü çifti tektir. |
| `budgets` | Takvim ayı olmak zorunda olmayan bütçe döngüsü anahtarıyla ilişkili planlanan tutar. |
| `savings_goal` | Tek aktif birikim hedefi ve mevcut katkı tutarı. |
| `category_limits` | Döngü başına kategori harcama limitleri. |
| `subscriptions` | Yerel harcama geçmişinden çıkarılan tekrarlayan satıcı ödeme tahminleri ve kullanıcının gizleme durumu; kullanıcı taahhüdü değildir. |
| `recurring_payment_reminders` | Kullanıcının manuel tanımladığı veya bir tahminden açıkça onayladığı takvimli ödeme hatırlatıcıları. |
| `debts` | Tüketimden ayrı izlenen alınan veya verilen borç anaparası; nakit-akışı tarihi ile opsiyonel vade birbirinden ayrıdır. |
| `debt_payments` | Borca bağlı kısmi veya tam geri ödeme olayları. |
| `extra_incomes` | Geri ödeme yükümlülüğü olmadan harcanabilir nakdi artıran tek seferlik gelir. |
| `settings` | Yerel anahtar/değer tercihleri ve alt sistem durumu; gizli bilgiler burada tutulmaz. |

Kolonlar, constraint'ler, index'ler ve silme davranışında [`src/db/schema.ts`](../src/db/schema.ts) içindeki SQL bildirimleri yetkilidir.

`savings_goal` ile `category_limits` yaşam döngüsü bakımından bağımsızdır. Hedef
silme yalnız singleton hedef satırını etkiler; limitlerin silinmesi ayrı ve açık
bir kullanıcı eylemi gerektirir. DAO silme sonucu etkilenen satır sayısıyla
bildirilir; böylece boş veya eskimiş UI durumu başarı olarak sunulmaz.

Satıcı silme finansal kayıtları da etkilediği için tekli ve toplu yollar aynı DAO
sınırını kullanır. `VendorDao.deleteMany(...)` kimlikleri doğrular ve tekilleştirir;
bağlı `expenses` satırlarını ve ardından seçili `vendors` satırlarını aynı
`withTransactionAsync(...)` içinde siler. Onay yüzeyindeki etki sayısı tek bir
parametreli toplu sorguyla hesaplanır; UI onayından önce hiçbir silme yazması
başlatılmaz.

Dashboard hedef sunumu, `settings` içindeki gizli olmayan iki yerel tercihle
orkestre edilir: ana görünürlük tercihi varsayılan açık, kompakt öne çıkarma
tercihi varsayılan kapalıdır. Bu tercihler aynı sorguda okunur; ekran hedef ve
tercih okumaları tamamlanmadan hedef varyantı göstermez. Öne çıkarma yalnız
pozitif tutarlı, tamamlanmamış hedefte kullanılır. Açık borç banner'ı kompakt
hedeften önce kalır, tam hedef kartı aynı anda render edilmez ve kategori
limitleri hedef varlığına bağlanmaz. Yüzde, kalan tutar ve takvim-günü durumu
[`src/utils/savingsGoalProgress.ts`](../src/utils/savingsGoalProgress.ts) içindeki
saf hesap sözleşmesinden gelir; hızlı katkı iki hedef varyantının paylaştığı tek
sheet bileşenini kullanır.

## Finansal değişmezler

### Fiş ve harcama bütünlüğü

- Bir fiş, tek harcama ve sıfır veya daha fazla satır kalemi olarak saklanır.
- Fiş miktarı kanonik `piece`, `kg` veya `l` ile saklanır; g/ml manuel veya AI girdisi hesap öncesinde kg/L tabanına çevrilir. Ürün fiyat geçmişi aynı kimliğin farklı ölçü boyutlarını birleştirmez.
- Ürün gruplama, bağlantı varsa `canonical_product_id + measurement_unit`; eski veya belirsiz nullable kayıtta yalnız deterministik canonical anahtar + ölçü birimiyle yapılır. Fuzzy benzerlik tek başına otomatik merge değildir.
- Ham `name` ve `turkish_name` korunur. Kullanıcının görünen ad düzeltmesi `user_label` alanındadır; kanonik ürün adı da ham fiş kanıtının üzerine yazılmaz.
- Bir merge veya alias split yalnız ürün bağlantısını değiştirir; tutar, miktar, fiyat, tarih ve ham/görünen satır adlarını silmez. Ayrıntılı yetki sınırı [`ADR-010`](decisions/ADR-010-canonical-product-identity.md) içindedir.
- Başlık ve kalem oluşturma atomiktir.
- Model bir satırı kaçırsa bile ilk fiş importundan sonra basılı/taranmış harcama toplamı yetkili kalır.
- Açık kullanıcı eylemiyle ürün düzenleme, kullanıcı yönlendirmeli bir düzeltme olduğu için toplamı yeniden hesaplayabilir.
- `expenses.total_amount`, `expense_items.total_price`, satır indirimi ve indirim öncesi satır toplamı iki ondalıklı para alt birimine normalize edilir. Toplama/çıkarma [`src/utils/moneyMath.ts`](../src/utils/moneyMath.ts) üzerinden tamsayı minor-unit ile yapılır; `quantity` ve birim oranı bu değişmezden ayrıdır.
- Kullanıcı kaynaklı kalem ekleme/düzenleme/silme ile harcama başlığı toplamının senkronizasyonu tek SQLite transaction'ıdır. Başlık, item `REAL` değerlerini doğrudan toplamak yerine yuvarlanmış minor-unit toplamından üretilir.
- Eski binary float artıkları tek seferlik idempotent migration ile hassasiyete çekilir; migration başlığı kalem toplamına eşitlemez ve basılı toplam otoritesini değiştirmez.
- Borç veya geri ödemeyi modellemek için fiş görselleri ve kalemleri yapay harcamalara bölünmemelidir.

### Bütçe döngüleri

Bütçe dönemi kullanıcının belirlediği döngü başlangıç gününden türetilir. Başlangıç günü bir olduğunda takvim ayıyla eşleşir; diğer değerler aylar arası aralık üretir. Oluşturulan her bütçe kendi kesin başlangıç/bitiş sınırını ve başlangıç günü snapshot'ını saklar; global kural değişikliği geçmişi yeniden hesaplayamaz. Dashboard, analiz, bildirimler ve DAO sorguları aynı çözümlenmiş dönem sınırlarını kullanmalıdır.

Dashboard bütçe donutunda dış payda `effectiveBudget`, renkli segment değerleri
aynı dönemin kategori harcamalarıdır. Segment toplamı bütçeden küçükken fark nötr
ray olarak kalır; aşımda segmentler kesilmez ve harcama toplamı çizim ölçeği olur.
Kategori odak görünümü yalnız `DonutChart.totalValue` paydasını kaldırarak aynı
segmentleri 360 dereceye genişletir; DB sorgusu veya finansal hesap değiştirmez.
Yay geometrisi küçük segment boşluğunu değerin bir bölümüyle sınırlayan saf
[`src/utils/donutGeometry.ts`](../src/utils/donutGeometry.ts) sözleşmesinden gelir.
Dashboard, ortak donutun opt-in `showTrackGlassEdge` sunumunu kullanır; bu yalnız
SVG iç/dış sınır çizgileri ile nötr ray görünürlüğünü değiştirir ve diğer donut
tüketicilerini etkilemez. Merkezdeki genişlet rozeti dekoratiftir; erişilebilir
eylem tek merkez `Pressable` üzerinde kalır.

### Harcama istatistikleri

[`src/utils/spendingStats.ts`](../src/utils/spendingStats.ts), günlük toplamları takvim günü sıraları ve tam para birimi alt birimleriyle değerlendirir. Aynı güne ait kaynak satırları birleştirilir; bugün tamamlanmış gün sayılmaz ve sıfır-harcama, hedef-altı veya toplam gün hesabına girmez, fakat bugünkü gerçek harcama aktif sıfır-harcama serisini sıfırlar. Takip-temelli uzun dönem hesabı ilk gerçek kaynak kaydında başlar; veri yoksa sıfır değerli başarı sonucu yerine açık `no_data` durumu döner. Bugünü içermeyen aralığın serisi dönem sonunda ölçülür.

Günlük hedef yalnız seçili aralık aktif bütçenin kanonik aylık döngüsüyle tam eşleştiğinde sağlanır. Bu durumda hedef, sabit `effectiveBudget / totalDays` planıdır ve yalnız açık hedef aralığındaki tamamlanmış, harcama bulunan günlerle karşılaştırılır. Yıllık, geçmiş veya özel aralıklarda aynı bütçe hedefi geriye dönük olarak uydurulmaz.

### Borç ve ek gelir

Borç tüketim değil, nakit akışı düzeltmesidir. [`src/utils/debtMath.ts`](../src/utils/debtMath.ts) içindeki ortak hesap şu formülü tanımlar:

```text
etkin bütçe = planlanan bütçe + alınan borç - geri ödeme + ek gelir
kalan       = etkin bütçe - gerçek harcama
```

Borç alma, borç tarihinin bulunduğu döngüyü; geri ödeme, ödeme tarihinin bulunduğu döngüyü etkiler. Ek gelir yalnız kendi döngüsünü etkiler. Açık borç toplamı ayrı ve döngüden bağımsız bir bakiyedir.

Borç vadesi bütçe matematiğine katılmaz. `due_date`, yalnız kullanıcının ödeme
taahhüdünü ve hatırlatma zamanını tanımlar; `debts.date` nakit-akışı tarihini
korur. Tam ödeme, kalan/status güncellemesiyle aynı transaction içinde borç
hatırlatmasını kapatır; kısmi ödeme hatırlatma tercihini değiştirmez.

### Kullanıcı tarafından yönetilen ödeme hatırlatıcıları

`subscriptions` yeniden üretilebilen bir istatistiksel tahmindir.
`recurring_payment_reminders` ise kullanıcının açık kararıyla oluşan kalıcı bir
varlıktır; tahmin silindiğinde veya tespit penceresinden çıktığında kaybolmaz.
İlişkili satıcı kullanıcı tarafından silinirse bir `BEFORE DELETE` uzlaştırması
kaydı manuel yönetime geçirir, ardından FK satıcı bağını `NULL` yapar; onaylanmış
hatırlatıcı bu yan etkiyle sessizce silinmez.
Tekrar kuralı anchor tarihi, sıradaki vade, gün/hafta/ay/yıl birimi ve pozitif
aralıkla saklanır. Sıradaki vade bu programın gerçek bir oluşumu olmak zorundadır.
Ay sonu ve artık yıl hesabı
[`src/utils/recurringSchedule.ts`](../src/utils/recurringSchedule.ts) içinde
kanonik takvim parçalarıyla yapılır; cihaz saat dilimi tarih sonucunu
değiştiremez.

Bu kalıcı modelden iki ayrı ikincil görünüm türetilir. Uygulama içi kural katmanı
açık/bakiyeli borç ile etkin kullanıcı planını saf yerel takvim ve saat üzerinden
değerlendirir; kalıcı fingerprint aynı aşamanın silindikten sonra geri dirilmesini
engeller. Android coordinator ise aynı kanonik kayıtlardan geleceğe tarihli,
tek-seferlik native alarm planı üretir ve gerçek OS planlarıyla uzlaştırır.
Tahmini abonelik, borç ve onaylı plan ayrı kanallardır. Native kimlik ile teslim
ve planlama ledger'ları backup verisi değildir. Ayrıntılı sınır
[`ADR-006`](decisions/ADR-006-reminder-domain-and-delivery-boundaries.md) içinde
tanımlanır.

## Temel akışlar

### Fiş tarama ve kaydetme

```text
kamera/galeri
  -> Android bekleyen kamera sonucu kurtarma
  -> en-boy oranını koruyan, büyütmeyen görsel sıkıştırma
  -> seçili TR/EN/AZ/RU dili + dil bağımsız kategori anahtarıyla Gemini ayrıştırma
  -> sınırlı model keşfi/fallback ve opsiyonel yapılandırılmış ürün metadatası
  -> savunmacı JSON onarımı, alan sınırları ve coercion
  -> satıcı + tarih + gerçek kalem + tutar kalite kapısı
  -> tehlikeli anahtar temizliği ve girdi doğrulama
  -> fiş satırı birleştirme/sonlandırma
  -> kullanıcı önizlemesi
  -> yerel alias / deterministik kanonik kimlik çözümü
  -> atomik harcama + kalem + nullable ürün bağlantısı kalıcılığı
  -> yenileme ve bildirim senkronizasyonu
```

İptal, görüntü hazırlama ve etkin ağ isteğine taşınmalıdır. Kaynak seçimi, görüntü
hazırlama, model keşfi ve tüm tarama için sonlu zaman sınırları bulunur; Durdur
ekran kilidini ağın kapanmasını beklemeden bırakır ve geç gelen sonuç `scanId` ile
yok sayılır. Model fallback, retry, yanıt boyutu ve kalite sınırları ekranın değil
servisin sorumluluğudur. Teknik olarak başarılı fakat geçersiz fiş şeması döndüren
model kayda ilerlemez; sınırlı sıradaki modele geçilir. Boş kalem, eksik satıcı,
geçersiz tarih, anlamsız satır veya indirime dayanmayan sıfır sonuç finansal kayıt
olamaz. Gerçek sıfır fiş brüt satır ve tam indirim kanıtı gerektirir.

Modelin `localized_name` alanı tarama anındaki seçili dile aittir ve mevcut
`turkish_name` kalıcı alanına geriye uyumlu biçimde yazılır; ham `name` korunur.
Kategori kararı yerelleştirilmiş etiketten yapılmaz: `category_key` yerel kanonik
kategori adına çözülür ve kullanıcıya `tc(...)` üzerinden çevrilir. Gemini'nin
`product_identity` çıktısı yalnız açıklayıcı metadata olabilir; yerel eşleşme
anahtarını veya merge kararını belirlemez ve basılı adı değiştirmez.

### Kanonik ürün düzeltmesi

```text
kayıtlı alias tam eşleşmesi
  -> tek deterministik ve birim-uyumlu aday
  -> aksi durumda ayrı/yeni ürün veya belirsiz nullable bağlantı
  -> Benzer ürünleri düzenle
       -> isteğe bağlı, açık ve metin-only Gemini önerisi
       -> kullanıcı merge / alias split / kanonik adı düzeltme kararı
       -> atomik bağlantı güncellemesi; finansal gözlem korunur
```

[`app/product-matching.tsx`](<../app/product-matching.tsx>) içindeki AI eşleşme
yardımı yalnız kullanıcı bu eylemi açıkça başlattığında çalışır.
Ölçü uyuşmazlığı SecureStore veya ağ erişiminden önce reddedilir; aday metinler ve
yanıt alanları sınırlanır. Analiz render'ı, DB migration'ı ve arka plan işi ağ
çağrısı yapmaz. AI sonucu alias ekleyemez, ürünleri birleştiremez veya geçmiş
finansal kayıtları değiştiremez.

Eşleştirme ekranının ilk görünümü, [`productMatchDiscovery.ts`](../src/utils/productMatchDiscovery.ts)
içinde cihazda üretilen ve yalnız aynı ölçü birimini paylaşan güçlü olası çiftleri
inceleme kuyruğu olarak sunar. Bu fuzzy/yerel skor kalıcı kimlik kararı değildir;
çifte dokunmak yalnız mevcut açık kullanıcı merge akışını hazırlar. Ekran açılışı
Gemini çağrısı yapmaz. **Tüm ürünler** görünümü `SectionList` sanallaştırmasıyla
0–30, 31–90, 91–365, 365 günden eski ve geçerli satın alma geçmişi olmayan
bölümleri render eder; arama, ölçü, birikimli tarih ve son görülme/sıklık/ad
sıralaması aynı saf keşif katmanından geçer. İlk bireysel seçimden sonra aday
havuzu seçilen ürünün kanonik ölçü birimiyle sınırlandırılır.

[`ProductIdentityDao.getProductSummaries`](../src/db/productIdentityDao.ts), alias
ve fiş gözlemlerini iki ayrı CTE içinde önce ürün başına toplar, sonra
`canonical_products` ile birleştirir. Böylece çok sayıda alias ile çok sayıda fiş
satırının doğrudan join edilmesiyle oluşacak çarpımsal satır sayısı ve yanlış
`observation_count` engellenir. Ham, çevrilmiş ve kullanıcı etiketli ad özetleri
arama/yerel aday keşfine taşınır; finansal satırların kendisi ekran listesine
yüklenmez.

### Yedekleme ve geri yükleme

Yedekleme, kullanıcının seçtiği tarih aralığı için sürümlenmiş JSON payload dışa
aktarır. İlişkisel bütünlük için seçili aralıkta oluşturulan veya ödemesi bulunan
bir borç, tüm ödeme geçmişiyle taşınır; kullanıcı tarafından yönetilen düzenli
ödeme hatırlatıcıları tarihsel olay değil yapılandırma olduğundan aralıktan
bağımsız taşınır. Import, tek transaction içinde uygulamadan önce payload'ın
tamamını doğrular ve sanitize eder. Kaynak SQLite kimlikleri hedef kimlik olarak
kullanılmaz; harcama, borç ve ödeme ilişkileri kaynak-hedef haritalarıyla kurulur.
Seçilen aralığın dışında kalan bağlı harcama payload'a gizlice eklenmez;
v3 bunun yerine ilişkinin export kapsamı nedeniyle eksik olduğunu açık bir
marker ile taşır. Böylece gerçekten bağlantısız borç ile eksik ilişki birbirine
karışmaz; aynı DB'ye geri yükleme mevcut bağı silmez veya ikinci borç üretmez.
Borç kalan/status değeri ödeme geçmişinden yeniden türetilir. Backup v4,
`canonical_products`, `product_aliases`, `user_label` ve item bağlantısını yerel
SQLite ID'si yerine taşınabilir kanonik ürün UID'siyle taşır. v1-v3 import
desteği korunur ve bu sürümler ürün kimliği koleksiyonlarını boş kabul eder.
v4 doğrulaması alias tekilliği, ölçü uyumu ve referans bütünlüğünü transaction
başlamadan denetler; tekrar import mevcut UID/aliası yeniden kullanır ve çakışan
payload'ı kısmi yazı bırakmadan reddeder. Kalıcı bir varlık veya
alan eklemek; şema başlatma, DAO, export oluşturma, import uyumluluğu ve yedek
format sürümünün birlikte incelenmesini gerektirir.

### Bildirimler

Bildirim kural motoru mevcut yerel durumdan feed girdileri türetir. Eşzamanlı yenileme, okuma, sessize alma ve silme işlemlerinin birbirini ezmemesi için feed ve dismissal-rule değişiklikleri serileştirilir. Çoklu silme paralel tekli yazmalar yerine tek depolama işlemi olmalıdır.

Borç ve onaylı ödeme planı kuralları `Date`/UTC takvim farkına güvenmez;
kanonik `YYYY-MM-DD`, yerel `HH:MM` ve saf gün farkı kullanır. Her kaynak için
vade, tercih ve aşamayı içeren PII taşımayan deterministik kimlik ile son
fingerprint tutulur. Aşama yükselince veya program değişince önceki türev feed'den
kaldırılır; okundu durumu ile ilk oluşturulma zamanı kanonik metin güncellenirken
korunur. Açık kullanıcı silmesi ayrı state'tir; 40 kayıtlık feed kapasitesi
nedeniyle teknik budama silme kabul edilmez ve kapasite baskısında en yakın
vadeler korunur. Kapanmış borç, duraklatılmış/silinmiş plan ve onaylı plana
dönüşmüş tahmin cleanup'ı sessize alma durumundan bağımsızdır; kaldırılan veya
aynı ID'de kanonik içeriği değişen tray kopyası transaction sonrasında best-effort
temizlenir. Mute uygulama-içi geçmişi korur fakat native retry teslimini de keser.
Feed veya native zamanlama bir ödemeyi gerçekleşmiş saymaz. Coordinator yalnız
etkin planın geçmişte kalmış schedule cursor'ını tekrar kuralındaki bugünkü veya
sonraki gerçek oluşuma ilerletir; bu işlem ödeme olayı, harcama ya da finansal
durum değişikliği üretmez. Açılış perdesinin arkasında çağrılan veya kuyrukta
bekleyen bir sync, native teslim daha sonra etkinleşse bile cursor ilerletme
yetkisi kazanmaz. Cold tap varsa son response normal bootstrap sync'inden önce
işlenir; eski oluşumun feed bağlamı kurulduktan ve native uzlaştırma uygulanabilir
olduktan sonra cursor ilerletilir.

Uygulama içi feed yetkili ve native teslimden bağımsız kalır. Android sistem bildirimi kök reveal kapısı kalktıktan sonra etkinleştirilir; Expo Go guard'ı native modül yüklenmeden önce çalışır. Standalone/development build'de rutin güncellemeler varsayılan ve sessiz `updates`, bütçe/hedef gibi dikkat gerektiren kayıtlar yüksek öncelikli sesli/titreşimli `alerts` kanalına gider. İki kanal da kilit ekranında `PRIVATE` görünürlük kullanır.

Teslim idempotency'si, `settings` içindeki sınırlı yerel ledger ile korunur. Ledger yalnız feed kimliği, native kimlik ve zaman bilgisi taşır; başlık, gövde veya finansal içerik saklamaz. İlk aktivasyon eski feed'i topluca yeniden bildirim olarak üretmez; başarılı teslim kaydedilir, başarısız teslim sonraki senkronizasyonda yeniden denenebilir. Native planlama öncesinde kanonik feed varlığı, okunma durumu ve içerik revision'ı aynı mutasyon kuyruğunda yeniden doğrulanır; kullanıcı silme veya satıcı düzeltmesi sırasında eski snapshot diriltilmez. Kanal adları uygulama dilinde güncellenir; sistem izni Bildirimler tercihlerinde görünür ve ham tarama tanısı panel için jenerik metne çevrilir. Uygulamanın arka plandan dönmesi feed ve native teslimi yeniden senkronize eder. Uygulama içinden silme tray kopyasını kaldırır; warm/cold bildirim dokunuşu kaydı okunmuş sayıp bildirim rotasına yönlendirir.

Android scheduling ve SQLite ledger yazımı tek OS transaction'ı değildir. Schedule sonrası ledger hatasında servis native kaydı geri kaldırıp retry yapar; kaldırma da başarısızsa süreç içi guard ikinci uyarıyı keser. Ani süreç ölümü sınırında mutlak exactly-once kanıtı verilemez; deterministik native kimlik, kalıcı ledger ve APK tekrar-teslim smoke testi bu küçük pencerenin azaltıcı kontrolleridir.

`scheduleNotificationAsync` çağrısının resolve olması tek başına başarı kanıtı
sayılmaz. Uzlaştırıcı yazımdan sonra Expo'nun uygulamaya ait kalıcı
scheduled-request envanterini tekrar okur, eksik deterministik kimliği bir kez
yeniden dener ve ikinci kez doğrular. Yazım sonrası envanter okunamazsa veya iki
ledger'ın ortak commit'i başarısızsa bu turda denenmiş native istekler telafi
iptaliyle geri alınır; doğrulanmamış kayıt başarılı/baseline edilmiş gösterilmez.
Bu envanter Expo'nun uygulama sahipliğindeki scheduled-request listesidir,
ayrıcalıklı bir `AlarmManager` dump'ı değildir.

Geleceğe tarihli planlama yalnız SPARK'a ait deterministik native kimlikleri
uzlaştırır; başka uygulama veya özelliklerin OS bildirimleri topluca iptal
edilmez. Borç için yaklaşan ve vade-günü alarmları, düzenli ödeme içinse mevcut
oluşumdan başlayarak 400 günlük ve plan başına en fazla 14 oluşumluk rolling
horizon hazırlanır; toplam istek sayısı 512 ile sınırlandırılır ve yakın
oluşumlar planlar arasında adil seçilir. Alarm kurulduğunda aynı feed kimliği
anlık teslim ledger'ında baselined edilerek uygulama açıldığında ikinci kez
teslim edilmez. Doze/inexact teslim nedeniyle zamanı geçtiği halde native
envanterde bekleyen alarm önce actual-vs-desired uzlaştırmasında iptal edilir;
başarılı iptal aynı transaction'da eski baseline'ı kaldırır. Kanonik kayıt bundan
sonra da anlık tray köprüsünde yeni uyarı olarak üretilmez; yalnız uygulama-içi
feed catch-up'ı olarak kalır. İptali başarısız istek 512 OS kotasına dahil
kalır ve ikinci alarm kurulmaz. Dil veya sunum metni değişirse revision değişir
ve bekleyen OS isteği yenilenir. Tetiklenip scheduled envanterden düşmüş tray kopyaları exact
feed kimliği ve içerik özetiyle izlenir; aşama, vade, tutar veya mute değişiminde
stale sayılır ve temizleme hatası ledger handle'ını koruyarak sonraki sync'te
yeniden denenir. Kalıcı ledger canlı 512 OS alarmını cleanup retry kayıtlarından
ayrı tutar; cleanup backlog'u canlı alarm kimliklerini budayamaz. DST ilkbahar
boşluğuna düşen yerel saat occurrence'ı kaybetmez, aynı takvim günündeki platformun
ileri normalize ettiği ilk geçerli saate taşınır. Android exact-alarm özel erişimi istenmez; Doze, üretici pil
politikası ve işletim sistemi alarmı seçilen dakikadan geciktirebilir. Reboot ve
paket yenilemesinde Expo'nun kalıcı native deposu planları yeniden kurar;
uygulama kapalıyken yapılan saat-dilimi değişikliği ancak sonraki startup/resume
uzlaştırmasında yeni yerel saate çevrilir. Force-stop sonrası teslim garantisi
verilmez ve bu sınırlar standalone APK kabulünde ayrıca sınanır.

Native planlı ailelerin uygulama açıldığında kural motorunca üretilen
`upcoming/today/overdue` veya dikkat-kilometre taşı karşılıkları yalnız kanonik
feed catch-up'ıdır. Anlık Android köprüsü bu kimlikleri bastırır; eski sürümün
aynı feed kimliğiyle oluşturduğu anlık tray handle'ını temizlerken gerçek
`spark:future:v1:` alarm/tray handle'ını korur. Böylece uygulama açılış saati
alarmın planlanan teslim saati gibi görünmez ve gerçek zamanlı alarm ikinci kez
üretilmez.

Aynı desired-state uzlaştırması, veri yazmadan yalnız önceden bilinen dikkat
zamanlarını da taşır: tamamlanmamış birikim hedefi için son tarihe kalan
`90/30/14/7/3/1/0` günler saat `09:00`, pozitif aktif bütçe için dönem
ilerlemesinin `%50/%75/%90` takvim günleri saat `19:00` yerel alarmıdır. Kimlik
hedef tarihi veya donmuş bütçe dönemi başlangıcını içerir; hedef/bütçe değişimi,
tamamlanma ve kanal mute'u bir sonraki yazma-tetikli sync'te eski planı iptal
eder. Uygulama uzun süre açılmazsa feed'e geçmiş eşik yığını eklenmez; her ailede
yalnız son geçilmiş kilometre taşı kanonik karta bağlanır. Bu katman harcama
verisini arka planda tahmin etmez. Bütçe tüketimi ve kategori aşımı yalnız yeni
yerel finansal event geldiğinde hesaplanır ve event sonrası senkronizasyonda
teslim edilir. Bildirim tercihleri ledger tahmini yerine Android'in gerçek SPARK
scheduled envanter sayısını gösterir.

Borç, ödeme planı, hedef, bütçe, hedef katkısı, restore ve onboarding bütçe
yazıları tamamlandıktan sonra scheduler desired-state'i doğrudan yenilenir;
genel 300 ms UI invalidation'ı tek başına teslim garantisi değildir. Native
senkronizasyon bu kalıcı yazılardan ayrı, best-effort bir yan etkidir ve hata
durumunda tamamlanmış finansal/domain işlemi geri çevrilmez. Yedek hatırlatması
ve kullanıcı tarafından henüz onaylanmamış abonelik tahminleri uygulama-tetikli
feed kapsamındadır; tarih çıpası/domain kararı olmadan kapalı uygulama alarmına
dönüştürülmez.

## Bağımlılık ve değişiklik sınırları

- Ekranlar hook ve component'leri birleştirebilir; domain hesapları saf yardımcı fonksiyonlara çıkarılmalıdır.
- Component'ler veritabanı şeması veya migration kararlarının sahibi olmamalıdır.
- DAO'lar mutasyon girdilerini doğrular ve SQL'in sahibidir; çağıranlar SQL parçalarını tekrar etmemelidir.
- Gemini API anahtarının sahibi SecureStore'dur. SQLite settings yalnız gizli olmayan tercihleri içerebilir.
- Gemini ürün kimliği metadatası ve açık eşleşme yanıtı yalnız öneridir; render, migration veya arka plan çalışması sırasında ağ çağrısı ya da kullanıcı onaysız semantik merge yapılamaz.
- Özellikle Expo Go bildirim sınırlamalarında platform davranışı guard ile korunmalıdır.
- Bir şema değişikliği yedekleme/geri yükleme ve geriye dönük uyumluluk incelenmeden tamamlanmış sayılmaz.
- Harcanabilir nakdi etkileyen yeni kaynak, ortak bütçe hesabı, budget hook, analiz, bildirimler ve testler aynı döngü semantiğinde uzlaşmadan tamamlanmış sayılmaz.
- İlk kareyi etkileyen yeni tercih, startup readiness ve flicker davranışı incelenmeden tamamlanmış sayılmaz.
- Vurgu paleti değişikliği; tam tema snapshot reaktivitesi, navigator sürekliliği, semantik renk bağımsızlığı ve `primaryAction`/`onPrimary` kontrastı incelenmeden tamamlanmış sayılmaz.

## Bu belgenin bakımı

Bu belge yalnız kalıcı sınırlar, veri semantiği, açılış sırası veya özellikler arası akışlar değiştiğinde güncellenmelidir. Özellik geçmişi, kapanmış hata envanterleri, kesin paket sürümleri ve güncel test sayıları başka yerde tutulmalı veya çalıştırılabilir kaynaklardan türetilmelidir.
