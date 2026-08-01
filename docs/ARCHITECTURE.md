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
    +--> Gemini API (isteğe bağlı fiş ayrıştırma)
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

Paylaşılan UI, grafikler, modal'lar, sheet'ler, geri bildirim yüzeyleri ve analiz kartları burada bulunur. Analiz bilinçli olarak bölünmüştür: [`app/(tabs)/analytics.tsx`](<../app/(tabs)/analytics.tsx>) veri ile kart sırasını orkestre eder; ayrı memoize kartlar ve ortak stiller [`src/components/analytics/`](../src/components/analytics) altında yer alır.

### Uygulama durumu — `src/context/` ve `src/hooks/`

Context'ler dil, para birimi, yenileme invalidation'ı ve bildirimler gibi ekranlar arası durumu sunar. Hook'lar DAO'ları ve domain yardımcılarını ekranların kullanacağı duruma dönüştürür. Provider değerleri ve dışarı açılan callback'ler referans bakımından kararlı kalmalıdır; geliştirme rehberine bakın.

### Kalıcılık — `src/db/`

Veritabanı modülü paylaşılan SQLite bağlantısının, başlatmanın, bütünlük kontrolünün, şema oluşturmanın, uyumluluk migration'larının ve ilk kategori seed işleminin sahibidir. DAO modülleri tabloya özgü okuma ve mutasyonları yönetir.

SQLite WAL modu ve foreign-key enforcement ile yapılandırılır. Başlatma, veritabanı promise'ının arkasında serileştirilir; böylece istemciler ilk kurulum seed işlemi sürerken sorgu çalıştıramaz.

### Domain ve entegrasyon servisleri — `src/services/`

Servisler fiş ayrıştırma, Gemini iletişimi, yedekleme/import, güvenli anahtar saklama, abonelik tespiti, bütçe döngüsü ayarları, Android bildirim kurulumu ve bekleyen tarama durumunu içerir. Servisler DAO'ları ve platform API'lerini koordine edebilir ancak aşağıdaki domain değişmezlerini korumalıdır.

### Bildirim motoru — `src/notifications/`

Bildirim tipleri, kural değerlendirmesi, feed kalıcılığı ve serileştirilmiş mutasyonlar bildirim ekranından ayrıdır. React context uygulamaya dönük işlemleri sunar; ekran depolama kurallarını kendi içinde uygulamamalıdır.

### Saf politika ve biçimlendirme — `src/utils/`

Tarih aralıkları, bütçe döngüsü matematiği, borca göre düzeltilmiş bütçe, para biçimlendirme, doğrulama, fiş onarımı, ürün normalizasyonu ve tema zamanlama yardımcıları burada bulunur. Saf iş kuralları React ve SQLite import'larından bağımsız kalmalı, böylece doğrudan test edilebilmelidir.

### Çapraz kesen yapılandırma — `src/theme/` ve `src/i18n/`

Tema token'ları ve çalışma zamanı tema mağazası ortak altyapıdır. Çeviri anahtarları varsayılan ürün dili olarak Türkçeyi; ayrıca İngilizce, Azerbaycanca ve Rusça sözlükleri kullanır. Üretilen locale artifact'leri bağımsız doğruluk kaynağı değildir; geliştirme rehberindeki i18n akışına bakın.

## Açılış yaşam döngüsü

İlk kareyi etkileyen durum tutarlı hâle gelmeden görünür uygulama açılmamalıdır.

1. Native splash modül başlatılırken tutulur.
2. SQLite açılır; WAL ve foreign key'ler etkinleştirilir, hızlı bütünlük kontrolü yapılır, şema garanti edilir, uyumluluk değişiklikleri ve gerekli seed işi tamamlanır.
3. Kalıcı tema, onboarding durumu, dil ve para birimi çözülür.
4. Provider'lar native pencere ve splash ile eşleşen koyu bir açılış yüzeyinin arkasında mount edilir.
5. Hedef rota perde opakken kesinleştirilir.
6. Layout commit'lerinden sonra native splash gizlenir ve uygulama tek kontrollü fade ile gösterilir.
7. Android bildirim kurulumu yalnız açılış perdesi kalktıktan sonra başlar.

İlk kareyi etkileyen tercihler veya startup provider'ları değiştiğinde bu readiness gate güncellenmelidir. Native görünüm değişiklikleri bu akış sırasında Android activity'sini yeniden oluşturmamalıdır.

## Domain modeli

| Varlık | Rol ve değişmez |
|---|---|
| `categories` | İkon, renk ve sistem sahipliği metaverisi bulunan iki seviyeli kategori ağacı. |
| `vendors` | Kanonik satıcı kaydı; manuel ve taranmış harcamalarda kullanılan varsayılan kategori tutabilir. |
| `expenses` | Finansal işlem başlığı. Kaydedilmiş fiş toplamı tüketim toplamıdır. |
| `expense_items` | Harcamaya bağlı isteğe bağlı fiş satır ayrıntısı; harcama silinince kalemler cascade ile silinir. |
| `budgets` | Takvim ayı olmak zorunda olmayan bütçe döngüsü anahtarıyla ilişkili planlanan tutar. |
| `savings_goal` | Tek aktif birikim hedefi ve mevcut katkı tutarı. |
| `category_limits` | Döngü başına kategori harcama limitleri. |
| `subscriptions` | Yerel olarak çıkarılan tekrarlayan satıcı ödemeleri ve kullanıcının gizleme durumu. |
| `debts` | Tüketimden ayrı izlenen alınan veya verilen borç anaparası. |
| `debt_payments` | Borca bağlı kısmi veya tam geri ödeme olayları. |
| `extra_incomes` | Geri ödeme yükümlülüğü olmadan harcanabilir nakdi artıran tek seferlik gelir. |
| `settings` | Yerel anahtar/değer tercihleri ve alt sistem durumu; gizli bilgiler burada tutulmaz. |

