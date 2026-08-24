# SPARK Yapay Zekâ İşbirliği Kaydı

## 1. Amaç

Bu günlük, SPARK geliştirilirken yapay zekânın hangi görevlerde ve hangi yetki
sınırları içinde kullanıldığını açıklamak için tutulur. Amaç AI kullanımını
gizlemek veya bütün çalışmayı AI'ya atfetmek değil; insan kararı, AI önerisi,
uygulama ve doğrulama arasındaki sınırı akademik olarak izlenebilir kılmaktır.

Bu dosya bir konuşma dökümü değildir. Hassas veya gereksiz kişisel içerik yerine
oturumun amacı, kararları, çıktıları, kanıtları ve sınırlamaları kaydedilir.

## 2. Atıf ve onay kuralları

1. İnsan, ürün hedefi ve kabul kriterlerinin sahibidir.
2. AI'nın önerdiği karar, insan açıkça seçmeden “insan kararı” sayılmaz.
3. AI'nın kod üretmesi, kodun doğru olduğunu kanıtlamaz. Test, inceleme ve cihaz
   kanıtı ayrı kaydedilir.
4. Model/araç sürümü arayüzde kesin görünmüyorsa tahmin edilmez; “kaydedilmedi”
   yazılır.
5. AI katkısı şu sınıflardan biriyle etiketlenir:
   `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon`, `araştırma`.
6. İnsan katkısı şu sınıflardan biriyle etiketlenir:
   `gereksinim`, `kapsam onayı`, `tasarım seçimi`, `kod inceleme`,
   `manuel test`, `nihai kabul`.

## 3. Oturum indeksi

| Oturum | Tarih | Amaç | İnsan onayı | AI katkısı | Ürün kodu değişti mi? | Kanıt/çıktı | Durum |
|---|---|---|---|---|---|---|---|
| `AI-2026-08-01-DOCS-001` | 2026-08-01 | SPARK belgelerini profesyonelleştirmek; akademik izlenebilirlik ve taşınabilir şablonlar oluşturmak | Kullanıcı önce ayrıntılı plan istedi, mevcut rehberi yedeklediğini bildirdi ve planı açıkça onayladı | `analiz`, `plan`, `inceleme`, `dokümantasyon` | Hayır | Kök belge sistemi, `docs/` rehberleri, ADR/tarihçe/evidence ve şablonlar | Uygulandı ve yerel doğrulama geçti; insan incelemesi bekleniyor |
| `AI-2026-08-01-ANALYTICS-001` | 2026-08-01 | Kayıtlar varken boş görünen Analiz kartlarının dönem/veri akışını düzeltmek | Kullanıcı ekran görüntüleriyle sorunu bildirdi ve doğrudan düzenleme istedi | `analiz`, `kod`, `test`, `dokümantasyon` | Evet | Ortak bütçe-döngüsü aralığı, önceki dönem çözümü, latest-wins sorgu koruması ve çapraz-ay heatmap | Uygulandı ve yerel doğrulama geçti; cihaz kabulü bekleniyor |
| `AI-2026-08-01-PRICE-CHART-001` | 2026-08-01 | Ürün fiyat grafiğindeki örtüşen ve kalıcı seçim balonunu profesyonel bir inceleme deneyimine dönüştürmek | Kullanıcı iki Expo Go ekran görüntüsüyle sorunu gösterdi, köklü UX düzenlemesine ve `DESIGN_BRIEF.md` güncellemesine yetki verdi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Ayrılmış inceleme şeridi, yoğun veri seçim bantları, hassas para gösterimi, erişilebilir seçim ve veri görselleştirme ilkeleri | Uygulandı ve yerel doğrulama geçti; cihaz kabulü bekleniyor |
| `AI-2026-08-02-ANALYTICS-DENSITY-001` | 2026-08-02 | Yoğun fiyat grafiğini okunabilir tutmak, yıllık tekrarlı işlem listesinin bilgi değerini artırmak ve yıllıkta anlamsız projeksiyon kartını kaldırmak | Kullanıcı iki Analiz ekran görüntüsüyle üç davranışı gösterdi; profesyonel yaklaşımı sordu ve yıllık projeksiyonun gösterilmemesi gerektiğini belirtti | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Gerçek gözlemleri koruyan grafik sadeleştirmesi, satıcı başına yıllık tepe işlem sorgusu, döneme bağlı kart görünürlüğü ve dört dil | Uygulandı ve yerel doğrulama geçti; cihaz kabulü bekleniyor |
| `AI-2026-08-02-NOTIFICATION-QUALITY-001` | 2026-08-02 | Bildirim kartındaki baskın unread vurgusunu sakinleştirmek ve fiş bildirimini kullanıcının son satıcı düzeltmesiyle tutarlı kılmak | Kullanıcı SPARK ekranları ve üç harici finans uygulamasından görsel referanslarla iki sorunu gösterdi ve doğrudan düzenleme istedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Kanonik satıcı uzlaştırması, merchant-first bildirim hiyerarşisi, sakin ve erişilebilir okunmamış durum, dört dil ve regresyon testleri | Uygulandı ve yerel doğrulama geçti; cihaz kabulü bekleniyor |
| `AI-2026-08-02-SPENDING-STATS-001` | 2026-08-02 | Harcama serisi ve gün istatistiklerini tamamlanmış gün, takip başlangıcı ve bütçe hedefi açısından deterministik yapmak | Analiz doğruluğunu iyileştirme çalışması kapsamında ürün kodundaki sonuçların yanıltıcı olmaması istendi; bu kayıt için ayrı cihaz kabulü verilmedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Saf istatistik politikası, kanonik aylık hedef kapısı, dönem sonu seri semantiği ve regresyon testleri | Uygulandı ve odaklı yerel test geçti; cihaz kabulü bekleniyor |
| `AI-2026-08-02-ANDROID-SYSTEM-NOTIFICATIONS-001` | 2026-08-02 | Uygulama-içi bildirimleri Android sistem tepsisine açılış sürekliliğini ve gizliliği koruyarak teslim etmek | Kullanıcının flicker olmadan profesyonel bildirim deneyimi hedefi korundu; native APK kabulü bu kayıtta henüz verilmedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Reveal-sonrası aktivasyon, Expo Go guard, iki özel kanal, idempotent ledger, resume/tap/silme koordinasyonu | Uygulandı ve odaklı yerel test geçti; fiziksel APK doğrulaması bekleniyor |
| `AI-2026-08-09-RECEIPT-MONEY-001` | 2026-08-09 | Fiş indirimi gösterimindeki hassasiyet kaybını ve düzenleme sonrası kayan nokta toplamlarını kökten gidermek | Kullanıcı gerçek fiş ve uygulama ekranıyla sorunu bildirdi; AI ve manuel fiş akışlarının stabil ve kesin çalışmasını istedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Minor-unit para matematiği, atomik item/header senkronu, basılı toplam otoritesi, eski veri onarımı, dört dil ve regresyon testleri | Uygulandı; otomatik doğrulama geçti, cihaz kabulü bekleniyor |
| `AI-2026-08-09-THEME-CONTINUITY-001` | 2026-08-09 | Tarayıcı'nın açık temada koyu kalmasını ve uzak/lazy sekmeye geçişte görünen beyaz ara yüzeyi gidermek | Kullanıcı ekran ve geçiş kaydıyla sorunu bildirdi; tema altyapısının kökten incelenip stabil hâle getirilmesini istedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Reactive Scanner stilleri, React Navigation tema köprüsü, opak lazy scene/placeholder ve regresyon testleri | Uygulandı; otomatik doğrulama geçti, standalone APK kabulü bekleniyor |
| `AI-2026-08-09-GOAL-DELETE-001` | 2026-08-09 | Boş hedefte çalışan silme eylemini güvenli kılmak ve Dashboard hedef görünürlüğü ile hatırlatıcı önerilerini SPARK altyapısına göre değerlendirmek | Kullanıcı hedef-silme hatasını ekran görüntüsüyle bildirdi; arkadaş geri bildirimlerini ürün kararı için değerlendirmemi istedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Kalıcı hedef-varlığı kapısı, gerçek DELETE sonucu, limitleri koruyan semantik, dört dil ve aşamalı ürün önerisi | Silme düzeltmesi uygulandı ve otomatik doğrulandı; yeni Dashboard/motivasyon/hatırlatıcı kapsamı insan seçimi bekliyor |
| `AI-2026-08-09-GOAL-FOCUS-001` | 2026-08-09 | Aktif birikim hedefini kritik finansal öncelikleri bozmadan isteğe bağlı olarak Dashboard'da öne çıkarmak; borç ve düzenli ödeme hatırlatıcılarını ayrı fazlara ayırmak | Kullanıcı profesyonel Dashboard önerisini açıkça seçti; hatırlatıcılar için önce plan, sonra ayrıca onay istedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Varsayılan kapalı odak tercihi, borçtan sonra kompakt hedef, tekil kart, ortak katkı sheet'i, dört dil ve altı fazlı hatırlatıcı planı | Dashboard uygulandı ve otomatik doğrulandı; hatırlatıcı uygulaması insan onayı bekliyor |
| `AI-2026-08-09-REMINDER-FOUNDATION-001` | 2026-08-09 | Borç ve düzenli ödeme hatırlatıcılarının güvenilir veri temelini küçük Faz 1 kapsamında kurmak | Kullanıcı altı fazlı plandan sonra açıkça “Faz 1'e geçelim” dedi; UI, bildirim kuralı ve kapalı-uygulama scheduler'ı bu onaya dahil edilmedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Vade/reminder şeması, saf takvim motoru, kararlı reminder UID'si, backup v3 ilişki kapanışı, migration ve regresyon testleri | Uygulandı ve yerel otomatik doğrulama geçti; standalone DB/restore kabulü ve sonraki faz onayı bekleniyor |
| `AI-2026-08-11-DEBT-REMINDER-UX-001` | 2026-08-11 | Faz 1 veri temelinin üzerine borç vadesi ve hatırlatma tercihinin profesyonel, erişilebilir ve yarış-güvenli kullanıcı akışını kurmak | Kullanıcı aşamalı hatırlatıcı planında açıkça “Faz 2'ye geçelim” dedi; düzenli ödeme UI'ı, feed kuralı, native scheduler, commit ve push bu onaya dahil edilmedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Yeni ve açık borç için ortak vade/tercih yüzeyi; güvenli yerel takvim seçimi; açık borçta vade durumu; stale/settled yazma kapısı; dört dil ve regresyon testleri | Uygulandı ve yerel otomatik doğrulama geçti; standalone UI kabulü bekleniyor |
| `AI-2026-08-11-RECURRING-PAYMENT-UX-001` | 2026-08-11 | Kullanıcının düzenli ödemeleri manuel planlamasını ve yerel tahminleri açık onayla plana dönüştürmesini sağlamak | Kullanıcı token maliyetinin düşük tutulmasını istedi ve açıkça “Faz 3 için başla” dedi; feed kuralı, native scheduler, commit ve push bu onaya dahil edilmedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Tek ortak plan formu, onaylı/tahmini ayrımı, create/edit/pause/resume/delete, dört dil, dürüst teslim metni ve odaklı regresyonlar | Uygulandı; otomatik doğrulama ve standalone insan kabulü ayrıştırılıyor |
| `AI-2026-08-11-REMINDER-FEED-RULES-001` | 2026-08-11 | Borç ve onaylı ödeme planlarını ayrı, deterministik ve yaşam döngüsü güvenli uygulama-içi bildirimlere dönüştürmek | Kullanıcı Faz 2 kalitesini koruyarak ölçülü token kullanılmasını istedi ve Faz 4'ü açıkça başlattı; future scheduler bu onaya dahil değildi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Saf kural motoru, ayrı filtre/mute, dismissal ve kapasite güvenliği, stale feed/tray temizliği, dört dil ve regresyonlar | Uygulandı ve otomatik doğrulandı; fiziksel Android kabulü bekleniyor |
| `AI-2026-08-11-ANDROID-REMINDER-SCHEDULER-001` | 2026-08-11 | Borç ve düzenli ödeme hatırlatıcılarını geleceğe tarihli Android alarmlarıyla kapalı uygulama teslimine hazırlamak | Kullanıcı token tüketiminin kontrollü tutulmasını istedi ve açıkça “Faz 5'e geçelim” dedi; commit, push, yayın ve exact-alarm özel izni yetkisi vermedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Rolling-horizon planlayıcı, cursor ilerletme, actual-vs-desired OS uzlaştırması, atomik çift-ledger baseline/rollback, cold-tap senkronu, dört dil ve kritik regresyonlar | Ürün kodu ve otomatik doğrulama tamamlandı; standalone APK/Faz 6 insan kabulü bekleniyor |
| `AI-2026-08-13-ACCENT-PALETTES-001` | 2026-08-13 | Açık/koyu görünümden bağımsız, profesyonel ve erişilebilir beşli vurgu paleti kişiselleştirmesi eklemek | Kullanıcı mavi/turuncu/mor fikrine kırmızıyı ekledi, kapsamlı planı onayladı; ilk yoğun ayar sunumunu değerlendirip yerleşik görünüm kontrolü ile kompakt carousel yönünü seçti; commit, push, merge veya yayın istemedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Atomik tema snapshot'ı, runtime tam-palet reaktivitesi, kontrastlı CTA sözleşmesi, sabit merkezli yatay palet carousel'i, dört dil, ADR-007 ve cihaz kabul matrisi | Uygulandı ve yerel otomatik doğrulama geçti; standalone APK insan kabulü bekleniyor |
| `AI-2026-08-14-ACCENT-DETENT-001` | 2026-08-14 | Vurgu carousel'ini gerçek viewport'ta optik merkezleyen, kademeli mekanik hissi ses+haptic ile veren ve sürükleme boyunca gereksiz DB yazmayan bir seçiciye dönüştürmek | Kullanıcı merkezleme kusurunu ekran görüntüsüyle gösterdi; daha sert kademeli “tak tak” hissi ile senkron ses ve titreşimi açıkça istedi. Commit, push, APK build veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Adaptif snap geometrisi, gesture-kademe önizlemesi, best-effort yerel klik+haptic, nihai snap kalıcılığı, sessiz/programatik yollar ve native yetenek sınırı | Uygulandı ve otomatik paket doğrulaması tamamlandı; fiziksel cihaz kabulü bekleniyor |
| `AI-2026-08-21-RECURRING-PAYMENT-FULLSCREEN-001` | 2026-08-21 | Ödeme planı formunun üst başlığını ve alanlarını klavye/ekran oranından bağımsız, tam ekran ve dikey kaydırılabilir yapmak | Kullanıcı gerçek Expo Go ekranıyla bottom-sheet davranışını reddetti ve sabit sayfa akışını doğrudan istedi; commit, push veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Ayrı card route, safe-area sabit başlık, klavyeden bağımsız scroll gövdesi, kimlik-temelli güvenli veri yükleme ve create/edit/detected regresyonları | Uygulandı ve otomatik doğrulandı; fiziksel Android klavye/safe-area kabulü bekleniyor |
| `AI-2026-08-21-DAILY-FLUCTUATION-VIEWPORT-001` | 2026-08-21 | Günlük Dalgalanma yakınlaştırmasını aynı adımlarda aynı tarih penceresini veren, sayaçla uyumlu ve sıçramasız bir görünüme dönüştürmek | Kullanıcı 32 günlük gerçek özel aralıkta `3/3`–`5/5` ile grafik kapsamının çeliştiğini ve geçişte başka grafik yanıp söndüğünü ekran kanıtıyla gösterdi; commit, push veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Sağdan hizalı saf pencere motoru, atomik viewport durumu, sağ-uç tarih çıpası, ilk karede doğru scroll konumu, tarih aralığı+sayaç ve zoomdan bağımsız giriş animasyonu | Uygulandı ve otomatik doğrulandı; fiziksel Android pager/optik kabulü bekleniyor |
| `AI-2026-08-21-VENDOR-PRODUCT-PAGER-001` | 2026-08-21 | Satıcı ve ürün yoğunluğunu ana Analiz akışını uzatmadan göstermek; alım sayısı/toplam harcama sıralamasını ayırmak | Kullanıcı önce ürünlerin, ardından ana satıcı listesinin beşerli yatay sayfalanmasını istedi; satıcı dokunuşunda donut detayının nasıl korunacağını sordu ve önerilen ayrı yüksek paneli açıkça onayladı. Commit, push veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | DAO'daki on ürün sınırının kaldırılması; sabit beşli satıcı pager'ı; ayrı satıcı analiz paneli; panel içinde donut, kararlı iki ürün sıralaması ve beşli pager; üst sekme kilidi; dört dil ve regresyon testleri | Uygulandı ve otomatik doğrulandı; fiziksel Android gesture/modal/optik kabulü bekleniyor |
| `AI-2026-08-22-CLOSED-APP-ATTENTION-001` | 2026-08-22 | Ödeme günleri, birikim hedefi ve bütçe kontrol noktalarının uygulama ekranda değilken de Android paneline ulaşmasını sağlamak | Kullanıcı kapalı uygulamada görünür, dikkat çekici ve davranışı destekleyen uyarıları kapsamlı biçimde istedi; commit, push veya yayın yetkisi vermedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Mevcut borç/ödeme scheduler'ının denetimi; hedef ve bütçe için sınırlı tarihli dikkat planı; gerçek OS alarm sayısı; dört dil; deterministik uzlaştırma, mute ve backlog kontrolü | Ürün kodu hazır; otomatik doğrulama ve standalone APK insan kabulü ayrıştırılıyor |
| `AI-2026-08-22-ANALYTICS-TRUST-001` | 2026-08-22 | Harcama istatistiği ve dönem karşılaştırmasını veri kapsamı açısından dürüstleştirmek; tekrarlı veya verisiz Analiz kartlarını sadeleştirmek | Kullanıcı önce önerileri değerlendirdi, ardından uygulanacak metin/hesap/kart kurallarını tek tek açıkça seçti; commit, push, build veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | En az geçmiş kapısı ve kapsam özeti; eş tamamlanmış gün karşılaştırması; gerçek aralık/gelecek tarih koruması; koşullu kart görünürlüğü; dört dil ve regresyon testleri | Uygulandı ve otomatik doğrulandı; fiziksel Android kabulü bekleniyor |
| `AI-2026-08-22-DELETE-CONFIRM-REDESIGN-001` | 2026-08-22 | İşlem silme onayını yoğun alarm/HUD görünümünden sade, profesyonel ve tema uyumlu karar penceresine dönüştürmek | Kullanıcı Expo Go ekran görüntüsünü değerlendirmemi istedi, ardından önerilen sade tasarımın uygulanmasını açıkça onayladı ve beğenmezse geri dönmek istediğini belirtti; commit, push veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Ortak silme modalının sadeleştirilmesi; tek semantik ikon; yalnız yıkıcı CTA'da kontrastlı kırmızı vurgu; tekil/çoğul ve geri alınamazlık metni; tema, erişilebilirlik, dört dil ve regresyon testi | Uygulandı ve otomatik doğrulandı; Expo Go insan kabulü bekleniyor |
| `AI-2026-08-22-SETTINGS-PLANNING-IA-001` | 2026-08-22 | Düzenli ödeme yönetimini doğru Ayarlar grubuna taşımak ve Bütçe/planlama kartlarındaki tekrarlı yardımcı metinleri sadeleştirmek | Kullanıcı bilgi mimarisi önerisini kabul etti; ekran görüntüsünde iki açıklamanın bilgi yüzeyleriyle tekrarlandığını gösterip kaldırılmasını istedi. Commit, push veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Bütçe ve planlama grubu; Düzenli ödemeler rotası; Veri ve yedek kapsamının daraltılması; iki kompakt ayar satırı; dört dil ve rota regresyonu | Uygulandı ve otomatik doğrulandı; fiziksel Android kabulü bekleniyor |
| `AI-2026-08-23-CANONICAL-PRODUCT-IDENTITY-001` | 2026-08-23 | Aynı fiziksel ürünün güvenli ad farklarını ortak fiyat geçmişinde toplamak; farklı ölçü/paket/varyantı ve ham fiş kanıtını korumak | Kullanıcı gerçek Fiyat Takibi örneğiyle problemi tanımladı; daha önce AI tarafından önerilen ayrıntılı planın incelenip iyileştirilerek uygulanmasını istedi. Commit, push, build veya yayın istemedi | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Deterministik birim-duyarlı ürün kimliği; canonical/alias kalıcılığı; kullanıcı etiketi ve merge/split; sınırlı AI metadata/öneri sınırı; backup v4; ADR-010 ve regresyon kanıtı | Uygulandı; typecheck, odaklı ve tam Jest ile diff kontrolü geçti, fiziksel cihaz kabulü bekleniyor |
| `AI-2026-08-24-DASHBOARD-BUDGET-DONUT-001` | 2026-08-24 | Dashboard donutunu etkin bütçe doluluğu ile kategori dağılımını birlikte ve küçük dilimlere erişilebilir biçimde gösterecek şekilde düzenlemek | Kullanıcı bütçenin %100 halka, kalan tutarın nötr boşluk ve harcamanın kategori renkleri olmasını onayladı; mevcut cam/sıvı görseli ile doğrudan etkileşimin korunmasını, %1–2 dilimlerin de kolay seçilmesini istedi. Commit/push istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Etkin bütçe paydalı normal görünüm; eski 360° kategori odak görünümü; küçük yayı yok etmeyen geometri; 44 dp önceki/sonraki erişimi; iki farklı yüzde bağlamı; dört dil | Uygulandı ve odaklı otomatik doğrulama geçti; fiziksel Android optik/gesture kabulü bekleniyor |
| `AI-2026-08-24-DASHBOARD-CATEGORY-LABELS-001` | 2026-08-24 | Dashboard Üst kategoriler ikonlarının anlamını doğrudan, kompakt ve yerelleştirilmiş etiketlerle göstermek | Kullanıcı ikonun tek başına hızlı bilgi erişimi sağlamadığını belirtti ve kategori adlarının görünmesini istedi; commit/push istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | İkon→iki satırlık yerelleştirilmiş ad→oran hiyerarşisi; tam ekran okuyucu etiketi; sabit kompakt genişlik | Uygulandı ve odaklı otomatik doğrulama geçti; fiziksel Android optik kabulü bekleniyor |
| `AI-2026-08-24-DASHBOARD-PERIOD-IDENTITY-001` | 2026-08-24 | Dashboard ana özetindeki takvim ayı ile gelir gününe bağlı bütçe dönemi çelişkisini kaldırmak | Kullanıcı “Ağustos 2026”, “Bu Ay Harcanan” ve “22 Ağu–21 Eyl” birlikteliğinin kavramsal sorununu ekran görüntüsüyle belirtti ve profesyonel çözümü uygulamamı istedi; commit/push istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Küçük dönem bağlamı; kanonik gerçek tarih aralığı; döneme özgü harcama etiketi; yıl geçişi güvenliği; dört dil | Uygulandı ve odaklı otomatik doğrulama geçti; fiziksel Android optik kabulü bekleniyor |
| `AI-2026-08-25-SAVINGS-UPDATE-AFFORDANCE-001` | 2026-08-25 | Birikim hedefi hızlı eyleminin sonucunu tıklamadan önce anlaşılır ve profesyonel kılmak | Kullanıcı “Birikime ekle / çıkar” CTA'sının açacağı yüzeyi önceden anlatmadığını ekran görüntüsüyle belirtti ve profesyonel yaklaşımı tasarlamamı istedi; commit/push istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Nötr güncelleme eylemi; görünür iki yön açıklaması; `±` affordance; sheet/kompakt kart/a11y tutarlılığı; dört dil | Uygulandı ve odaklı otomatik doğrulama geçti; fiziksel Android optik kabulü bekleniyor |
| `AI-2026-08-25-SETTINGS-FLAT-HIERARCHY-001` | 2026-08-25 | Ana Ayarlar gruplarını korurken dört alt sayfayı kalıcı kart yığınından modern, düz ve görev odaklı bir bilgi mimarisine geçirmek | Kullanıcı Dashboard ve Analiz'de yeterince kart bulunduğunu, Ayarlar iç sayfalarındaki tekrarın psikolojik ve görsel yük yarattığını belirtti; Genel, Bütçe ve planlama, Veri ve yedek ve Yapay zekâ içeriğinin profesyonel klasik uygulama düzenine dönüştürülmesini açıkça istedi. Commit, push veya yayın istemedi | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon` | Evet | Ortak kart-dışı bölüm ve gezinme satırı sözleşmesi; yalnız gerçek kontrollerde sınır; düz bütçe geçmişi; kenar vurgulu yedek durumu; büyük metinde büyüyen satırlar ve mevcut dört dil metinlerinin korunması | Uygulandı; typecheck, odaklı 14/14 test, tam 902/902 test ve diff kontrolü geçti; fiziksel Android optik kabulü bekleniyor |

