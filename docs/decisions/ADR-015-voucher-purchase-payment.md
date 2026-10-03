# ADR-015 — Depozito voucher’ı alışveriş ödeme aracıdır

**Status:** Accepted · prospective
**Date:** 2026-10-02
**Supersedes:** [ADR-014](ADR-014-container-deposit-wallet.md), bütçe ve kullanım akışı açısından.

## İnsan kararı

Kullanıcı şişe iadelerinden yalnız kupon aldığını belirtti ve kuponun alınırken gelir olmamasını, alışverişte kullanılırken kart/nakit ödemesini azaltmasını onayladı. Bu uygulama kapsamı bütün mağazalar için nakit iadenin imkânsız olduğu iddiası değildir. Genel promosyon kuponları bu depozito domain'ine otomatik dahil edilmez.

## Karar ve değişmezler

- ADR-014'ün fiş bütünlüğü, depozito satırlarının ürün analizinden dışlanması, dört fotoğraf sınırı ve v6 backup sözleşmesi korunur.
- `total_amount` basılı fiş toplamıdır; `container_voucher_used` ürün indirimi değil ödeme payıdır. Bütçe harcaması işlem başına `total_amount - container_voucher_used` üzerinden hesaplanır. Örnek: 100 fiş, 5 voucher, 95 kart/nakit.
- Kullanılmamış veya süresi dolmuş kupon bütçe tutarını değiştirmez. Bütçe yüzdesi ve günlük ortalama net kart/nakit harcamasını kullanır. Geçmiş dönem, devir, bütçe bildirimleri ve projeksiyon da aynı ödeme hesabını izler. Kategori/ürün analizleri fiş değerini korur; voucher tutarı ürünlere indirim olarak dağıtılmaz.
- `purchase_voucher` recovery kaydı izlenebilirlik içindir, etkin bütçeye eklenmez. Önceden kaydedilmiş `cash` olayları yeniden yorumlanmaz ve kendi tarihlerinde eski nakit akışı olarak korunur. Yeni nakit iade düğmesi veya DAO yazma akışı sunulmaz.
- Cüzdandan kullanım yeni alışveriş formunu açar; kupon ID'si ve tutarı taşınır. Kaydetmeden çıkma kuponu tüketmez. Tam kupon tutarı tek alışverişte kullanılır; kısmi kupon bakiyesi bu değişikliğin kapsamında değildir.
- Kullanıcı seçimi aynı tutarlı adaylar arasında önceliklidir. Kayıtta tutar, para birimi, alınma/son kullanım tarihi ve kullanılabilirlik transaction içinde tekrar kontrol edilir. İkinci kullanım reddedilir. AI veya serbest manuel giriş yalnız tek kesin tarih/tutar/para birimi eşleşmesini bağlar; belirsizlikte kullanım tutarı kaydedilir, kupon bağlantısı tahmin edilmez.
- Düzenleme aynı bağlantıyı mümkünse korur; kullanım kaldırıldığında/işlem silindiğinde kupon serbest bırakılır. Süresi dolmuş kupon yeniden güncel kullanılabilir bakiyeye girmez.
- Mevcut şema ve v6 formatı yeterlidir, migration veya format artışı yoktur. Restore, kupon kullanımının fiş toplamını aşmasını reddeder. Eski `cash` kayıtları backup ile korunur; yanlış sınıflandırılmış geçmiş kayıtlar kanıtsız otomatik dönüştürülmez.

## Doğrulama

SQLite testleri kupon oluşturma, 100/5/95 ödeme, dönem ayrımı, tam kupon ödemesi, aynı tutarlı kupon seçimi, ikinci kullanım rollback'i, kullanım düzeltmesi, tarih/para birimi/tutar sınırlarını kapsar. Hook, işlem satırı, parser ve backup testleri ilgili sözleşmeleri doğrular.

Fiziksel cihaz kabulü açık: cüzdan→işlem→iptal/kaydet, gerçek AI fişleri, aynı kuponla hızlı tekrar kayıt, işlem silme, yeniden açılış ve cihazlar arası yedek geri yükleme. Önceki sürüme ait cihaz kabulü bu değişikliği doğrulamaz.
