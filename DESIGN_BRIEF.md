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

Gemini fiş ayrıştırmayı ve açıkça istenen iki ürün adayının karşılaştırılmasını kolaylaştıran isteğe bağlı bir araçtır. AI çıktısı kaydedilmeden önce kullanıcı tarafından görülebilir ve düzeltilebilir; ürünleri kendiliğinden birleştiremez. Analiz ekranı açılırken veya eski veri migration'ında ağ çağrısı yapılmaz. API anahtarı olmayan kullanıcı manuel finans yönetimine, yerel ürün eşleştirmesine ve Fiyat Takibi'ne devam edebilir.

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
| Dashboard | Aktif bütçe döngüsünün harcanan, kalan ve nakit-akışı etkisini özetler; kullanıcı isterse aktif birikim hedefini kompakt biçimde öne çıkarır |
| İşlemler | Harcamaları listeler, arar, filtreler, düzenler ve çoklu seçime izin verir |
| Fiş tarama | Kamera veya galeriden alınan fişi sıkıştırır, isteğe bağlı Gemini ayrıştırmasına ve kullanıcı önizlemesine sunar |
| Analiz | Kategori, satıcı, zaman ve davranış odaklı kartlarla finansal örüntüleri gösterir |
| Ürün kimliği | Aynı ürünün güvenli yazım/OCR farklarını ölçü birimine duyarlı kalıcı kimlikte toplar; belirsiz eşleşmeyi kullanıcıya bırakır |
| Bütçe | Gelir gününe göre dönem oluşturur; kategori limitleri ve projeksiyonlarla birlikte çalışır |
| Birikim hedefi | Hedef tutarı ve kullanıcının ilerlemesini izler |
| Borç | Alınan borcu, kalan bakiyeyi ve kısmi/tam ödeme geçmişini harcamadan ayrı tutar |
| Ek gelir | Geri ödeme yükümlülüğü olmayan dönemsel nakit girişini kaydeder |
| Abonelikler | Yerel işlem geçmişinden tekrar eden satıcı ödemelerini tahmin eder ve kullanıcı kararını saklar |
| Ödeme hatırlatıcıları | Borç vadelerini ve kullanıcının açıkça tanımladığı/onayladığı düzenli ödemeleri, tahmini aboneliklerden ayrı bir takvim kaydı olarak tutar |
| Bildirim merkezi | Bütçe, hedef, kategori, fiş ve sistem uyarılarını kalıcı, filtrelenebilir ve yönetilebilir biçimde gösterir |
| Yedekleme | Seçilen tarih aralığındaki veriyi sürümlü JSON olarak dışa aktarır ve doğrulanmış veriyi atomik geri yükler |
| Ayarlar | Dil, para birimi, açık/koyu görünüm, vurgu paleti, bütçe, veri ve AI tercihlerini yönetir |

## 5. Kritik kullanıcı akışları

### 5.1 Manuel harcama

Kullanıcı tutar, tarih, satıcı, kategori ve isteğe bağlı not girer. Kayıt tamamlandığında ilgili liste, Dashboard, analiz ve bildirim türevleri aynı finansal gerçeği göstermelidir.

### 5.2 Fişten işlem oluşturma

1. Kullanıcı kamera veya galeriden görsel seçer.
2. Görsel ağ aktarımı öncesinde küçültülür ve sıkıştırılır.
3. Gemini yapılandırılmış fiş verisi ve opsiyonel, yalnız açıklayıcı ürün kimliği metadatası önerir.
4. Yanıt doğrulanır, temizlenir ve satırlar birleştirilir.
5. Kullanıcı önizlemeyi kabul eder veya düzenlemeye geçer.
6. Yerel deterministik kurallar ürün aliaslarını çözer; fiş başlığı, kalemler ve nullable ürün bağlantıları tek atomik işlemle kaydedilir.

AI sonucu doğrudan finansal gerçek kabul edilmez. Kullanıcı kontrol noktası akışın zorunlu ürün ilkesidir.

Tarama dili uygulamanın o anda seçili TR/EN/AZ/RU dilidir. Model basılı adı
değiştirmeden ayrıca bu dilde okunabilir ürün adı üretir; kategori ise çevrilmiş
serbest metin yerine dil bağımsız anahtarla taşınır ve yerel kategori kaydına
uygulama tarafından çözülür. Satıcı, geçerli fiş tarihi, anlamlı ürün satırı ve
tutar bulunmayan bir model yanıtı önizleme veya sıfır tutarlı harcama taslağına
dönüşmez. Gerçek tamamen indirimli sıfır fiş ancak brüt satır ve tam indirim
kanıtıyla kabul edilir. İlk model geçersiz yapı döndürürse yalnız sınırlı model
adayları içinde yeniden denenir; başarısızlık kullanıcıya güvenli, yerelleştirilmiş
mesajla açıklanır.

Tarayıcı giriş yüzeyi, büyük dekoratif ikon ve ağır kart yığınları yerine tek bir
sayfa başlığı, dairesel tonal yüzeyde köşe hedefleri ve ortadaki tarama
bantlarından oluşan kompakt outline işaret ile aynı kontrol ailesindeki iki kaynak
kapsülü kullanır. Kamera önerilen hızlı yol olarak aktif vurgu ikon kapsülüyle
önceliklendirilir; dış ray açık temada siyaha dönmez ve galeri seçimi aynı
geometriyi daha sakin ikincil vurguyla sürdürür. Canlı vurgu bölümü
yalnız eylem ikonunu taşır; ince outline ikonlar, doğal metin ölçüsü ve ölçülü
gölge açık/koyu temada aynı bilgi hiyerarşisini korur. Bu kaynak seçiciler bir
sonuç CTA'sı olmadığı için `susevar` sözleşmesini kullanmaz; fiş sonucu
ekranındaki Kaydet eylemi tek birincil CTA olarak kalır. İzin veya picker işlemi
beklerken hızlı tekrar dokunma ikinci bir sistem akışı başlatmamalıdır.
Kamera Activity'si Android tarafından yeniden oluşturulduğunda bekleyen sistem
sonucu geri kazanılmalıdır. Kaynak seçimi, görüntü hazırlama ve ağ ayrıştırması
sınırlı bekleme sürelerine sahiptir; Durdur eylemi etkin isteği iptal edip kaynak
kilidini hemen açar. Görsel en-boy oranı korunarak yalnız gerekirse küçültülür;
küçük görsel büyütülmez.

