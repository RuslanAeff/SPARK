# ADR-010: Kanonik ürün kimliği ve kullanıcı kontrollü eşleştirme

- **Status:** Accepted
- **Kayıt türü:** Prospective
- **Kayda geçirildi:** 23 Ağustos 2026

## Bağlam

Fişlerde aynı fiziksel ürün; OCR kısaltması, büyük/küçük harf, aksan, çekim eki,
çeviri veya sonuna yazılmış satış birimi nedeniyle farklı adlarla gelebilir.
Yalnız normalize edilmiş metinle gruplama, aynı ürünün fiyat geçmişini böler.
Öte yandan fuzzy benzerlik veya ortak bir üst aileye dayanmak; farklı marka,
aroma, yağ oranı, tavuk kesimi ya da paket büyüklüğünü yanlışlıkla tek üründe
birleştirebilir. Bu ikinci hata, finansal analizde sessiz ve geriye dönük bir veri
yorumu değişikliği oluşturduğu için daha yüksek risklidir.

ADR-009 satış ölçüsünü ve fiyat karşılaştırma tabanını belirledi. Bu kayıt,
ölçü birimi değişmezini koruyarak ürün adlarının hangi kalıcı kimlikle
gruplandığını ve belirsiz eşleşmelerde insan ile AI'nın yetki sınırını tanımlar.

## Karar

1. Ürün etiketi önce cihazda, deterministik ve ölçü-birimine duyarlı
   `canonicalizeProductLabel` kurallarıyla çözümlenir. Unicode/yazım temizliği,
   gözden geçirilmiş güvenli token eşleri ve `kg`/`l` satılan üründeki çıplak son
   satış birimi normalize edilebilir. Marka, varyant, aroma, yağ oranı, kesim
   türü ve sayısal paket tanımı korunur; fuzzy benzerlik otomatik birleştirme
   gerekçesi değildir.