> Yukarıdaki oturum girdisi eşzamanlı olarak yazılmıştır; ancak doğrudan konuşma
> dışa aktarımı veya kalıcı bir oturum kimliği henüz bağlanmamıştır. İnsan onayı
> kanıtı tezde kullanılacaksa kontrollü konuşma/issue referansı sonradan eklenmelidir.

## 4. Ayrıntılı oturum kaydı

### AI-2026-08-01-DOCS-001

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-01 / Europe/Warsaw |
| İnsan hedefi | DESIGN_BRIEF içeriğini tezde kullanılabilir kanıt düzenine dönüştürecek, SPARK'a uygulanabilir ve başka projelere taşınabilir belgeler oluşturmak |
| Onaylanan yazma kapsamı | Önceden açıklanan profesyonelleştirme planındaki kök belgeleri yeniden düzenlemek; `docs/` altında mimari, geliştirme, kalite, ADR, tarihçe, evidence ve taşınabilir şablonlar oluşturmak |
| Yasaklanan işlem | Ürün kodunu değiştirmek, yedeği silmek, kullanıcı değişikliklerini kaybetmek veya onaysız commit oluşturmak |
| İncelenen kaynaklar | Güncel ve legacy `DESIGN_BRIEF`, `README.md`, `CLAUDE.md`, `package.json`, Expo/EAS config, CI, DB şema/migration'ları, ilgili ürün kodu, test yapısı ve Git durumu/geçmişi |
| AI aracı/modeli | OpenAI Codex; kesin model/build kimliği bu kayıtta doğrulanmadı |
| AI katkısı | Kaynak-sahipliği analizi; belge ayrıştırma planı; yaşayan ürün rehberi, teknik rehberler, ADR'ler, retrospektif tarihçe, akademik kanıt düzeyleri ve yeniden kullanılabilir şablonların taslak/yazımı |
| İnsan katkısı | SPARK ve diğer projelerdeki tez kullanım amacını belirledi; mevcut rehberi ayrıca yedekledi; önerilen kapsamı inceledi ve uygulamayı açıkça onayladı |
| AI önerisi ile insan kararı ayrımı | Yapı ve metin AI tarafından önerilip uygulanmıştır. Profesyonelleştirme hedefi ve uygulama yetkisi insana aittir; akademik kullanım ve nihai belge kabulü hâlâ insan incelemesine tabidir |
| Otomatik doğrulama | 2026-08-01T03:33+02:00 civarında: legacy SHA-256 `695cb5d14d5c92f7b78fda3fc0766f4b7be010a733d249c23dc9027ef8a9f60d`; 20 Markdown dosyasında 0 kırık göreli bağlantı; `git diff --check` başarılı; `npm run typecheck` exit 0; `npm test -- --ci --coverage=false` ile 30/30 suite ve 201/201 test başarılı |
| Cihaz doğrulaması | Uygulanamaz |
| Commit/CI | Doğrulama `main`, başlangıç HEAD `24bc015ea363d3f98621616e07811ab7f572b85f`, kirli çalışma ağacı üzerinde yapıldı. Bu dokümantasyon dönüşümü henüz commit'e bağlanmadı; sonuç CI kanıtı değildir |
| Gizlilik | Şablonlara secret/kişisel veri eklenmedi; yerel mutlak yollar kanonik belge içeriğine taşınmadı; ekran görüntüleri repoya kopyalanmadı |
| Retrospektif sınırlama | Önceki SPARK olaylarına ilişkin örnekler Git ve yaşayan rehberden çıkarılmıştır; olay zamanındaki tüm konuşmaları veya alternatifleri temsil etmez |
| Nihai durum | Belge uygulaması ve yerel doğrulama tamamlandı; insan doküman incelemesi ve isteğe bağlı commit bekleniyor |

### AI-2026-08-01-ANALYTICS-001

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-01 / Europe/Warsaw |
| Başlangıç çalışma ağacı | `main`, HEAD `a3e1299`; görev başlangıcında temiz |
| İnsan hedefi | Dashboard'da harcamalar görünürken Analiz'deki dönem karşılaştırması, günlük grafik ve diğer veri kartlarının boş/0 görünmesini düzeltmek; stabil açılış ve bildirim davranışını korumak |
| Sağlanan kanıt | Biri Analiz, biri Dashboard durumunu gösteren iki kullanıcı ekran görüntüsü; cihaz veritabanı bu oturumda doğrudan okunmadı |
| AI katkısı | Kod ve mimari akış incelemesi; takvim ayı ile bütçe döngüsü ayrışmasının teşhisi; ortak tarih aralığı helper'ı, önceki döngü hesabı, geç sorgu sonucu koruması, seri odak/yenileme okumaları, çapraz-ay ısı haritası ve regresyon testlerinin uygulanması |
| İnsan katkısı | Hata senaryosunu, beklenen mevcut veriyi ve korunması gereken stabil UX davranışını belirledi; cihaz kabulü kullanıcıda kalır |
| Karar | `DESIGN_BRIEF.md` ve `docs/ARCHITECTURE.md` değişmezine göre aylık Analiz 1–31 takvim ayını değil Dashboard'un `budget.periodStart/periodEnd` aralığını kullanır. Kategori limitlerinin takvim-aylı kalıcılık modeli migration gerektirdiği için bu çalışmada değiştirilmedi |
| Değiştirilen dosyalar | `app/(tabs)/analytics.tsx`; `src/utils/analyticsPeriod.ts`; `src/hooks/useExpenses.ts`; `src/components/SpendingHeatmap.tsx`; `src/components/analytics/HeatmapCard.tsx`; iki yeni regresyon testi; evidence kayıtları |
| Otomatik doğrulama | `npm run typecheck` exit 0; `npm test -- --runInBand --coverage=false` exit 0, 32/32 suite ve 207/207 test; hedefli iki yeni suite 6/6 test; `expo export --platform android` ile 1.917 modüllük Android bundle başarıyla üretildi (geçici dizin, repoya eklenmedi) |
| Cihaz doğrulaması | Bekleniyor: başlangıç günü 23, dönem 23 Tem–22 Ağu; Dashboard ve Analiz toplamı/kategori/satıcı/grafik verileri karşılaştırılmalı |
| Gizlilik | Kullanıcı ekran görüntüleri repoya kopyalanmadı; kişisel dosya yolu veya ham finans verisi belgeye eklenmedi |
| Kalan risk | Jest gerçek SQLite/gesture/render yaşam döngüsünü kanıtlamaz. Kategori limitleri mevcut takvim-aylı ürün modelini sürdürür; ayrı migration/ürün kararı olmadan döngü anahtarına çevrilmedi |
| Nihai durum | Kod ve yerel otomatik doğrulama tamamlandı; commit/build ve hedef cihaz kabulü bekleniyor |

### AI-2026-08-01-PRICE-CHART-001

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-01 / Europe/Warsaw |
| Başlangıç çalışma ağacı | `main`, HEAD `a153574`; görev başlangıcında temiz ve `origin/main` ile eşit |
| İnsan hedefi | Ürün fiyat değişimi grafiğinde seçilen fiyat balonunun diğer noktaları örtmesini ve kapanmamasını gidermek; grafik, veri ve görsel tasarımı profesyonel bir deneyimde birleştirmek; yaşayan ürün rehberini güncellemek |
| Sağlanan kanıt | Seçimsiz ve `10 zł` balonu açık durumlarını gösteren iki Expo Go ekran görüntüsü; gerçek dokunma akışı bu oturumda cihaz üzerinden kontrol edilmedi |
| AI katkısı | Grafik ve modal akış incelemesi; sabit merkezli tooltip ve üst üste binen hitbox kök nedenlerinin teşhisi; ayrılmış seçim şeridi, çakışmayan hit bantları, seçili nokta kılavuzu, açık kapatma/toggle/reset yolları, iki ondalıklı para gösterimi, doğrusal gözlem çizgisi, dört dil ve component testlerinin uygulanması |
| İnsan katkısı | Sorunun estetik ve kullanım etkisini belirledi; kapsamlı UX düzenlemesine ve `DESIGN_BRIEF.md` güncellemesine açık yetki verdi; cihaz kabulü kullanıcıda kalır |
| Karar | Geçici fiyat bilgisi plot alanının üstüne çizilmez. Seçim ayrılmış ve sabit yükseklikli bir şeritte gösterilir; yoğun gözlemler çakışan nokta hedefleri yerine plotu bölen en-yakın-gözlem bantlarıyla seçilir. Rastgele timeout kullanılmaz |
| Değiştirilen dosyalar | `src/components/LineChart.tsx`; `src/components/ItemAnalyticsModal.tsx`; `src/components/__tests__/LineChart.test.tsx`; TR/EN/AZ/RU locale kaynak ve üretilmiş çıktıları; `DESIGN_BRIEF.md`; evidence kayıtları |
| Otomatik doğrulama | `npm run typecheck` exit 0; odaklı LineChart suite 6/6 test; `npm test -- --runInBand --coverage=false` exit 0, 33/33 suite ve 213/213 test; `expo export --platform android` ile 1.917 modüllük Android bundle başarıyla üretildi (geçici dizin, repoya eklenmedi) |
| Cihaz doğrulaması | Bekleniyor: 23 gözlemli ürün grafiğinde ilk/orta/son nokta seçimi, aynı noktaya yeniden dokunma, kapatma düğmesi, dikey sheet scroll, modalı kapatıp yeniden açma, açık/koyu tema, büyük font ve TalkBack |
| Gizlilik | Kullanıcı ekran görüntüleri repoya kopyalanmadı; ürün/finans verisi belgeye aktarılmadı; yalnız davranış düzeyinde kanıt özeti tutuldu |
| Kalan risk | Jest, şeffaf Pressable bantlarının gerçek cihazda ScrollView ile interruption davranışını ve TalkBack odak sırasını kanıtlamaz. X ekseni mevcut ürün davranışındaki gibi kronolojik gözlem sırasını kullanır; gerçek gün aralıklarına orantılı zaman ölçeği ve aynı-gün agregasyonu ayrı ürün/veri semantiği kararı gerektirir |
| Nihai durum | Kod, yaşayan ürün rehberi ve yerel otomatik doğrulama tamamlandı; commit/CI ve hedef cihaz insan kabulü bekleniyor |

### AI-2026-08-02-ANALYTICS-DENSITY-001

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-02 / Europe/Warsaw |
| Başlangıç çalışma ağacı | `main`, HEAD `a153574`; çalışma ağacında aynı kullanıcı akışının önceki, yetkili fakat henüz commit edilmemiş fiyat grafiği ve belge değişiklikleri vardı. Bu oturum onları koruyarak devam etti |
| İnsan hedefi | Yıl içinde çok sayıda ürün fiyat kaydının nokta kalabalığı yaratmasını önlemek; yıllık En Yüksek İşlemler kartındaki aynı satıcı tekrarlarını profesyonel biçimde ele almak; yıllık görünümde Ay Sonu Projeksiyonu kartını göstermemek |
| Sağlanan kanıt | Yıllık projeksiyon boş durumunu ve ilk dört sırada aynı kira satıcısını gösteren iki Expo Go ekran görüntüsü; 100+ noktalı gerçek cihaz serisi bu oturumda sağlanmadı |
| AI katkısı | Grafik yoğunluğu ve işlem sıralaması için alternatiflerin semantik incelemesi; gerçek gözlem referanslı plateau sıkıştırma ve kova-uç örnekleme yardımcı fonksiyonu; kaynak konumlu x ekseni, 12 görsel işaret sınırı ve en yakın gözlemi seçen tek ayarlanabilir yüzey; ürün sorgularında latest-wins koruması; sadeleştirme açıklaması; satıcı başına tepe işlem SQL/hook/UI akışı; yıllık projeksiyon görünürlük kuralı; test, i18n ve yaşayan rehber güncellemeleri |
| İnsan katkısı | Üç UX sorununun önceliğini ve beklenen yıllık projeksiyon davranışını belirledi; tekrarlı işlem ve yoğun grafik için profesyonel karar değerlendirmesini AI ile paylaştı; hedef cihaz kabulü kullanıcıda kalır |
| Karar | Ham alım geçmişi silinmez ve uydurma/ortalama fiyat üretilmez. Grafik en fazla 32 gerçek temsilî gözlem çizer, kaynak gözlem aralıklarını korur, en fazla 12 normal işaret gösterir ve sadeleştirmeyi açıklar; fiziksel seçim onlarca dar hedef yerine tek plot yüzeyinde en yakın gözleme gider. Yıllık işlem kartı genel top listeyi sessizce dedup etmez; DAO her satıcının en yüksek tek gerçek işlemini seçer, başlık/açıklama kapsamı bildirir. Yıllıkta ay sonu projeksiyonu yer tutmaz |
| Değiştirilen dosyalar | `app/(tabs)/analytics.tsx`; analytics Projection/TopTx kartları, stilleri ve testleri; `src/db/expenseDao.ts`; `src/hooks/useExpenses.ts` ve testleri; `src/utils/priceHistorySeries.ts` ve testleri; fiyat grafiği/modal; TR/EN/AZ/RU locale kaynak ve çıktıları; `DESIGN_BRIEF.md`; evidence kayıtları |
| Otomatik doğrulama | Locale derlemesi: RU/AZ partial 750, runtime 751 anahtar; `npm run typecheck` exit 0; son LineChart odaklı doğrulama 9/9 test; tam Jest 37/37 suite ve 236/236 test; Android Metro export 1.918 modülle başarılı (geçici dizin, repoya eklenmedi); `git diff --check` temiz |
| Cihaz doğrulaması | Bekleniyor: yıllıkta projeksiyon kartının yokluğu; aynı satıcılı aylık kayıtlarda yıllık kartın satıcıyı bir kez ve en yüksek tutarla göstermesi; aya dönüşte genel top işlemlerin geri gelmesi; 2/23/32/100+ fiyat kaydında çizgi, seçim, kapatma, sheet scroll, büyük font, açık/koyu tema ve TalkBack |
| Gizlilik | Kullanıcı ekran görüntüleri repoya kopyalanmadı; ekrandaki satıcı, tutar ve ürün ayrıntıları test veya belgelere aktarılmadı; fixture'lar genel örneklerle kuruldu; secret veya kişisel dosya yolu kaydedilmedi |
| Kalan risk | Jest, gerçek SQLite window-function sonucunu, Android'deki dokunma/scroll arbitration'ını ve uzun dört dilli başlıkların cihaz yerleşimini tek başına kanıtlamaz. Grafik x ekseni kronolojik gözlem sırasıdır; gerçek zaman aralığı ölçeği ayrı ürün kararıdır |
| Nihai durum | Kod, test, yaşayan ürün rehberi ve yerel Android bundle doğrulaması tamamlandı; commit/CI ve hedef cihaz insan kabulü bekleniyor |

### AI-2026-08-02-NOTIFICATION-QUALITY-001

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-02 / Europe/Warsaw |
| Başlangıç çalışma ağacı | `main`, HEAD `a153574`; çalışma ağacında önceki kullanıcı onaylı Analiz, grafik, locale ve belge değişiklikleri vardı ve korunarak devam edildi |
| İnsan hedefi | Okunmamış bildirimdeki kalın yeşil sol şeridi daha profesyonel bir tasarımla değiştirmek; fiş bildirimindeki tırnaklı satıcı sunumunu iyileştirmek; AI satıcı adını kullanıcı kayıt öncesinde düzelttiğinde bildirimin eski adı göstermesini önlemek |
| Sağlanan kanıt | SPARK'ın liste ve detay durumunu gösteren iki ekran görüntüsü ile üç harici finans uygulamasının bildirim tasarımı referansı; ekran görüntüleri depoya kopyalanmadı ve içlerindeki finans/satıcı verileri testlere aktarılmadı |
| AI katkısı | Tarayıcı→fiş kaydı→bildirim snapshot'ı→harcama düzenleme akışının kod düzeyinde izlenmesi; `receipt-saved-{expenseId}` kimliğinden kanonik satıcıyı tek batch sorguyla uzlaştırma; düzenleme sonrası hedefli no-op güvenli yenileme; mevcut eski feed kayıtlarının focus/sync ile onarımı; açık detayın feed kimliğine bağlanması; unread rail'in tonal kart, küçük nokta ve erişilebilir etiketle değiştirilmesi; merchant-first metin hiyerarşisi, dört dil ve testlerin uygulanması |
| İnsan katkısı | Sorunların görsel ve işlevsel etkisini belirledi; referans yüzeyleri sağladı; profesyonel ve özgün tasarım hedefini koydu; gerçek cihazdaki nihai kabul kullanıcıda kalır |
| Karar | Bildirim geçmişi ayrı bir event tablosuna taşınmadan mevcut feed sürümü korunur. Mevcut receipt bildirimleri yeni harcamalardan yeniden üretilmez; yalnız feed'deki güvenilir expense kimlikleri kanonik satıcıyla uzlaştırılır. Harcama bulunamazsa tarihsel bildirim sessizce silinmez. DB okuma hatası boş sonuç sayılmaz. Okunmamış durum kalın yan şerit kullanmaz ve yalnız renge bırakılmaz |
| Değiştirilen dosyalar | `app/add-expense.tsx`; `app/notifications.tsx`; `src/db/expenseDao.ts`; `src/notifications/{buildNotifications,receiptNotifications}.ts`; `src/services/receiptParser.ts`; bildirim/DAO/component testleri; TR/EN/AZ/RU locale kaynakları ve çıktıları; `DESIGN_BRIEF.md`; evidence kayıtları |
| Otomatik doğrulama | Locale üretimi: RU/AZ partial 751, runtime 752 anahtar; odaklı 4/4 suite ve 31/31 test; `npm run typecheck` exit 0; `npm test -- --ci --coverage=false` ile 38/38 suite ve 249/249 test; Android Metro export 1.919 modülle başarılı (geçici dizin, repoya eklenmedi); `git diff --check` temiz |
| Cihaz doğrulaması | Bekleniyor: koyu/açık temada unread ve read kartları; fişten “düzenle” akışında satıcı değiştirip kaydetme; önceden yanlış satıcı taşıyan mevcut bildirimin ekrana focus olduğunda düzelmesi; açık detay, kaydırarak silme, uzun basma/çoklu seçim ve pull-to-refresh birlikteliği |
| Gizlilik | Kullanıcı ekran görüntüleri repoya eklenmedi; gerçek satıcı adı, finansal değer ve kişisel dosya yolu dokümana veya fixture'a taşınmadı; testlerde yalnız genel örnek adlar kullanıldı |
| Kalan risk | Jest DAO ve bildirim depolamasını mock'larla doğrular; gerçek Expo SQLite bağlantısı, Android render tonu, font ölçekleme ve gesture birlikteliği yalnız hedef cihaz/APK smoke testiyle kabul edilebilir. Değişiklikler henüz commit veya CI kimliğine bağlı değildir |
| Nihai durum | Kod, test, locale, yaşayan ürün rehberi ve yerel Android bundle doğrulaması tamamlandı; commit/CI ve hedef cihaz insan kabulü bekleniyor |

### AI-2026-08-02-SPENDING-STATS-001

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-02 / Europe/Warsaw |
| Başlangıç çalışma ağacı | `main`; çalışma ağacında önceki kullanıcı onaylı Analiz, bildirim, locale ve belge değişiklikleri vardı ve korunarak devam edildi. Bu kayıt commit kimliğine bağlanmadı |
| İnsan hedefi | Analiz'deki harcama günü, seri ve hedef-altı metriklerinin kısmi gün veya yanlış dönem hedefi nedeniyle yanıltıcı olmamasını sağlamak |
| Sağlanan kanıt | Bu alt çalışma için ayrı cihaz ölçümü veya ekran görüntüsü bağlanmadı; mevcut Analiz akışı ve çalışma ağacındaki davranış/test sözleşmesi incelendi |
| AI katkısı | Tarih aritmetiği, aynı-gün toplama, sıfır-harcama, seri ve hedef-altı semantiklerinin ayrıştırılması; UTC gün sırasına dayalı saf helper, açık durum/mode çıktıları, kanonik aylık hedef kapısı, UI entegrasyonu ve sınır testlerinin mevcut çalışma ağacında incelenmesi ve belgelenmesi |
| İnsan katkısı | Analiz doğruluğunu geliştirme hedefini belirledi; kesin formül ve cihazdaki nihai kabul bu kayıtla ayrıca onaylanmış sayılmaz |
| Karar | Yalnız tamamlanmış günler değerlendirilir ve bugün payda/sıfır/hedef-altı sayısına girmez; bugünkü gerçek harcama aktif sıfır-harcama serisini keser. Takip-temelli uzun dönem ilk gerçek kaynak kaydında başlar; geçmiş aralık seri sonucu dönem sonuna aittir. Günlük hedef yalnız aktif bütçenin kanonik aylık döngüsünde sabit `effectiveBudget / totalDays` olarak sağlanır; hedef olmayan aralıklarda başarı sayısı uydurulmaz. Aynı gün tutarları kuruş cinsinden birleştirilir |
| Değiştirilen dosyalar | Mevcut çalışma ağacı: `app/(tabs)/analytics.tsx`; `src/utils/spendingStats.ts`; `src/utils/__tests__/spendingStats.test.ts`; seri kartı/detay bileşenleri; yaşayan ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; `npm test -- --ci --coverage=false` ile 41/41 suite ve 287/287 test; Android Metro export 1.921 modülle başarılı (çıktı geçici dizinde, repoya eklenmedi) |
| Cihaz doğrulaması | Bekleniyor: bugün işlemli/işlemsiz durum, aktif aylık döngü, yıllık/takip başlangıcı, geçmiş aralık dönem-sonu etiketi ve aralık geçişleri |
| Gizlilik | Ham kullanıcı işlemleri veya ekran görüntüleri belge/test fixture'larına aktarılmadı |
| Kalan risk | Saf testler cihaz saat dilimi girdisinin çağıran tarafından doğru üretilmesini, gerçek SQLite günlük toplamlarını ve görünen metinlerin fiziksel cihaz yerleşimini tek başına kanıtlamaz |
| Nihai durum | Mevcut çalışma ağacındaki kod ve odaklı otomatik test gözlemlendi; commit/CI, hedef cihaz ve insan kabulü bekleniyor |

