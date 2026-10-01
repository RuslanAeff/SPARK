# ADR-014 — İade edilebilir ambalaj depozitosu ayrı bir cüzdan ve nakit akışıdır

**Durum:** Accepted · prospective  
**Tarih:** 2026-09-30  
**İlgili kararlar:** [ADR-003](ADR-003-financial-cash-flow-domain.md),
[ADR-004](ADR-004-receipt-total-integrity.md),
[ADR-012](ADR-012-ai-transfer-service-and-market-scope.md).

## Bağlam

Bir içecek alınırken ödenen şişe/kutu depozitosu fiş toplamının parçasıdır. Ambalaj
iade edildiğinde mağaza bir voucher verebilir; bu voucher daha sonraki alışverişte
ödeme aracı olarak kullanılabilir veya nakde çevrilebilir. Ürün indirimi, yeni
gelir ve depozito geri kazanımı aynı olay değildir. Bunları tek bir indirim alanına
yazmak harcamayı ve bütçeyi yanlış gösterir. Voucher uzun fişin en altında
bulunabildiği için tek fotoğraf da yeterli olmayabilir.

## Karar

1. `expenses.container_deposit_paid`, alışveriş sırasında ödenen depozitoyu;
   `expenses.container_voucher_used`, o alışverişte geri kazanılan eski depozitoyu
   taşır. Basılı fiş toplamı değişmeden kalır.
2. Depozito fiş satırı `expense_items.financial_kind='container_deposit'` olur.
   Harcama toplamına dahildir, fakat ürün fiyatı, kişisel enflasyon, sessiz harcama
   ve ürün kimliği analizlerine girmez.
3. Kullanılabilir kuponlar `container_deposit_vouchers` cüzdanında tutar,
   para birimi, alınma/son kullanım tarihi ve `available/redeemed/expired`
   durumuyla saklanır. Sistem adet şişeden bakiye tahmin etmez; kanonik değer
   voucher tutarıdır.
4. Bütçe yalnız gerçek geri kazanım olayından etkilenir.
   `container_deposit_recoveries`, voucher alışverişte kullanıldığında veya nakde
   çevrildiğinde pozitif nakit akışı üretir. Voucher oluşturulması tek başına
   bütçeyi artırmaz.
5. Tek ve kesin tutar eşleşmesi varsa kullanılan voucher alışverişe bağlanır.
   Aynı tutarlı birden fazla aday varsa sistem tahmin etmez; geri kazanım kaydı
   korunur, voucher bağlantısı boş kalır.
6. Manuel harcama ve AI fiş sonucu aynı alanları kullanır. Bağımsız iade voucher'ı
   harcama oluşturmaz; cüzdana eklenir. Tarayıcı tek istekte en fazla dört sayfayı
   sıralı gönderir ve kullanıcı sayfaları gördükten sonra analizi açıkça başlatır.
7. Yedek formatı v6'dır. Harcama alanları, satır türü, voucher ve recovery
   kayıtları taşınır; v1–v5 içe aktarımları bu koleksiyonları boş kabul eder.

## Değişmezler

- Voucher kullanımı ürün indirimi veya `extra_incomes` kaydı değildir.
- Bir voucher'ın elde edilmesi ile harcanabilir bütçeye geri dönmesi iki ayrı
  tarihtir; bütçe ikinci tarihi kullanır.
- Depozito satırı basılı fiş toplamından çıkarılmaz ve ürün analizi üretmez.
- Voucher/harcama/recovery bağlantılı yazıları tek SQLite transaction'ında kalır.
- Belirsiz voucher eşleşmesi sessizce seçilmez.

## Doğrulama sınırı

DAO, parser, Gemini istek yapısı, migration ve yedek sözleşmesi otomatik testlerle
doğrulanır. Gerçek uzun fişlerin kamera/galeri ile çok sayfalı seçimi, Gemini'nin
farklı mağaza metinlerini doğru ayırması, yeni migration'ın gerçek Expo SQLite
üzerinde açılması ve v6 dosyasının başka kuruluma geri yüklenmesi fiziksel cihaz
kanıtı olmadan kapanmış sayılmaz.