### 5.3 Bütçe döngüsü

Bütçe dönemi takvim ayıyla sınırlı değildir. Kullanıcının seçtiği başlangıç günü, Dashboard, analiz, kategori limitleri, bildirimler, borç etkisi ve ek gelir hesabında ortak dönem sınırı olmalıdır.

Başlangıç günü değiştirilince yeni düzen bütçe onayıyla birlikte yeni döneme
uygulanır. Tamamlanmış dönemlerin tarih aralığı ve planlanan tutarı değişmez;
kullanıcı gerçek gelir veya işlem tarihini yapay biçimde ileri almak zorunda
kalmaz.

Harcama istatistikleri yalnız tamamlanmış takvim günlerini değerlendirir; bugün harcama kaydı olmayan gün, hedef-altı gün veya değerlendirme paydasına katılmaz, ancak bugünkü gerçek harcama aktif seriyi keser. Takip-temelli görünümde gözlem veritabanındaki ilk gerçek işlemle başlar. Üç tamamlanmış günden kısa kapsam başarı veya seri üretmez; kart kaç tamamlanmış günün kaçında harcama kaydı bulunduğunu açıkça gösterir. Mesaj yalnız son seri uzunluğuna dayanmaz: günlük plan varsa tüm dönemdeki kayıtlı harcama günlerinin ne kadarının plan içinde kaldığını, plan yoksa yalnız kayıt kapsamının güvenini açıklar. Kayıt bulunmayan gün tasarruf kanıtı sayılmaz. Bugünü içermeyen geçmiş bir aralıkta gösterilen seri, güncel seri gibi değil dönem sonu serisi olarak adlandırılır. Sabit günlük plan hedefi yalnız aktif bütçenin kanonik aylık döngüsünde `etkin bütçe / toplam döngü günü` hesabıyla sunulur; diğer aralıklarda yapay bir hedef üretilmez.

Analiz karşılaştırması bütçeyi değil, iki tarih aralığındaki kayıtlı harcama toplamını karşılaştırır. Devam eden dönemde bugün ve gelecek günler dışarıda bırakılır; mevcut dönemin ilk tamamlanmış `N` günü, önceki dönemin ilk `N` günüyle karşılaştırılır ve iki gerçek tarih aralığı kartta görünür. Başarılı sorgudaki sıfır harcama ile verinin yüklenememesi aynı durum gibi sunulmaz.

Analiz, Dashboard'da zaten bulunan **Bütçe Durumu** kartını ve kayıt oluşturma saatini gerçek satın alma saati gibi yorumlama riski taşıyan **Ne Zaman Harcıyorsun** kartını tekrarlamaz. **En Yüksek İşlemler** seçili aralığın somut tepe işlemlerini gösterdiği için korunur. Limit Sağlığı, Fiyat Takibi, Aktif Abonelikler ve Birikim Hedefi yalnız ilgili kalıcı veya türetilmiş veri varsa render edilir; veri yokken boş kart yığını oluşturmaz. Kart düzenleme yüzeyinde kullanıcı tüm aktif kartları tek ve geri alınabilir bir eylemle Kullanılabilir Kartlar bölümüne taşıyabilir. Kart ekleme, kaldırma ve sıralama işlemleri onaya kadar yalnız taslaktır; düzenleme sırasında ana sekmeler arasında yatay kaydırma kilitlenir, sekme düğmesiyle ayrılınca taslak atılıp son onaylanmış yapı geri yüklenir. Boş taslakta en az bir kart yeniden eklenmeden onay kabul edilmez veya boş ayar kalıcılaştırılmaz; eski bir boş ayar bulunursa Günlük Grafik kartıyla güvenli biçimde onarılır.

Dashboard sırası tamamen serbest sürükle-bırak kişiselleştirmesine açılmaz. Kullanıcı, aktif ve tamamlanmamış birikim hedefini isteğe bağlı olarak üst bölgede kompakt bir özetle öne çıkarabilir. Açık borç uyarısı daha yüksek öncelikte kalır; öne çıkarılan hedef aynı ekranda ikinci kez tam kart olarak tekrarlanmaz. Tamamlanmış hedef standart ayrıntı konumunda kalır ve kategori limitleri hedef kaydının varlığına bağlanmaz.

Birikim hedefi kartındaki hızlı finansal eylem iki zıt fiili CTA başlığına
yığmaz ve yalnız ekleme yapılacakmış gibi `+` simgesi kullanmaz. Nötr ana eylem
“Birikimi güncelle”, görünen yardımcı satır “Tutar ekle veya azalt” olur; `±`
simgesi iki yönü önceden anlatır. Aynı ad açılan panelin başlığıdır, ekleme veya
azaltma seçimi panel içinde yapılır. Ekran okuyucu ana eylemi etiket, iki olası
sonucu ipucu olarak ayrı okur; kompakt hedef kartındaki ikon-only eylem de aynı
sözleşmeyi kullanır.

Dashboard ana özeti, gelir gününe bağlı bütçe döngüsünü takvim ayı adıyla
etiketlemez. Gezinme alanında küçük “Bütçe dönemi” bağlamının altında gerçek
tarih aralığı ana kimlik olarak gösterilir; aynı ay/yılda tekrarlar sıkıştırılır,
yıl değişiminde iki yıl da açıkça yazılır. Dönem kimliğinin altında harcanan
tutar ikinci kez yazılmaz; halka kullanım oranını, hemen aşağıdaki bütçe kartı
kesin harcanan ve kalan tutarı zaten gösterir. Böylece hem `22 Ağu–21 Eyl` gibi
bir döngü “Ağustos” veya “bu ay” sanılmaz hem de kategori odağı açıldığında üst
bölüm gereksiz yere uzamaz.

Dashboard bütçe özetini donut bölümünün hemen altındaki tek ayrıntılı bütçe kartında
sunar. Aylık bütçe, kullanılan oran ve kalan gün değerlerini sayfanın sonunda
ikinci bir üçlü kartla tekrarlamaz; alt akış kategori ve satıcı sonuçlarından sonra
doğrudan sayfa sonuna ulaşır.

