# SPARK Kalite ve Güvenlik

Bu belge SPARK için zorunlu kalite kapılarını, güvenlik sınırlarını ve yayın riski kontrollerini tanımlar. Önceden kapatılmış denetim bulgularının geçmişini değil, mevcut politikayı kaydeder.

Mimari [`ARCHITECTURE.md`](ARCHITECTURE.md), uygulama kuralları [`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md) içinde belgelenmiştir.

## Kaynak sahipliği

| Konu | Yetkili kaynak |
|---|---|
| CI ortamı ve komut sırası | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Mevcut test/type-check script'leri | [`package.json`](../package.json) |
| Jest eşleştirme ve transform yapılandırması | `package.json` içindeki `jest` bölümü |
| Native izinler ve Expo plugin'leri | [`app.json`](../app.json) ve [`app.config.js`](../app.config.js) |
| Derleme profilleri | [`eas.json`](../eas.json) |
| Gizli anahtar saklama uygulaması | [`src/services/secureKeyStore.ts`](../src/services/secureKeyStore.ts) |
| Girdi doğrulama uygulaması | [`src/utils/inputValidation.ts`](../src/utils/inputValidation.ts) |
| Veritabanı bütünlüğü ve başlatma | [`src/db/database.ts`](../src/db/database.ts) |

Kesin test toplamları, paket patch sürümleri ve üretilen locale anahtar sayıları bilinçli olarak bulunmaz. Bu değerlerin sahibi CI çıktısı ve çalıştırılabilir yapılandırmadır.

## Otomatik kalite kapıları

Deponun zorunlu otomatik kontrolleri şunlardır:

```bash
npm run typecheck
npm test -- --ci --coverage=false
```

CI bu kapıları çalıştırmadan önce lockfile üzerinden kurulum yapar. Yerel odaklı testler geliştirme sırasında yararlıdır ancak teslimden önce tam paketin yerini almaz.

### Test stratejisi

Mevcut test paketi dört seviyeyi kapsar:

- Saf domain yardımcıları: tarihler, bütçe döngüleri, borç nakit akışı, tamamlanmış-gün harcama istatistikleri, projeksiyonlar, normalizasyon, doğrulama, para birimi ve fiş onarımı.
- Para regresyonları: virgül/nokta girdisi, kuruş toplama-çıkarma, indirimli satır, ardışık indirim, tam indirim, basılı toplam otoritesi, DAO yazma normalizasyonu ve eski veri migration'ı.
- Servis kuralları: Gemini yanıt coercion'ı, fiş satırı birleştirme, abonelik tespiti ve Android bildirim kanal/teslim politikası.
- Hook/context davranışı: eski sonuç koruması, refresh yayılımı, tema/dil readiness, bildirim serileştirme ve kalıcılık koordinasyonu.
- Component/ekran davranışı: analiz kartları, toast yaşam döngüsü, bildirim işlemleri, swipe affordance'ları ve çoklu seçim akışları.

SQLite, SecureStore, Reanimated, router API'leri ve platform servisleri gibi native modüller gerektiğinde mock'lanır. Bu, test paketini deterministik yapar ancak açık bir sınır oluşturur: geçen Jest sonucu gerçek cihaz grafiğini, izinleri, native veritabanı yaşam döngüsünü, OS bildirim davranışını veya derleme yapılandırmasını kanıtlamaz.

### Zorunlu native doğrulama

Değişiklik aşağıdaki alanlara dokunuyorsa development build veya APK smoke testi kullanın:

- Startup splash, tema, provider readiness veya routing
- Gesture Handler/Reanimated hareketi ve interruption davranışı
- Kamera, image picker, image manipulation, filesystem, paylaşım veya document picker
- SQLite başlatma, migration, transaction veya geri yükleme
- SecureStore kalıcılığı
- Android bildirim izni/channel davranışı
- Uygulama metaverisi, Expo plugin'leri, native izinler veya EAS yapılandırması

Sıcak navigasyonun yanında cold start da test edilmelidir. Expo Go her native açılış yüzeyini yeniden üretmediğinden startup görsel düzeltmeleri standalone build içinde doğrulanmalıdır.

Android sistem bildirimi değişikliklerinin APK smoke testi en az şu senaryoları kaydetmelidir: cold start sırasında reveal tamamlanmadan izin yüzeyi açılmaması; Android 13+ izin akışı; sessiz güncelleme ve dikkat gerektiren uyarı kanallarının önem/ses/titreşim farkı; kilit ekranında özel içerik görünürlüğü; resume ve yeniden başlatmada çift teslim olmaması; uygulama içi silmenin tray kopyasını kaldırması; warm/cold dokunuşun doğru kaydı okuyup Bildirimler'e yönlendirmesi. Geleceğe tarihli hatırlatıcılarda ayrıca seçilen saate planlama, settle/pause/delete/mute sonrası iptal, cold tap ile feed'e tek kayıt, process-kill, reboot, APK update, saat-dilimi değişiminden sonraki resume uzlaştırması ve Doze/OEM gecikmesi kaydedilmelidir. Force-stop sınırı ayrıca raporlanmalıdır. Expo Go sonucu bu davranışlar için cihaz kanıtı sayılmaz.

## Güvenlik modeli

SPARK hassas kişisel finans verisini yerel olarak saklar. Tek kasıtlı uzak veri yolu, Gemini üzerinden isteğe bağlı fiş analizidir. Güvenlik kararları her sınırda gizli anahtarları, finansal kayıtları, fiş görsellerini ve import edilen veriyi korumalıdır.

### Gizli bilgiler

- Gemini API anahtarı yalnız `secureKeyStore.ts` üzerinden OS-backed SecureStore içinde bulunmalıdır.
- Anahtarı SQLite, kaynak dosyaları, route parametreleri, backup payload'ları veya log'larda saklamayın.
- Anahtarı URL query parametresi yerine `x-goog-api-key` request header ile gönderin.
- Kopyalanan anahtar girdisini saklama ve kullanımdan önce trim edip doğrulayın.
- UI tanılaması anahtarın varlığını bildirebilir; prefix, suffix, uzunluktan türeyen fingerprint veya header içerebilen tam hata payload'ını göstermemelidir.

### Dış ve kullanıcı kontrollü girdi

Aşağıdakilerin tümünü güvenilmez kabul edin:

- Gemini yanıtları
- Backup JSON ve document-picker sonuçları
- Kullanıcının girdiği adlar, notlar, tarihler, tutarlar, miktarlar, para birimleri ve tanımlayıcı dizileri
- Dosya ve görsel URI'ları
- Eski uygulama sürümlerinden kalan kalıcı ayarlar

`src/utils/inputValidation.ts` içindeki merkezi sanitizer'ları kullanın. `__proto__`, `constructor` ve `prototype` gibi tehlikeli nesne anahtarları dış nesne ağaçlarından özyinelemeli çıkarılmalıdır. Koleksiyon boyutlarını ve metin uzunluklarını render veya kalıcılık öncesinde sınırlandırın.

### Loglama ve hata bildirimi

- API anahtarı, fiş base64 verisi, Gemini yanıt gövdesi, kullanıcı notları, satıcı adları veya finansal değerleri asla loglamayın.
- Development tanılamaları mümkün olduğunda `__DEV__` arkasında kalmalıdır.
- Production uyarıları kısa ve anonim alt sistem sinyalleri olmalıdır.
- Production UI içinde stack trace veya hassas exception ayrıntısı göstermeyin.
- Kök error boundary, ayrıntılı tanılamayı yalnız development ortamında tutarken kullanıcıya kurtarılabilir bir yüzey sunmalıdır.

### Ağ davranışı

- Gemini istekleri HTTPS, timeout, abort propagation, sınırlı retry ve kontrollü model fallback kullanmalıdır.
- Sonsuza kadar retry yapmayın veya eşzamanlı model keşfiyle istekleri çoğaltmayın.
- Beklenmedik büyüklükte model çıktısını UI veya veritabanı döngülerine ulaşmadan reddedin ya da sınırlandırın.
- Ağ hatası yerel veritabanını tutarlı, uygulamanın kalanını kullanılabilir bırakmalıdır.

### İzinler ve native yetenekler

Native izinlerin sahibi `app.json` dosyasıdır; dokümantasyon bağımsız bir izin listesi tutmamalıdır. Her yeni izin somut özellik ihtiyacı, kullanıcıya dönük açıklama ve daha dar bir sistem API'sinin bulunup bulunmadığına dair inceleme gerektirir.

Bildirim kurulumu Android sürüm davranışını ve Expo Go sınırlamalarını hesaba katmalıdır. Kullanılamayan push API'lerini mevcut ortam guard'ı olmadan import veya invoke etmeyin. Native aktivasyonu kök reveal kapısından önce başlatmayın; izin istemini ilk görünür kareyle yarıştırmayın. Rutin ve dikkat gerektiren kayıtları ayrı Android kanallarına ayırın ve finansal içerik için kilit ekranı görünürlüğünü `PRIVATE` tutun.

## Veri bütünlüğü

### SQLite

- WAL ve foreign-key enforcement etkin kalmalıdır.
- Başlatma, yıkıcı olmayan bir bütünlük kontrolü yapar. Bozulma kullanıcı verisini sessizce silmeden veya yeniden oluşturmadan görünür kılınmalıdır.
- İlişkili yazmalar atomiktir.
- İlk kurulum seed ve migration işlemleri veritabanı hazır olarak sunulmadan önce tamamlanır.
- Çakışabilen aynı bağlantı sorguları Expo SQLite shared-object yaşam döngüsünün gerektirdiği yerlerde serileştirilir.
- Silme davranışı foreign key'lere uymalı ve bağlı domain anlamını korumalıdır; örneğin bir harcamayı silmek borcu sessizce yeniden yorumlamamalıdır.
- Finansal toplamları ham JavaScript `number` veya SQLite `SUM(REAL)` sonucuyla kullanıcıya taşımayın. Para toplam/indirimlerini integer minor-unit ile hesaplayın; DAO yazma sınırında iki ondalığa normalize edin ve düzenlenebilir alanları ham `.toString()` yerine kanonik para metniyle doldurun.

### Yedekleme ve geri yükleme

- Backup payload'ları sürümlenir.
- Restore, mutasyondan önce belgenin tamamını doğrular ve sanitize eder.
- Import veritabanı transaction'ı içinde all-or-nothing çalışır.
- Desteklenen payload'larda yeniden import idempotent olmalıdır.
- Format sürümü artırımı, desteklenen eski sürümler için açık uyumluluk yolunu korumalıdır.
- Saklanan URI mevcut olsa bile fiş dosya içerikleri taşınabilir kabul edilmez.

### Bildirim durumu

Feed, okuma, mute, dismissal ve özel kural durumu birden fazla UI ve refresh yolundan güncellenebilir. Bu değişiklikleri ortak serileştirilmiş mutasyon mekanizması üzerinden kalıcılaştırın. Toplu işlemler tek atomik depolama değişikliği yapmalıdır; paralel tekli işlemlerden birleştirilmemelidir.

Native teslim başarısızlığı uygulama içi feed'in kalıcılığını geri almamalıdır. Tekrar teslimi önleyen ledger sınırlı ve idempotent olmalı; yalnız feed/native kimlikleri ile zaman damgalarını taşımalı, bildirim metni veya finansal veri saklamamalıdır. Başarılı teslim ledger'a yazılır; başarısız teslim sonraki resume/senkronizasyonda güvenle yeniden denenebilir. İlk native aktivasyon, eski feed kayıtlarını topluca sistem bildirimi olarak canlandırmamalıdır. Planlama öncesi kanonik feed `id/read/revision` kontrolü yapılmalı; schedule başarılıyken ledger yazımı başarısız olursa native side-effect geri alınarak retry hazırlanmalıdır. OS scheduling ile SQLite arasında mutlak atomiklik varsaymayın; ani süreç ölümü penceresini fiziksel APK'da tekrar-teslim senaryosuyla ayrıca kaydedin.

Geleceğe tarihli alarm uzlaştırması yalnız uygulamaya ait kimlik prefix'ini
yönetmeli; `cancelAll` kullanmamalı ve gerçek OS planlarını kanonik isteklerle
karşılaştırmalıdır. İptal edilmemiş future alarm ile daha önce sunulmuş tray
kopyası aynı şey değildir: future için cancel, sunulmuş kayıt için dismiss API'si
kullanılır. Uygulamanın SQLite schedule ledger'ı yalnız PII içermeyen kimlik,
revision ve zaman bilgisi taşır; ancak Expo/Android'in uygulamaya özel native
deposunda alarm başlık/gövdesi bulunabilir. Dokümantasyon bu iki depoyu
birbirine karıştırmamalıdır. Exact-alarm özel erişimi yokken tam dakika garantisi
verilmez; Doze/OEM, force-stop ve uygulama kapalıyken saat-dilimi değişikliği
fiziksel cihaz kabulünde açık sınırlama olarak raporlanır.

## Güvenilirlik gereksinimleri

### Açılış sürekliliği

Native splash, Android penceresi, JavaScript açılış yüzeyi ve ilk uygulama karesi tek kontrollü görsel sıra kullanır. Tema, dil, para birimi, veritabanı, onboarding hedefi ve layout readiness gösterimden önce çözülür.

Ara bir beyaz/varsayılan/native yüzey üretebilecek değişikliklerden kaçının:

- Splash'i erken gizlemeyin.
- Provider child'larını geçici boş kare olarak render etmeyin.
- Activity'yi yeniden oluşturan native görünüm değişikliklerini çağırmayın.
- Yanlış ilk rotayı şeffaf yüzey arkasında animate etmeyin.
- Nested navigator, lazy scene veya pager wrapper'ında React Navigation'ın varsayılan açık arka planını bırakmayın.
- Hata yolunun splash'i gizleyip kurtarılabilir ekran gösterme yeteneğini koruyun.

### Async latest-wins davranışı

Focus değişiklikleri, pull-to-refresh ve mutasyon invalidation'ı çakışan okumalar başlatabilir. Daha yavaş eski istek yeni sonucu ezmemelidir. React state için sequence/generation guard, sıralı kalıcılık için serileştirilmiş queue kullanın.

### UI geri bildirimi ve yıkıcı işlemler

- Async yıkıcı işlem sürerken tekrar dokunmayı engelleyin.
- Geri alınamaz toplu işlemler için tek bir onay kullanın.
- Silme ve seçim gesture'larını birbirinden bağımsız tutun.
- Navigasyon ve mod değişikliklerinde geçici swipe/sheet durumunu kapatın veya sıfırlayın.
- Kısa süreli toast geri bildirimi için yeni native modal penceresi oluşturmayın.
- Yalnız ikonlu veya gesture destekli eylemler için accessibility role, selected/checked state, label ve hint sağlayın.

## Performans korumaları

Performans çalışması doğruluğu ve görsel sürekliliği korumalıdır.

- N+1 SQL döngülerinden kaçının; tekrarlayan sorguları batch'leyin ve index'leyin.
- Genel JavaScript rehberliği `Promise.all` önerebilse bile ortak SQLite bağlantısı işini serileştirin.
- Büyük veri kümelerini sayfalayın ve liste callback'lerini kararlı tutun.
- Provider değerlerini ve memoize component'lere geçen prop'ları memoize edin.
- Yeni animasyonları desteklendiğinde UI thread üzerinde çalıştırın.
- Büyük `StyleSheet` nesnelerini her render'da yeniden oluşturmayın.
- Base64 dönüşümü ve ağ yüklemesinden önce fiş görsellerini sıkıştırın.
- Bağımlılık eklemeden veya spekülatif optimizasyon uğruna doğruluktan ödün vermeden önce ölçüm yapın.

## İnceleme kontrol listesi

### Her kod değişikliği

- [ ] TypeScript doğrulaması geçiyor.
- [ ] Odaklı testler değişen davranışı kapsıyor.
- [ ] Teslimden önce tam Jest paketi geçiyor veya engel kaydedilmiş.
- [ ] İlgisiz kullanıcı değişikliklerinin üzerine yazılmamış.
- [ ] Görünür metin dört dil akışını izliyor.
- [ ] Açık ve koyu tema çalışma zamanı tema token'larını kullanıyor.
- [ ] Async state daha eski istek tarafından ezilemiyor.

### Kalıcılık veya finansal mantık

- [ ] Girdiler mutasyon sınırında sanitize ediliyor.
- [ ] İlişkili yazmalar transaction içinde.
- [ ] Bütçe döngüsü sınırları ve para birimi semantiği açık.
- [ ] Borç, geri ödeme, gelir ve tüketim çift sayılmıyor.
- [ ] Backup/export/import etkisi incelenmiş.
- [ ] Mevcut kurulumlar için idempotent upgrade yolu var.

### Dış veya native davranış

- [ ] Gizli ve özel değerler log veya URL'ye giremiyor.
- [ ] Abort, timeout, retry ve offline davranışı tanımlı.
- [ ] İzinler ve Expo yapılandırması kendi kaynağında incelenmiş.
- [ ] Native sınır gerçek cihaz veya APK smoke testiyle kapsanmış.

### Yayını etkileyen değişiklikler

- [ ] CI temiz lockfile kurulumundan sonra geçiyor.
- [ ] EAS profili ve ortam gereksinimleri doğrulanmış.
- [ ] Cold start standalone build içinde kontrol edilmiş.
- [ ] Yayından etkilenen kamera/tarama/kaydetme, işlem yenileme, backup/restore, bildirim ve tema akışları smoke test edilmiş.

## Bu belgenin bakımı

Güvenlik sınırları, kalite kapıları, native doğrulama gereksinimleri veya güvenilirlik politikaları değiştiğinde bu belge güncellenmelidir. Kapanmış sorun envanterleri ve tarihli denetim anlatıları buraya eklenmek yerine history veya decision kayıtlarında bulunmalıdır. Kesin sayılar ve patch sürümleri CI ile çalıştırılabilir yapılandırmanın sahipliğinde kalır.
