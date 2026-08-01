# S.P.A.R.K. — Ürün ve Tasarım Rehberi

| Alan | Değer |
|---|---|
| Belge durumu | Yaşayan ürün belgesi |
| Belge sorumluluğu | Ürün kapsamı, kullanıcı deneyimi ve tasarım ilkeleri |
| Yapısal gözden geçirme | 1 Ağustos 2026 |
| Hedef okuyucu | Ürün sahibi, tasarımcı, geliştirici, tez inceleyicisi ve AI destekli geliştirme araçları |
| Tarihsel kaynak | [`docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md`](docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md) |

Bu belge S.P.A.R.K.'ın **ne yaptığını**, **hangi kullanıcı problemlerini çözdüğünü** ve **nasıl bir deneyim sunması gerektiğini** tanımlar. Kod yapısı, geliştirme komutları, geçmiş hata kayıtları ve doğrulama kanıtları ayrı belgelerde tutulur.

## 1. Ürün tanımı

S.P.A.R.K. (Smart Personal Accounting & Receipt Keeper), kullanıcının kişisel finans hareketlerini anlaşılır ve kontrollü biçimde yönetmesini sağlayan, çevrimdışı öncelikli bir mobil uygulamadır.

Uygulama şu temel sorunları çözmeyi hedefler:

- Harcamaları hızlı ve düzenli kaydetmek
- Fişleri isteğe bağlı AI desteğiyle işleme dönüştürmek
- Kullanıcının gerçek gelir gününe göre bütçe dönemlerini izlemek
- Borç, borç ödemesi ve ek gelirin harcanabilir tutara etkisini doğru göstermek
- Finansal durumu sade fakat açıklanabilir analizlerle sunmak
- Kişisel veriler üzerinde kullanıcı kontrolünü korumak

## 2. Değer önerisi ve ürün ilkeleri

### Yerel veri, kullanıcı kontrolü

Finansal kayıtların ana kaynağı cihaz içindeki SQLite veritabanıdır. Uygulama temel harcama, bütçe ve analiz işlevleri için hesap veya bulut bağlantısı gerektirmez.

### AI yardımcıdır, karar sahibi değildir

Gemini yalnız fiş ayrıştırmayı kolaylaştıran isteğe bağlı bir araçtır. AI çıktısı kaydedilmeden önce kullanıcı tarafından görülebilir ve düzeltilebilir. API anahtarı olmayan kullanıcı manuel finans yönetimine devam edebilir.

### Finansal sonuçlar açıklanabilir olmalıdır

Bir tutarın neden bütçeyi artırdığı veya azalttığı kullanıcı açısından anlaşılabilir olmalıdır. Harcama, borç, ödeme ve ek gelir aynı olay gibi ele alınmaz.

### Hız, süreklilik ve sakin hareket

Ekran geçişleri, toast'lar, bottom-sheet'ler ve başlangıç yüzeyi sert ışık değişimi, flicker veya gereksiz tam ekran karartma üretmemelidir. Animasyonlar bilgi hiyerarşisini desteklemeli, kullanıcının görevini geciktirmemelidir.

### Tutarlılık ayrıntıdan önemlidir

Aynı tür eylemler aynı görsel ve etkileşim dilini kullanmalıdır. Bir ekran için geliştirilen çözüm ortak tema, modal, bildirim ve erişilebilirlik sözleşmelerini ihlal etmemelidir.

## 3. Hedef kullanıcı ve temel ihtiyaçlar

S.P.A.R.K., günlük finansını kendi cihazında takip etmek isteyen bireysel kullanıcıya yöneliktir. Kullanıcının muhasebe veya finans uzmanı olması beklenmez.

Temel ihtiyaçlar:

- Bir işlemi mümkün olan en az sürtünmeyle kaydetmek
- Yanlış kaydı güvenle düzeltmek veya silmek
- Dönem içinde ne kadar harcandığını ve ne kadar kaldığını görmek
- Borç ve geri ödeme etkisini harcamayla karıştırmamak
- Harcama davranışını kategori, satıcı ve zaman açısından incelemek
- Veriyi dışa aktarmak ve geri yüklemek
- Dil, para birimi ve tema tercihlerini korumak