Dashboard donutunun nötr rayı etkin bütçenin tamamını, renkli yayları ise gerçek
harcamayı temsil eder; kalan tutar ikinci bir renkli kategori gibi çizilmez.
Renkli bölüm kendi içinde gerçek kategori tutarlarına ayrılır ve merkezde bütçe
kullanım yüzdesi görünür. Kategori ayrıntısında “harcamalardaki pay” ile
“bütçedeki pay” ayrı adlandırılır. Düşük bütçe kullanımında küçük kategorilerin
yayları fiziksel dokunma hedefinden daha dar olabileceği için merkeze veya renkli
yaya dokunmak kategorileri eski tam-halka dağılımında büyütür; önceki/sonraki
44 dp kontrolleri her kategoriye kesin erişim sağlar. Bu odak yalnız sunumu
değiştirir, finansal toplamı veya bütçe paydasını değiştirmez. Halkanın iç ve
dış sınırındaki çok ince tema-duyarlı parlamalar, ağır bir çerçeve oluşturmadan
cam tüpün sınırını tanımlar. Normal görünümde merkezdeki kullanım değerine bağlı
küçük dışa-genişlet rozeti alanın dokunulabilir olduğunu anlatır; kategori odağına
geçilince bunun karşılığı olan içe-topla ikonu görünür. Rozet ayrı bir erişilebilir
kontrol değildir; merkez düğmesinin açıklayıcı eylem etiketi kanoniktir.

Analiz sekmesindeki **Davranışsal Analiz** kartındaki ihtiyaç/keyif ve hafta
içi/hafta sonu donut'ları aynı küçük-dilim erişilebilirlik sözleşmesini paylaşır:
bir dilim seçildiğinde analiz metninin iki yanında beliren önceki/sonraki ok
kontrolleri, o donut'un segmentleri arasında dizi boyutuna göre döngüsel
gezinir. Hiçbir dilim seçili değilken kart, iki donut sayfası arasındaki yatay
kaydırmayı anlatan mevcut ipucunu değiştirmeden gösterir; ok gezinmesi yalnız
dilim seçimini, sayfa kaydırmayı değil hedefler.

Dashboard'daki **Üst kategoriler** yalnız ikon ezberine dayanmaz. Her kategori
ikonunun altında seçili uygulama dilindeki kategori adı, onun altında renkli oran
görünür. Kompakt yatay akışı korumak için uzun ad en fazla iki satırda kısalabilir;
tek satırlık adlar kullanılmayan ikinci satır yüksekliğini ayırmaz ve oran gerçek
metnin hemen altında kalır. Tam kategori adı ve oran ekran okuyucu etiketinde
birlikte korunur.

Dashboard'daki **Sık gidilen yerler** iki sütunlu kompakt yapısını korur. Satıcı
yüzdesi adla aynı yatay alan için yarışmak yerine adın altında gösterilir; sütun
boşluğu azaltılarak orta uzunluktaki adlara daha geniş, tek satırlık alan verilir.
Satıcı adı bu gerçek alana sığıyorsa tamamen statik kalır. Yalnız gerçekten
taşan ad, başlangıcı okunabilsin diye kısa bir beklemeden sonra sakin biçimde
sağdan sola döngüsel kayar; tam ad ekran okuyucu etiketi olarak korunur.

Aylık bütçe altındaki **Borç** ve **Ek gelir** girişleri boş değeri anlamsız bir
çizgiyle göstermez. Borç yoksa “Açık borç yok”, seçili bütçe döneminde ek gelir
yoksa “Bu dönem ek gelir yok” denir. Veri varsa borç tutarı “Açık bakiye” olarak,
ek gelir ise yeşil `+tutar` ve “Bütçeye eklendi” bağlamıyla sunulur. Böylece açık
borcun dönemden bağımsız bakiye, ek gelirin ise yalnız seçili dönemin harcanabilir
bütçesini artıran nakit olduğu ayrımı korunur. Erişilebilir eylem adı görünen
durum ve tutarı da birlikte açıklar.

### 5.4 Borç ve ek gelir

Borç işlemleri harcama fişini parçalamaz. Borç alınması, borç verilmesi, geri ödeme ve ek gelir kendi türleriyle saklanır. Silinen veya düzeltilen bir kayıt bütçe etkisinde kalıcı artık bırakmamalıdır; sonuç mevcut kayıtlar üzerinden yeniden türetilmelidir.

### 5.5 Bildirim yönetimi

Kullanıcı bildirimleri kanala göre filtreleyebilir, okuyabilir, detayını açabilir, kaydırma hareketiyle silme eylemini ortaya çıkarabilir ve uzun basmayla çoklu seçim yapabilir. Tekli kaydırma ile seçim modu birbirinin jest alanını bozmamalıdır.

Fiş bildirimi AI'ın ilk önerisini kalıcı bir metin kopyası olarak göstermemelidir. Kullanıcı satıcıyı düzenlediğinde bildirim, işlem kimliği üzerinden son kaydedilmiş satıcıyla uzlaşmalı; satıcı adı birincil başlık, kayıt sonucu ise kısa destek metni olarak sunulmalıdır.

Uygulama içi feed finansal bildirim geçmişinin kalıcı yüzeyidir; Android sistem bildirimi bunun ikincil teslim kanalıdır. Native bildirim aktivasyonu ilk uygulama karesi gösterildikten sonra başlamalı, Expo Go'da desteklenmeyen API'lere girilmemeli ve tekrar açma/özgeçmişten dönme aynı kaydı ikinci kez teslim etmemelidir. Rutin güncellemeler ile dikkat gerektiren uyarılar ayrı ve yerelleştirilmiş önem kanallarında sunulmalı; kilit ekranı içeriği gizli kalmalıdır. Sistem izni kapalıysa Bildirimler tercihleri durumu açıkça göstermeli ve kullanıcıyı işletim sistemi ayarlarına taşımalıdır. Ham tarama/ağ tanısı sistem paneline çıkarılmamalı; ayrıntı yalnız uygulama içinde gösterilmelidir.

Kapalı uygulama teslimi yalnız önceden bilinen tarihler için işletim sistemine
planlanır. Borç/ödeme vadelerine ek olarak tamamlanmamış birikim hedefi
`90/30/14/7/3/1/0` gün kala, aktif bütçe dönemi ise `%50/%75/%90`
noktalarında sınırlı bir kontrol uyarısı üretir. Bu alarmlar dikkat kanalını
kullanır; ilgili bildirim kanalı sessize alındığında eski plan iptal edilir.
Harcama ve kategori limitleri ancak yeni yerel kayıt geldiğinde yeniden
hesaplanabildiği için sahte arka plan takibi vaat etmez; eşik uyarısı işlemin
kaydedildiği senkronizasyonda teslim edilir. İlk kurulumda uygulamanın bir kez
açılması ve Android izninin verilmesi gerekir. Sistem tarafından **Zorla
durdurulan** uygulamanın alarm teslimi garanti edilmez.