2. Kalıcı kimlik `canonical_products`, öğrenilmiş adlar `product_aliases`
   tablolarında tutulur. `expense_items.canonical_product_id` nullable foreign
   key'dir. Grup anahtarı, bağlantı varsa `canonical_product_id +
   measurement_unit`; bağlantı yoksa yalnız güvenli deterministik etiket ve
   ölçü birimi geri düşüşüdür.
3. Çözüm sırası tam alias, tek ve çelişkisiz deterministik anahtar, ardından yeni
   kanonik ürün şeklindedir. Migration belirsiz birden fazla aday gördüğünde
   seçim yapmaz ve bağlantıyı kullanıcı kararına kadar boş bırakır.
4. `expense_items.name` ve `turkish_name` fiş/OCR kanıtı olarak korunur.
   Kullanıcının görünüm düzeltmesi ayrı nullable `user_label` alanına yazılır;
   ham adlar canonical ad veya çeviriyle sessizce ezilmez.
5. Gemini fiş ayrıştırırken yalnız sınırlı, yapılandırılmış
   `product_identity` metadatası önerebilir. Bu metadata yerel eşleşme anahtarını
   veya otomatik merge kararını belirlemez. Düşük güvenli metadata görünen
   kanonik başlığa uygulanmaz; güçlü metadata marka, varyant veya paket
   çelişkisi bildirirse deterministik tek aday bile sessizce bağlanmaz. İki kayıt için AI eşleşme önerisi
   yalnız açık kullanıcı eyleminde, aynı ölçü birimi önceden doğrulandıktan sonra
   ve sınırlı metin adaylarıyla çağrılabilir. Analiz render'ında, migration'da
   veya arka planda Gemini çağrısı yapılmaz; yanıt hiçbir kaydı kendiliğinden
   değiştirmez.
6. Kullanıcı **Benzer ürünleri düzenle** yüzeyinde aynı ölçüdeki ürünleri
   birleştirebilir, bir aliası yeniden ayırabilir ve görünen kanonik adı
   düzeltebilir. Birleştirme/ayırma yalnız kimlik bağlantılarını taşır; fiş
   satırını, tutarı, miktarı, birim fiyatı, tarihi, `name`, `turkish_name` veya
   `user_label` değerini silmez. Yanlış birleştirme, ilgili aliası ayırma yoluyla
   finansal gözlemler kaybedilmeden düzeltilebilir. Yüzeyin varsayılan görünümü,
   cihazda sınırlı inverted-index ile hesaplanan güçlü olası eşleşmeleri küçük bir
   inceleme kuyruğunda gösterir. Bu kuyruk otomatik merge değildir ve ekran
   açılışında AI çağrısı yapılmaz. Tüm katalog `SectionList` ile sanallaştırılır;
   0–30, 31–90, 91–365, 365 günden eski ve satın alma geçmişi olmayan bölümler ile
   ad/alias/ham-çevrilmiş-kullanıcı etiketi araması, ölçü ve tarih filtreleri,
   son görülme/sıklık/alfabetik sıralama sunulur. İlk seçimden sonra ikinci ürün
   yalnız aynı ölçü biriminden seçilebilir.
7. Fiyat Takibi, ürün ayrıntısı, ürün alım geçmişi, satıcı ürünleri, en çok alınan
   ürünler ve ürün adıyla grup oluşturan diğer analizler ortak kanonik kimlik
   anahtarını kullanır. Ölçü birimi her durumda anahtarın zorunlu parçasıdır.
8. Ürün kimliği kalıcı finansal bağlam olduğu için backup biçimi v4'tür. Yerel
   SQLite ID'leri yerine taşınabilir ürün UID'si kullanılır. v1-v3 import desteği
   korunur; bu sürümlerde kimlik koleksiyonları boş kabul edilir. v4 doğrulaması
   ürün, alias, ölçü ve kalem bağlantılarını import transaction'ından önce
   denetler; aynı dosyanın yeniden yüklenmesi kopya kimlik üretmemelidir.

## Değişmezler

- `piece`, `kg` ve `l` fiyat serileri birbirine karışmaz.
- Adet satılan `Yoğurt 500 g`, tartıyla satılan `0.5 kg Yoğurt` ile paket metni
  silinerek otomatik eşleştirilmez.
- `Tavuk Baget`, `Tavuk Kanat` ve `Tavuk Budu` yalnız ortak `tavuk` kelimesi
  nedeniyle birleşmez.
- AI çıktısı öneridir; kalıcı alias/merge kararı deterministik kural veya açık
  kullanıcı eylemi gerektirir.
- Kimlik düzeltmesi finansal olay değildir ve geçmiş fiyat gözlemlerini silmez.
- API anahtarı yalnız SecureStore'da ve `x-goog-api-key` header'ında kalır.

## Sonuçlar

Aynı ürünün güvenli yazım varyasyonları ortak geçmişte toplanabilir; farklı
ölçü, paket ve varyantlar yanlış birleştirmeye karşı korunur. Kalıcı tablolar,
migration, DAO, analiz sorguları ve backup v4 birlikte yönetilmek zorundadır.
Kullanıcı düzeltme yüzeyi ek ürün karmaşıklığı getirir; bunun karşılığında
belirsiz semantik kararlar denetlenebilir ve veri kaybı olmadan düzeltilebilir.

AI önerisi ağ ve kota gerektirir, kesinlik garantisi taşımaz ve temel fiyat
takibinin çalışması için zorunlu değildir. Çevrimdışı durumda deterministik
eşleşme, kayıtlı aliaslar ve manuel birleştirme/ayırma çalışmaya devam eder.
Alias ve gözlem sayıları, doğrudan çoklu join yerine ayrı ürün-başına CTE
agregasyonlarıyla çıkarılır; bu karar hem liste sırasını hem öneri sinyalini
çarpımsal satır çoğalmasından korur. Sanallaştırma görünür kart yükünü sınırlar,
ancak ürün özet sorgusu kompakt kataloğun tamamını belleğe alır; çok büyük gerçek
katalogda SQL sayfalama gerekip gerekmediği cihaz profiliyle ayrıca kararlaştırılır.

## Reddedilen seçenekler

- Ham ad veya yalnız `normalizeItemKey(name)` ile kalıcı gruplama
- Levenshtein/fuzzy skoruna göre otomatik toplu merge
- Aynı ürün ailesindeki bütün kayıtları tek ürüne indirme
- Analiz ekranı açılırken Gemini ile arka plan eşleştirmesi
- Canonical adı ham fiş adının üzerine yazma
- Yerel SQLite ID'sini taşınabilir backup kimliği olarak kullanma

## Doğrulama

Otomatik kabul; deterministik canonicalization, birim ayrımı, paket koruması,
migration belirsizliği, alias öğrenimi, merge/split veri koruması, analiz grup
anahtarları, Gemini yanıt sınırları ve v1-v4 backup senaryolarını kapsamalıdır.
Typecheck, ilgili Jest paketleri, tam Jest ve `git diff --check` ayrı kaydedilir.

Fiziksel cihaz doğrulaması henüz beklemektedir. Eski gerçek veritabanı upgrade'i,
AI fiş önizlemesi, kullanıcı etiketi, **Benzer ürünleri düzenle** içinde
birleştirme/ayırma, uygulamayı yeniden açma ve Fiyat Takibi/ürün ayrıntısı
sonuçları açık/koyu temada kontrol edilmeden cihaz kabulü verilmez. Buna ek
olarak yüzlerce/binlerce ürünle ilk açılış süresi, inceleme kuyruğu üretimi,
uzun `SectionList` kaydırması, filtre geçişi, bellek kullanımı ve aynı ölçüde
ikinci seçim fiziksel cihazda manuel olarak hâlâ beklemektedir.

## Kanıt

- [`src/utils/productIdentity.ts`](../../src/utils/productIdentity.ts)
- [`src/db/productIdentityDao.ts`](../../src/db/productIdentityDao.ts)
- [`src/db/schema.ts`](../../src/db/schema.ts) ve
  [`src/db/database.ts`](../../src/db/database.ts)
- [`src/db/expenseDao.ts`](../../src/db/expenseDao.ts)
- [`src/services/geminiService.ts`](../../src/services/geminiService.ts) ve
  [`src/services/receiptParser.ts`](../../src/services/receiptParser.ts)
- [`src/services/backupService.ts`](../../src/services/backupService.ts)
- [`app/product-matching.tsx`](../../app/product-matching.tsx)
- [`src/utils/productMatchDiscovery.ts`](../../src/utils/productMatchDiscovery.ts)
- [`src/utils/__tests__/productMatchDiscovery.test.ts`](../../src/utils/__tests__/productMatchDiscovery.test.ts)
- [`src/utils/__tests__/productIdentity.test.ts`](../../src/utils/__tests__/productIdentity.test.ts)
- [`src/db/__tests__/databaseProductIdentityMigration.test.ts`](../../src/db/__tests__/databaseProductIdentityMigration.test.ts)
  ve [`src/db/__tests__/productIdentityDao.test.ts`](../../src/db/__tests__/productIdentityDao.test.ts)
- [`src/services/__tests__/geminiParse.test.ts`](../../src/services/__tests__/geminiParse.test.ts)
  ve [`src/services/__tests__/backupService.test.ts`](../../src/services/__tests__/backupService.test.ts)
- [`src/components/__tests__/ProductMatchingScreen.test.tsx`](../../src/components/__tests__/ProductMatchingScreen.test.tsx)
  ve [`src/components/__tests__/SettingsDataProductMatching.test.tsx`](../../src/components/__tests__/SettingsDataProductMatching.test.tsx)

## İlişkili kararlar

- [ADR-004 — Fiş toplamı bütünlüğü](ADR-004-receipt-total-integrity.md)
- [ADR-009 — Fiş kalemi ölçü birimleri](ADR-009-receipt-item-measurement-units.md)