## 4. Ürün kapsamı

| Alan | Kullanıcıya sağlanan değer |
|---|---|
| Dashboard | Aktif bütçe döngüsünün harcanan, kalan ve nakit-akışı etkisini özetler |
| İşlemler | Harcamaları listeler, arar, filtreler, düzenler ve çoklu seçime izin verir |
| Fiş tarama | Kamera veya galeriden alınan fişi sıkıştırır, isteğe bağlı Gemini ayrıştırmasına ve kullanıcı önizlemesine sunar |
| Analiz | Kategori, satıcı, zaman ve davranış odaklı kartlarla finansal örüntüleri gösterir |
| Bütçe | Gelir gününe göre dönem oluşturur; kategori limitleri ve projeksiyonlarla birlikte çalışır |
| Birikim hedefi | Hedef tutarı ve kullanıcının ilerlemesini izler |
| Borç | Alınan borcu, kalan bakiyeyi ve kısmi/tam ödeme geçmişini harcamadan ayrı tutar |
| Ek gelir | Geri ödeme yükümlülüğü olmayan dönemsel nakit girişini kaydeder |
| Abonelikler | Yerel işlem geçmişinden tekrar eden satıcı ödemelerini tahmin eder ve kullanıcı kararını saklar |
| Bildirim merkezi | Bütçe, hedef, kategori, fiş ve sistem uyarılarını kalıcı, filtrelenebilir ve yönetilebilir biçimde gösterir |
| Yedekleme | Seçilen tarih aralığındaki veriyi sürümlü JSON olarak dışa aktarır ve doğrulanmış veriyi atomik geri yükler |
| Ayarlar | Dil, para birimi, tema, bütçe, veri ve AI tercihlerini yönetir |

## 5. Kritik kullanıcı akışları

### 5.1 Manuel harcama

Kullanıcı tutar, tarih, satıcı, kategori ve isteğe bağlı not girer. Kayıt tamamlandığında ilgili liste, Dashboard, analiz ve bildirim türevleri aynı finansal gerçeği göstermelidir.

### 5.2 Fişten işlem oluşturma

1. Kullanıcı kamera veya galeriden görsel seçer.
2. Görsel ağ aktarımı öncesinde küçültülür ve sıkıştırılır.
3. Gemini yapılandırılmış fiş verisi önerir.
4. Yanıt doğrulanır, temizlenir ve satırlar birleştirilir.
5. Kullanıcı önizlemeyi kabul eder veya düzenlemeye geçer.
6. Fiş başlığı ve kalemleri tek atomik işlemle kaydedilir.

AI sonucu doğrudan finansal gerçek kabul edilmez. Kullanıcı kontrol noktası akışın zorunlu ürün ilkesidir.

### 5.3 Bütçe döngüsü

Bütçe dönemi takvim ayıyla sınırlı değildir. Kullanıcının seçtiği başlangıç günü, Dashboard, analiz, kategori limitleri, bildirimler, borç etkisi ve ek gelir hesabında ortak dönem sınırı olmalıdır.

### 5.4 Borç ve ek gelir

Borç işlemleri harcama fişini parçalamaz. Borç alınması, borç verilmesi, geri ödeme ve ek gelir kendi türleriyle saklanır. Silinen veya düzeltilen bir kayıt bütçe etkisinde kalıcı artık bırakmamalıdır; sonuç mevcut kayıtlar üzerinden yeniden türetilmelidir.

### 5.5 Bildirim yönetimi

Kullanıcı bildirimleri kanala göre filtreleyebilir, okuyabilir, detayını açabilir, kaydırma hareketiyle silme eylemini ortaya çıkarabilir ve uzun basmayla çoklu seçim yapabilir. Tekli kaydırma ile seçim modu birbirinin jest alanını bozmamalıdır.

### 5.6 Yedekleme ve geri yükleme