Planlı bir alarm ailesinin uygulama açılışında hesaplanan `yaklaşıyor`, `bugün`,
`tarihi geçti`, hedef kilometre taşı veya bütçe kontrol karşılığı uygulama-içi
geçmişi tamamlayan bir **feed catch-up** kaydıdır; yeni bir sistem tepsisi
bildirimi değildir. Gerçek gelecek alarmı Android'e daha önce kurulmuşsa aynı
olay uygulama açıldığında ikinci kez sunulmaz. Geçmiş tarihli bir kayıt için de
uygulama açıldığı anda sahte biçimde “zamanında uyarılmış” izlenimi yaratılmaz.
Bildirim tercihleri planlanan gerçek Android istek sayısını, sıradaki zamanı ve
uyarı kanalının kapalı/düşük öncelikli durumunu gösterir; eksik planlar kullanıcı
tarafından yeniden uzlaştırılabilir.

### 5.6 Yedekleme ve geri yükleme

Kullanıcı taşınabilir bir yedek oluşturabilir. Geri yüklemede bütün veri önce doğrulanır; hata halinde kısmi kayıt bırakılmaz. Eski desteklenen formatlar okunabilir, desteklenmeyen yeni formatlar açık hata ile reddedilir.

Yedek hatırlatması mevcut tasarımda uygulama açılışında/yenilenmesinde hesaplanan
feed kuralıdır; kapalı uygulamayı uyandıran native alarm olarak vaat edilmez.
Hatırlatma tercihi, başarılı export ve restore sonrası bildirim durumu hemen
yenilenir. Restore ile gelen borç veya onaylı ödeme planlarının gelecekteki
native alarmları aynı uzlaştırmada kurulurken, bildirim hatası atomik olarak
tamamlanmış restore'u kullanıcıya başarısız göstermez.

### 5.7 Borç vadesi ve ödeme hatırlatıcıları

Borç kaydının bütçe etkisini belirleyen işlem tarihi ile kullanıcının ödeme sözü
olan vade tarihi aynı kavram değildir. Düzenli ödeme tahmini de kullanıcı
tarafından onaylanmış bir hatırlatıcı sayılmaz. Kalıcı hatırlatıcı; kullanıcı
kararı, tekrar başlangıcı, sıradaki vade ve tercih edilen uyarı zamanını ayrı
tutar. Android'de bu kalıcı kayıttan türetilen tek-seferlik alarmlar uygulama
kapalıyken de OS tarafından teslim edilmek üzere planlanır; kalıcı kayıt yetkili,
native alarm ise iptal edilip yeniden kurulabilen ikincil bir yan etkidir.

Borç oluşturma yüzeyi vade tarihini opsiyonel tutar ve bu tarihi borcun nakit-akış
tarihinden açıkça ayırır. Hatırlatma tercihi ancak vade varken etkinleştirilebilir;
vadenin kaldırılması tercihi de kapatır. Kullanıcı açık bir borcun vade ve
hatırlatma ayarlarını geri ödeme işleminden ayrı bir yüzeyde değiştirir.
Açık borç listesi yaklaşan, bugün olan ve gecikmiş vadeyi yalnız renkle değil
ikon ve metinle gösterir. Bu tercih yüzeyi, seçilen yerel zaman için Android
alarmı kurulduğunu ve cihazın pil/bildirim politikasının teslimi
geciktirebileceğini açıkça belirtir.

Abonelikler ekranı kullanıcı tarafından onaylanmış **Ödeme planlarım** ile işlem
geçmişinden türetilmiş **Algılanan ödemeler** alanlarını birbirinden ayırır.
Algılanan bir ödeme ancak kullanıcı plan formunu gözden geçirip açıkça
kaydettiğinde kalıcı plana dönüşür. Kullanıcı manuel plan oluşturabilir; tutar,
para birimi, sıradaki ödeme, tekrar aralığı ve hatırlatma tercihini düzenleyebilir;
planı veri kaybetmeden duraklatabilir veya onayla silebilir. Çok alanlı ödeme
planı formu geçici bottom sheet değildir; safe-area başlığı sabit kalan, klavye
açıldığında yalnız gövdesi daralıp dikey kaydırılabilen tam ekran bir akıştır.
Analiz'deki **Aktif Abonelikler** kartı yalnız otomatik tahmin tablosunu değil,
kullanıcının kaydettiği etkin ödeme planlarını da gösterir. Aynı satıcı hem
onaylı planda hem otomatik tespitte bulunuyorsa kullanıcı kararı kanoniktir ve
kartta tek kez yer alır; tutarı belirtilmeyen plan sıfır tutarlıymış gibi
sunulmaz. Aylık yük, planın gün/hafta/ay/yıl tekrar aralığından 30 günlük
karşılığa normalize edilir.
Duraklatılmış plan gizlenmez. Etkin plan için mevcut ve sonraki gerçek takvim oluşumları sınırlı
bir rolling horizon içinde planlanır; uygulama her açılış, resume ve veri
değişikliğinde bu pencereyi yeniler.

Uygulama içi bildirim motoru açık ve bakiyeli borçları, ayrıca yalnız kullanıcı
tarafından kaydedilmiş etkin ödeme planlarını değerlendirir. Bildirim; yaklaşan
ve bugün aşamalarının ilk ilgili gününde seçilen yerel saati bekler; planlanan
uyarı anı önceki bir takvim gününde kaldıysa aynı saati yeniden beklemez. Borcun
geciktiği kanonik bakiyeden bilinebilir; ödeme planında gerçekleşen ödeme
izlenmediği için geçmiş tarih metni yalnız planlanan tarihin geçtiğini söyler.
Kapanan borç, duraklatılan/silinen plan veya değiştirilen vade eski türev kartı
aktif uyarı olarak bırakmaz. Tahmine dayalı abonelikler ayrı “Tahmin” kanalında
kalır; aynı satıcı açıkça ödeme planına dönüştürüldüğünde çift bildirim üretmez.
Borç, ödeme planı ve tahmin kanalları ayrı ayrı filtrelenip sessize alınabilir.
Native scheduler borçta yaklaşan ve vade-günü alarmını, düzenli ödemede ise 400
günlük pencere içinde en çok 14 oluşumu planlar; toplam native istek 512 ile
sınırlı ve varlıklar arasında adil seçilir. Geçmiş plan cursor'ı ödeme yapılmış
sayılmadan yalnız sıradaki gerçek oluşuma ilerletilir. Faz 5 exact-alarm özel
izni istemez: Android Doze/OEM politikası dakikayı geciktirebilir; force-stop ve
uygulama kapalıyken saat dilimi değişimi Faz 6 fiziksel APK kabulünde açık
platform sınırı olarak doğrulanır. Gecikmiş ama hâlâ bekleyen native alarm önce
iptal edilir; aynı kanonik kayıt uygulama açıldığında yeni bir sistem bildirimi
olarak değil, yalnız uygulama-içi geçmişte catch-up olarak görünür. Alarm iptal
edilemezse ikinci alarm kurulmaz. Yaz saati başlangıç
boşluğuna denk gelen yerel saat aynı günün ilk geçerli ileri saatine taşınır ve
occurrence tamamen kaybolmaz.