Kolonlar, constraint'ler, index'ler ve silme davranışında [`src/db/schema.ts`](../src/db/schema.ts) içindeki SQL bildirimleri yetkilidir.

## Finansal değişmezler

### Fiş ve harcama bütünlüğü

- Bir fiş, tek harcama ve sıfır veya daha fazla satır kalemi olarak saklanır.
- Başlık ve kalem oluşturma atomiktir.
- Model bir satırı kaçırsa bile ilk fiş importundan sonra basılı/taranmış harcama toplamı yetkili kalır.
- Açık kullanıcı eylemiyle ürün düzenleme, kullanıcı yönlendirmeli bir düzeltme olduğu için toplamı yeniden hesaplayabilir.
- Borç veya geri ödemeyi modellemek için fiş görselleri ve kalemleri yapay harcamalara bölünmemelidir.

### Bütçe döngüleri

Bütçe dönemi kullanıcının belirlediği döngü başlangıç gününden türetilir. Başlangıç günü bir olduğunda takvim ayıyla eşleşir; diğer değerler aylar arası aralık üretir. Dashboard, analiz, bildirimler ve DAO sorguları aynı çözümlenmiş dönem sınırlarını kullanmalıdır.

### Borç ve ek gelir

Borç tüketim değil, nakit akışı düzeltmesidir. [`src/utils/debtMath.ts`](../src/utils/debtMath.ts) içindeki ortak hesap şu formülü tanımlar:

```text
etkin bütçe = planlanan bütçe + alınan borç - geri ödeme + ek gelir
kalan       = etkin bütçe - gerçek harcama
```

Borç alma, borç tarihinin bulunduğu döngüyü; geri ödeme, ödeme tarihinin bulunduğu döngüyü etkiler. Ek gelir yalnız kendi döngüsünü etkiler. Açık borç toplamı ayrı ve döngüden bağımsız bir bakiyedir.

## Temel akışlar

### Fiş tarama ve kaydetme

```text
kamera/galeri
  -> görsel sıkıştırma
  -> Gemini model keşfi ve ayrıştırma
  -> savunmacı JSON onarımı ve coercion
  -> tehlikeli anahtar temizliği ve girdi doğrulama
  -> fiş satırı birleştirme/sonlandırma
  -> kullanıcı önizlemesi
  -> atomik harcama + kalem kalıcılığı
  -> yenileme ve bildirim senkronizasyonu
```

İptal, etkin ağ isteğine taşınmalıdır. Model fallback, retry ve yanıt boyutu sınırları ekranın değil servisin sorumluluğudur.

### Yedekleme ve geri yükleme

Yedekleme, kullanıcının seçtiği tarih aralığı için sürümlenmiş JSON payload dışa aktarır. Import, tek transaction içinde uygulamadan önce payload'ın tamamını doğrular ve sanitize eder. Kalıcı bir varlık veya alan eklemek; şema başlatma, DAO, export oluşturma, import uyumluluğu ve yedek format sürümünün birlikte incelenmesini gerektirir.

### Bildirimler

Bildirim kural motoru mevcut yerel durumdan feed girdileri türetir. Eşzamanlı yenileme, okuma, sessize alma ve silme işlemlerinin birbirini ezmemesi için feed ve dismissal-rule değişiklikleri serileştirilir. Çoklu silme paralel tekli yazmalar yerine tek depolama işlemi olmalıdır.

## Bağımlılık ve değişiklik sınırları

- Ekranlar hook ve component'leri birleştirebilir; domain hesapları saf yardımcı fonksiyonlara çıkarılmalıdır.
- Component'ler veritabanı şeması veya migration kararlarının sahibi olmamalıdır.
- DAO'lar mutasyon girdilerini doğrular ve SQL'in sahibidir; çağıranlar SQL parçalarını tekrar etmemelidir.
- Gemini API anahtarının sahibi SecureStore'dur. SQLite settings yalnız gizli olmayan tercihleri içerebilir.
- Özellikle Expo Go bildirim sınırlamalarında platform davranışı guard ile korunmalıdır.
- Bir şema değişikliği yedekleme/geri yükleme ve geriye dönük uyumluluk incelenmeden tamamlanmış sayılmaz.
- Harcanabilir nakdi etkileyen yeni kaynak, ortak bütçe hesabı, budget hook, analiz, bildirimler ve testler aynı döngü semantiğinde uzlaşmadan tamamlanmış sayılmaz.
- İlk kareyi etkileyen yeni tercih, startup readiness ve flicker davranışı incelenmeden tamamlanmış sayılmaz.

## Bu belgenin bakımı

Bu belge yalnız kalıcı sınırlar, veri semantiği, açılış sırası veya özellikler arası akışlar değiştiğinde güncellenmelidir. Özellik geçmişi, kapanmış hata envanterleri, kesin paket sürümleri ve güncel test sayıları başka yerde tutulmalı veya çalıştırılabilir kaynaklardan türetilmelidir.