### AI-2026-08-02-ANDROID-SYSTEM-NOTIFICATIONS-001

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-02 / Europe/Warsaw |
| Başlangıç çalışma ağacı | `main`; çalışma ağacında önceki kullanıcı onaylı Analiz, bildirim, locale ve belge değişiklikleri vardı ve korunarak devam edildi. Bu kayıt commit kimliğine bağlanmadı |
| İnsan hedefi | Uygulama içi bildirimleri Android sistem bildirim alanında da sunarken düzeltilmiş açılış sürekliliğini, profesyonel önem düzeyini, gizliliği ve tekrar etmeyen teslimi korumak |
| Sağlanan kanıt | Bildirim UX ve flicker hedefleri önceki kullanıcı geri bildiriminde tanımlandı; bu native köprü için fiziksel APK sonucu veya sistem tepsisi ekran kaydı sağlanmadı |
| AI katkısı | Açılış reveal sırası, Expo Go sınırı, Android 13 izin akışı, kanal önemleri, foreground davranışı, teslim idempotency'si, resume senkronizasyonu, warm/cold tap ve silme koordinasyonunun mevcut çalışma ağacında incelenmesi; servis/storage/context testleri ve belge/kanıt ayrımının uygulanması |
| İnsan katkısı | Flicker olmadan profesyonel bildirim deneyimi hedefini belirledi; fiziksel APK smoke testi ve nihai kabul kullanıcıda kalır |
| Karar | Native teslim reveal sonrasında etkinleşir; Expo Go native modül importundan önce durdurulur. Bilgi kayıtları sessiz/default `updates`, warning/critical kayıtları sesli-titreşimli/high `alerts` kanalına gider ve iki kanal kilit ekranında `PRIVATE` kalır. Uygulama feed'i native başarısızlıktan bağımsızdır. Sınırlı ledger yalnız kimlik/zaman bilgisi tutar; ilk aktivasyonda eski feed baselined edilir, başarılı teslim kaydedilir, başarısız teslim sonraki resume sync'te yeniden denenebilir |
| Değiştirilen dosyalar | Mevcut çalışma ağacı: `app/_layout.tsx`; `src/context/NotificationsContext.tsx`; `src/services/androidNotificationsSetup.ts`; `src/notifications/storage.ts`; ilgili testler; yaşayan ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; `npm test -- --ci --coverage=false` ile 41/41 suite ve 287/287 test; Android Metro export 1.921 modülle başarılı (çıktı geçici dizinde, repoya eklenmedi). Native servis testleri OS yüzeyini mock'lar |
| Cihaz doğrulaması | Bekleniyor: standalone APK cold start/reveal ve Android 13+ izin sırası; iki kanalın önem/ses/titreşim/`PRIVATE` davranışı; foreground/background/resume ve yeniden başlatmada çift teslim olmaması; uygulama içi silme; warm/cold bildirim dokunuşu |
| Gizlilik | Ledger sözleşmesi bildirim başlığı, gövdesi ve finansal içeriği saklamaz; bu belgeye gerçek bildirim içeriği veya kişisel dosya yolu eklenmedi |
| Kalan risk | Expo Go native teslim kanıtı değildir. Jest mock'ları Android kanal davranışını, OS izin UI'ını, kilit ekranı gizliliğini, cold-start routing'i veya üretim Activity yaşam döngüsünü doğrulamaz |
| Nihai durum | Mevcut çalışma ağacındaki kod ve odaklı otomatik test gözlemlendi; fiziksel APK, commit/CI ve insan kabulü bekleniyor |

### AI-2026-08-09-RECEIPT-MONEY-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-09 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `203cdde` |
| Başlangıç çalışma ağacı | Clean |
| İnsan hedefi | `3,17` indirimin `3` görünmesini ve item düzenlemesinden sonra `55.000000…` gibi toplam oluşmasını kökten düzeltmek; AI ve manuel fiş akışını küçük para değişikliklerinde stabil kılmak |
| Açık insan onayı | Kullanıcı doğrudan inceleme ve uygulama istedi; dış yayın/commit yapılmadı |
| Kısıtlar ve korunacak alanlar | Basılı fiş toplamı ingestion sırasında yetkili kalmalı; explicit item edit toplamı değiştirebilir; mevcut veri kaybolmamalı; ortak SQLite erişim ve dört dil sözleşmesi korunmalı |
| AI'ya sağlanan kaynaklar | Uygulama tutar ekranı ve örnek mağaza fişi ekran görüntüleri; mevcut repo kodu ve ADR-004 |
| AI katkısı | İndirim formatı, edit hesapları, DAO yazmaları, SQLite toplamı, AI coercion, fiş sonlandırma, backup import ve eski veri upgrade zincirinin incelenmesi; minor-unit helper, atomik mutasyon, migration, UI hassasiyeti ve testlerin uygulanması |
| İnsan katkısı | Gerçek hata örneğini, beklenen kesinlik seviyesini ve AI/manüel kapsamını belirledi |
| Değiştirilen ana alanlar | `app/{add-expense,edit-items}.tsx`, tarayıcı önizlemesi; `src/utils/{moneyMath,receiptMoney,receiptLineDiscountUi}.ts`; `src/db/{database,expenseDao}.ts`; fiş/Gemini/backup servisleri; i18n, testler ve mimari belgeler |
| Otomatik doğrulama | `npm run typecheck` exit 0; `npm test -- --ci --coverage=false` ile 43/43 suite ve 310/310 test; Android Metro export 1.923 modülle başarılı; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: eski veritabanından upgrade; indirim `3,17`; fiş toplamı `55,93`; indirimi `0,20` değiştirip toplamın tam `0,20` değişmesi; kayıt, geri açma ve AI/manüel akış karşılaştırması |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor |
| Gizlilik incelemesi | Gerçek fiş içeriği veya yerel attachment yolu belgeye kopyalanmadı; yalnız hesap senaryosu ve anonim tutarlar kaydedildi |
| Kalan risk | Jest DAO ve migration sözleşmesini mock ile doğrular; gerçek Expo SQLite `REAL` upgrade'i ve Android TextInput/render sonucu yalnız cihazda kabul edilebilir |

### AI-2026-08-09-THEME-CONTINUITY-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-09 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `203cdde` |
| Başlangıç çalışma ağacı | Önceki kullanıcı onaylı fiş para hassasiyeti değişiklikleri vardı; korunarak devam edildi |
| İnsan hedefi | Aydınlık temada koyu kalan Tarayıcı'yı düzeltmek; Dashboard'dan Tarayıcı'ya hızlı geçişte görünen beyaz/İşlemler benzeri ara kareyi kökten kaldırmak; otomatik ve manuel tema modlarını aynı stabil altyapıda tutmak |
| Açık insan onayı | Kullanıcı tema sisteminin incelenmesini ve gerekli kod düzenlemesinin uygulanmasını doğrudan istedi; dış yayın/commit yapılmadı |
| AI'ya sağlanan kaynaklar | Açık tema Tarayıcı ekran görüntüsü, geçiş videosundan alınmış kare, mevcut tema/startup ADR'si ve depo kodu |
| AI katkısı | Tema store, root reveal, Expo config, React Navigation ve Material Top Tabs kaynak zincirinin incelenmesi; Scanner abonelik açığının ve DefaultTheme lazy scene kaçağının teşhisi; navigation theme bridge, opak lazy placeholder, test ve belge uygulaması |
| İnsan katkısı | Görsel semptomları, hızlı geçiş rotasını, otomatik/manüel tema kapsamını ve profesyonel süreklilik beklentisini tanımladı |
| Karar | `Appearance.setColorScheme` kullanılmaz ve lazy loading kapatılmaz. SPARK paleti React Navigation context'ine taşınır; scene ve lazy placeholder aktif temada opak kalır; mounted Scanner `useAppTheme` ile StyleSheet'i yeniden üretir |
| Değiştirilen ana alanlar | `app/_layout.tsx`, `app/(tabs)/{_layout,scanner}.tsx`, `src/theme/navigationTheme.ts`, üç regresyon testi, ADR-001 ve evidence/rehber belgeleri |
| Otomatik doğrulama | Odaklı 3/3 suite ve 4/4 test; `npm run typecheck` exit 0; tam `npm test -- --ci --coverage=false` ile 46/46 suite ve 314/314 test; Android Metro export 1.924 modülle başarılı; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: standalone APK'da dark/light cold start; Dashboard→Tarayıcı ve Tarayıcı→Dashboard doğrudan dokunma; ilk lazy İşlemler/Analiz/Ayarlar ziyareti; iki yönlü swipe; açık uygulamada manuel ve otomatik tema değişimi; yavaşlatılmış animasyon/video kare kontrolü |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor |
| Gizlilik incelemesi | Kullanıcı görselleri repoya kopyalanmadı; yerel attachment yolu, cihaz kimliği veya finansal içerik kanıt belgesine eklenmedi |
| Kalan risk | Jest, React props ve tema eşlemesini doğrular; Android PagerView/native window kompozisyonunda tek karelik flicker olmadığını yalnız standalone cihaz kaydı kanıtlayabilir |

### AI-2026-08-09-GOAL-DELETE-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-09 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `203cdde` |
| Başlangıç çalışma ağacı | Önceki kullanıcı onaylı fiş para hassasiyeti ve tema sürekliliği değişiklikleri vardı; korunarak devam edildi |
| İnsan hedefi | Kayıtlı hedef yokken çalışan “Hedefi sil” eylemini düzeltmek; hedefi Dashboard'da öne çıkarma, motivasyon mesajları ve borç/tekrarlayan ödeme hatırlatıcılarını SPARK'a özel değerlendirmek |
| Açık insan onayı | Kullanıcı hata düzeltmesini doğrudan istedi; daha büyük Dashboard ve hatırlatıcı kapsamı için karar sordu, bu özellikler sessizce uygulanmadı |
| AI katkısı | Hedef ve kategori limiti yaşam döngülerinin incelenmesi; persisted-state ve DAO değişim korumasının uygulanması; dört dil ve regresyon testleri; Dashboard sırası, hedef mesajları, abonelik tahmini, borç şeması ve Android teslim sınırlarının salt-okunur analizi |
| İnsan katkısı | Hata örneğini ve arkadaş kullanıcı geri bildirimlerini sağladı; sonraki ürün kapsamının nihai seçimi insanda kaldı |
| AI önerileri | Serbest Dashboard drag/drop yerine isteğe bağlı kompakt “hedefi öne çıkar” modu; milestone tabanlı ve susturulabilir hedef motivasyonu; borç için ayrı son-tarih alanı; tekrarlayan ödeme için kullanıcı onaylı takvim kuralı ve daha sonra güvenilir scheduler |
| İnsan tarafından seçilen/reddedilen öneriler | Hedef-silme güvenlik düzeltmesi istekte açıkça seçildi. Dashboard, motivasyon ve tarihli hatırlatıcı önerileri bu kayıt anında henüz seçilmedi |
| Değiştirilen dosyalar | `app/goal-settings.tsx`; `src/db/{goalDao,categoryLimitDao}.ts`; i18n kaynak/üretilmiş sözlükleri; iki yeni test; ürün, mimari ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; locale+hedef odaklı 3/3 suite ve 16/16 test; `npm test -- --ci --runInBand --coverage=false` ile 48/48 suite ve 319/319 test başarılı |
| Cihaz doğrulaması | Bekleniyor: hedefsiz ekran; hedef+birden fazla aya ait limit; silme modalı; hızlı çift dokunma; açık/koyu tema ve dört dil |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor |
| Gizlilik incelemesi | Kullanıcı görselleri repoya kopyalanmadı; kişisel mesaj veya finansal tutar kanıt belgesine taşınmadı |
| Kalan risk | Testler gerçek SQLite ve native modal dokunmasını mock'lar. Tarihli hatırlatıcılar henüz uygulanmadı; mevcut Android teslimi kapalı uygulamayı gelecekte uyandıran scheduler değildir |

### AI-2026-08-09-GOAL-FOCUS-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-09 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `203cdde` |
| Başlangıç çalışma ağacı | Önceki kullanıcı onaylı fiş, tema ve hedef-silme değişiklikleri vardı; korunarak devam edildi |
| İnsan hedefi | Dashboard'da birikim hedefini daha görünür fakat profesyonel ve kontrollü yapmak; borç ve internet ödemesi hatırlatıcılarını küçük, doğrulanabilir fazlara bölmek |
| Açık insan onayı | Kullanıcı Dashboard önerisini uygulamak için açık onay verdi. Bildirim/hatırlatıcı koduna geçmeden planı görüp ayrıca onay vermek istedi; bu kapsamda hatırlatıcı ürün kodu değiştirilmedi |
| Kısıtlar ve korunacak alanlar | Açık borç en yüksek dinamik öncelikte kalmalı; hedef iki kez gösterilmemeli; kategori limitleri hedeften bağımsız kalmalı; mevcut kullanıcı düzeni izinsiz değişmemeli; dört dil ve tema sözleşmesi korunmalı |
| AI katkısı | Dashboard sırası ve mevcut tercih altyapısının incelenmesi; kompakt kart, saf ilerleme hesabı, ortak katkı sheet'i, tek-sorgulu yerel tercih, yükleme kapısı, dört dil, testler ve tez kanıtının uygulanması; mevcut borç/abonelik/native teslim sınırlarından altı fazlı hatırlatıcı planının çıkarılması |
| İnsan katkısı | Dashboard önerisini ürün kararı olarak seçti; hatırlatıcıların daha büyük çalışma olduğunu ve yalnız ayrı onaydan sonra uygulanacağını belirledi |
| Karar | Tam serbest drag/drop yerine varsayılan kapalı “Birikim hedefini öne çıkar” tercihi kullanılır. Aktif/tamamlanmamış hedef, açık borç uyarısından sonra kompakt gösterilir; tam kart aynı anda render edilmez. Tamamlanmış hedef standart konumda kalır; hedef yokken üst placeholder üretilmez; kategori limitleri bağımsız alt bölümünü korur |
| Değiştirilen ana alanlar | `app/{(tabs)/index,settings-budget}.tsx`; `src/components/SavingsGoal{Card,PulseCard,ContributionSheet}.tsx`; hedef preference hook/service'i; iki saf hedef helper'ı; dört dil kaynak ve çıktıları; altı yeni test paketi; ürün, mimari ve evidence belgeleri |
| Otomatik doğrulama | Locale derlemesi: RU/AZ partial 775, runtime 776 anahtar; odaklı 8/8 suite ve 41/41 test; `npm run typecheck` exit 0; tam `npm test -- --ci --runInBand --coverage=false` ile 55/55 suite ve 349/349 test; son kodla Android Metro export 1.928 modülle başarılı; `git diff --check` temiz |
| Cihaz doğrulaması | Bekleniyor: standalone APK'da açık/koyu tema; TR/EN/AZ/RU; büyük font; açık borç+aktif hedef sırası; tercih aç/kapat ve yeniden başlatma; aktif/tamamlanmış/gecikmiş hedef; ana kart ve ayrı katkı düğmesi; katkı sonrası anlık yenileme |
| Hatırlatıcı plan sınırı | Mevcut Android teslimi yalnız uygulama sync/open/resume sırasında anlıktır. Gerçek geleceğe tarihli teslim için şema+backup, borç UX, kullanıcı onaylı düzenli ödeme, saf notification kuralları, Android scheduler/uzlaştırma ve fiziksel APK doğrulaması ayrı fazlar olarak planlandı; hiçbiri bu kayıtta uygulanmış sayılmaz |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Dashboard için cihaz ve insan kabulü; hatırlatıcı kapsamı için uygulama öncesi onay bekleniyor |
| Gizlilik incelemesi | Kullanıcı görselleri veya kişisel mesajlar repoya kopyalanmadı; gerçek finansal değerler test fixture'larına taşınmadı; hatırlatıcı planı şema ve davranış düzeyinde tutuldu |
| Kalan risk | Jest gerçek SQLite tercih kalıcılığını, büyük font fiziksel yerleşimini, haptic'i veya native sheet dokunmasını kanıtlamaz. Kapalı uygulamaya zamanlı Android bildirimi Faz 5 tamamlanıp APK'da doğrulanmadan vaat edilemez |

### AI-2026-08-09-REMINDER-FOUNDATION-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-09 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `67b8117` |
| Başlangıç çalışma ağacı | Clean |
| İnsan hedefi | Borç son ödeme tarihi ile internet benzeri düzenli ödeme hatırlatıcılarını büyük tek değişiklik yerine küçük, doğrulanabilir fazlarda geliştirmek; önce veri temelini kurmak |
| Açık insan onayı | Kullanıcı, önceden sunulan hatırlatıcı planında yalnız Faz 1'e geçilmesini açıkça onayladı. Uygulama UI'ı, feed kuralları, geleceğe tarihli Android teslimi, commit, push ve yayın yetkisi verilmedi |
| Kısıtlar ve korunacak alanlar | Borcun nakit-akışı tarihi vade olarak yeniden kullanılamaz; abonelik tahmini kullanıcı taahhüdü değildir; birden çok finansal yazı atomik olmalı; backup geriye uyumlu ve dış girdi doğrulamalı olmalı; dört dil ve Expo Go guard'ı korunmalı |
| AI'ya sağlanan kaynaklar | Kullanıcı geri bildirimi; mevcut borç, abonelik, bildirim, backup ve DB kodu; `DESIGN_BRIEF.md`, mimari/kalite rehberleri ve ADR'ler |
| AI katkısı | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon`: vade/reminder şeması ve idempotent migration; saf takvim/occurrence doğrulaması; borç ve recurring DAO'ları; backup v3 doğrulama, kaynak-hedef eşleme ve exact consumable-pool idempotence; çapraz ajan final denetimi; ADR ve tez kanıtı |
| İnsan katkısı | Hatırlatıcı ihtiyacını ve aşamalı çalışma tercihini belirledi; Faz 1 kapsamını seçti; gerçek APK/cihaz testi ve sonraki faz kararı insanda kaldı |
| Karar | `debts.date` nakit-akışı semantiğini korur, opsiyonel `due_date` ayrı tutulur. Kullanıcı tarafından yönetilen düzenli ödeme ayrı tablo/UID kullanır; sıradaki vade tekrar programının gerçek oluşumudur. Backup v3 ilişkileri hedef PK'lerine yeniden eşler, borç durumunu ödemelerden türetir ve yalnız birebir eşleşmeleri atlar. Veri modeli tek başına native scheduler değildir |
| Değiştirilen ana alanlar | `src/db/{schema,database,debtDao,recurringPaymentReminderDao}.ts`; `src/utils/{inputValidation,recurringSchedule}.ts`; `src/services/backupService.ts`; `src/components/BackupSection.tsx`; TR/EN/AZ/RU locale kaynak/çıktıları; DAO/migration/backup/calendar testleri; `DESIGN_BRIEF.md`, `docs/ARCHITECTURE.md`, ADR-006 ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; odaklı 6/6 suite ve 121/121 test; `npm test -- --ci --runInBand --coverage=false` exit 0, 60/60 suite ve 448/448 test; `git diff --check` exit 0. SQLite trigger davranışı salt-okunur denetimde bellek veritabanıyla doğrulandı; bu bir Android cihaz kanıtı değildir |
| Cihaz doğrulaması | Bekleniyor: standalone APK temiz kurulum; mevcut v1 marker'lı DB'de v2 trigger uzlaştırması; eski borç DB upgrade'i; invalid CHECK'ler; vendor silmede reminder'ın manuel+bağsız kalması; v1/v2/v3 backup restore ve ikinci import |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor |
| Hatalı/yarım AI çıktısı | İlk taslaklarda backup identity yalnız tek `created_at` satırına, UID yalnız biçim-benzeri regex'e ve recurrence yalnız `next>=anchor` kontrolüne dayanıyordu. Final çapraz denetim bunların sessiz merge/self-restore riskini gösterdi; consumable pool, ortak RFC UUID ve occurrence üyeliği ile değiştirildi |
| Gizlilik incelemesi | Kullanıcı ekran görüntüsü, kişisel mesaj, satıcı/tutar kaydı, secret, credential veya yerel mutlak dosya yolu evidence içine kopyalanmadı; testler genel fixture'larla kuruldu |
| Retrospektif sınırlama | Oturumun kalıcı platform kimliği ve kesin model build'i kaydedilmedi; yerel komut çıktıları henüz commit/CI artefaktına bağlanmadı |
| Takip işleri | Faz 2 borç vade/reminder UX'i; Faz 3 kullanıcı tarafından onaylı düzenli ödeme yönetimi; daha sonra feed kuralları, Android scheduler/uzlaştırma ve fiziksel APK kabulü. Faz 5 tamamlanmadan kapalı uygulamaya zamanında teslim garantisi verilmez |

### AI-2026-08-11-DEBT-REMINDER-UX-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-11 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `67b8117` |
| Başlangıç çalışma ağacı | Dirty; aynı insan-onaylı hatırlatıcı çalışmasının henüz commit edilmemiş Faz 1 şema, DAO, backup, test ve belge değişiklikleri vardı ve korundu |
| İnsan hedefi | Faz 1'in ardından borç son ödeme tarihi ve borç hatırlatma tercihinin profesyonel kullanıcı akışına geçmek |
| Açık insan onayı | Kullanıcı yalnız Faz 2'ye geçilmesini açıkça onayladı. Düzenli ödeme yönetimi, feed bildirimi, kapalı uygulamayı uyandıran scheduler, commit, push ve yayın yetkisi verilmedi |
| Kısıtlar ve korunacak alanlar | `debts.date` nakit-akış tarihi olarak kalmalı; vade opsiyonel olmalı; vadesiz hatırlatma açılmamalı; kapanmış borç eski UI ile değiştirilmemeli; aynı SQLite bağlantısında sorgular seri tutulmalı; dört dil ve tema sözleşmesi korunmalı |
| AI'ya sağlanan kaynaklar | Kullanıcının faz onayı; Faz 1 kodu ve ADR-006; mevcut `DebtSheet`, takvim, DAO, i18n, kalite ve kanıt belgeleri |
| AI katkısı | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon`: Faz sınırı denetimi; ortak vade/hatırlatma alanı; yeni borçta tek INSERT ve açık borçta tek UPDATE akışı; açık listede vade sunumu; tarih seçici hedef ayrımı ve timezone/ay-sonu güvenliği; erişilebilirlik, dört dil, test ve tez kanıtı |
| İnsan katkısı | Aşamalı uygulama yöntemini ve Faz 2 başlangıcını seçti; fiziksel APK ve nihai kullanıcı kabulü insanda kaldı |
| Karar | Vade, borcun işlem tarihinden ayrı ve opsiyoneldir. Hatırlatma yalnız vade varken etkinleşir; vade temizlenince kapanır. Kapanmış/bakiyesiz borçta ayar UPDATE'i başarısız sayılır. Hatırlatma ayarı geri ödemeden ayrı mutasyondur ve bütçe yenilemesi tetiklemez. Faz 2 tercih saklar; geleceğe tarihli native teslim yapmaz |
| Değiştirilen ana alanlar | `src/components/{DebtSheet,DebtReminderFields,CustomDatePicker}.tsx`; `src/utils/{dateUtils,debtReminder}.ts`; `src/db/debtDao.ts`; TR/EN/AZ/RU locale kaynak/derlenmiş çıktılar; component/DAO/takvim testleri; `DESIGN_BRIEF.md` ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; odaklı 7/7 suite ve 67/67 test; `npm test -- --ci --runInBand --coverage=false` exit 0, 64/64 suite ve 483/483 test; locale parity 11/11; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: standalone Android'de nested sheet+tarih modalı, işlem/vade/ödeme tarihi ayrımı, klavye, geri/drag, açık-koyu tema, büyük font ve TalkBack. Zamanlı sistem bildirimi bu fazın cihaz kabulü değildir |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor |
| Gizlilik incelemesi | Kullanıcı ekran görüntüsü, gerçek borç/tutar/kişi verisi, secret, credential veya yerel mutlak dosya yolu belge ve testlere kopyalanmadı; fixture'lar geneldir |
| Retrospektif sınırlama | Component testleri native modal kompozisyonunu ve Android dokunma/klavye davranışını kanıtlamaz. Faz 5 scheduler ve uzlaştırma tamamlanmadan kapalı uygulamaya zamanında teslim iddiası kurulamaz |
| Takip işleri | Faz 3 kullanıcı tarafından yönetilen düzenli ödeme akışı; sonra feed kuralları, native scheduler/ledger/uzlaştırma ve standalone cihaz kabulü |