### 5.8 Kanonik ürün ve benzer ürün yönetimi

Aynı fiziksel ürünün yalnız yazım, aksan, OCR kısaltması, güvenli çekim eki
veya kg/L satış biriminin ada eklenmesi yüzünden ayrı fiyat serisine düşmesi
engellenir. Kimlik çözümü cihazda ve ölçü birimine duyarlı çalışır. Adet, kg ve
litre kayıtları hiçbir koşulda ortak seriye alınmaz; adet satılan `500 g` paket
ile tartıyla satılan `0.5 kg` ürün de otomatik olarak eş sayılmaz. Marka, aroma,
yağ oranı, kesim türü, varyant ve paket büyüklüğü ürünün ayırt edici parçasıdır.

Fişte basılı ürün adı ve ilk çeviri korunur. Kullanıcının yalnız görünümü
düzeltmek için yazdığı etiket ayrı tutulur; böylece hem okunabilir ad hem kaynak
fiş kanıtı birlikte görülebilir. Analizler mümkün olduğunda kalıcı ürün kimliğini,
eski veya belirsiz kayıtta ise güvenli yerel geri düşüşü kullanır.

**Benzer ürünleri düzenle** yüzeyi, kullanıcıya aynı ölçüdeki adayları
birleştirme, öğrenilmiş bir adı yeniden ayırma ve kanonik görünen adı düzeltme
olanağı verir. İsteğe bağlı AI düğmesi yalnız iki sınırlı metin adayını
karşılaştırıp açıklanabilir bir öneri sunar; sonucu uygulama kararı kullanıcıya
aittir. Merge/split işlemi satır tutarı, miktarı, birim fiyatı, tarihi veya ham
adları silmez. Böylece yanlış bir seçim ilgili alias ayrılarak geçmiş fiyat
gözlemleri kaybedilmeden düzeltilebilir.

Bu yüzey büyüyen ürün arşivini tek ve sonsuz bir kart akışı gibi sunmaz.
Varsayılan görünüm, cihazda hesaplanan güçlü **olası eşleşmeleri** küçük bir
inceleme kuyruğunda öne çıkarır. Kuyruktaki benzerlik yalnız sıralama önerisidir;
ürünleri otomatik birleştirmez ve ekran açılırken AI çağrısı yapmaz. Kullanıcı
isterse **Tüm ürünler** görünümüne geçer; ürünler sanallaştırılmış listede son
aktiviteye göre 0–30, 31–90, 91–365, 365 günden eski ve satın alma geçmişi
olmayan gruplara ayrılır. Arama; kanonik ad, öğrenilmiş ad, ham/çevrilmiş fiş adı
ve kullanıcı etiketini kapsar. Ölçü, tarih ve son görülme/sıklık/alfabetik
sıralama kontrolleri birlikte kullanılabilir. İlk ürün seçildiğinde ikinci seçim
yalnız aynı kanonik ölçü birimindeki ürünlerle sınırlandırılır.

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
9. **Tamamlanmamış gün kesin sonuç değildir.** Bugün, tamamlanmış-gün istatistiğinin paydasına veya sıfır/hedef-altı sayısına eklenmez; bugünkü harcama aktif sıfır-harcama serisini kesebilir ve geçmiş dönem serisi dönem sonuna göre açıklanır.
10. **Para değerleri kuruş hassasiyetinde deterministiktir.** Harcama, fiş satır toplamı ve indirimler iki ondalıklı alt birimlerle hesaplanır; kayan nokta artığı kullanıcıya gösterilmez veya kalıcı finansal sonuca dönüşmez. Birim fiyat, ağırlıklı ürünler için daha hassas tutulabilir; ödenecek satır ve fiş toplamı daima para biriminin iki ondalıklı sonucuna kapanır.
11. **Hedef ve kategori limiti bağımsız kayıtlardır.** “Hedefi sil” yalnız gerçekten var olan birikim hedefini kaldırır; kategori limitlerini sessizce silmez. Kayıt yoksa yıkıcı eylem sunulmaz ve eskimiş ekran durumunda sahte başarı gösterilmez.
12. **Dashboard önceliği kontrollüdür.** Açık borç uyarısı isteğe bağlı hedef özetinden önce gelir; aktif hedef kompakt veya tam karttan yalnız biriyle gösterilir ve görünüm tercihi finansal veriyi değiştirmez.
13. **Hatırlatma taahhüdü tahminden ayrıdır.** Türetilmiş abonelik önerisi kullanıcı onayı olmadan kalıcı ödeme hatırlatıcısına dönüşmez; borç vadesi borcun işlem tarihini veya bütçe etkisini değiştirmez.
14. **Kategori sınırı hedeften bağımsız ve erişilebilir olmalıdır.** Kullanıcı birikim hedefi oluşturmadan aylık kategori harcama sınırı kaydedebilir; giriş yolu Bütçe ve Analiz yüzeylerinde görünürdür. Fiyat değişimi özeti, kart yüksekliğini büyütmeden altılı yatay sayfalarda tüm değişimlere eriştirir; kart içindeki yatay jest üst sekme gezinmesine devredilmez. Satıcı özeti de ilk beşten başlayarak sabit yükseklikte yatay sayfalanır; satıcıya dokunmak ana kartı büyütmez, donut ve ürün analizi ayrı bir yüksek alt panelde açılır. Satıcı ürünleri panel içinde beşerli yatay sayfalarda sunulur ve kullanıcı sıralamayı alım sayısı veya toplam harcama olarak açıkça seçebilir. Fiyat karşılaştırması ürün adıyla birlikte kanonik ölçü türünü kullanır; adet, kg ve litre serileri karıştırılmaz, g/ml girişi anlaşılır gösterilip kanonik tabana çevrilir. Analiz kartı başlıklarında ikon ve metin aynı optik ekseni paylaşır. Projeksiyon şeridi veri göstergesidir, kullanıcı ayarı değildir; bütçe eşiği dolgu üzerinde ve uç konumlarda da kontrastlı görünür.
15. **Analiz güveni görünür ve karşılaştırma eş olmalıdır.** Harcama kaydı olmayan gün başarı etiketi değildir; kısa takip geçmişi başarı/seri üretmez ve kapsam sayısı kullanıcıya gösterilir. Devam eden harcama dönemi, önceki dönemin aynı sayıda tamamlanmış günüyle karşılaştırılır; bugün ve gelecek günler toplamlara katılmaz. Veri yükleme hatası ile geçerli `0 harcama` sonucu ayrıdır. İlgili veri bulunmayan opsiyonel analiz kartları boş yüzey olarak yer kaplamaz.
16. **Ürün kimliği ölçüye bağlı ve geri düzeltilebilir olmalıdır.** Güvenli yazım farkları kalıcı canonical ürün ve aliaslarla toplanabilir; fuzzy benzerlik, ortak ürün ailesi veya AI önerisi kullanıcı onayı olmadan semantik merge yapamaz. Ham `name`/`turkish_name` korunur, kullanıcı etiketi ayrıdır ve merge/split hiçbir finansal gözlemi silmez.
17. **Geçersiz AI çıktısı finansal kayıt değildir.** Seçili dil yalnız görünüm metnini değil fiş çeviri sözleşmesini belirler; kategori anahtarı dilden bağımsızdır. Eksik satıcı/tarih/kalem/tutar veya kanıtsız sıfır toplam kaydedilemez ve Detaylı Düzenle boş/sıfır bir harcamayı otomatik oluşturamaz. İşlem listesi her kaydın kendi para birimini gösterir.