Kullanıcı taşınabilir bir yedek oluşturabilir. Geri yüklemede bütün veri önce doğrulanır; hata halinde kısmi kayıt bırakılmaz. Eski desteklenen formatlar okunabilir, desteklenmeyen yeni formatlar açık hata ile reddedilir.

## 6. Finansal ve veri değişmezleri

Bu kurallar ürün davranışıdır; uygulama ayrıntısı gibi sessizce değiştirilemez:

1. **Harcama, borç ödemesi değildir.** Borç geri ödemesi tüketim toplamına ikinci kez eklenmez.
2. **Ek gelir borç değildir.** Geri ödeme yükümlülüğü ve açık borç bakiyesi oluşturmaz.
3. **Bütçe etkisi kayıtlardan türetilir.** Silinen borç, ödeme veya ek gelir gelecekteki hesapta görünmemelidir.
4. **Aynı dönem her yerde aynıdır.** Dashboard ve analiz farklı tarih pencereleriyle aynı bütçeyi kıyaslayamaz.
5. **Basılı fiş toplamı korunur.** AI bir satırı kaçırdı diye fiş başlığı sessizce düşürülemez; kullanıcı açıkça kalem düzenlerse toplam yeniden hesaplanabilir.
6. **Çoklu veri yazımı atomiktir.** Fiş, restore ve ilişkili mutasyonlar yarım durumda kalmamalıdır.
7. **Secret finansal ayarlardan ayrıdır.** Gemini anahtarı SQLite ayar tablosunda tutulmaz.
8. **Üretilmiş locale dosyaları kaynak değildir.** Çeviri kaynağı değiştirilip çıktılar yeniden üretilir.