### AI-2026-08-11-RECURRING-PAYMENT-UX-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-11 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `67b8117` |
| Başlangıç çalışma ağacı | Dirty; insan-onaylı Faz 1–2 reminder değişiklikleri henüz commit edilmemişti ve korundu |
| İnsan hedefi | Faz 3'te internet/kira gibi düzenli ödemeler için kullanıcı tarafından yönetilen plan akışını kurmak; token tüketimini sınırlı tutmak |
| Açık insan onayı | Kullanıcı yalnız Faz 3'e geçilmesini onayladı. Feed bildirimi, geleceğe tarihli native scheduler, commit, push ve yayın yetkisi verilmedi |
| Kısıtlar ve korunacak alanlar | Yerel tahmin kullanıcı onayı olmadan kalıcı plana dönüşmemeli; sorgular seri kalmalı; tekrar programı kanonik occurrence olmalı; dört dil ve tema sözleşmesi korunmalı; UI telefon teslimi vaadi vermemeli |
| AI katkısı | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon`: mevcut Abonelikler/DAO sınırının tek dar denetimi; ortak plan sheet'i; manuel/detected create, edit, pause/resume/delete; i18n, test ve tez izlenebilirliği |
| İnsan katkısı | Faz 3 başlangıcını ve düşük token önceliğini belirledi; fiziksel APK ve nihai kabul insanda kaldı |
| Karar | Onaylı “Ödeme planlarım” ile salt tahmin olan “Algılanan ödemeler” ayrı yüzeylerdir. Algılanan satıcı yalnız formda açık Kaydet ile detected plana dönüşür. Düzenleme program değiştiğinde anchor'ı yeni vadesine taşır; salt metin/tutar değişikliği ay-sonu anchor'ını korur. Pause silme değildir |
| Değiştirilen ana alanlar | `app/subscriptions.tsx`; `src/components/RecurringPaymentReminderSheet.tsx`; TR/EN/AZ/RU locale kaynak/çıktıları; form regresyon testleri; `DESIGN_BRIEF.md` ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; form/DAO/locale odaklı 3/3 suite ve 32/32 test; `npm test -- --ci --runInBand --coverage=false` exit 0, 65/65 suite ve 487/487 test; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: standalone Android'de sheet+tarih modalı, klavye, geri/drag, açık-koyu tema, dört dil, büyük font ve tüm CRUD/detected akışı. Telefon zamanlaması Faz 3 cihaz kabulü değildir |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor |
| Gizlilik incelemesi | Gerçek kullanıcı ödeme/satıcı/tutarı, ekran görüntüsü, secret, credential veya mutlak yerel yol belge/test fixture'larına kopyalanmadı |
| Retrospektif sınırlama | Component testleri native modal ve gerçek SQLite'ı mock'lar. Faz 5 scheduler/uzlaştırma tamamlanmadan kapalı uygulamaya zamanında teslim iddiası kurulamaz |
| Takip işleri | Faz 4 saf feed kuralları; Faz 5 native scheduler/ledger/uzlaştırma; Faz 6 standalone cihaz sertleştirme ve kullanıcı kabulü |

### AI-2026-08-11-REMINDER-FEED-RULES-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-11 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `67b8117` |
| Başlangıç çalışma ağacı | Dirty; insan-onaylı Faz 1–3 reminder değişiklikleri henüz commit edilmemişti ve korundu |
| İnsan hedefi | Faz 4'te borç vadesi ve açıkça kaydedilmiş ödeme planlarını profesyonel uygulama-içi bildirim kurallarına bağlamak; Faz 2 düzeyindeki kaliteyi ölçülü token kullanımıyla korumak |
| Açık insan onayı | Kullanıcı yalnız Faz 4'e geçilmesini onayladı. Geleceğe tarihli native scheduler, commit, push ve yayın yetkisi verilmedi |
| Kısıtlar ve korunacak alanlar | Borç, onaylı plan ve tahmin birbirine karışmamalı; tarih hesabı yerel ve saf olmalı; silinen aynı uyarı geri doğmamalı; stale feed/tepsi kopyaları temizlenmeli; DB sorguları seri kalmalı; dört dil korunmalı; kapalı uygulama teslimi vaat edilmemeli |
| AI katkısı | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon`: saf reminder kural motoru; deterministik kimlik/fingerprint; feed uzlaştırma ve stale retirement; ayrı filtre/mute kanalları; Android tepsi temizliği; domain mutasyonlarında global yenileme; dört dil, regresyon testleri ve tez izlenebilirliği |
| İnsan katkısı | Faz 4 başlangıcını, kalite/token dengesini ve kapsam sınırını belirledi; fiziksel APK ve nihai kabul insanda kaldı |
| Karar | Açık borç “yaklaşıyor/bugün/gecikti” aşamalarını kullanır. Kullanıcı planında ödeme sonucu izlenmediği için geçmiş tarih yalnız tarafsız “planlanan tarih geçti” olarak sunulur. Tahmini abonelik ayrı kanalda kalır ve aynı vendor onaylı plana dönüştüğünde bastırılır. Feed kanoniktir; native geleceğe zamanlama Faz 5'tir |
| Değiştirilen ana alanlar | `src/notifications/{reminderNotificationRules,reminderNotificationFeed,buildNotifications,presentation,types}.ts`; `src/context/NotificationsContext.tsx`; `app/{notifications,subscriptions}.tsx`; `src/components/DebtSheet.tsx`; TR/EN/AZ/RU locale kaynak/çıktıları; testler; ürün, mimari, ADR ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; `npm test -- --ci --runInBand --coverage=false` exit 0, 69/69 suite ve 547/547 test; locale parity 11/11; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: standalone Android'de uygulama açık/resume, saat eşiği, borç/plan/tahmin filtre ve mute'ları, settle/pause/reschedule cleanup ve retired tepsi kopyalarının kaldırılması. Kapalı uygulamada geleceğe kesin teslim Faz 5 kabulüdür |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor |
| Gizlilik incelemesi | Gerçek kullanıcı borcu, ödeme planı, satıcı/tutarı, ekran görüntüsü, secret, credential veya mutlak yerel yol belge/test fixture'larına kopyalanmadı |
| Retrospektif sınırlama | Saf Jest ve context mock'ları OS scheduler, süreç ölümü, reboot, timezone değişimi veya fiziksel Android tepsisini kanıtlamaz. `next_due_date` Faz 4'te otomatik ilerletilmez; plan yaşam döngüsü ve native ledger Faz 5'e bırakılmıştır |
| Takip işleri | Faz 5 native scheduler/ledger/uzlaştırma; Faz 6 standalone cihaz sertleştirme ve kullanıcı kabulü |

### AI-2026-08-11-ANDROID-REMINDER-SCHEDULER-001

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-11 · Europe/Warsaw |
| İnsan katılımcı/rol | Ürün sahibi ve geliştirici |
| AI aracı, model ve sürüm | Codex; kesin model/sürüm bu kayıtta doğrulanmadı |
| Repo/branch/başlangıç commit'i | `main` · `67b8117` |
| Başlangıç çalışma ağacı | Dirty; insan-onaylı Faz 1–4 hatırlatıcı değişiklikleri henüz commit edilmemişti ve korundu |
| İnsan hedefi | Faz 5'te borç ve düzenli ödeme tercihlerinin, uygulama kapalıyken de Android tarafından gelecekte teslim edilebilecek güvenli alarmlara dönüşmesi; kalitenin korunurken token tüketiminin kontrollü kalması |
| Açık insan onayı | Kullanıcı yalnız Faz 5'e geçilmesini onayladı. Commit, push, yayın, yeni paket/native modül ve exact-alarm özel erişimi onaylanmadı veya uygulanmadı |
| Kısıtlar ve korunacak alanlar | Feed kanonik kalmalı; native hata finansal/domain veriyi geri almamalı; aynı SQLite bağlantısı seri kullanılmalı; Expo Go ve reveal kapısı korunmalı; başka native istekler iptal edilmemeli; kişisel/finansal metin uygulama ledger'ına yazılmamalı; exact dakika garantisi verilmemeli |
| AI'ya sağlanan kaynaklar | İnsan faz onayı ve token sınırı; Faz 1–4 kodu/testleri; Expo SDK 55'in depodaki tip/native uygulaması; `DESIGN_BRIEF`, mimari, kalite rehberi ve ADR-006 |
| AI katkısı | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon`: SDK 55 trigger/cancel sınırı; saf rolling-horizon üretimi; geçmiş schedule cursor'ı; actual-vs-desired native uzlaştırma; schedule+immediate-delivery baseline'ının ortak transaction'ı ve telafi iptali; mute/dismiss/settle/pause cleanup; reveal-güvenli cold-tap senkronu, sync mutex'i ve fired-tray retry; dört dil; odaklı ve tam regresyon; tez izlenebilirliği |
| İnsan katkısı | Faz 5 başlangıcını ve ölçülü token kullanımını seçti; yeni izin eklenmemesi ve fiziksel APK/nihai kabul insanda kaldı |
| Karar | Borç için yaklaşan ve vade-günü alarmı; kullanıcı planı için 400 günlük, plan başına en çok 14 oluşum ve global 512 istek üretilir. Plan cursor'ı ödeme gerçekleşti sayılmadan ilerler. Yalnız SPARK sahiplik prefix'i uzlaştırılır. Future alarm başarıyla kurulunca aynı feed kimliği anlık teslim ledger'ında baseline edilir. Exact-alarm izni istenmez ve teslim dakikası garanti edilmez |
| Değiştirilen ana alanlar | `src/notifications/{reminderNativeSchedule,reminderNotificationPresentation,storage,buildNotifications}.ts`; `src/services/{reminderScheduler,androidNotificationsSetup}.ts`; `src/context/NotificationsContext.tsx`; `src/db/recurringPaymentReminderDao.ts`; `src/utils/recurringSchedule.ts`; `app/_layout.tsx`; dört dil kaynak/çıktıları; ilgili testler; ürün, mimari, kalite, ADR ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; Faz 5 odaklı `npm test -- --runInBand --coverage=false ...` exit 0, 9/9 suite ve 167/167 test; `npm test -- --ci --runInBand --coverage=false` exit 0, 71/71 suite ve 614/614 test; locale parity odaklı pakete dahil; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: standalone Android APK'da Android 13+ izin; seçilen saate future DATE alarmı; process-kill; reboot; APK update; Doze/OEM gecikmesi; settle/pause/delete/mute sonrası iptal; warm/cold tap ve tek feed kaydı; timezone değişiminden sonraki resume; force-stop sınırı |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor; otomatik test sonucu OS teslim kanıtı sayılmadı |
| Hatalı/yarım AI çıktısı | İlk dar seçenek yalnız tek `next_due_date` alarmını planlayacaktı; bu, aylık internet ödemesini uygulama açılmadan sonraki aylara taşıyamayacağı için kullanılmadı. Bunun yerine sınırlı ve adil rolling horizon seçildi. Exact-alarm izni ve sonsuz tekrar vaadi kapsam dışında bırakıldı |
| Gizlilik incelemesi | Gerçek borç, satıcı, ödeme/tutar, ekran görüntüsü, secret, credential veya mutlak yerel yol test ve belgeye kopyalanmadı. SQLite schedule ledger'ı yalnız kimlik/revision/zaman metadata'sı taşır; Expo/Android'in uygulamaya özel native deposunda kullanıcıya sunulan title/body bulunabileceği açıkça belgelendi |
| Retrospektif sınırlama | Jest native API'leri mock'lar; OS alarmı, reboot restore, Doze/OEM gecikmesi, force-stop ve killed-state timezone davranışını kanıtlamaz. OS scheduling ile SQLite tek transaction değildir; telafi iptali ani süreç ölümü penceresini tamamen ortadan kaldırmaz |
| Takip işleri | Faz 6 standalone Android sertleştirme, fiziksel cihaz kanıtı ve nihai insan kabulü |

### `AI-2026-08-13-RECEIPT-DELETE-NOTIFICATION-001`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-13 · Europe/Warsaw |
| İnsan hedefi | Silinen bir işlemin saatler önce oluşturulmuş fiş bildiriminin genel refresh sonrasında yeniden “işlem kaydedildi” olarak Android paneline düşmesini engellemek |
| Açık insan onayı | Kullanıcı hata düzeltmesini istedi; commit, push, APK build veya yayınlama istemedi |
| Başlangıç çalışma ağacı | Dirty; insan-onaylı Faz 1–5 değişiklikleri korundu |
| AI katkısı | `analiz`, `kod`, `test`, `dokümantasyon`: işlem–fiş bildirimi yaşam döngüsü ve Android delivery eligibility denetlendi; stale kart emekliliği, tray cleanup kimliği ve eski backlog baseline koruması uygulandı |
| İnsan katkısı | Gerçek cihazdaki yeniden bildirim semptomunu ekran görüntüsü ve tekrar senaryosuyla bildirdi; nihai APK kabulü insanda kaldı |
| Karar | Fiş bildirimi bağımsız sonsuz tarihçe değil, mevcut harcamaya bağlı türevdir. Harcama silinince kart stale olur. Native anlık teslim yalnız explicit-created veya iki dakikalık taze kayıt içindir; eski unread backlog başka bir işlem nedeniyle yeniden uyarılmaz |
| Değiştirilen ana alanlar | `src/notifications/{receiptNotifications,buildNotifications}.ts`; `src/services/androidNotificationsSetup.ts`; ilgili Jest testleri; evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; odaklı 4/4 suite ve 65/65 test; tam Jest 71/71 suite ve 617/617 test; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: standalone APK'da eski unread fiş kartı bulunan durumda başka bir taranmış harcamayı silme, app resume ve yeniden başlatma sonrasında eski işlem için yeni tray bildirimi oluşmamalı; silinen işleme bağlı feed kartı kalmamalı |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor; otomatik test Android panel davranışının fiziksel kanıtı değildir |
| Gizlilik incelemesi | Kullanıcının ekran görüntüsündeki gerçek satıcı adları veya cihaz bilgileri teste ve belgeye taşınmadı; sentetik kimlikler kullanıldı |
| Takip işleri | Faz 6 standalone Android cihaz kabulüne bu regresyon senaryosunu eklemek |

### `AI-2026-08-13-SCANNER-VISUAL-REFINEMENT-001`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-13 · Europe/Warsaw |
| İnsan hedefi | Fiş Tarayıcı girişini eski Android hissi veren büyük ikon/kartlardan arındırıp, sağlanan kapsül referansını SPARK kimliğine uyarlayan modern ve sakin bir açık/koyu tema tasarımına dönüştürmek |
| Açık insan onayı | Kullanıcı görsel/etkileşim tasarımının uygulanmasını istedi; commit, push, APK build veya yayınlama istemedi |
| Başlangıç çalışma ağacı | Dirty; insan-onaylı önceki özellik ve hata düzeltmeleri korundu |
| AI'ya sağlanan kaynaklar | Bir kapsül düğme referans görseli; iki Scanner ekran görüntüsü için verilen yollar yerel dosya sisteminde bulunamadı. Mevcut Scanner kodu ve oturumdaki önceki açık/koyu ekranlar ikincil kanıt olarak kullanıldı |
| AI katkısı | `analiz`, `tasarım`, `kod`, `test`, `dokümantasyon`: bilgi hiyerarşisi sadeleştirildi; Ionicons outline ailesine geçildi; kamera/galeri için tema-duyarlı ortak kapsül dili, erişilebilir etiketler ve same-frame çift dokunma/yazma guard'ları eklendi; tema ve picker yönlendirme regresyonları yazıldı |
| İnsan katkısı | Modern, Apple-benzeri fakat amatör olmayan yönü ve kamera/galeri kapsül referansını seçti; görsel APK kabulü insanda kaldı |
| Karar | Referanstaki web hover/gradient birebir kopyalanmadı. Mobilde tema yüzeyli dış ray + canlı ikon kapsülü, kısa press geri bildirimi ve düz SPARK yeşili kullanıldı; açık temada siyah ray kullanılmadı. Hazır fiş ikonu yerine platformdan bağımsız özel belge-tarama vektörü çizildi. Kaynak seçicileri `susevar` CTA sayılmadı; sonuç ekranındaki Kaydet tek birincil CTA olarak korundu |
| Değiştirilen ana alanlar | `app/(tabs)/scanner.tsx`; `src/components/__tests__/ScannerScreen.test.tsx`; `DESIGN_BRIEF.md`; evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; Scanner odaklı Jest 1/1 suite ve 3/3 test; tam Jest 71/71 suite ve 619/619 test; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: Android development/standalone build'de açık/koyu tema, küçük ekran, büyük font, dört dil, TalkBack; kamera/galeri izin kabul-reddi, picker iptali, hızlı çift dokunma ve sonuç Kaydet/Düzenle akışları |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor; otomatik test görsel kalite veya native picker kanıtı değildir |
| Gizlilik incelemesi | Kullanıcı ekran görüntülerindeki gerçek finansal içerik belge/test fixture'ına taşınmadı; mutlak attachment yolu belgeye yazılmadı |
| Retrospektif sınırlama | İki açık/koyu ekran görüntüsü belirtilen konumda bulunamadığı için doğrudan piksel karşılaştırması yapılamadı. Referansın gradient/hover davranışı mobil-native etkileşime uygun olmadığı için bilinçli olarak uygulanmadı |
| Takip işleri | İnsan görsel incelemesi sonrası gerekirse yalnız spacing/optik ağırlık rötuşu; APK öncesi cihaz kabul matrisine Scanner senaryolarını eklemek |

### `AI-2026-08-13-ACCENT-PALETTES-001`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-13 · Europe/Warsaw |
| İnsan hedefi | Açık/koyu görünümü korurken SPARK'ı tek rengin kontrollü tonlarıyla kişiselleştirmek; yeşil, mavi, turuncu, mor ve kırmızı arasında profesyonel seçim sunmak |
| Açık insan onayı | Kullanıcı kapsamlı palet planını ve kırmızı seçeneğini açıkça onayladı; özellik branch'ine geçti ve uygulamayı başlatmamızı istedi. Commit, push, main'e merge, APK build veya yayınlama yetkisi vermedi |
| Başlangıç çalışma ağacı | `feature/accent-palettes` branch'i; önceki kararlı tarayıcı tasarımı ayrı tag ile korunmuştu. Eşzamanlı insan-onaylı özellik uygulaması sırasında çalışma ağacı değiştirildi |
| Kısıtlar ve korunacak alanlar | Açık/koyu nötr yüzeyler korunmalı; renk cümbüşü veya serbest hex seçimi olmamalı; semantik durumlar, kategori/grafik renkleri ve logo/splash sabit kalmalı; `Appearance.setColorScheme` ve navigator remount kullanılmamalı; ilk görünür kare flicker üretmemeli; vurgu finansal backup kapsamına girmemeli |
| AI'ya sağlanan kaynaklar | Kullanıcının renk kişiselleştirmesi geri bildirimi; mevcut tema/startup kodu, ADR-001, ürün/mimari/kalite rehberleri ve test yapısı |
| AI katkısı | `analiz`, `plan`, `kod`, `test`, `inceleme`, `dokümantasyon`: tema tüketicileri ve startup akışı denetlendi; küratörlü açık/koyu palet registry'si, tam snapshot/revision reaktivitesi, atomik kalıcılık, navigation köprüsü, runtime `susevar`, ayar seçicisi, dört dil, kontrast ve regresyon testleri ile ADR-007 tasarlandı/uygulandı. İnsan geri bildirimi sonrasında görünüm kontrolü yerleşik yapısına döndürüldü; vurgu seçimi sabit merkez halkalı yatay snap carousel ve ayrı bilgi modalı olarak sadeleştirildi |
| İnsan katkısı | Vurgunun renkli yüzeylerden değil tek rengin tonlarından oluşmasını seçti; mavi, turuncu ve mora kırmızıyı ekledi; ilk uygulamadaki ayrı görünüm seçenekleri ile beş dikey vurgu satırının yoğunluğunu değerlendirip eski tam genişlikte otomatik kontrolü ve kompakt yatay carousel'i seçti; güvenli branch/tag akışını uyguladı ve nihai görsel kabulü kendisinde tuttu |
| Karar | Görünüm ve vurgu ayrı eksenlerdir. Beş sabit palet dışına çıkılmaz. Dolu eylem `primaryAction`/`onPrimary` kullanır; semantik/veri/marka renkleri vurguya bağlanmaz. Şema ve vurgu startup DB readiness içinde tek snapshot olarak uygulanır; runtime değişim React store ve Navigation theme context'i üzerinden remount olmadan yayılır. Görünüm kartı yerleşik tam genişlikte otomatik kontrolü korur ve yalnız otomatik kapalıyken Açık/Koyu seçeneklerini gösterir. Vurgu kartı beş dikey satır yerine merkez halkalı yatay snap carousel kullanır; ayrıntılar ayrı bilgi modalındadır. Vurgu cihaz-yerel ayardır ve backup v4 oluşturmaz |
| Değiştirilen ana alanlar | `src/theme/{colors,themeStore,navigationTheme,susevar}.ts`; `src/utils/themeSchedule.ts`; root/tab layout ve tema tüketen ekran/bileşenler; `app/settings-general.tsx`; `src/components/{AutoThemeScheduleToggle,AccentPaletteCarousel}.tsx`; TR/EN/AZ/RU kaynak/çıktıları; tema/ayar testleri; `DESIGN_BRIEF.md`, mimari/geliştirme/kalite rehberleri, ADR-007 ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; görünüm/vurgu/locale odaklı Jest 4/4 suite ve 24/24 test; `npm test -- --ci --coverage=false` 76/76 suite ve 648/648 test; locale compile/build başarılı; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: standalone APK'da beş vurgu × açık/koyu görünüm; cold start, otomatik/manüel görünüm, carousel dokunma ve swipe/snap, büyük font, art arda vurgu değişimi, yeniden başlatma kalıcılığı, aktif rota/sheet/scroll korunumu, lazy sekmeler, birincil CTA kontrastı, semantik/kategori/grafik sabitliği, logo/splash ve video-kare flicker kontrolü |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor; otomatik test görsel uyumu, native ilk kareyi veya navigator kompozisyonunu kanıtlamaz |
| Gizlilik incelemesi | Secret, kişisel finans verisi, kullanıcı hesabı, mutlak yerel yol veya attachment kimliği belge/test kanıtına eklenmedi; yalnız depo-göreli yollar kullanıldı |
| Retrospektif sınırlama | Doğrulama `feature/accent-palettes` branch'inde, başlangıç HEAD `c9ef1db3d667461f5fd84ed8104f5b1a9789153a` üzerinde fakat henüz commit/build kimliği oluşmamış çalışma ağacında yapıldı; sonuç CI veya fiziksel cihaz kanıtı değildir |
| Hatalı/yarım AI çıktısı | İlk UI taslağı görünümü yeni bir seçenek düzenine, vurgu seçimini ise beş dikey satıra genişleterek ekranı gereğinden uzun ve mevcut alışkanlıktan kopuk yaptı. İnsan geri bildirimiyle bu sunum bırakıldı; mimari karar korunarak görünüm eski kontrolüne, vurgu da kompakt swipe/snap carousel'e geçirildi |
| Takip işleri | Standalone APK matrisini build/cihaz kimliğiyle yürütmek; insan görsel kabulünden sonra branch merge kararını ayrıca vermek |

### `AI-2026-08-14-ACCENT-DETENT-001`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-14 · Europe/Warsaw |
| İnsan hedefi | Vurgu renk dairelerini seçici sınırına tam merkezlemek; serbest kayan hissi sert ve kademeli bir detent deneyimine dönüştürmek; her kademe geçişinde kısa “tak” sesi ile titreşimi senkron algılatmak |
| Açık insan onayı | Kullanıcı doğrudan bu görsel/etkileşim düzenlemesini istedi. Commit, push, merge, APK build veya yayınlama yetkisi vermedi |
| Başlangıç çalışma ağacı | `feature/accent-palettes` branch'i; aynı özellik için insan-onaylı fakat henüz commit edilmemiş çalışma ağacı korundu |
| Kısıtlar ve korunacak alanlar | Görünüm/tema altyapısı, beş palet ve semantik renk sınırı değişmemeli; programatik ilk konumlandırma geri bildirim üretmemeli; hızlı swipe DB yazma fırtınasına dönüşmemeli; ses/haptic hatası seçimi engellememeli; mikrofon, recording veya arka plan playback eklenmemeli; native hissin kabulü Jest'e dayandırılmamalı |
| AI'ya sağlanan kaynaklar | Kullanıcının Genel Ayarlar ekran görüntüsü ve mekanik kademe hissi tarifi; sonraki geri bildirimlerde Samsung Alarm saat çarkı ekran görüntüsü, daha tok saat-kademesi, daha yavaş geçiş ve kovuk “tuf” yerine çok kısa tiz “tik” isteği; mevcut carousel/tema kodu, yerel Expo Haptics SDK sözleşmesi, ADR-007, kalite ve evidence sözleşmeleri |
| AI katkısı | `analiz`, `kod`, `test`, `inceleme`, `dokümantasyon`: gerçek ScrollView ölçüsünden adaptif item stride/kenar inset/snap offset türetildi; seçili rozeti optik merkezi bozmayan sabit halkaya dönüştürüldü; kullanıcı gesture'ında geçilen her yeni kademeye dedupe edilmiş platform haptic'i ve kısa yerel klik bağlandı; hedef Samsung'da hafif kalan `CLOCK_TICK` insan geri bildirimiyle tek ve daha tok OEM `CONTEXT_CLICK`e, iOS geri bildirimi `RIGID` impact'e geçirildi; kovuk duyulan düşük frekans, ikinci mandal ve uzun rezonans kaldırılarak 12 ms özgün tiz “tik” WAV'ı üretildi; yuva mesafesi yaklaşık 96 dp'ye, geri bildirim ritmi 100 ms'ye çıkarıldı ve Android kaydırma freni güçlendirildi; önizleme ile DB kalıcılığı ayrılıp yalnız nihai snap yazıldı; programatik/rollback akışları sessiz tutuldu; Expo Audio yapılandırması recording/arka plan yeteneği açmayacak şekilde sınırlandı; regresyon ve cihaz kabul matrisi güncellendi |
| İnsan katkısı | Merkezleme hatasını ve aranan fiziksel hissi belirledi; ses ile titreşimin birlikte gelmesini seçti; açık görünümde yeşil/mavi tonlarının mat, turuncu/kırmızının kirli göründüğünü ve yeniden açmada mor etiket/halkanın fiziksel turuncu kademe üzerinde kalabildiğini ekran görüntüsüyle gösterdi; cihazdaki hissin ve nihai tasarımın kabulünü kendisinde tuttu |
| Karar | Geometri dış wrapper'a veya sabit 84 dp adıma bağlanmaz; gerçek viewport'a uyarlanır. Scroll sırasında yalnız merkez eşiği değiştiğinde önizleme+tek geri bildirim oluşur. Hedef cihaz geri bildirimine göre Android'de tok tek `CONTEXT_CLICK`, iOS'ta `RIGID` impact; yaklaşık 96 dp yuva, 100 ms kademe ritmi ve kuvvetli fren kullanılır. Kalıcı vurgu yalnız drag/momentum sonundaki snap kademesinde bir kez yazılır; içerik ölçümü, kayıt tamamlanması ve yeniden açma kanonik kademeyi sessizce yeniden merkezler. Açık görünüm canlı `primary` gösterim tonlarını, dolu CTA ise ayrı kontrastlı `primaryAction` tonunu kullanır. Bas/ikinci mandal/uzun rezonans içermeyen 12 ms tiz yerel “tik” best-effort'tur; sistem sessiz/medya politikası ile native API sınırlamaları aşılmaz. Mikrofon/recording ve arka plan playback kapalıdır |
| Değiştirilen ana alanlar | `src/components/AccentPaletteCarousel.tsx`; `app/settings-general.tsx`; `assets/audio/palette-detent.wav`; `scripts/generate-palette-detent-audio.cjs`; `package.json`/lockfile; `app.json`; carousel/ayar testleri; `DESIGN_BRIEF.md`, ADR-007, kalite ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; görünüm/vurgu/ses yapılandırması/locale odaklı Jest 5/5 suite ve 40/40 test; son `npm test -- --ci --coverage=false` ile 77/77 suite ve 665/665 test; Android Metro export 1.956 modülle başarılı ve `assets/audio/palette-detent.wav` pakete dahil; Expo config introspection başarılı; `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: desteklenen Android/iOS cihazda ilk/orta/son rengin optik merkezi; yavaş sürükleme, hızlı savurma ve dokunma; kademe başına tek haptic+klik algısı; normal ses, sessiz/titreşim ve düşük medya sesi; OEM haptic farkı; TalkBack/VoiceOver ayarlanabilir kontrol; ses/haptic hazır değilken seçim ve yeniden başlatma kalıcılığı |
| Son commit/PR | Henüz yok |
| Nihai insan kabulü | Bekleniyor; mekanik sertlik, ses seviyesi ve algısal senkron kullanıcı tarafından fiziksel cihazda değerlendirilmelidir |
| Hatalı/yarım AI çıktısı | İlk sabit genişlik yaklaşımı ekran genişliğini ve dış wrapper ölçüm farkını yeterince hesaba katmadığı için daireler merkez sınırına optik olarak oturmadı; seçili rengin köşe rozeti de ağırlığı yana çekti. Sabit adım ve köşe rozeti bırakıldı |
| Gizlilik incelemesi | Yerel ses varlığı özgün, kısa ve uygulama içinde paketlidir; kullanıcı sesi, mikrofon verisi, finansal veri, secret, credential veya mutlak attachment yolu eklenmedi |
| Retrospektif sınırlama | Otomatik test native ses oturumunu, sessiz anahtarını, OEM haptic motorunu veya iki duyunun algısal senkronunu kanıtlamaz. Expo/React Native geri bildirim çağrıları aynı JS etkileşiminde kuyruğa alınsa da örnek düzeyinde zamanlama garantisi verilmez |
| Takip işleri | Standalone cihaz kabulünü build/OS/artefakt kimliğiyle yürütmek ve gerekirse yalnız stride, haptic türü veya klik seviyesini ölçülü biçimde ayarlamak |

