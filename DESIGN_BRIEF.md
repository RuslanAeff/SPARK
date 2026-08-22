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
| Dashboard | Aktif bütçe döngüsünün harcanan, kalan ve nakit-akışı etkisini özetler; kullanıcı isterse aktif birikim hedefini kompakt biçimde öne çıkarır |
| İşlemler | Harcamaları listeler, arar, filtreler, düzenler ve çoklu seçime izin verir |
| Fiş tarama | Kamera veya galeriden alınan fişi sıkıştırır, isteğe bağlı Gemini ayrıştırmasına ve kullanıcı önizlemesine sunar |
| Analiz | Kategori, satıcı, zaman ve davranış odaklı kartlarla finansal örüntüleri gösterir |
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
3. Gemini yapılandırılmış fiş verisi önerir.
4. Yanıt doğrulanır, temizlenir ve satırlar birleştirilir.
5. Kullanıcı önizlemeyi kabul eder veya düzenlemeye geçer.
6. Fiş başlığı ve kalemleri tek atomik işlemle kaydedilir.

AI sonucu doğrudan finansal gerçek kabul edilmez. Kullanıcı kontrol noktası akışın zorunlu ürün ilkesidir.

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

### 5.6 Yedekleme ve geri yükleme

Kullanıcı taşınabilir bir yedek oluşturabilir. Geri yüklemede bütün veri önce doğrulanır; hata halinde kısmi kayıt bırakılmaz. Eski desteklenen formatlar okunabilir, desteklenmeyen yeni formatlar açık hata ile reddedilir.

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
platform sınırı olarak doğrulanır. Gecikmiş ama hâlâ bekleyen native alarm
başarıyla iptal edilirse uygulama açıkken aynı kanonik kayıt anlık fallback ile
teslim edilebilir; iptal edilemezse ikinci alarm kurulmaz. Yaz saati başlangıç
boşluğuna denk gelen yerel saat aynı günün ilk geçerli ileri saatine taşınır ve
occurrence tamamen kaybolmaz.

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

Ayrıntılı teknik sözleşmeler için [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ve karar kayıtları kullanılır.

## 7. Tasarım dili

### Görsel kimlik

- Temel kimlik: sakin nötr yüzeyler, ölçülü cam hissi ve kullanıcı tarafından seçilebilen kontrollü vurgu rengi
- Görünüm ile vurgu iki ayrı tercihtir: açık/koyu/otomatik görünüm yüzey ve metin kontrastını; vurgu paleti birincil eylem, aktif sekme ve seçili kontrol kimliğini belirler
- Desteklenen vurgu ailesi beş küratörlü seçenektir: SPARK yeşili, okyanus mavisi, kehribar turuncusu, menekşe moru ve yakut kırmızısı
- Başarı, tehlike, uyarı ve bilgi renkleri kullanıcı vurgusundan bağımsız semantik anlamlarını korur; kategori ve grafik serisi renkleri de veri kimliğini kaybetmemek için yeniden renklendirilmez
- Uygulama logosu ve splash kimliği SPARK markasına bağlı kalır; kullanıcı paleti bunları yeniden boyamaz
- Açık ve koyu temada aynı bilgi hiyerarşisi
- Birincil CTA: `susevar` sözleşmesine ve kontrastı doğrulanmış `primaryAction`/`onPrimary` çiftine bağlı, belirgin fakat ekranı domine etmeyen eylem
- Kartlarda düzenli hizalama, tutarlı radius, sınır ve iç boşluk
- İkonlarda işlevsel boyut ve optik denge; dekoratif büyüklükten kaçınma

Kod tarafındaki kesin renk, tipografi ve spacing değerlerinin kaynağı `src/theme/` dizinidir.

Vurgu tercihi cihazda yerel bir kişiselleştirmedir. Finansal veri değildir,
cihazlar arası görünüm sözü vermez ve taşınabilir yedek biçimine eklenmez.
Eksik veya artık tanınmayan bir tercih güvenli biçimde SPARK yeşiline döner.

Genel Ayarlar'da görünüm ve vurgu ayrı, kompakt kartlarla yönetilir. Görünüm
kartı yerleşik tam genişlikte otomatik zamanlama kontrolünü korur; otomatik mod
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
ve ses ya da haptic kullanılamadığında renk seçimini engellemez. Kısa kart yüzeyi
yalnız seçim görevine ayrılır, uzun
açıklamalar başlıktaki bilgi eyleminden açılan ayrı modalda tutulur.

Ayar bilgi mimarisi işin anlamına göre ayrılır. **Bütçe ve planlama**; bütçe,
birikim hedefi, kategori limitleri ve kullanıcı tarafından yönetilen düzenli
ödeme planlarını içerir. **Veri ve yedek** yalnız satıcı verisi, dışa aktarma,
geri yükleme ve veri yaşam döngüsü işlemlerini taşır. Kira ve internet gibi
düzenli ödemeler yalnız abonelik olmadığı için yönetim girişi **Düzenli
ödemeler** olarak adlandırılır. Bir ayarın açıklaması aynı karttaki bilgi
eyleminde zaten bulunuyorsa kontrol satırında ikinci kez gösterilmez; kısa başlık
ve doğrudan kontrol korunur.

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