Ayrıntılı teknik sözleşmeler için [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ve karar kayıtları kullanılır.

## 7. Tasarım dili

### Görsel kimlik

- Temel kimlik: koyu yüzey, canlı yeşil vurgu ve ölçülü cam hissi
- Açık ve koyu temada aynı bilgi hiyerarşisi
- Birincil CTA: `susevar` sözleşmesine bağlı, belirgin fakat ekranı domine etmeyen eylem
- Kartlarda düzenli hizalama, tutarlı radius, sınır ve iç boşluk
- İkonlarda işlevsel boyut ve optik denge; dekoratif büyüklükten kaçınma

Kod tarafındaki kesin renk, tipografi ve spacing değerlerinin kaynağı `src/theme/` dizinidir.

### Etkileşim ilkeleri

- Ana eylem ilk bakışta anlaşılmalı; ikincil eylemler görsel gürültü yaratmamalıdır.
- Silme gibi geri alınması zor eylemler kasıtlı bir jest, seçim veya onay gerektirir.
- Swipe, uzun basma, scroll ve pull-to-refresh aynı yüzeyde birbirini kilitlememelidir.
- Toast ve popup geri bildirimi içeriği örterek veya ekranı karartarak cezalandırmamalıdır.
- Animasyonun başlangıç ve bitiş yüzeyleri aynı tema bağlamında olmalıdır; beyaz/siyah ara kare kabul edilmez.
- Safe area, sistem gesture alanı, font scaling ve dokunma hedefleri cihaz çeşitliliğiyle değerlendirilmelidir.

### Erişilebilirlik

- Yalnız renkle anlam aktarılmamalıdır.
- Metin, ikon ve dokunma alanları okunabilir ve erişilebilir kalmalıdır.
- Seçim ve silme modları ekran okuyucuya anlaşılır durum/etiket sunmalıdır.
- Hareket azaltma tercihi ve düşük performanslı cihazlar yeni animasyonlarda değerlendirilmelidir.

## 8. Kalite hedefleri

| Hedef | Kabul yaklaşımı |
|---|---|
| Finansal doğruluk | Saf domain testleri, DAO testleri ve ekranlar arası aynı dönem karşılaştırması |
| Veri bütünlüğü | Transaction, migration ve backup/restore senaryoları |
| Başlangıç sürekliliği | Cold-start, açık/koyu tema ve temiz kurulum cihaz testi |
| Etkileşim güvenilirliği | Gesture, seçim, scroll, modal ve toast cihaz senaryoları |
| Gizlilik | Yerel saklama, SecureStore ve dış veri sınırlarının incelenmesi |
| Dil tutarlılığı | Dört dil anahtar paritesi ve insan dil kontrolü |
| Geriye dönük uyumluluk | Şema ve backup sürüm geçişleri |

Otomatik test başarısı, gerçek cihazdaki görsel veya native davranışı tek başına kanıtlamaz. Doğrulama politikası [`docs/QUALITY_AND_SECURITY.md`](docs/QUALITY_AND_SECURITY.md), tez kanıt zinciri [`docs/evidence/TRACEABILITY.md`](docs/evidence/TRACEABILITY.md) içindedir.

## 9. Mevcut sınırlar ve kapsam dışı alanlar

Mevcut ürün kapsamında:

- Kullanıcı hesabı ve merkezi backend bulunmaz.
- Cihazlar arası gerçek zamanlı bulut senkronizasyonu bulunmaz.
- Banka hesabına doğrudan bağlantı veya otomatik banka hareketi aktarımı bulunmaz.
- Gemini yanıtı doğruluk garantisi taşımaz ve ağ bağlantısına bağlıdır.
- Expo Go, native bildirim ve release-build davranışlarının tamamını temsil etmez.
- iOS ve Android hedeflenir; web komutu geliştirme kolaylığı sağlasa da web birincil ürün hedefi değildir.

Bu alanlardan biri kapsama alınırsa veri modeli, güvenlik, gizlilik, mimari ve tez kanıt planı birlikte güncellenmelidir.

## 10. Belge sistemi ve tek kaynak sahipliği

| Belge/kaynak | Sorumluluk |
|---|---|
| `README.md` | Dışarıdan ilk bakış, kurulum ve belge indeksi |
| `DESIGN_BRIEF.md` | Ürün kapsamı, UX niyeti ve tasarım ilkeleri |
| `AGENTS.md` | İnsan/AI katkı sözleşmesi ve değişmez çalışma kuralları |
| `docs/ARCHITECTURE.md` | Mimari sınırlar, veri modeli ve ana akışlar |
| `docs/DEVELOPMENT_GUIDE.md` | Kodlama, tema, i18n, DB ve release çalışma biçimi |
| `docs/QUALITY_AND_SECURITY.md` | Test, cihaz doğrulaması, güvenlik ve güvenilirlik sınırları |
| `docs/decisions/` | Önemli kararların bağlamı, seçenekleri ve gerekçesi |
| `docs/history/` | Değiştirilemez retrospektif mühendislik geçmişi |
| `docs/evidence/` | Tez için gereksinim, AI katkısı ve doğrulama izleri |
| `docs/templates/` | Diğer projelere taşınabilir dokümantasyon ve AI oturumu şablonları |
| `package.json`, `app.json`, `eas.json`, CI ve ürün kodu | Çalıştırılabilir gerçekler |

README İngilizce tutulabilir; iç teknik belgelerin kanonik dili Türkçedir. Kod sembolleri, komutlar ve resmi teknoloji adları çevrilmez.

## 11. Belge bakım kuralı

- Ürün kapsamı veya kullanıcıya görünen davranış değişirse bu belge güncellenir.
- Mimari uygulama değişirse `docs/ARCHITECTURE.md` veya ilgili ADR güncellenir.
- Paket sürümü, test sayısı ve izin listesi gibi değişken değerler burada tekrarlanmaz; kanonik kaynağa bağlantı verilir.
- Çözülmüş hata geçmişi bu belgeye eklenmez; tarihçe ve izlenebilirlik kaydına taşınır.
- Akademik iddia otomatik olarak “kanıtlandı” sayılmaz; commit, test, cihaz ve insan kabulü ayrı kaydedilir.
- Tarihsel kayıt sessizce yeniden yazılmaz. Hata varsa düzeltme notu veya yeni revizyon eklenir.

---

Önceki birleşik tasarım/teknik rehber, profesyonel ayrıştırma öncesindeki haliyle [`docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md`](docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md) içinde birebir korunmuştur.