### `AI-2026-08-21-IMMUTABLE-BUDGET-PERIODS-001`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-21 · Europe/Warsaw |
| İnsan hedefi | Maaş erken/geç geldiğinde yeni bütçe döngüsünü o gün başlatabilmek; eski bütçelerin tarih aralığı ve tutarını değiştirmemek |
| Açık insan onayı | Kullanıcı çözümü değerlendirdikten sonra uygulama değişikliğini onayladı; commit, push veya yayınlama yetkisi vermedi |
| AI katkısı | Global döngü gününün geçmişi yeniden yorumladığını teşhis etti; dönem sınırı snapshot migration'ı, atomik 23→21 geçişi, geçmiş kartı/hook/backup uyumu ve regresyon testlerini uyguladı |
| İnsan katkısı | Değişmez geçmiş ve yeni dönemde esnek başlangıç gereksinimini belirledi; cihaz kabulünü kendisinde tuttu |
| Karar | Döngü günü ara `+/-` dokunuşlarında değil yeşil bütçe kaydında yürürlüğe girer. Açık dönem yürürlük tarihinden önceki gün kapanır; yeni dönem yürürlük tarihinde başlar; tamamlanmış kayıtlar değiştirilmez |
| Değiştirilen ana alanlar | `app/settings-budget.tsx`; `src/db/{schema,database,budgetDao}.ts`; `src/hooks/useBudget.ts`; `src/components/BudgetHistoryCard.tsx`; `src/services/backupService.ts`; ADR-008 ve ilgili ürün/mimari/kanıt belgeleri |
| Otomatik doğrulama | Odaklı Jest 6/6 suite ve 53/53 test başarılı; `npm run typecheck` ve `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: eski 23 Haz–22 Tem kaydının sabit kalması, 21 Ağustos'ta 23→21 kaydı, uygulamayı yeniden açma ve mevcut DB migration'ı |
| Son commit/PR | Henüz yok |
| Retrospektif sınırlama | Otomatik SQLite sözleşme testleri gerçek cihaz upgrade'ını ve kullanıcının mevcut verisini kanıtlamaz |

### `AI-2026-08-21-ANALYTICS-AFFORDANCE-001`

| Alan | Kayıt |
|---|---|
| Tarih ve saat dilimi | 2026-08-21 · Europe/Warsaw |
| İnsan hedefi | Kategori limitinin anlamını ve giriş yolunu netleştirmek; tüm fiyat değişimlerine erişmek; sekiz analiz kartı başlığını hizalamak |
| Açık insan onayı | Kullanıcı doğrudan uygulama düzenlemesini istedi; commit/push/yayın yetkisi vermedi |
| AI katkısı | Gizli ve hedef doğrulamasına bağlı limit akışını teşhis etti; hedefsiz limit kaydı, Bütçe/Analiz yönetim girişleri, kapsam metni, altılı yatay fiyat sayfaları ve ortak başlık ölçüsü uyguladı. Projeksiyon eşiğini kontrastlı/uçta görünür işaretçiye, donut yönlerini aynı vektör ikon sistemine dönüştürdü; test/dokümantasyon ekledi |
| İnsan katkısı | Anlaşılmaz giriş yolunu, altı ürün sınırını ve optik hizasızlığı ekran görüntüleriyle belirledi; cihaz görsel kabulünü kendisinde tuttu |
| Otomatik doğrulama | Locale üretimi/parity başarılı; ilk kapsam odaklı Jest 8/8 suite ve 29/29 test; yatay fiyat sayfası/projeksiyon eşiği takip kontrolü 3/3 suite ve 15/15 test; `npm run typecheck` ve `git diff --check` exit 0 |
| Cihaz doğrulaması | Bekleniyor: hedef olmadan limit ekleme, 7+/13+ fiyat değişiminde nested yatay swipe, %1/%99 bütçe işaretçisi, donut okları, açık/koyu tema ve büyük fontta kart başlıkları |
| Son commit/PR | Henüz yok |
| Retrospektif sınırlama | Jest gerçek ekran ölçüsü, scroll ve optik hizayı kanıtlamaz |

### `AI-2026-08-21-MEASUREMENT-PRICE-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Fiyat kartı swipe'ının üst sekmeyi yanlışlıkla değiştirmemesini sağlamak; fiyat takibinin doğruluğunu denetlemek; ağırlıklı meyve/sebze/et miktarlarını adet `x` yerine uluslararası ölçüyle izlemek |
| İnsan katkısı | Gerçek Analiz ve ürün geçmişi ekranlarıyla `0.53x`, `1.225x` örneklerini ve nested swipe riskini gösterdi; AI ve manuel akışın birlikte ele alınmasını istedi |
| AI katkısı | Gesture sahipliğini tab navigator ile koordine etti; kanonik adet/kg/L şeması, g/ml dönüşümü, eski veri migration'ı, AI prompt/coercion, atomik fiş yazısı, backup uyumu ve ölçü-duyarlı ürün analizi uyguladı. Fiyat gruplamasını normalize ad+ölçüye bağladı; aynı gün tekrarlarını ağırlıklı tek gözleme indirdi ve ortalama fiyatı toplam tutar/toplam miktar yaptı |
| İnsan kararı | Ölçü sistemi ve profesyonel fiyat takibi kapsamını talep etti; commit, push ve yayın yetkisi vermedi |
| Otomatik doğrulama | `npm run typecheck` başarılı; `npm test -- --ci --coverage=false` ile 83 suite / 682 test başarılı; `git diff --check` temiz. Gemini 500-kalem koruma testi beklenen geliştirme uyarısını üretir |
| Cihaz doğrulaması | Bekleniyor: fiyat kartı üzerinde yatay sürüklemede sekmenin sabit kalması; kart dışı swipe ile sekme geçişi; 530 g/0.53 kg manuel ve AI kaydı; eski kesirli kayıtların upgrade sonrası görünümü |
| Kalan risk | Jest native PagerView gesture yarışını ve gerçek Expo SQLite upgrade'ını kanıtlamaz. Eski kesirli miktarlar için kg çıkarımı kontrollü fakat heuristiktir |

### `AI-2026-08-21-PRICE-HISTORY-UX-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Fiyat grafiği noktalarını kolay seçmek, uzun alım geçmişini sabit yükseklikte altışarlı incelemek ve davranış analizindeki belirsiz “Tasarruf” kavramını açıklığa kavuşturmak |
| İnsan katkısı | Gerçek ürün geçmişi ve davranış analizi ekranlarıyla küçük hedef, geri dönüşsüz “Tümünü göster” ve kavramsal belirsizliği gösterdi |
| AI katkısı | Her gözleme 44×44 doğrudan dokunma hedefi ekledi; geçmişi en yeniden eskiye altışarlı yatay pager yaptı ve iç gesture sırasında üst sekmeyi kilitledi; SQL sınıflandırmasını inceleyerek segmentin tasarruf değil kalan gider kategorileri olduğunu doğruladı ve dört dilde “Diğer Harcamalar” olarak düzeltti |
| İnsan kararı | Üç sorunun birlikte düzeltilmesini istedi; commit, push veya yayın yetkisi vermedi |
| Otomatik doğrulama | `npm run typecheck` başarılı; `npm test -- --ci --coverage=false` ile 83 suite / 685 test başarılı; `git diff --check` temiz. Gemini 500-kalem koruma testi beklenen geliştirme uyarısını üretir |
| Cihaz doğrulaması | Bekleniyor: küçük/kenar grafik noktaları, geçmişte yatay sayfalama, dikey sheet scroll ile gesture ayrımı, açık/koyu tema ve dört dil |
| Kalan risk | Jest fiziksel parmak hedefini, native gesture arbitration'ı ve optik yerleşimi tek başına kanıtlamaz |

### `AI-2026-08-21-ANALYTICS-SUBSCRIPTION-UX-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Davranış sınıflandırmasını açıklamak, uç değerli günlük grafiği yakından incelemek ve abonelik create/edit formunun ekran oranı ile belirsiz tekrar aralığını düzeltmek |
| İnsan katkısı | Gerçek ekran görüntüleriyle kategori anlamını, grafik okunabilirliğini, sheet katmanını ve “her kaç birimde” belirsizliğini gösterdi; abonelik sisteminin doğruluğunun da denetlenmesini istedi |
| AI katkısı | Ayarlar ile aynı bilgi affordance'ını davranış kartına ekledi ve “Diğer Harcamalar”ın tasarruf olmadığını belirtti. Günlük grafiği tüm dönem/14/7 gün kademeli, alt zaman pencereleri yatay gezilebilir ve her pencere yerel Y ölçekli hale getirdi. Abonelik sheet'ini klavye/safe-area uyumlu sabit yüzeye taşıdı; aralığı stepper ve dilbilgisel özetle açıkladı. DAO, tekrar takvimi ve scheduler sözleşmelerini yeniden doğruladı |
| İnsan kararı | Bilgi penceresi ve sade timeline benzeri zoom yaklaşımını istedi; commit, push veya yayınlama yetkisi vermedi |
| Otomatik doğrulama | `npm run typecheck` başarılı; odaklı 7/7 suite ve 82/82 test; tam `npm test -- --ci --coverage=false --runInBand` ile 85/85 suite ve 689/689 test başarılı; `git diff --check` temiz. Gemini 500-kalem koruma testi beklenen geliştirme uyarısını üretir |
| Cihaz doğrulaması | Bekleniyor: Android APK'da grafiğin `-/+` kademeleri ve yatay pencereleri, uç değerli veri, klavye açıkken yeni/düzenle abonelik sheet'i, safe-area, büyük font ve dört dil |
| Kalan risk | Jest native klavye, safe-area, gerçek kaydırma hissi ve kapatılmış uygulamadaki OS teslimini kanıtlamaz; bunlar standalone cihaz kabulü gerektirir |

