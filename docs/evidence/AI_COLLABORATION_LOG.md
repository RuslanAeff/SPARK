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
