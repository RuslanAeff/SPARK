# ADR-006: Hatırlatıcı domain modeli ve teslim sınırları

- **Status:** Accepted
- **Kayıt türü:** Prospective
- **Kabul tarihi:** 9 Ağustos 2026

## Bağlam

SPARK'ın mevcut `subscriptions` tablosu, yerel harcama geçmişinden tekrar eden
satıcı ödemelerini tahmin eder. Bu kayıtlar kullanıcı tarafından tanımlanmış bir
ödeme taahhüdü değildir; yeni harcamalar geldikçe yeniden üretilebilir veya
kaybolabilir. Borç modelindeki `date` ise borcun nakit akışına girdiği gündür,
son ödeme tarihi değildir.

Mevcut Android bildirim köprüsü uygulama açıldığında veya özgeçmişten döndüğünde
kanonik feed kayıtlarını sisteme teslim eder. Gelecekteki bir tarih için kapalı
uygulamayı uyandıran genel bir zamanlayıcı değildir. Bu üç kavramı aynı alan veya
tablo üzerinde birleştirmek; yanlış vade, kaybolan kullanıcı tercihi, yinelenen
teslim ve yedekten dönüşte bozuk ilişki riski oluşturur.

## Karar

1. Borcun gerçekleşme günü ile son ödeme tarihi ayrılır. `debts.date` nakit-akışı
   anlamını korur; opsiyonel `due_date` yalnız vade anlamına gelir.
2. Borç hatırlatma tercihi borç üzerinde saklanır: etkinlik, kaç gün önce
   hatırlatılacağı ve yerel teslim saati. Vadesiz borç için etkin hatırlatıcı
   oluşturulamaz. Borç tamamen kapandığında etkin hatırlatma aynı ödeme
   transaction'ında kapatılır; kısmi ödeme tercihi korur.
3. Kullanıcının manuel tanımladığı veya otomatik tahminden açıkça onayladığı
   düzenli ödeme, `recurring_payment_reminders` içinde ayrı ve kalıcı bir
   varlıktır. Türetilmiş `subscriptions` tablosuna yaşam döngüsü foreign key'i
   kurulmaz. İlişkili satıcı silinirse kullanıcı tarafından korunmuş hatırlatıcı
   silinmez; satıcı bağı çözülür ve kayıt manuel yönetilen kaynağa geçirilir.
4. Düzenli ödeme kimliği olan `uid`, yedek tekrar içe aktarımında ve ilerideki
   native planlama uzlaştırmasında kararlı mantıksal kimliktir. OS tarafından
   üretilen notification kimlikleri ve teslim ledger'ı taşınabilir veri değildir.
5. Tekrar kuralı `anchor_date`, `next_due_date`, birim ve pozitif aralıkla
   saklanır. Takvim hesabı `Date`, UTC ofseti veya cihaz saat dilimine bağlı
   olmadan kanonik `YYYY-MM-DD` parçalarıyla yapılır. Ay sonu ve artık yıl
   davranışı özgün anchor gününü korur. `next_due_date`, yalnız anchor'dan sonra
   olmakla yetinmez; bu programın gerçek bir oluşum günü olmak zorundadır.
6. Backup v3 borçları, borç ödemelerini, ek gelirleri ve kullanıcı tarafından
   yönetilen düzenli ödeme hatırlatıcılarını taşır. v1 ve v2 dosyaları yeni
   koleksiyonlar boş kabul edilerek okunmaya devam eder. İçe aktarımda kaynak
   SQLite kimlikleri hedef kimlik olarak kullanılmaz; ilişkiler kaynak-hedef
   haritalarıyla kurulur ve borç kalan/status değeri ödeme geçmişinden yeniden
   türetilir. Tarih aralığı dışında kalan bağlı harcama payload'a eklenmez;
   borçtaki açık ilişki-eksikliği marker'ı, bu durumu gerçekten bağlantısız
   borçtan ayırır.
7. Bu karar veri temelini tanımlar; bildirim feed kuralı veya geleceğe tarihli
   Android planlama davranışını tek başına etkinleştirmez. Native schedule,
   kalıcı veriden türetilen ve iptal/yeniden planlama ile uzlaştırılan ikincil bir
   yan etkidir.

## Faz 5 teslim kararı

- Android native zamanlama, açık borç ve etkin kullanıcı planlarından türetilen
  tek-seferlik `DATE` alarmlarını gerçek OS planlarıyla uzlaştırır. Yalnız SPARK'a
  ait deterministik kimlikler yönetilir; global `cancelAll` kullanılmaz.
- Borç için yaklaşan ve vade-günü alarmları kurulur. Kullanıcı planları için
  mevcut oluşumdan başlayan 400 günlük rolling horizon, plan başına en fazla 14
  oluşum ve global en fazla 512 istek kullanılır. Kapasite dağıtımı en yakın
  oluşumu her plan için önce korur.
- Geçmişte kalmış `next_due_date`, ödeme gerçekleşti kabul edilmeden yalnız
  schedule cursor'ı olarak bugünkü veya sonraki gerçek oluşuma ilerletilir.
  Finansal event, borç ödemesi veya harcama üretilmez.