### `AI-2026-08-21-RECURRING-PAYMENT-FULLSCREEN-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | “Ödeme planı ekle/düzenle” başlığının ekran dışına itilmesini ve tutar klavyesi açıldığında formun görünümden kaybolmasını gidermek; ana formu bottom sheet yerine sabit, aşağı-yukarı kaydırılabilir gerçek sayfa yapmak |
| İnsan katkısı | Sorunun önceki düzenlemeden sonra sürdüğünü gerçek Expo Go ekranıyla gösterdi; kabul edilen sunum modelini açıkça tam ekran sayfa olarak belirledi |
| AI katkısı | Bottom-sheet yüzde yüksekliği, absolute alt yerleşim ve Android klavye daralmasının birleşimini kök neden olarak doğruladı. Manuel, düzenleme ve algılanan ödeme akışlarını ayrı `recurring-payment` card route'una taşıdı; safe-area başlığını klavye alanının dışında sabitledi ve yalnız form gövdesini dikey ScrollView+KeyboardAvoidingView içine aldı. Route parametrelerini sayısal plan/vendor kimliğiyle sınırladı; gerçek veriyi DAO'dan yükledi ve dönem eşlemesini ortak utility'ye ayırdı |
| İnsan kararı | Ana formun alt pop-up olmamasını, ilk karede üst başlığın görünmesini ve klavye açıkken sayfanın kaydırılabilir kalmasını istedi; commit, push veya yayın yetkisi vermedi |
| Değiştirilen ana alanlar | `app/{subscriptions,recurring-payment,_layout}.tsx`; `src/components/RecurringPaymentReminderSheet.tsx`; `src/utils/recurringPaymentPlan.ts`; route/form regresyon testleri; evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` başarılı; route+form odaklı 2/2 suite ve 8/8 test; tam `npm test -- --ci --coverage=false --runInBand` ile 86/86 suite ve 692/692 test başarılı; `git diff --check` temiz |
| Cihaz doğrulaması | Bekleniyor: Android APK/Expo Go'da ilk açılışta başlığın görünmesi; beklenen tutar ve not klavyelerinde başlığın sabit, gövdenin kaydırılabilir kalması; create/edit/detected, tarih seçici, sistem geri hareketi, açık/koyu tema ve büyük font |
| Hatalı/yarım AI çıktısı | Önceki `%92` bottom-sheet + klavye kaçınma yaklaşımı Jest'te geçmesine rağmen gerçek cihazda başlığı korumadı. Bu iddia ekran kanıtıyla geçersizleşti ve sessizce yamalanmak yerine tam ekran route ile değiştirildi |
| Gizlilik incelemesi | Route parametrelerine başlık, tutar, not veya satıcı metni konmadı; yalnız yerel sayısal kayıt kimliği taşındı. Ekran görüntüsü veya yerel dosya yolu depoya eklenmedi |
| Kalan risk | Jest native Android pencere yeniden boyutlandırmasını, OEM klavye davranışını ve optik safe-area sonucunu kanıtlamaz; fiziksel cihaz kabulü gerekir |

### `AI-2026-08-21-DAILY-FLUCTUATION-VIEWPORT-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Günlük Dalgalanma grafiğindeki `-/+` adımlarını, sağdaki sayacı ve görünen tarih/veri kapsamını deterministik yapmak; geçiş sırasında farklı grafiğin kısa süre görünmesini kaldırmak |
| İnsan katkısı | 21.07–21.08 özel aralığında tam görünüm, `3/3` ve `5/5` durumlarını yan yana göstererek son iki kademenin beklenmedik biçimde aynı dört günü çizdiğini ve her geçişin stabil hissedilmediğini belgeledi |
| AI katkısı | Kaynağın günlük toplam sorgusu değil görünüm bölme/scroll yaşam döngüsü olduğunu doğruladı. 32 günü soldan `[14,14,4]` ve `[7,7,7,7,4]` bölen yaklaşımı en güncel tarihten geriye hizalanan saf sayfa aralıklarıyla değiştirdi; zoomu tek atomik `{zoomIndex,pageIndex}` durumuna aldı; kademe değişiminde incelenen sağ uç tarihi korudu; render sonrası `requestAnimationFrame(scrollTo)` sıçramasını ilk mount `contentOffset` ile kaldırdı; tarih aralığı ve sayacı aynı viewport'tan üretti; yalnız zoom değişiminde bar giriş animasyonunun yeniden başlamasını engelledi |
| İnsan kararı | Kapsamlı ve kök neden odaklı düzeltme istedi; commit, push veya yayınlama yetkisi vermedi |
| Değiştirilen ana alanlar | `src/components/BarChart.tsx`; `src/utils/barChartViewport.ts`; `app/(tabs)/analytics.tsx`; `src/components/analytics/ChartCard.tsx`; saf ve bileşen regresyon testleri; ürün/evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` başarılı; odaklı 2/2 suite ve 10/10 test; tam `npm test -- --ci --coverage=false --runInBand` ile 87/87 suite ve 700/700 test başarılı; `git diff --check` temiz |
| Cihaz doğrulaması | Bekleniyor: 21.07–21.08 aralığında tüm görünüm `21.07–21.08 · 1/1`; ilk artıda `08.08–21.08 · 3/3`; ikinci artıda `15.08–21.08 · 5/5`; eksiyle aynı pencerelere ters sırada dönüş; eski yatay sayfada zoom yapınca aynı sağ uç gününün korunması; hızlı dokunuş ve açık/koyu tema |
| Hatalı/yarım AI çıktısı | Önceki uygulama sayfaları dizinin başından bölüyordu; bu nedenle en güncel son sayfa iki zoom kademesinde de yalnız dört gün kalıyordu. Ayrıca render sonrası imperatif scroll ve zooma bağlı animasyon yeni grafiğin bir kare yanlış konumda görünmesine yol açabiliyordu. Bu yaklaşım otomatik testlerden geçmiş olsa da gerçek cihaz ekran kanıtıyla geçersizleşti |
| Gizlilik incelemesi | Ekran görüntüsü veya yerel dosya yolu depoya eklenmedi; yalnız tarih aralığı ve davranış düzeyindeki kabul örneği kaydedildi |
| Kalan risk | Jest native ScrollView momentumunu, fiziksel dokunma hızını ve küçük ekran/büyük font optiğini tek başına kanıtlamaz; APK/cihaz kabulü gerekir |

### `AI-2026-08-21-VENDOR-PRODUCT-PAGER-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Ana satıcı/mağaza kartında ilk beş satıcıyı gösterip sağa doğru tüm satıcılara erişmek; satıcı seçilince donut ve ürün analizini profesyonel biçimde korumak; ürünleri alım sayısı veya toplam harcamaya göre sıralamak |
| İnsan katkısı | Ana listenin sayfa boyutunu ve gezinme yönünü belirledi; ana kartta satır içi büyüme yerine ayrı yüksek analiz paneli önerisini açıkça onayladı. Commit, push veya yayın yetkisi vermedi |
| AI katkısı | DAO'daki sessiz on ürün sınırını kaldırdı. Ana satıcı kartını sabit yükseklikte beşerli pager'a çevirdi; yatay hareket sırasında üst analiz sekmesini kilitledi ve satır dokunuşunu ayrı yüksek satıcı analiz paneline bağladı. Donut, lejant, alım/toplam harcama sıralaması ve beşerli ürün pager'ını panele taşıdı; ürün modalını iki native katman üst üste binmeden panel kapandıktan sonra açtı. `kg/l/adet` miktarlarını karşılaştırılamaz bir “adet” toplamına dönüştürmedi |
| İnsan kararı | Satıcı sayfalarında kart yüksekliğinin değişmemesini, satıcı ayrıntısının ayrı panelde açılmasını ve ürünlerin iki anlamlı sıralamayla yatay gezilmesini seçti |
| Değiştirilen ana alanlar | `app/(tabs)/analytics.tsx`; `src/components/analytics/{VendorsCard,VendorAnalyticsSheet,analyticsStyles}.tsx`; `src/db/expenseDao.ts`; dört dil kaynağı; DAO, bileşen ve locale testleri; ürün/evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` başarılı; odaklı satıcı kartı/paneli 1/1 suite ve 6/6 test; tam `npm test -- --ci --coverage=false --runInBand` ile 88/88 suite ve 708/708 test başarılı; locale çıktıları yeniden üretildi; `git diff --check` sonucu teslim öncesi kaydedildi |
| Cihaz doğrulaması | Bekleniyor: 6+ ve 11+ satıcı/ürünle beşerli sayfalar, son eksik sayfa, satır dokunuşu ile yatay swipe ayrımı, üst sekmeye kaçmayan jest, panel geri/handle/backdrop kapatma, kapandıktan sonra aynı satıcı sayfası, ürün ayrıntısı geçişi, açık/koyu tema ve büyük font |
| Hatalı/yarım AI çıktısı | İlk sürüm satıcı ayrıntısını ana kartın içinde genişletiyordu; ürün sayfalansa bile satıcı sayısı kartı uzatıyor ve seçili satıcı donut'ı liste bağlamını bozuyordu. Kullanıcı geri bildirimiyle bu yaklaşım ayrı panel lehine geçersiz kılındı |
| Gizlilik incelemesi | Ekran görüntüsü veya yerel dosya yolu depoya eklenmedi; yalnız davranış ve doğrulama özeti kaydedildi |
| Kalan risk | Jest gerçek Android nested gesture önceliğini, tap/swipe ayrımını, native panel geçişini, momentum davranışını ve optik kart yüksekliğini kanıtlamaz; APK/cihaz kabulü gerekir |

### `AI-2026-08-21-ANALYTICS-PAGERS-SUBSCRIPTIONS-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Ayarlar'da eklenen aboneliklerin Analiz'deki aktif aboneliklere yansıması; En Yüksek İşlemler ve Sessiz Harcamalar kartlarının amacı zayıflamadan yatay sayfalanması |
| İnsan katkısı | Üç davranışı açıkça talep etti; commit, push veya yayın yetkisi vermedi |
| AI katkısı | Veri akışını iki ayrı tablonun kullanıldığını bulacak şekilde izledi. Etkin onaylı planlar ile otomatik tespitleri kullanıcı planı öncelikli tek görünümde birleştirdi; tekrar sıklığını aylık karşılığa normalize etti ve tutarsız çift vendor'ı bastırdı. En yüksek işlemleri 10 kayıt/iki beşli sayfa, sessiz harcamaları 15 kayıt/üç beşli sayfa ile sınırladı; kart yüksekliğini sabitledi ve iç gesture sırasında üst sekmeyi kilitledi |
| İnsan kararı | Yoğun listelerde fiyat takibine benzer sağa/sola gezinmeyi istedi; En Yüksek İşlemler kapsamının aşırı büyütülmemesini özellikle belirtti |
| Değiştirilen ana alanlar | `app/(tabs)/analytics.tsx`; `src/utils/subscriptionAnalytics.ts`; `src/components/analytics/{shared,SubscriptionsCard,TopTxCard,SilentSpendCard,analyticsStyles}.tsx`; ilgili testler ve ürün/evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` başarılı; tam Jest koşusu 89/89 suite ve 714/714 test başarılı; `git diff --check` temiz |
| Cihaz doğrulaması | Bekleniyor: manuel planın karta anında/focus sonrası gelmesi; aynı vendor tekilleştirmesi; 6+/11+ kayıt, son eksik sayfa, kart içi swipe ile üst sekme ayrımı, açık/koyu tema ve büyük font |
| Gizlilik incelemesi | Ekran görüntüsü, yerel dosya yolu ve kullanıcı finans değeri belgeye eklenmedi |
| Kalan risk | Jest gerçek SQLite, native yatay gesture arbitration'ı ve optik yükseklik hissini kanıtlamaz; standalone cihaz kabulü gerekir |

### `AI-2026-08-22-CLOSED-APP-ATTENTION-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Uygulamayı her gün açma zorunluluğu olmadan ödeme tarihleri, planlar, birikim hedefi ve bütçe davranışı için Android sistem panelinde dikkat çekici uyarılar almak |
| Açık insan onayı | Kullanıcı bildirim altyapısının kapsamlı düzenlenmesini doğrudan istedi; commit, push, APK build veya yayın istemedi |
| İnsan katkısı | Kapalı uygulamada gözlenmeyen teslim sorununu ve beklenen davranışsal amacı gerçek Android paneliyle tanımladı |
| AI katkısı | Mevcut future scheduler, reveal/izin kapısı, feed köprüsü, mute ve refresh akışını denetledi; borç/ödeme planlarını koruyup hedef son tarihi ile bütçe dönemi kontrol noktalarını deterministik Android alarmına dönüştürdü; gerçek OS plan sayısını tercih yüzeyine taşıdı; dört dil, test ve tez izlenebilirliği ekledi |
| İnsan tarafından seçilen/reddedilen öneriler | Sınırsız veya sürekli rahatsız etme yerine tarihli ve anlamlı kilometre taşları seçildi; bilinmeyen harcamayı arka planda varmış gibi gösterme reddedildi |
| Değiştirilen ana alanlar | `src/notifications/{attentionNativeSchedule,buildNotifications,types}.ts`; `src/services/{reminderScheduler,androidNotificationsSetup}.ts`; `app/notifications.tsx`; ilgili testler; TR/EN/AZ/RU kaynak ve çıktıları; ürün, mimari, ADR ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; dikkat planı/scheduler/native envanter/feed/tercihler/locale için odaklı Jest 6/6 suite ve 72/72 test; tam Jest 90/90 suite ve 720/720 test; locale parity geçti; `git diff --check` exit 0. İki mevcut analytics bileşen testinde sonucu etkilemeyen overlapping `act()` uyarısı sürüyor |
| Cihaz doğrulaması | Bekleniyor: standalone APK ilk izin; planlandı sayısı; uygulamayı ana ekrana gönderme/process kill; 5–10 dakika ileri ödeme alarmı; hedef/bütçe test tarihi; plan değişimi/mute iptali; reboot; Doze/OEM gecikmesi; force-stop sınırı |
| Gizlilik incelemesi | Native schedule kimlikleri kişi/satıcı adı veya finansal tutar taşımaz; OS request içeriğinin Android özel deposunda bulunabileceği mevcut sınır korunur; ekran görüntüsü ve kişisel dosya yolu repoya eklenmedi |
| Kalan risk | Yeni kurulum uygulama bir kez açılmadan ve izin verilmeden alarm kuramaz. Android force-stop planlı teslimi engeller; exact alarm izni olmadığı için seçilen dakika Doze/OEM tarafından gecikebilir. Uygulama kapalıyken yeni finansal veri gelmediğinden harcama/kategori eşikleri ancak event sonrası senkronizasyonda hesaplanır |

### `AI-2026-08-22-ANALYTICS-BACKSTACK-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Satıcı analizindeki bir üründen geri dönünce Analiz sekmesi yerine aynı satıcı analizini göstermek; boş Aylık Kategori Sınırları kartındaki CTA metni ile kenarlık arasına estetik boşluk eklemek |
| Açık insan onayı | Kullanıcı iki görsel hata için kod, test ve gerekli katkı kaydı düzenlemesini istedi; commit, push, build veya yayınlama yetkisi vermedi |
| İnsan katkısı | Gerçek cihaz ekran görüntüleriyle hatalı geri dönüşü ve dar CTA çerçevesini işaretledi |
| AI katkısı | Satıcı→ürün geçişinin mevcut native modal çakışma korumasını koruyarak paneli kapatmak yerine askıya alan bir yaşam döngüsü kurdu. Ürün modalının `onDismiss` sinyaliyle aynı satıcı panelini yeniden açtı; doğrudan Analiz kartından açılan ürün akışını ayırdı. Boş limit CTA'sına yüzeye özel yatay padding, 44 dp minimum yükseklik ve dar ekran metin davranışı ekledi; regresyon testlerini güncelledi |
| Değiştirilen ana alanlar | `app/(tabs)/analytics.tsx`; `src/components/{ItemAnalyticsModal,analytics/VendorAnalyticsSheet,analytics/LimitsHealthCard}.tsx`; `src/components/analytics/analyticsStyles.ts`; ilgili bileşen testleri ve evidence kayıtları |
| Otomatik doğrulama | `npm run typecheck` başarılı; odaklı Jest 3/3 suite ve 11/11 test; tam `npm test -- --ci --coverage=false --runInBand` ile 90/90 suite ve 721/721 test başarılı; `git diff --check` temiz. Mevcut iki analytics testindeki sonucu etkilemeyen overlapping `act()` uyarıları sürüyor |
| Cihaz doğrulaması | Bekleniyor: Android'de satıcı→ürün→geri/X/handle ile aynı satıcı paneline dönüş; satıcı panelinin normal X/backdrop/handle ile tamamen kapanması; doğrudan fiyat/sessiz harcama ürününün Analiz'e dönmesi; küçük ekran, büyük font, TR/EN/AZ/RU ve açık/koyu temada CTA boşluğu |
| Gizlilik incelemesi | Sağlanan ekran görüntüleri, kişisel yerel dosya yolu, satıcı/ürün adı ve finansal değerler depoya veya evidence metnine kopyalanmadı |
| Kalan risk | Jest native Android Modal kapanış zamanlamasını, sistem geri hareketini ve fiziksel cihazdaki optik sonucu kanıtlamaz; cihaz kabulü gerekir |

### `AI-2026-08-22-ANALYTICS-TRUST-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Harcama İstatistikleri kartında kayıt yokluğunu tasarruf başarısı gibi göstermemek, veri kapsamını açıklamak ve mesajı dönem davranışına bağlamak; Dönem Karşılaştırmasını eş ilerleyen harcama aralıklarına dönüştürmek; tekrarlı/verisiz Analiz kartlarını kaldırmak veya koşullu göstermek |
| Açık insan onayı | Kullanıcı önerilen davranışları tek tek seçip doğrudan uygulanmasını istedi; Ne Zaman Harcıyorsun ve Bütçe Durumu kartlarının Analiz'den kaldırılmasını, En Yüksek İşlemlerin korunmasını onayladı. Commit, push, build veya yayınlama yetkisi vermedi |
| İnsan katkısı | Gerçek cihaz ekranlarıyla mevcut metinleri ve kart hiyerarşisini gösterdi; ürün açısından kalacak/kaldırılacak kartları belirledi; yeniden tasarım fikirleri için uygulama yerine basit açıklama istedi |
| AI katkısı | Tamamlanmış gün/takip başlangıcı ve en az üç günlük güven kapısını saf hesapta uyguladı; kartta kayıt kapsamını ve dönem-geneli davranış mesajını sundu. Karşılaştırmayı aynı sayıda tamamlanmış güne sınırladı, gerçek aralıkları görünür yaptı, geleceği tarih seçicisinde ve hesapta engelledi, yükleme hatası ile geçerli sıfırı ayırdı. Kart registry'sinden iki tekrarlı kartı çıkardı; limit, fiyat, abonelik ve hedef kartlarının veri yokken render edilmemesini doğruladı. Düzenleme yüzeyine tüm aktif kartları tek seferde kullanılabilir listeye taşıyan geri alınabilir eylem ekledi; kart değişikliklerini onaya kadar taslakta tuttu, boş taslağın onayını engelledi, düzenleme sırasında ana sekme kaydırmasını kilitledi ve sekmeden onaysız ayrılınca son onaylanan yapıyı geri yükledi. Eski boş ayarı Günlük Grafik ile onardı; dört dil ve testleri güncelledi |
| Değiştirilen ana alanlar | `app/(tabs)/analytics.tsx`; `src/utils/{spendingStats,analyticsPeriod,analyticsCardConfig}.ts`; `src/components/{CustomDatePicker,analytics/{StreakCard,MonthlyCompareCard,GoalCard,LimitsHealthCard,SubscriptionsCard,analyticsStyles}}.tsx`; ilgili testler; TR/EN/AZ/RU kaynak/çıktıları; ürün ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` başarılı; önceki odaklı analiz paketi 11/11 suite ve 71/71 test; son kart/sekme paketi 2/2 suite ve 8/8 test; tam `npm test -- --ci --coverage=false --runInBand` ile 92/92 suite ve 742/742 test başarılı; locale kaynakları derlenip üretildi. Mevcut analytics testlerindeki sonucu etkilemeyen overlapping `act()` uyarıları sürüyor |
| Cihaz doğrulaması | Bekleniyor: Android'de aktif/geçmiş/özel dönem karşılaştırması; bugün/gelecek tarih sınırı; önceki toplam sıfır; 0/1/2/3+ tamamlanmış gün; limit/fiyat/abonelik/hedef verisi varken ve yokken kart akışı; Tümünü kaldır sonrası boş onay uyarısı, düzenlemede yatay ana sekme kaydırması, sekme düğmesiyle onaysız ayrılma, geri ekleme ve uygulamayı yeniden açma; açık-koyu tema, büyük font ve TR/EN/AZ/RU |
| Gizlilik incelemesi | Sağlanan ekran görüntüleri, yerel dosya yolları, satıcı/ürün isimleri ve finansal tutarlar depoya veya evidence metnine kopyalanmadı |
| Kalan risk | Harcama kaydı olmayan gün, kullanıcının kesinlikle para harcamadığı gün anlamına gelmez; yalnız yerel veritabanında o gün için kayıt bulunmadığını söyler. Jest native tarih seçici, gerçek SQLite cihaz verisi ve fiziksel kart yerleşimini tek başına kanıtlamaz |

### `AI-2026-08-22-DELETE-CONFIRM-REDESIGN-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Ekran görüntüsündeki işlem silme onayını daha sade ve profesyonel hale getirmek; sonucu beğenmezse yalnız bu düzenlemeyi geri alabilmek |
| Açık insan onayı | Kullanıcı önerilen tek ikonlu, kısa, yalnız Sil CTA'sı kırmızı olan tasarımın uygulanmasını doğrudan istedi. Commit, push, build veya yayınlama yetkisi vermedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcı tarafından onaylanmış Analiz ve modal düzeltmeleri korundu, ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Expo Go ekran görüntüsüyle HUD köşeleri, kırmızı parlama, başlık tekrarı ve metin sıkışıklığı bulunan mevcut görünümü gösterdi; önerilen sade yönü denemek üzere seçti |
| AI katkısı | Ortak silme modalından HUD köşeleri, scanline, ayırıcı, kırmızı dış parlama ve çift halkayı kaldırdı; tema yüzeyi, tek çöp kutusu ikonu, normal başlık hiyerarşisi, 48 dp eylemler ve yalnız kırmızı Sil düğmesi uyguladı. İşlem toplu silme metnini tekil/çoğul başlık ve açık geri alınamazlık açıklamasıyla dört dilde güncelledi; erişilebilirlik etiketleri ve bileşen testi ekledi |
| Değiştirilen ana alanlar | `src/components/GlassDeleteModal.tsx`; `app/(tabs)/transactions.tsx`; `src/components/__tests__/GlassDeleteModal.test.tsx`; TR/EN/AZ/RU kaynak/çıktıları; ürün ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` başarılı; silme modalı + locale parity odaklı paketi 2/2 suite ve 13/13 test; tam `npm test -- --ci --coverage=false --runInBand` ile 93/93 suite ve 744/744 test başarılı; locale kaynakları derlenip üretildi |
| Cihaz doğrulaması | Bekleniyor: Expo Go/standalone Android'de tek ve çoklu işlem seçimi; backdrop, sistem geri, İptal ve Sil; açık-koyu tema, büyük font ve TR/EN/AZ/RU; ortak modalı kullanan kategori/hedef/borç/plan silme yüzeylerinde kısa smoke kontrolü |
| Gizlilik incelemesi | Kullanıcı ekran görüntüsündeki satıcı adları, tutarlar, tarih ve yerel dosya yolu depoya veya belge metnine kopyalanmadı |
| Kalan risk | Jest native Modal gölgesini, ekran karartma yoğunluğunu, font ölçeğini ve gerçek cihazdaki optik dengeyi kanıtlamaz; nihai görsel kabul kullanıcıya aittir |

### `AI-2026-08-22-SETTINGS-PLANNING-IA-001`

| Alan | Kayıt |
|---|---|
| İnsan hedefi | Abonelik/düzenli ödeme yönetimini semantik olarak doğru Ayarlar grubuna taşımak; birikim hedefini öne çıkarma ve bu ay kategori limitleri satırlarındaki tekrarlı açıklamaları kaldırmak |
| Açık insan onayı | Kullanıcı önce sunulan “Bütçe ve planlama / Düzenli ödemeler” önerisini kabul etti, ardından iki açıklamanın kaldırılmasını doğrudan istedi. Commit, push, build veya yayınlama yetkisi vermedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcı tarafından onaylanmış Analiz ve silme modalı değişiklikleri korundu, ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Expo Go ekran görüntüsünde hedef öne çıkarma ve aylık limit açıklamalarının gereksiz tekrarını işaretledi; bilgi ikonundaki ayrıntının yeterli olduğunu belirledi |
| AI katkısı | Ayar grubunu Bütçe ve planlama olarak yeniden adlandırdı; Düzenli ödemeler rotasını Veri ve yedek'ten çıkarıp bu gruba taşıdı; Veri ve yedek açıklamasını satıcı/yedekleme/geri yükleme kapsamına indirdi. İki ayar satırındaki yardımcı metni kaldırdı, ancak hedef açıklamasını bilgi modalında ve limit kapsamını ayrıntılı limit yüzeylerinde korudu; dört dili ve rota regresyonunu güncelledi |
| Değiştirilen ana alanlar | `app/{settings-budget,settings-data}.tsx`; `src/components/__tests__/SettingsBudgetScreen.test.tsx`; TR/EN/AZ/RU kaynak/çıktıları; ürün ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` başarılı; Settings Budget + locale parity odaklı paketi 2/2 suite ve 15/15 test; tam Jest 93/93 suite ve 745/745 test başarılı; locale çıktıları yeniden derlendi ve parity geçti |
| Cihaz doğrulaması | Bekleniyor: Ayarlar ana kartında uzun açıklama; Bütçe ve planlama içinde iki kompakt satır ile Düzenli ödemeler; Veri ve yedek içinde eski bağlantının yokluğu; açık-koyu tema, büyük font ve TR/EN/AZ/RU |
| Gizlilik incelemesi | Kullanıcı ekran görüntüsündeki bütçe tutarları, tarihler ve yerel dosya yolu depoya veya belge metnine kopyalanmadı |
| Kalan risk | Jest rota ve metin görünürlüğünü doğrular; gerçek cihazdaki satır yüksekliği, uzun grup açıklamasının kesilmesi ve optik sıralama insan kabulü bekler |

