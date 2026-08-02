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