Ayrıntılı teknik sözleşmeler için [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ve karar kayıtları kullanılır.

## 7. Tasarım dili

### Görsel kimlik

- Temel kimlik: sakin nötr yüzeyler, ölçülü cam hissi ve kullanıcı tarafından seçilebilen kontrollü vurgu rengi
- Görünüm ile vurgu iki ayrı tercihtir: açık/koyu/otomatik görünüm yüzey ve metin kontrastını; vurgu paleti birincil eylem, aktif sekme ve seçili kontrol kimliğini belirler
- Desteklenen vurgu ailesi beş küratörlü seçenektir: SPARK yeşili, okyanus mavisi, kehribar turuncusu, menekşe moru ve yakut kırmızısı
- Başarı, tehlike, uyarı ve bilgi renkleri kullanıcı vurgusundan bağımsız semantik anlamlarını korur; kategori ve grafik serisi renkleri de veri kimliğini kaybetmemek için yeniden renklendirilmez
- Uygulama ikonu ve splash kimliği SPARK markasına bağlı kalır; kullanıcı paleti bunları yeniden boyamaz. Uygulama içindeki tipografik imza ise aşağıdaki kontrollü sözleşmeyle aktif vurguyu kullanabilir
- Açık ve koyu temada aynı bilgi hiyerarşisi
- Birincil CTA: `susevar` sözleşmesine ve kontrastı doğrulanmış `primaryAction`/`onPrimary` çiftine bağlı, belirgin fakat ekranı domine etmeyen eylem
- Kartlarda düzenli hizalama, tutarlı radius, sınır ve iç boşluk
- İkonlarda işlevsel boyut ve optik denge; dekoratif büyüklükten kaçınma

Kod tarafındaki kesin renk, tipografi ve spacing değerlerinin kaynağı `src/theme/` dizinidir.

**SPARK Yaşayan Çekirdek İmzası**, uygulama ikonu veya splash değil, uygulama
içinde Dashboard başlığında ve Ayarlar kimlik alanında kullanılan ortak tipografik
wordmark'tır. Harfler tok, sıkı optik ritimli ve sabit kalır; yerleşim, ölçek
veya okunabilirlik animasyonla değiştirilmez. Platform kerning'ine bırakılmış
tek metin yerine beş harf eşit merkez aralığına, dört nokta da ayrı vektör
öğeleri olarak yerleşir. Noktalar gerçek glyph yan boşluklarına göre optik
dengelenir; özellikle `S` ve `P` sonrasındaki ilk iki nokta matematiksel orta
noktadan ölçülü biçimde sola alınır, son iki nokta geometrik ortayı korur.
Görünür ilk harf Dashboard içerik hizasından başlar. Seçili vurgu ailesinin
koyu/ana/açık tonları harf yüzeyini ve bütün hareket katmanlarını kurar; saf
beyaz veya sert, dikdörtgen renk bandı kullanılmaz. “A” çevresinde karşı
yönlerde dolaşan iki düşük yoğunluklu sis çekirdeği, yarım faz arayla merkezden
organik biçimde büyüyüp görünmez olan iki eliptik enerji dalgası ve soldan-sağa
ile sağdan-sola sürekli akan iki yumuşak renk çekirdeği farklı sürelerde birlikte
çalışır. Üç UI-thread saati sırasıyla yaklaşık `6,2`, `3,8` ve `5,4` saniyede bu
altı görünür primitive'i sürer; dokunma olmasa da wordmark tamamen durağan bir
ana düşmez. Canlı AI hissi harflerin içinde kalır;
dışarı taşan
neon, blur/filter, parçacık kalabalığı, hızlı parlama veya sürekli dikkat talebi
üretmez. İmzanın tamamı tek dokunma hedefidir; dokunma navigasyon veya veri
eylemi yapmadan “A” merkezinde kısa bir uyanma parlamasını ve iki ayrı organik
çekirdek olarak sola/sağa yayılan tek seferlik tepkiyi anında yeniden başlatır.
Ekran odağını kaybettiğinde
ya da uygulama arka plana geçtiğinde hareket durur; sistemde hareket azaltma
açıksa hem ortam hem dokunma hareketi statik kalır. Ekran okuyucu katmanları
ayrı ayrı değil, yerelleştirilmiş dokunma ipucuyla tek “S.P.A.R.K” kontrolü
olarak okur. Uygulama ikonu ve splash bu wordmark'tan türetilmez ve vurgu
seçimine göre değişmez. Ortak bileşendeki klasik varyant, insan görsel kabulü
olumsuzsa ekran yapılarını geri sökmeden güvenli sunum geri dönüşü sağlar.

İç hareketin okunabilir yüzeyini büyütmek için hero imzada harf boyutu `32`,
kontur `1,2` ve harf merkez adımı `30` birimdir; kompakt imzada karşılıkları
`29`, `1,2` ve `27` birimdir. Bu sıkı ve tok geometri animasyon sırasında ölçek
değiştirmez; noktalar aynı optik düzeltme sözleşmesine göre yeniden hizalanır.

Aydınlık temada beyaz yüzeyin kontrastı koyu uç tonlarını olduğundan daha durağan
gösterdiği için `S` ve `K` temel yüzeyi ana vurgu tonunda tutulur; iki sis
çekirdeğinin yatay hareket alanı da uç harf merkezlerini kapsayacak şekilde
genişler ve opaklığı ölçülü artırılır. Bu, uçları merkezden koparmadan yaşayan
hareketi bütün imzaya dağıtır. Karanlık temada insan tarafından onaylanan koyu
uç gradyanı, hareket mesafesi ve yoğunluk korunur.

**Spark Dörtlü Periyot Anahtarı**, ileride uygun bir kartta yeniden kullanılmak
üzere adlandırılmış görsel şemadır: yuvarlatılmış tek bir ray, dört eşit bölüm,
yüzeyden hafifçe yükselen açık aktif kapsül ve `W / M / 3M / ALL` gibi kısa
etiketlerden oluşur. Bu ad yalnız tasarım tarifidir; veri aralıklarının anlamı
uygulanacağı karta göre ayrıca belirlenmelidir. Kullanıcı talebi üzerine Harcama
Takvimi denemesi geri alınmıştır ve bu kart şu anda bu şemayı kullanmaz.

Vurgu tercihi cihazda yerel bir kişiselleştirmedir. Finansal veri değildir,
cihazlar arası görünüm sözü vermez ve taşınabilir yedek biçimine eklenmez.
Eksik veya artık tanınmayan bir tercih güvenli biçimde SPARK yeşiline döner.

Genel Ayarlar'da görünüm ve vurgu ayrı, doğrudan sayfa bölümlerinde yönetilir. Görünüm
bölümü yerleşik tam genişlikte otomatik zamanlama kontrolünü korur; otomatik mod
kapalıyken yalnız Açık ve Koyu seçeneklerini gösterir. Vurgu kartı beş ayrı
dikey ayar satırı üretmez: renkler yatay kaydırılan ve her adımda merkeze oturan
bir seçicide sunulur. Seçici, gerçek görünür genişliğe göre aralık ve kenar
boşluğunu uyarlayarak ilk, orta ve son rengin aynı sabit merkez halkasına optik
olarak oturmasını sağlar. Kullanıcı bir renk kademesini geçtiğinde önizleme
hemen değişir ve desteklenen cihazda tek, kısa bir dokunsal tık ile yerel kısa
mekanik mandal sesi aynı etkileşim adımında best-effort olarak üretilir. İlk
`CLOCK_TICK` denemesi hedef Samsung cihazda fazla hafif kaldığı için Android,
kademe başına daha tok tek vuruşlu `CONTEXT_CLICK`; iOS ise `RIGID` impact
kullanır. Ses; bas gövdesi, ikinci mandal ve uzun rezonans içermeyen 12 ms'lik
tiz ve kuru bir “tik”tir. Yaklaşık 96 dp yuva mesafesi, 100 ms geri bildirim
aralığı ve kuvvetli kaydırma freni renklerin fazla hızlı geçmesini ve vuruşların
birbirine karışmasını önler. Kalıcı tercih
yalnız son snap konumunda bir kez yazılır. Programatik ilk konumlandırma,
rollback ve dışarıdan gelen tercih eşitlemesi geri bildirim üretmez. Ses,
platformun desteklediği ölçüde sistem sessizliği/medya ayarlarına saygı gösterir
ve seçim ekranı yeniden açıldığında kalıcı vurgu, ray konumu, merkez halkası ile
etiket içerik ölçümü tamamlandıktan sonra yeniden aynı kademede uzlaştırılır.
Açık görünümdeki gösterim tonları, nötr yüzey üzerinde kirli veya mat görünmemesi
için canlı tutulur; dolu CTA'lar ise okunabilirliği koruyan ayrı koyu
`primaryAction` tonlarını kullanır.
ve ses ya da haptic kullanılamadığında renk seçimini engellemez. Kısa bölüm
yalnız seçim görevine ayrılır; uzun
açıklamalar başlıktaki bilgi eyleminden açılan ayrı modalda tutulur.

Ayar bilgi mimarisi işin anlamına göre ayrılır. **Bütçe ve planlama**; bütçe,
birikim hedefi, kategori limitleri ve kullanıcı tarafından yönetilen düzenli
ödeme planlarını içerir. **Veri ve yedek** yalnız satıcı verisi, dışa aktarma,
geri yükleme ve veri yaşam döngüsü işlemlerini taşır. Kira ve internet gibi
düzenli ödemeler yalnız abonelik olmadığı için yönetim girişi **Düzenli
ödemeler** olarak adlandırılır. Bir ayarın açıklaması aynı karttaki bilgi
eyleminde zaten bulunuyorsa kontrol satırında ikinci kez gösterilmez; kısa başlık
ve doğrudan kontrol korunur.

Ayarlar ana ekranındaki **Genel**, **Bütçe ve planlama**, **Veri ve yedek** ve
**Yapay zekâ** girişleri de kalıcı kart kabuğu kullanmaz. Renkli kimlik ikonu,
başlık, sarmalanabilen kısa açıklama ve yön oku korunarak doğrudan sayfa zemininde
tam genişlikte satırlar ve ince ayırıcılarla sunulur; yalnız basılı durumda geçici
tonal geri bildirim oluşur. SPARK kimlik alanı menüden yeni bir kartla değil,
belirgin bir nefes boşluğuyla ayrılır. Bu grupların iç sayfaları da aynı kart-dışı
hiyerarşiyi sürdürür: içerik doğrudan sayfa zemini üzerinde boşluk, tipografi ve
ince ayırıcılarla gruplanır; başka bir ekrana giden öğeler tam genişlikte düz ayar
satırlarıdır. Metin girişi, tarih seçimi, çip, anahtar ve birincil eylem gibi
gerçek kontroller kendi etkileşim sınırlarını korur. Yedek sonucu gibi özel bir
durum, genel kart yerine sınırlı tonal veya kenar vurgulu durum şeridi
kullanabilir. Bu ayrım Dashboard ve Analiz'deki veri kartlarıyla Ayarlar'daki
görev odaklı düzenin psikolojik ve görsel olarak birbirine karışmasını engeller.

**Satıcı Yönetimi** tekli düzenleme ve uzun basarak silme davranışlarını korurken
açık bir çoklu seçim moduna da sahiptir. Bu mod seçili satıcı sayısını gösterir;
tümünü seçme, seçimi temizleme ve iptal eylemlerini tek yerde sunar. Toplu silme
isteği doğrudan veri değiştirmez: önce seçili satıcı sayısı ile bunlara bağlı
işlem sayısını açıklayan geri alınamazlık onayı gösterilir. Kullanıcı onayladıktan
sonra satıcılar ve bağlı işlemler tek atomik veritabanı işlemiyle kaldırılır.

### Etkileşim ilkeleri

- Ana eylem ilk bakışta anlaşılmalı; ikincil eylemler görsel gürültü yaratmamalıdır.
- Dashboard kişiselleştirmesi kritik finansal öncelikleri bozmamalı; kullanıcı tercihi bir kartı öne çıkarabilir fakat aynı bilgiyi tekrarlamamalı veya açık borç uyarısını aşağı itememelidir.
- Okunmamış bildirim, kalın bir yan şerit yerine hafif tonal yüzey, ince sınır, güçlendirilmiş başlık ve küçük durum noktasıyla belirtilmelidir; durum ekran okuyucu etiketinde de açıkça söylenmelidir.
- Silme gibi geri alınması zor eylemler kasıtlı bir jest, seçim veya onay gerektirir.
- Silme onayı sakin ve tema uyumlu bir karar penceresidir: tek semantik ikon, açık başlık ve geri alınamazlık metni kullanır; yalnız yıkıcı onay düğmesi kırmızı vurgulanır. HUD köşeleri, tarama çizgisi, yoğun kırmızı parlama veya başlık/düğme tekrarıyla kullanıcıyı gereksiz yere alarm durumuna sokmaz.
- Swipe, uzun basma, scroll ve pull-to-refresh aynı yüzeyde birbirini kilitlememelidir.
- Toast ve popup geri bildirimi içeriği örterek veya ekranı karartarak cezalandırmamalıdır.
- Animasyonun başlangıç ve bitiş yüzeyleri aynı tema bağlamında olmalıdır; beyaz/siyah ara kare kabul edilmez.
- Sekme yöneticisinin scene yüzeyi ve henüz yüklenmemiş lazy placeholder'ı da aktif uygulama temasında opak olmalıdır; komşu veya atlanan sekme geçişte varsayılan sistem rengini gösteremez.
- Safe area, sistem gesture alanı, font scaling ve dokunma hedefleri cihaz çeşitliliğiyle değerlendirilmelidir.

### Veri görselleştirme

- Etkileşimli grafiklerde seçilen gözlemin ayrıntısı veri noktalarını veya eksenleri örtmeyen ayrılmış bir alanda gösterilmelidir.
- Seçim başka noktaya dokunma, seçili noktaya yeniden dokunma, açık bir kapatma eylemi veya ürün/veri bağlamının değişmesiyle öngörülebilir biçimde temizlenmelidir.
- Grafik çizgileri gözlenmemiş tepe veya dipler üretmemeli; para değerleri karar için gerekli hassasiyeti ve aktif para birimi biçimini korumalıdır.
- Yoğun veride dokunma alanları birbirinin eylemini çalmamalı; grafik etkileşimi bulunduğu scroll ve modal gesture'larını kilitlememelidir.
- Yoğun seriler sadeleştirilecekse ham geçmiş erişilebilir kalmalı; ilk/son gözlem, kaynak gözlem konumu ve gerçek uç değerler korunmalı, ortalama veya yapay nokta üretilmemeli ve gösterilen/kaynak kayıt sayısı kullanıcıya açıklanmalıdır.
- Zaman grafiğindeki ayrık yakınlaştırma kademeleri deterministik olmalıdır. Günlük dalgalanma görünümünde tüm dönem, 14 gün ve 7 gün pencereleri en güncel tarihten geriye hizalanır; yalnız en eski sayfa eksik gün içerebilir. Kademe değişimi incelenen sayfanın sağ uç tarihini korur, görünen tarih aralığı ile sayfa sayacı aynı durumdan üretilir ve yalnız görünüm değişti diye veri giriş animasyonu yeniden oynatılmaz.
- Sıralı analiz kartları seçim veya gruplama kuralını başlık ve kısa açıklamayla dürüstçe belirtmelidir; yıllık uzun dönem özetleri aynı satıcının tekrarları yerine satıcı başına en yüksek tek gerçek işlemi gösterebilir.
- Devam eden dönem karşılaştırmaları eş ilerleme kullanmalı; kart karşılaştırılan iki gerçek tarih aralığını göstermeli ve bütçe yerine harcama toplamı kullandığını başlığıyla açık etmelidir.
- En yüksek işlemler kartı odağını kaybetmemesi için yalnız ilk 10 sonucu beşerli iki yatay sayfada; sessiz harcamalar ise en yüksek toplam etkili ilk 15 kalemi beşerli en fazla üç sayfada sunar. Her iki iç pager yatay hareket sırasında üst sekme geçişini geçici olarak kilitler ve kart yüksekliği sayfalar arasında değişmez.
- Yıllık görünümde anlamını kaybeden aylık projeksiyon kartları boş açıklama yüzeyi olarak yer kaplamamalıdır; kısa ve özel aralıklarda mevcut yönlendirici açıklama korunabilir.
- Seçili durum yalnız renkle aktarılmamalı; tarih, değer ve bağlam için erişilebilir bir metin karşılığı bulunmalıdır.

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
| Tema kişiselleştirmesi | Beş vurgu × açık/koyu görünüm kontrastı, anlık geçiş, yeniden başlatma kalıcılığı ve flicker/remount cihaz kontrolü |
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
- AI ürün eşleştirme önerisi yalnız kullanıcı tarafından başlatılır; çevrimdışı yerel eşleştirme ve kullanıcı düzeltmesi temel davranış olarak kalır.
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