### `AI-2026-08-23-CANONICAL-PRODUCT-IDENTITY-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-23 / Europe/Warsaw |
| İnsan hedefi | Fiyat Takibi ve ürün bazlı analizlerde aynı fiziksel ürünün yalnız yazım, çekim, OCR, aksan, çeviri veya son satış birimi farkı yüzünden bölünmesini engellemek; farklı tavuk kesimi, ölçü ve paket türünü yanlış birleştirmemek |
| Açık insan onayı | Kullanıcı sağladığı planın depo gerçeğine göre denetlenmesini, gerekiyorsa iyileştirilmesini ve uygulanmasını doğrudan istedi. Kalıcı ürün kimliği, geriye uyumlu migration/backup ve kullanıcı düzeltme akışı kapsama dahildi; commit, push, APK build veya yayın yetkisi verilmedi |
| Başlangıç çalışma ağacı | Clean; ürün kimliği değişiklikleri başlamadan önce `git status --short` çıktısı boştu |
| İnsan katkısı | Gerçek uygulama ekranında bölünmüş fiyat serilerini gösterdi; `Tavuk Baget`/`Tavuk Baget kg` gibi güvenli eşleri ve `Baget`/`Kanat`/`But`, `piece`/`kg` ile paket/ağırlık ayrımı gibi yanlış merge sınırlarını belirledi; belirsizlikte kullanıcı kontrolü ve ham fiş adının korunmasını istedi |
| AI katkısı | Depodaki normalizer, ölçü, fiş kaydetme, analiz, migration ve backup akışlarını denetledi; birim-duyarlı canonicalization, kalıcı ürün/alias modeli, nullable kalem bağlantısı, kullanıcı etiketi, analiz ortak grup anahtarı, merge/split DAO'su, v4 taşınabilir UID restore sözleşmesi, sınırlı Gemini metadata/explicit suggestion ve ilgili test/dokümantasyon dilimlerini uyguladı |
| AI önerisi ile insan kararı ayrımı | İlk ayrıntılı plan önceki bir AI önerisiydi; bu oturumda insan problemi, güvenlik sınırlarını ve uygulama yetkisini açıkça seçti. AI repo ayrıntılarına göre fazlamayı ve kodu üretti. AI eşleşme sonucu ürün kararı değildir: otomatik bağ yalnız gözden geçirilmiş deterministik kurala, belirsiz merge ise açık kullanıcı eylemine dayanır |
| Mimari güvenlik sınırı | Gemini fiş sırasında yalnız bounded `product_identity` metadatası, açık kullanıcı karşılaştırmasında yalnız iki bounded metin adayı alır. Ölçü uyuşmazlığı ağdan önce reddedilir; analiz render'ı ve migration ağ çağrısı yapmaz; öneri DB, alias veya finansal kayıt mutate etmez. API anahtarı SecureStore/header akışında kalır ve anahtar uzunluğu tanı logundan çıkarılmıştır |
| Değiştirilen ana alanlar | `src/utils/{productIdentity,itemDisplayName,priceWatch}.ts`; `src/db/{schema,database,productIdentityDao,expenseDao}.ts`; `src/services/{geminiService,receiptParser,backupService}.ts`; `app/{product-matching,_layout,settings-data,edit-items}.tsx`; analiz tüketicileri; ilgili testler; `DESIGN_BRIEF.md`, `docs/ARCHITECTURE.md`, ADR-009/010 ve evidence kayıtları |
| Otomatik doğrulama | `npm run typecheck` exit 0; canonicalization, görünüm etiketi, fiyat gruplama, migration, DAO, ExpenseDao, Gemini, v1-v4 backup ve ürün yönetimi/Ayarlar UI kapsamındaki odaklı paket 11/11 suite ve 141/141 test; `npm test -- --ci --coverage=false` ile tam Jest 98/98 suite ve 813/813 test geçti. Locale parity tam pakette geçti; Markdown göreli bağlantı kontrolü ve `git diff --check` temizdi |
| Cihaz doğrulaması | Bekleniyor: eski gerçek DB migration'ı; `Tavuk Baget`/`Tavuk Baget kg` ve `Tavuk Kanat`/`Tavuk Kanadı kg`; farklı kesim/paket/ölçü koruması; AI fiş önizleme; kullanıcı etiketi; Benzer ürünleri düzenle merge/split; yeniden açma; Fiyat Takibi ve ürün detay sonucu; v3 restore ile v4 export→restore→tekrar restore |
| Commit/CI ve nihai kabul | Henüz commit, CI, build kimliği veya nihai insan kabulü yoktur. Çalışma ağacındaki sonuçlar yayımlanmış özellik olarak sunulamaz |
| Gizlilik incelemesi | Kullanıcının ekran görüntüsü, yerel dosya yolu ve gerçek finansal değerleri depoya taşınmadı. API anahtarı veya uzunluğu log/evidence içine yazılmadı; AI eşleşmesine yalnız iki sınırlı ürün adayı gider |
| Kalan risk | Deterministik sözlük kasıtlı olarak dardır; güvenli olmayan semantik eşler ayrı kalabilir ve kullanıcı düzenlemesi gerektirir. Gemini doğruluk garantisi vermez. Jest gerçek Expo SQLite upgrade/restore yaşam döngüsünü, ağ/kota davranışını, native UI erişilebilirliğini veya fiziksel cihazdaki merge/split sonucunu kanıtlamaz |

### `AI-2026-08-23-PRODUCT-MATCHING-DISCOVERY-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-23 / Europe/Warsaw |
| İnsan hedefi | Benzer ürünleri düzenle ekranındaki büyüyen tek parça ürün akışını, veri arttığında aranabilir ve yönetilebilir kalacak zaman veya başka anlamlı gruplarla yeniden düzenlemek |
| Açık insan onayı | Kullanıcı mevcut ekranın az veride bile uzun olduğunu ekran görüntüsüyle gösterdi ve ürünleri zamana ya da daha iyi bir keşif düzenine göre kategorileyerek uygulanmasını doğrudan istedi. Commit, push, APK build veya yayın yetkisi vermedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcı talebindeki kanonik ürün kimliği uygulaması ve daha önce onaylanmış değişiklikler korundu, ilgisiz dosyalar geri alınmadı |
| İnsan katkısı | Ürün sayısı büyüdüğünde tek dikey akışta belirli bir kaydı bulmanın pratikte imkânsızlaşacağını belirledi; zaman gruplamasını olası çözüm olarak önerdi ve daha iyi alternatif seçimini uygulayıcıya bıraktı |
| AI katkısı | Ekranı iki amaçlı keşif modeline böldü: varsayılan, ağsız güçlü yerel olası eşleşme inceleme kuyruğu ve filtrelenebilir Tüm ürünler kataloğu. Kataloğu `SectionList` ile sanallaştırdı; 0–30/31–90/91–365/>365/geçmiş yok bölümleri, ad/alias/ham/çevrilmiş/kullanıcı etiketi araması, ölçü+tarih filtreleri ve son görülme/sıklık/alfabetik sıralama ekledi. İlk seçimden sonra ikinci adayları aynı ölçüyle sınırladı. DAO alias ve gözlemleri ayrı CTE agregasyonlarında özetleyerek join kaynaklı şişmeyi önledi |
| AI önerisi ile insan kararı ayrımı | İnsan ölçeklenebilir kategorileştirme ihtiyacını ve uygulama yetkisini belirledi. İki görünüm, zaman kovaları, yerel aday sırası ve sanallaştırma AI tarafından önerilip uygulandı. Yerel benzerlik bir ürün kimliği kararı veya AI kararı değildir; yalnız inceleme sırasıdır ve kalıcı merge ancak kullanıcının mevcut açık onay akışında oluşur |
| Mimari güvenlik sınırı | İnceleme kuyruğu cihazda sınırlı inverted-index ile kurulur; farklı ölçüler aday olmaz, paket/marka/varyant çelişkileri korunur. Ekran açılırken Gemini çağrılmaz. AI yalnız kullanıcı iki ürünü seçip görüş istediğinde öneri verir; DB veya finansal kayıtları kendiliğinden değiştiremez |
| Değiştirilen ana alanlar | `app/product-matching.tsx`; `src/utils/productMatchDiscovery.ts`; `src/db/productIdentityDao.ts`; ilgili component/saf/DAO testleri; TR/EN/AZ/RU kaynakları; `DESIGN_BRIEF.md`, `docs/ARCHITECTURE.md`, ADR-010 ve evidence kayıtları |
| Otomatik doğrulama | `npm run typecheck` exit 0; keşif yardımcıları, ürün eşleştirme ekranı, DAO ve locale parity kapsamındaki odaklı 4/4 Jest suite ile 53/53 test geçti. `npm test -- --ci --coverage=false` tam koşusunda 99/99 suite ve 843/843 test geçti; `git diff --check` temizdi. Saf yardımcı testinde 2.000 ürün girdisiyle sınırlı ve tekrarsız aday üretimi kontrol edildi. Bu kayıt fiziksel cihaz sonucu iddia etmez |
| Cihaz doğrulaması | Bekleniyor: gerçek SQLite verisiyle yüzlerce/binlerce ürün; ilk açılış ve yerel kuyruk süresi; uzun `SectionList` kaydırma akıcılığı ve bellek; arama/filtre/sıralama geçişleri; ilk seçimden sonra aynı ölçü; merge/split; açık-koyu tema, büyük font ve dört dil |
| Commit/CI ve nihai kabul | Henüz commit, CI, build kimliği veya nihai insan kabulü yoktur. Çalışma ağacındaki sonuçlar yayımlanmış özellik olarak sunulamaz |
| Gizlilik incelemesi | Kullanıcının ekran görüntüsü, yerel dosya yolu ve gerçek ürün adları bu yeni evidence kaydına kopyalanmadı; test verileri sentetiktir. Varsayılan keşif ağ çağrısı yapmaz |
| Kalan risk | `SectionList` görünür kart mount sayısını sınırlar, ancak DAO kompakt ürün özetlerinin tamamını belleğe yükler. Çok büyük katalogda SQL pagination gerekip gerekmediği cihaz profiliyle belirlenmelidir. Jest gerçek Expo SQLite sorgu süresini, native liste çizimini, düşük bellekli cihazı veya erişilebilirlik yerleşimini kanıtlamaz |

### `AI-2026-08-23-MULTILINGUAL-RECEIPT-RELIABILITY-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-23 / Europe/Warsaw |
| İnsan hedefi | Türkçe dışında Azerbaycanca, İngilizce ve Rusça seçildiğinde fiş/fatura taramasının çevrilmiş ürün, doğru kategori ve gerçek tutarla çalışmasını; “Harcama / Kategorisiz / 0” bozuk kaydının ve kameradan taramanın bazen askıda kalmasının sistem düzeyinde incelenip düzeltilmesini istedi |
| Açık insan onayı | Kullanıcı önce sistem kontrolünü istedi; bulgular ve kabul ölçütleri açıklandıktan sonra “Başlayalım” diyerek kod, test ve belge değişikliklerine onay verdi. Commit, push, APK build, yayın veya gerçek dış servise fiş gönderme yetkisi vermedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait kanonik ürün kimliği ve ürün keşfi değişiklikleri ile önceki onaylı çalışmalar korundu, ilgisiz dosyalar geri alınmadı |
| İnsan katkısı | Sorunu gerçek uygulama davranışıyla tanımladı: TR dışındaki dilde çeviri/kategori/tutar kaybı, sıfır harcama taslağı, kamerada asılı kalma ve zaman zaman yanlış sonuç. Galeri yolunun gözleminde daha stabil olduğunu ayrıca belirtti |
| AI katkısı | Dil promptundan çelişkili Türkçe-özel alanı kaldırıp `translation_language` + `localized_name` kurdu; 46 dil bağımsız `category_key` değerini yerel kanonik kategoriye bağladı. Sayı/para birimi coercion'ını güçlendirdi. Satıcı, tarih, gerçek kalem ve toplam kalite kapısı ekledi; gerçek tam indirimli sıfırı ayrı doğruladı ve geçersiz model yanıtını sınırlı sonraki modele yönlendirdi. Görseli en-boy oranlı 2048 px/%82 hazırladı; görüntü, ağ/model keşfi ve tüm taramaya timeout/AbortSignal ekledi; Durdur kilidini anında açtı, geç sonuçları kimlikle engelledi ve Android pending kamera sonucunu kurtardı. Sıfır tutarlı Detaylı Düzenle otomatik kaydını kapattı; taranmış/kayıtlı işlemin para birimini önizleme, işlem satırı, harcama düzenleme ve kalem düzenleme boyunca korudu |
| AI önerisi ile insan kararı ayrımı | İnsan çok dilli eş davranış ve askıda kalmayan kamera sonucunu seçti. Yapılandırılmış dil/kategori sözleşmesi, kalite kapısı eşikleri, zaman sınırları ve Android recovery teknik çözümü AI tarafından depo kanıtına göre tasarlanıp uygulandı. AI/OCR sonucu yine doğruluk garantisi değildir; kullanıcı önizleme ve düzenleme noktası korunur |
| Güvenlik ve veri sınırı | API anahtarı mevcut SecureStore ve `x-goog-api-key` header akışında kaldı. Bu çalışma gerçek fiş veya anahtarla ağ çağrısı yapmadı. Geçersiz yanıt DB sınırında ikinci kez doğrulanır; orijinal basılı ürün adı korunur. Kategori çevirisi finansal DB adını modelin serbest metnine bırakmaz |
| Değiştirilen ana alanlar | `app/{(tabs)/scanner,add-expense,edit-items}.tsx`; `src/services/{geminiService,receiptParser}.ts`; `src/utils/{receiptCategory,imageCompressor}.ts`; `src/components/TransactionRow.tsx`; Scanner/Gemini/parser/kategori/görsel/para birimi testleri; TR/EN kaynakları ve AZ/RU map+üretilmiş locale çıktıları; `DESIGN_BRIEF.md`, `docs/ARCHITECTURE.md` ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; prompt/kalite/fallback, TR/EN/AZ/RU kamera zinciri, Android pending-result, Durdur kilidi, kategori, görsel sıkıştırma, parser ön dolumu, işlem para birimi ve locale parity kapsamındaki odaklı 7/7 Jest suite ile 70/70 test geçti. `npm test -- --ci --coverage=false --runInBand` ile tam Jest 103/103 suite ve 878/878 test geçti; `git diff --check` temizdi |
| Cihaz doğrulaması | Bekleniyor: aynı okunaklı fişi uygulama dili TR/EN/AZ/RU iken kamera ve galeriden okutma; basılı ad ile yerelleştirilmiş ad, kategori, tarih, satır ve genel toplam karşılaştırması; kamera Activity yeniden oluşturma; Durdur→yeniden tara; bulanık/uzun fiş; çevrimdışı/yavaş/kota dolu ağ; PLN/USD/AZN/TRY işlem listesi; düşük bellekli Android |
| Commit/CI ve nihai kabul | Henüz commit, CI, build kimliği veya nihai insan kabulü yoktur. Otomatik test sonucu gerçek cihaz OCR/çeviri kabulü sayılmaz |
| Hatalı/yarım AI çıktısı | İlk test taslağında Durdur senaryosunun mock Gemini promise'i AbortSignal dinlemediği için test timeout oldu; mock gerçek iptal sözleşmesini dinleyecek biçimde düzeltildi. Bu test hatası ürün kodu kanıtı olarak kullanılmadı |
| Gizlilik incelemesi | Gerçek fiş görseli, kullanıcının yerel dosya yolu, API anahtarı veya kişisel finans verisi belge/test fixture'ına kopyalanmadı. Sentetik satıcı, ürün ve tutarlar kullanıldı |
| Kalan risk | Model seçili dilde doğal çeviri üretmeyebilir veya optik olarak zor fişi yanlış okuyabilir; kalite kapısı yapısal/finansal saçmalığı azaltır, semantik doğruluğu garanti etmez. Jest native kamera dönüşünü, OEM process death davranışını, gerçek bellek baskısını, Google kota gecikmesini veya insan çeviri kalitesini kanıtlamaz |

### `AI-2026-08-24-DASHBOARD-BUDGET-DENSITY-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-24–25 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı Dashboard sayfasının sonundaki “Aylık bütçe / Kullanılan / Kalan gün” kartının, donut altındaki mevcut bütçe kartını tekrarladığı için kaldırılmasını doğrudan istedi; commit veya push istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı çalışmalar korundu ve ilgisiz değişiklikler geri alınmadı |
| AI katkısı | Yalnız tekrarlı alt kartın render bloğunu ve ona özel stilleri kaldırdı; donut altındaki ayrıntılı `BudgetCard`, bütçe hesapları, borç/gelir girişleri, kategori ve satıcı kartları korunarak ürün niyeti belgelendi |
| Değiştirilen alanlar | `app/(tabs)/index.tsx`, `DESIGN_BRIEF.md` ve evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; kaldırılan kart/stil anahtarları Dashboard kaynağında bulunmadı; donut ve `BudgetCard` render'ı korundu; `git diff --check` temizdi |
| Cihaz doğrulaması ve sınır | Bekleniyor: açık/koyu tema, bütçeli/bütçesiz ve geçmiş dönemlerde alt scroll boşluğu. Otomatik test gerçek cihazdaki optik yoğunluğu kanıtlamaz |
| Commit/CI ve nihai kabul | Commit, push, CI/build kimliği veya nihai insan kabulü yoktur |

### `AI-2026-08-24-SPENDING-CALENDAR-RANGES-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-24 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı referans görseldeki dört parçalı `W / M / 3M / ALL` dönem seçicisinin mevcut Harcama Takvimi kartına uygulanmasını doğrudan istedi; commit, push veya cihaz build'i istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı analiz, ürün kimliği ve fiş güvenilirliği değişiklikleri korundu, ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Görsel yönü ve dört dönem kavramını belirledi; haftalık, aylık, üç aylık ve tüm zamanlar arasında kart içinden geçiş istedi |
| AI katkısı | Mevcut kartın yalnız ana aylık filtrede render edildiğini ve aynı `dailyData` aralığına bağlı olduğunu saptadı. Kartı ana filtreden ayıran saf 7/30/90 gün+tüm geçmiş resolver'ı, seri yenileme kuyruğunda ayrı günlük sorgu, referans geometride segment kontrolü, gerçek tarih etiketi ve uzun `ALL` geçmişi için yıllara ayrılmış aylık yoğunluk görünümü uyguladı. TR/EN erişilebilir adları ile AZ/RU kaynak haritalarını ekleyip üretilmiş sözlükleri derledi |
| AI önerisi ile insan kararı ayrımı | İnsan dört seçenekli kart içi tasarımı seçti. Rolling gün sayıları, ana filtreden bağımsızlık ve `ALL` görünümünün aylık özetlenmesi, kartın yüzlerce satıra uzamasını engellemek için AI tarafından kod kanıtına göre seçildi; finansal kayıt veya DAO sonucu değiştirilmedi |
| Değiştirilen alanlar | `app/(tabs)/analytics.tsx`; `src/components/{SpendingHeatmap,analytics/HeatmapCard}.tsx`; `src/utils/spendingCalendarPeriod.ts` ve testleri; dört dil kaynağı/çıktıları; `DESIGN_BRIEF.md`, `docs/ARCHITECTURE.md` ve evidence kayıtları |
| Otomatik doğrulama | `npm run typecheck` exit 0; dönem çözümü, segment etkileşimi, günlük/aylık yoğunluk ve locale parity için odaklı 4/4 suite ve 17/17 test geçti; locale derleme akışı 1.055 anahtarlı AZ/RU çıktıları üretti; `git diff --check` temiz |
| Cihaz doğrulaması ve sınır | Bekleniyor: Android açık/koyu tema, W/M/3M/ALL dokunma ve yükleme, boş/yeni/çok yıllı DB, günlük ve aylık hücre tooltip'i, uzun ay adları, büyük font ve TalkBack. Jest gerçek SQLite performansını ve optik kabulü kanıtlamaz |
| Hatalı/yarım AI çıktısı | İlk HeatmapCard test mock'u Jest factory kapsamı dışında `Text` referansladığı için suite yüklenmedi; mock kendi factory'si içinde `react-native` yükleyecek biçimde düzeltildi ve başarısız ilk koşu ürün doğrulaması sayılmadı |
| Gizlilik ve yayın sınırı | Ekli ekranlardaki gerçek tutar/adlar test veya belgeye kopyalanmadı; kişisel dosya yolu kaydedilmedi. Commit, push, CI/build veya nihai insan kabulü yoktur |
| Nihai insan kararı / geri alma | Kullanıcı 2026-08-24'te kontrolün görsel şemasını beğendi fakat Harcama Takvimi ile uyumunu reddetti ve kartın eski sürümüne dönmesini istedi. Kart, veri aralığı, ek sorgu, çeviri ve test uygulaması geri alındı. Görsel şema **Spark Dörtlü Periyot Anahtarı** adıyla yalnız yeniden kullanılabilir tasarım tarifi olarak `DESIGN_BRIEF.md` içinde korundu; Harcama Takvimi'nde aktif özellik değildir |
| Son durum | İnsan tarafından reddedilen deney / geri alındı. Bu blok uygulanmış güncel davranışın kanıtı olarak kullanılamaz |