- Native planlama ledger'ı PII içermeyen schedule/feed kimliği, revision ve
  zaman bilgisini taşır; backup'a girmez. Expo/Android'in kendi özel native
  deposunda kullanıcıya gösterilecek başlık ve gövde bulunabileceği için yalnız
  uygulama ledger'ı hakkında “içeriksiz” güvencesi verilir.
- Future schedule başarısı aynı feed kimliğini anlık teslim ledger'ında
  baseline eder. Böylece alarm çalıştıktan sonra uygulama senkronizasyonu aynı
  uyarıyı ikinci kez anlık bildirim olarak üretmez.
- Zamanı geçmiş fakat Doze/inexact nedeniyle hâlâ OS envanterinde bekleyen istek
  önce iptal edilir. Başarılı iptal eski future baseline'ını atomik snapshot'tan
  çıkarır; iptal başarısızsa istek kotaya dahil kalır ve duplicate kurulmaz.
  Bu bulletın “anlık fallback teslimi” kısmı aşağıdaki 25 Ağustos 2026 kararıyla
  geçersizdir: kanonik kayıt uygulama-içi feed catch-up'ı olarak kalır, anlık
  tray köprüsünde yeni uyarı olarak üretilmez.
- Native reveal öncesinde çağrılan veya sync kuyruğunda bekleyen çalışma cursor
  ilerletemez. Cold notification response normal bootstrap sync'inden önce
  kanonik feed'e uygulanır; native uzlaştırma `not_ready` veya `error` ise eski
  oluşum retry için korunur.
- Dil/metin değişikliği native revision'ı değiştirir. Tetiklenmiş tray kopyasının
  cleanup kararı exact feed kimliği ve içerik özetiyle verilir; mute, aşama,
  vade veya tutar değişikliği sonrası kaldırma başarısızsa ledger kaydı sonraki
  retry'a kalır.
- Native OS planı en fazla 512 istektir. Ledger bu 512 canlı isteği, en fazla
  512 fired-cleanup retry handle'ından ayrı havuzda korur; cleanup baskısı canlı
  planların kimliklerini düşüremez.
- DST ilkbahar saat boşluğuna denk gelen occurrence sessizce atlanmaz; aynı
  takvim gününde platformun ileri normalize ettiği ilk geçerli yerel saate taşınır.
- Exact-alarm özel erişimi istenmez. Doze/OEM politikaları teslimi geciktirebilir;
  force-stop ve uygulama kapalıyken saat-dilimi değişikliği için kesin teslim
  garantisi verilmez. Startup/resume uzlaştırması yeni yerel zamanı onarır.

## Değişmezler

- Otomatik abonelik tahmini kullanıcı tarafından onaylanmış hatırlatıcı değildir.
- Borç vadesi, borcun bütçe döngüsüne girdiği tarihi değiştirmez.
- Hatırlatıcı kaydı tüketim, borç ödemesi veya ek gelir üretmez.
- Geçersiz takvim günü, saat, tekrar kuralı veya orphan ilişki kalıcılığa
  sessizce düzeltilerek yazılmaz.
- Backup import mutasyondan önce doğrulanır ve ilişkili yazılar tek transaction'da
  tamamlanır.
- Yalnız birebir eşleşen taşınabilir kayıtlar atlanır; aynı mantıksal kimliğin
  farklı içeriği sessizce birleştirilmez.
- Uygulama içi feed kanonik kalır; native teslim başarısızlığı finansal veya
  hatırlatıcı verisini geri alamaz.

## 22 Ağustos 2026 dikkat-planı genişletmesi

- Aynı native actual-vs-desired mekanizması yalnız tarihi önceden bilinen iki
  ek kaynağı planlar: tamamlanmamış birikim hedefinin `90/30/14/7/3/1/0` gün
  kilometre taşları ve aktif bütçe döneminin `%50/%75/%90` kontrol günleri.
- Bu planlar yeni finansal kayıt, hedef katkısı veya bütçe sonucu üretmez.
  Harcama/kategori eşikleri arka planda tahmin edilmez; yeni yerel event
  kaydedildiğinde mevcut bildirim senkronizasyonunda değerlendirilir.
- Hedef ve bütçe kanalı mute'u kendi future planlarını desired-state'ten
  çıkarır. Tarih/dönem değişikliği deterministik kimliği değiştirdiği için eski
  OS isteği iptal edilir ve yeni istek kurulur.
- İlk açılış ve Android bildirim izni ön koşuldur. Process kill ve reboot sonrası
  planlar OS deposuna dayanır; kullanıcı Android ayarından **Zorla durdur**
  uyguladığında teslim garantisi yoktur. Exact-alarm özel izni istenmez.
- Tercih yüzeyi, uygulama ledger'ı yerine Android'in gerçek SPARK future-alarm
  envanterini sayar. Expo Go bu davranış için kabul ortamı değildir.

## 25 Ağustos 2026 teslim ve doğrulama sertleştirmesi