### `AI-2026-08-24-DASHBOARD-VENDOR-NAMES-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-24 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı Dashboard Sık gidilen yerlerde orta uzunluktaki satıcı adlarının kesilmeden görünmesini, gerçekten uzun adların ise kartı bozmadan sağdan sola kendiliğinden kaymasını doğrudan istedi; commit/push istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı çalışmalar korundu ve ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Kısa adın doğru, orta uzunluktaki örneğin gereksiz kesildiğini gözlemledi; kartın tasarım sınırlarının korunmasını ve yalnız gerçek uzunlukta hareket kullanılmasını belirledi |
| AI katkısı | Mevcut iki sütunda avatar, ad ve yüzde aynı yatay alanı paylaştığı için metin viewport'unun daraldığını saptadı. İki sütunu koruyup kolon boşluğunu azalttı, yüzdeyi adın altına taşıdı ve mevcut ölçüm-temelli `MarqueeText` bileşenini 28 px/sn hız ile 1,4 sn başlangıç gecikmesinde kullandı. Statik/sığan ve negatif yönde kayan/taşan durumlar için odaklı test ekledi |
| AI önerisi ile insan kararı ayrımı | İnsan orta adların tam görünmesi ve uzun adların kayması davranışını seçti. Yüzdeyi alt satıra alma, genişlik oranı, hız ve gecikme değerleri tasarım sınırını korumak için AI tarafından mevcut kod ölçülerine göre belirlendi |
| Değiştirilen alanlar | `app/(tabs)/index.tsx`, `src/components/__tests__/MarqueeText.test.tsx`, `DESIGN_BRIEF.md` ve evidence kayıtları. Mevcut ortak `MarqueeText.tsx` davranışı değiştirilmeden yeniden kullanıldı |
| Otomatik doğrulama | `npm test -- --runInBand --coverage=false src/components/__tests__/MarqueeText.test.tsx`: 1/1 suite, 2/2 test geçti; `npm run typecheck` exit 0 |
| Cihaz doğrulaması ve sınır | Bekleniyor: gerçek Inter fontuyla Biedronka/MultiSport/çok uzun ad; farklı yüzdeler; iki sütun hizası; açık-koyu tema; büyük font; TalkBack; Dashboard dışında kalan sekmede animasyon maliyeti. Jest gerçek cihazdaki optik kabulü veya sürekli animasyon akıcılığını kanıtlamaz |
| Gizlilik ve yayın sınırı | Testte sentetik ad kullanıldı; kişisel finans değeri veya yerel dosya yolu taşınmadı. Commit, push, build veya nihai insan kabulü yoktur |

### `AI-2026-08-24-DASHBOARD-CASH-STATUS-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-24 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı aylık bütçe altındaki Borç/Ek gelir kutularındaki boş çizginin kısa açıklayıcı metne dönüşmesini ve ek gelir için profesyonel, finansal anlamı doğru bir gösterge tasarlanmasını doğrudan istedi; commit/push istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı çalışmalar korundu ve ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Çizginin bilgi taşımadığını ve ek gelir ekledikten sonra göstergenin anlaşılır olmadığını gerçek kullanım gözlemiyle belirtti; ek gelir sunum kararını finansal ve görsel kalite sınırlarıyla AI'ya bıraktı |
| AI katkısı | `outstandingDebt` değerinin global açık bakiye, `extraIncomeIn` değerinin seçili döngüde bütçeyi artıran tutar olduğunu koddan doğruladı. İki kutuyu ortak tema-duyarlı bileşene çıkardı; boş durumları açık metinle, dolu durumları tutar+bağlamla sundu. Ek geliri “Bütçeye eklendi”, borcu “Açık bakiye” olarak ayrıştırdı; ekran okuyucu etiketine eylem, durum ve tutarı ekledi; dört dil ve component/locale testleri ekledi |
| AI önerisi ile insan kararı ayrımı | İnsan boş çizginin kaldırılması ile profesyonel ek gelir göstergesini seçti. Tam metinler, global/dönem ayrımı, üçüncü bağlam satırı ve ortak bileşen yapısı AI tarafından mevcut finansal model ve dar iki-sütun geometrisine göre belirlendi |
| Değiştirilen alanlar | `app/(tabs)/index.tsx`, `src/components/DashboardCashEntryTiles.tsx`, `src/components/__tests__/DashboardCashEntryTiles.test.tsx`, TR/EN/AZ/RU kaynakları/çıktıları, `DESIGN_BRIEF.md` ve evidence kayıtları |
| Otomatik doğrulama | `npm run typecheck` exit 0; component ve locale parity odaklı paketi 2/2 suite ve 14/14 test geçti; locale derleme akışı AZ/RU çıktılarını yeniden üretti. Final `git diff --check` ayrıca çalıştırılır |
| Cihaz doğrulaması ve sınır | Bekleniyor: gerçek SQLite verisiyle ek gelir ekle/sil sonrası Dashboard'ın anlık yenilenmesi; boş/borç/gelir/ikisi dolu; geçmiş bütçe dönemi; büyük tutar; dört dil; açık-koyu tema; büyük font ve TalkBack. Jest native sheet, SQLite ve fiziksel yerleşimi kanıtlamaz |
| Gizlilik ve yayın sınırı | Testlerde sentetik tutarlar kullanıldı; gerçek finansal değer, ekran görüntüsü veya kişisel dosya yolu depoya taşınmadı. Commit, push, build veya nihai insan kabulü yoktur |

### `AI-2026-08-24-DASHBOARD-BUDGET-DONUT-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-24 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı normal Dashboard donutunda toplam etkin bütçenin %100 kabul edilmesini, kalan bölümün renkli kategori gibi doldurulmamasını ve harcanan bölümün kategorilere ayrılmasını doğrudan onayladı. Mevcut cam/sıvı görünümü ile interaktif hissin korunmasını ve %1–2 gibi küçük kategorilerin kolay seçilmesini istedi; commit/push istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı çalışmalar korundu ve ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Bütçe-kategori hibrit bilgi modelini seçti; mevcut donut estetiğinin ve kategori dokunuşunun ürün için değerli olduğunu belirtti |
| AI katkısı | Mevcut `DonutChart`ın segment toplamını otomatik %100 yaptığını ve sabit 4 px boşluğun küçük yayları sıfıra indirebildiğini koddan doğruladı. Dış payda desteği ve saf geometri ekledi; normal görünümde etkin bütçeyi payda yaptı. Bütçe kullanımının düşük olduğu durumda küçük kategorilerin tek halka üzerinde yeterli bağımsız dokunma alanına sahip olamayacağı fiziksel sınırı için kategori dokunuşu/merkez üzerinden sevilen eski 360° dağılıma geçen odak ve 44 dp önceki/sonraki kontrollerini uyguladı. Seçili kategoride harcama payı ile bütçe payını ayrı gösterdi; dört dil ve odaklı testler ekledi. Kullanıcının cihaz görseliyle verdiği ikinci geri bildirimde nötr ray sınırının zayıf ve merkez eyleminin belirsiz olduğunu doğruladı; yalnız Dashboard için opt-in ince iç/dış cam kenarı, merkez kullanım bilgisinde dekoratif dışa-genişlet rozeti ve odakta mevcut içe-topla karşılığını ekledi |
| AI önerisi ile insan kararı ayrımı | İnsan bütçe tabanlı halka, nötr kalan ve korunacak interaktif cam görünümü kararını verdi; ardından cam sınırının hafifçe belirginleşmesini ve merkez genişletme eyleminin tasarımla anlaşılmasını istedi. İki aşamalı büyütme, erişilebilir gezinme, dinamik boşluk oranı, yüzde metinleri, opt-in çift kenar ve küçük genişlet rozeti AI tarafından seçildi; finansal veri veya DAO sonucu değiştirilmedi |
| Değiştirilen alanlar | `app/(tabs)/index.tsx`; `src/components/{DashboardBudgetDonut,DonutChart}.tsx`; `src/utils/donutGeometry.ts`; ilgili component/geometri testleri; Reanimated Jest mock'u; TR/EN/AZ/RU kaynak/çıktıları; `DESIGN_BRIEF.md`, `docs/ARCHITECTURE.md` ve evidence kayıtları |
| Otomatik doğrulama | Cam kenarı ve merkez affordance sonrasında `npm run typecheck` exit 0; odaklı 2/2 suite ve 9/9 test; final `npm test -- --ci --coverage=false` ile 107/107 suite ve 892/892 test geçti; `git diff --check` temiz. Tam pakette ürün sonucunu etkilemeyen mevcut async `act()` konsol uyarıları görüldü |
| Cihaz doğrulaması ve sınır | Bekleniyor: Android açık/koyu tema; %0/%1/%6/%100/%100+ bütçe; 1–10 kategori; merkeze ve renkli yaya dokunma; önceki/sonraki wrap; dönem değiştirme; bütçesiz görünüm; büyük font, dört dil ve TalkBack. Jest gerçek SVG animasyonunu, parmak isabetini ve optik kabulü kanıtlamaz |
| Gizlilik ve yayın sınırı | Testlerde sentetik tutarlar kullanıldı; ekli gerçek finansal değer veya kişisel dosya yolu depoya taşınmadı. Commit, push, build veya nihai insan kabulü yoktur |

### `AI-2026-08-24-DASHBOARD-CATEGORY-LABELS-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-24 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı Dashboard Üst kategoriler kartındaki ikonların neyi temsil ettiğinin yazıyla görünmediğini ve bu bilginin hızlı erişim için önemli olduğunu belirterek düzenlemeyi istedi; commit/push istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı çalışmalar korundu ve ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Görsel ikonun tek başına yeterli olmadığı kullanım sorununu belirledi ve kategori anlamının Dashboard'da doğrudan görünmesini seçti |
| AI katkısı | Mevcut `CategoryPill` bileşeninin aldığı `name` değerini hiç render etmediğini ve Dashboard'ın çeviri yardımcısını kullanmadan ham kategori adı gönderdiğini koddan doğruladı. İkonun altına en fazla iki satırlık yerelleştirilmiş adı, onun altına mevcut renkli oranı yerleştirdi; orta/uzun adlar için kontrollü genişlik ve tam ad+oranı koruyan erişilebilir etiket ekledi. Kullanıcının cihaz geri bildiriminde yüzdeyi aşağı iten zorunlu iki satırlık ad yüksekliğini tespit edip kaldırdı; ikon–ad aralığını korurken ad–oran aralığını 2 dp yaptı |
| AI önerisi ile insan kararı ayrımı | İnsan kategori adlarının görünür olması kararını verdi. İki satır sınırı, sabit genişlik, görsel sıra ve ekran okuyucu sözleşmesi AI tarafından mevcut kompakt yatay kartın sınırlarına göre seçildi |
| Değiştirilen alanlar | `app/(tabs)/index.tsx`; `src/components/CategoryPill.tsx`; `src/components/__tests__/CategoryPill.test.tsx`; `DESIGN_BRIEF.md`; evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; odaklı CategoryPill Jest paketi 1/1 suite ve 3/3 test geçti. Final `npm test -- --ci --coverage=false --runInBand` ile 108/108 suite ve 895/895 test geçti; `git diff --check` temizdi. Tam pakette ürün sonucunu etkilemeyen mevcut async `act()` konsol uyarıları görüldü |
| Cihaz doğrulaması ve sınır | Bekleniyor: Android açık/koyu tema; 1–6 kategori; TR/EN/AZ/RU kısa ve uzun kategori adları; büyük font, yatay kaydırma ve TalkBack. Jest gerçek font metriğini, iki satırlık optik dengeyi ve kart yüksekliğini kanıtlamaz |
| Gizlilik ve yayın sınırı | Testlerde yalnız sentetik kategori adları kullanıldı; gerçek finansal veri veya kişisel dosya yolu depoya taşınmadı. Commit, push, build veya nihai insan kabulü yoktur |

### `AI-2026-08-24-DASHBOARD-PERIOD-IDENTITY-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-24 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı Dashboard'da “Ağustos 2026” ve “Bu Ay Harcanan” ifadelerinin gerçek `22 Ağu–21 Eyl` bütçe döngüsüyle çeliştiğini ekran görüntüsüyle belirtti; profesyonel yaklaşımın tasarlanıp uygulanmasını istedi. Commit/push istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı çalışmalar korundu ve ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Takvim ayı ile özel bütçe döngüsünün aynı bilgi hiyerarşisinde çarpıştığını gerçek cihaz görünümüyle tanımladı; çözümün yalnız yazım değil profesyonel dönem kimliği olmasını istedi. İlk uygulamayı gördükten sonra üstteki harcama etiketi+tutarın aşağıdaki bütçe kartını yinelediğini ve kategori odağında boşluğu büyüttüğünü belirterek tamamen kaldırılmasını seçti |
| AI katkısı | Mevcut Dashboard'ın başlangıç ayını `formatMonthYear` ile başlık, özel döngüyü ayrı alt satır ve yalnız güncel seçimde “Bu Ay” etiketi yaptığını koddan doğruladı. Küçük “Bütçe dönemi” bağlamı altında gerçek aralığı ana gezinme kimliği yaptı; tekrarlı alt tarihi kaldırdı. Aynı ayı sıkıştıran, iki ayda yılı bir kez yazan ve Ara–Oca geçişinde iki yılı koruyan saf biçimleyici ile dört dil ekledi. Takip geri bildiriminde üst harcama etiketi+tutarı ve artık kullanılmayan çeviri anahtarını kaldırıp dönem→donut aralığını 8 dp'ye indirdi; kesin harcanan tutarı aşağıdaki bütçe kartının tek sorumluluğu olarak bıraktı |
| AI önerisi ile insan kararı ayrımı | İnsan kavramsal çelişkinin kaldırılması ve profesyonel çözüm kararını, ardından tekrar harcama özetinin tamamen kaldırılmasını verdi. Tarih aralığının kanonik başlık olması, mikro etiket hiyerarşisi, tarih sıkıştırma kuralları ve dört dil metinleri AI tarafından mevcut bütçe döngüsü mimarisine göre seçildi |
| Değiştirilen alanlar | `app/(tabs)/index.tsx`; `src/utils/dateUtils.ts`; `src/utils/__tests__/dateUtils.test.ts`; TR/EN kaynakları, AZ/RU map ve üretilmiş locale çıktıları; `DESIGN_BRIEF.md`; evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; tarih biçimi ve locale parity odaklı 2/2 Jest suite ile 27/27 test geçti. Final `npm test -- --ci --coverage=false --runInBand` ile 108/108 suite ve 899/899 test geçti; `git diff --check` temizdi. Tam pakette ürün sonucunu etkilemeyen mevcut async `act()` konsol uyarıları görüldü |
| Cihaz doğrulaması ve sınır | Bekleniyor: ayın 1'inde `1–31 Ağu 2026`; gelir günü 22'de `22 Ağu–21 Eyl 2026`; `22 Ara 2026–21 Oca 2027`; geçmiş/güncel ok gezinmesi; TR/EN/AZ/RU, açık-koyu tema, büyük font ve TalkBack. Jest gerçek font sığmasını ve dikey ritmi kanıtlamaz |
| Gizlilik ve yayın sınırı | Kod ve testlerde yalnız sentetik tarihler kullanıldı; ekli ekran görüntüsü veya kişisel finans tutarı depoya taşınmadı. Commit, push, build veya nihai insan kabulü yoktur |

### `AI-2026-08-25-SAVINGS-UPDATE-AFFORDANCE-001`

| Alan | Kayıt |
|---|---|
| Tarih / saat dilimi | 2026-08-25 / Europe/Warsaw |
| İnsan hedefi ve onayı | Kullanıcı Dashboard Birikim hedefim kartındaki “Birikime ekle / çıkar” düğmesinin, kullanıcı tıklamadan önce açılan panelde ne olacağını yeterince anlatmadığını gerçek cihaz ekranıyla belirtti ve profesyonel yaklaşımın tasarlanmasını istedi. Commit/push istemedi |
| Başlangıç çalışma ağacı | Dirty; aynı kullanıcıya ait önceki onaylı çalışmalar korundu ve ilgisiz değişiklikler geri alınmadı |
| İnsan katkısı | Aynı CTA'daki zıt fiillerin ve açılacak yüzeyin belirsizliğini kullanım öncesi beklenti problemi olarak tanımladı; çözüm seçimini AI'ya bıraktı |
| AI katkısı | Mevcut metnin iki zıt işlemi tek başlığa yığdığını, ikonun ise yalnız `+` yönünü anlattığını ve aynı anahtarın standart kart, kompakt kart, sheet başlığı ile input erişilebilirlik etiketinde aşırı yüklendiğini koddan doğruladı. Ana eylemi “Birikimi güncelle”, görünür yardımcı satırı “Tutar ekle veya azalt” yaptı; `±` ikonunu standart/kompakt karta taşıdı. Erişilebilir etiketi ana eylem, ipucunu iki seçenek olarak ayırdı; sheet başlığını eşitledi, input'u genel tutar etiketiyle adlandırdı ve ayarlardaki eski “+ düğmesi” referansını dört dilde düzeltti |
| AI önerisi ile insan kararı ayrımı | İnsan belirsiz CTA'nın profesyonel biçimde yeniden ele alınması kararını verdi. Nötr güncelleme fiili, iki satırlı ön bilgi, `±` ikonu ve erişilebilir etiket/ipucu ayrımı AI tarafından mevcut sheet davranışına göre seçildi |
| Değiştirilen alanlar | `src/components/SavingsGoal{Card,PulseCard,ContributionSheet}.tsx`; `src/components/__tests__/SavingsGoal{Card,PulseCard,ContributionSheet}.test.tsx`; TR/EN kaynakları, AZ/RU map ve üretilmiş locale çıktıları; `DESIGN_BRIEF.md`; evidence belgeleri |
| Otomatik doğrulama | `npm run typecheck` exit 0; standart/kompakt hedef kartı, katkı sheet'i ve locale parity odaklı 4/4 Jest suite ile 17/17 test geçti. Final `npm test -- --ci --coverage=false --runInBand` ile 109/109 suite ve 900/900 test geçti; eski CTA metni/anahtarı için kalıntı taraması ve `git diff --check` temizdi. Tam pakette ürün sonucunu etkilemeyen mevcut async `act()` konsol uyarıları görüldü |
| Cihaz doğrulaması ve sınır | Bekleniyor: standart hedef kartında iki satırlı CTA; kompakt hedef kartında `±`; CTA→panel başlığı; ekle/azalt geçişi; açık-koyu tema, TR/EN/AZ/RU, büyük font ve TalkBack. Jest gerçek font sarımını, kart yüksekliğini, haptic'i ve native sheet hissini kanıtlamaz |
| Gizlilik ve yayın sınırı | Testlerde yalnız sentetik hedef adı ve tutarlar kullanıldı; ekli ekran görüntüsü veya kişisel finans verisi depoya taşınmadı. Commit, push, build veya nihai insan kabulü yoktur |

## 5. Yeni kayıt ekleme şablonu

Her anlamlı AI oturumu için aşağıdaki blok kullanılır. Küçük yazım düzeltmeleri tek
bir toplu kayıt altında birleştirilebilir; mimari veya ürün kararları ayrı tutulur.

### `<AI-YYYY-AA-GG-KONU-NNN>`

| Alan | Kayıt |
|---|---|
| Tarih, başlangıç/bitiş ve saat dilimi | `<...>` |
| İnsan katılımcı/rol | `<kişisel veri yerine rol veya kontrollü kimlik>` |
| AI aracı, model ve sürüm | `<doğrulanmış bilgi; bilinmiyorsa kaydedilmedi>` |
| Repo/branch/başlangıç commit'i | `<...>` |
| Başlangıç çalışma ağacı | `<clean/dirty; ilgili değişiklik özeti>` |
| İnsan hedefi | `<istenen sonuç>` |
| Açık insan onayı | `<hangi yazma/çalıştırma/dış etki yetkisi verildi>` |
| Kısıtlar ve korunacak alanlar | `<...>` |
| AI'ya sağlanan kaynaklar | `<dosya, görsel, not, bağlantı>` |
| AI katkısı | `<analiz/plan/kod/test/inceleme/dokümantasyon>` |
| İnsan katkısı | `<gereksinim/seçim/inceleme/test/kabul>` |
| AI önerileri | `<öneri ve gerekçe>` |
| İnsan tarafından seçilen/reddedilen öneriler | `<karar ve tarih>` |
| Değiştirilen dosyalar | `<...>` |
| Otomatik doğrulama | `<komut, sonuç, log/CI>` |
| Cihaz doğrulaması | `<build, cihaz/OS, senaryo, artefakt>` |
| Son commit/PR | `<hash/URI>` |
| Nihai insan kabulü | `<kapsam ve kanıt>` |
| Hatalı/yarım AI çıktısı | `<neyin kullanılmadığı ve neden>` |
| Gizlilik incelemesi | `<redaksiyon ve paylaşım sınırı>` |
| Retrospektif sınırlama | `<eksik zaman damgası, transcript, model bilgisi vb.>` |
| Takip işleri | `<...>` |

## 6. AI katkı özeti için önerilen metin

Akademik çalışmada gerektiğinde aşağıdaki kalıp projeye göre doldurulabilir:

> Bu projede yapay zekâ; kod deposunu inceleme, alternatif çözüm üretme, sınırlı
> kapsamda kod/test taslağı yazma ve dokümantasyon desteği amacıyla kullanılmıştır.
> Ürün gereksinimleri, kapsam seçimleri ve nihai kabul insan tarafından
> belirlenmiştir. AI çıktıları doğrudan doğruluk kanıtı olarak kabul edilmemiş;
> Git geçmişi, otomatik testler ve uygun olduğunda hedef cihaz testleriyle ayrı
> olarak doğrulanmıştır. Model veya oturum bilgisi kesin kaydedilemeyen geçmiş
> çalışmalar retrospektif ve sınırlı kanıt olarak etiketlenmiştir.

## 7. Gizlilik ve paylaşım

- Prompt veya transcript içinde API key, kişisel finans verisi ya da credential
  bulunuyorsa ham döküm repoya eklenmez.
- Kullanıcı adı, yerel home yolu, attachment UUID'si ve cihaz seri numarası
  akademik gereksinim yoksa çıkarılır.
- Ekran görüntüsü ve video, kanıt indeksinde kontrollü bir kimlikle tutulur;
  herkese açık depoya otomatik olarak eklenmez.
- Harici modele gönderilen veri türü, mümkün olduğunda “kaynak kodu”, “ekran
  görüntüsü”, “hata logu” gibi kategori düzeyinde belirtilir.
- AI servisinin saklama politikası bilinmiyorsa kesin güvence verilmez; bu durum
  sınırlama olarak kaydedilir.