- Gerçek cihazda “planlanan tarih geçti” kaydının uygulama açıldığı anda tray'e
  gelmesi, kapalı uygulama alarmının gecikmesi değil; uygulama açılışında üretilen
  kanonik catch-up feed kaydının anlık köprüden ikinci kez sunulmasıydı.
- Borç/ödeme planı `upcoming/today/overdue` aşamaları ile hedef ve bütçe dikkat
  kilometre taşlarının app-open karşılıkları feed-only catch-up olarak sınıflanır.
  Eski anlık tray kopyası temizlenir; gerçek `spark:future:v1:` handle korunur.
- `scheduleNotificationAsync` resolve sonucu yeterli değildir. İlk yazımdan sonra
  Expo scheduled-request envanteri okunur, eksik deterministik istek bir kez
  yeniden denenir ve son envanter tekrar doğrulanır. Post-write okuma veya ortak
  ledger commit'i başarısızsa bu turda denenmiş native side-effect telafi
  iptaliyle geri alınır; `verifiedCount` başarı gibi korunmaz.
- Bildirim tercihleri permission'a ek olarak gerçek plan sayısı, sıradaki alarm,
  alerts kanalının blocked/degraded durumu ve desired/verified uyumsuzluğunu
  gösterir. Scheduler `error` sağlıklı ikonla sunulmaz ve onarım eylemi sağlar;
  eski async sorgu yeni modal oturumunun sonucunu ezemez.
- Borç, ödeme planı, hedef/bütçe ve restore gibi kalıcı kaynağı değiştiren
  işlemler yazı tamamlandıktan sonra doğrudan desired-state sync'i çağırır.
  Native hata tamamlanmış finansal/domain yazısını geri alamaz veya kullanıcıya
  aynı işlemi tekrar yaptıracak sahte kayıt hatasına dönüştürülemez.
- Exact-alarm özel erişimi istememe, Doze/OEM gecikmesi, force-stop sınırı ve
  standalone APK fiziksel kabul gereksinimi değişmemiştir. Expo'nun uygulamaya
  ait scheduled-request envanteri ayrıcalıklı AlarmManager dump'ı değildir.

## Sonuçlar ve ödünleşimler

**Olumlu:** Borç, tahmin ve kullanıcı taahhüdü açıkça ayrılır; tarih hesabı ay
sonunda kaymaz; backup tekrar importu güvenli bir kimliğe sahip olur; ilerideki
Android zamanlayıcı için test edilebilir tek veri kaynağı oluşur.

**Bedel:** Şema ve backup sürümü büyür. `next_due_date`, tekrar kuralıyla tutarlı
tutulmalıdır. SQLite ile OS zamanlayıcısı tek transaction paylaşamadığı için
deterministik uzlaştırma, telafi iptali ve fiziksel cihaz testleri zorunludur.

## Doğrulama

- Legacy veritabanında idempotent kolon/tablo/index migration'ı ve hata halinde
  marker yazılmaması.
- Borç oluşturma, hatırlatma ayarı, kısmi/tam ödeme ve geçersiz vade/saat DAO
  testleri.
- Ay sonu, artık yıl, günlük/haftalık/aylık/yıllık aralık ve saat dilimi bağımsız
  saf takvim testleri.
- Backup v1/v2 uyumluluğu; v3 kaynak-hedef ilişki haritası, tam ödeme geçmişi,
  türetilmiş kalan/status ve `uid` ile idempotent reminder importu.
- SQLite migration ve restore, standalone build içinde eski veritabanı ve temiz
  kurulumla ayrıca smoke test edilir.
- Native actual-vs-desired uzlaştırma; schedule/revision değişimi; settled,
  pause, silme ve mute iptali; ledger yazma hatasında telafi iptali; cold tap ve
  anlık teslimle çift üretmeme; pre-reveal sync yarışı, eşzamanlı sync sırası ve
  fired-tray cleanup retry'ı otomatik test edilir.
- Process-kill, reboot, APK update, Doze/OEM gecikmesi, saat dilimi değişimi ve
  force-stop sınırları standalone Android cihazda ayrıca doğrulanır.

## Kanıt

- `src/db/schema.ts`
- `src/db/database.ts`
- `src/db/debtDao.ts`
- `src/db/recurringPaymentReminderDao.ts`
- `src/services/backupService.ts`
- `src/utils/recurringSchedule.ts`
- `src/notifications/{reminderNotificationRules,reminderNotificationFeed,buildNotifications}.ts`
- `src/notifications/reminderNativeSchedule.ts`
- `src/services/{reminderScheduler,androidNotificationsSetup}.ts`
- İlgili DAO, migration, backup ve saf takvim testleri

## Takip fazları

Borç vade UX'i, manuel/onaylanmış düzenli ödeme ekranı, uygulama içi kural
üretimi ve Android gelecek-tarih scheduler'ı ayrı fazlar olarak uygulanmıştır.
Standalone APK sertleştirmesi ve fiziksel cihaz kabulü Faz 6'dır. Cihaz kanıtı
tamamlanmadan kapalı uygulamaya teslim davranışı doğrulanmış sayılmaz; exact
dakika garantisi ürün sözleşmesi değildir.
