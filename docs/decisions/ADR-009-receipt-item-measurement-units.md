# ADR-009: Fiş kalemi ölçü birimleri ve fiyat karşılaştırma tabanı

- **Status:** Accepted
- **Kayıt türü:** Prospective
- **Kayda geçirildi:** 21 Ağustos 2026

## Bağlam

Kesirli ağırlıkla satılan meyve, sebze ve et kalemleri yalnız `quantity` alanıyla saklandığında `0.530x` gibi adet izlenimi veriyor. Aynı ürünün adet ve kilogram kayıtları tek fiyat serisinde birleşirse yüzde değişimi de anlamsızlaşıyor. Yalnız ekranda `kg` yazmak, AI/manuel giriş, yedek ve geçmiş analizini tutarlı hale getirmez.

## Karar

1. Kalıcı kanonik ölçüler `piece`, `kg` ve `l` olur.
2. Manuel giriş `g` ve `ml` kabul eder; finansal hesap öncesinde sırasıyla `kg` ve `l` tabanına çevrilir. Birim fiyat kanonik birim başınadır.
3. Gemini her kalem için ölçü türü önerir. Paket adında `500g` veya `1.75L` geçmesi tek başına ağırlık/hacim satışı değildir; açık fiş miktarı gerekir.
4. Fiyat geçmişi, varsa kalıcı kanonik ürün kimliği **ve ölçü türü** ile gruplanır; eski veya henüz bağlanmamış kayıtlar yalnız güvenli deterministik ürün anahtarı ve ölçü türüne geri düşer. Ürün kimliği ve belirsiz eşleştirme sınırı [ADR-010](ADR-010-canonical-product-identity.md) içindedir. Aynı gündeki tekrarlar toplam tutar/toplam miktar ile ağırlıklı tek gözleme dönüşür; değişim için en az iki ayrı gün gerekir.
5. Ürün ve satıcı ortalama birim fiyatı `toplam harcama / toplam miktar` ile hesaplanır.
6. Eski açık `(kg)` etiketleri ve kesirli miktarlar tek seferlik migration ile kilogram olarak sınıflanır; diğer kayıtlar adet kalır.
7. Ölçü alanı yedekte taşınır; eski yedeklerde alan yoksa güvenli varsayılan `piece` olur.

## Değişmezler

- Satır net toplamı ve basılı fiş toplamı ADR-004 kurallarını korur.
- `500 g × kg başı fiyat`, kayıtta `0.5 kg × kg başı fiyat` olarak aynı net sonucu verir.
- Adet, kütle ve hacim fiyatları birbirine karşılaştırılmaz.
- Paket hacmi/ağırlığı, satış ölçü birimiyle karıştırılmaz.
- Ürün kimliği hangi yoldan çözülürse çözülsün ölçü türü grup anahtarından çıkarılamaz.

## Sonuçlar

Fiyat grafikleri anlamlı birim fiyatlarını izler; kullanıcı miktarı `g/kg/L/ml/adet` olarak girip okuyabilir. Eski kesirli kayıt migration'ı güçlü fakat kusursuz olmayan bir heuristiktir; cihaz kabulünde sıra dışı kesirli adet kayıtları gözden geçirilmelidir.

## Doğrulama

- `530 g` → `0.53 kg`; `7.94 / 0.53 = 14.9811` kg birim fiyatı.
- Aynı isimli `piece` ve `kg` satırları ayrı fiyat serileri.
- Aynı gün tekrarları sahte değişim oluşturmaz.
- Eski DB upgrade'i ve eski/yeni backup import'u.
- Manuel ekleme/düzenleme ile AI taramasında satır ve fiş toplamı korunur.

## Kanıt

- `src/utils/{measurementUnit,priceWatch}.ts`
- `src/db/{schema,database,expenseDao}.ts`
- `src/services/{geminiService,receiptParser,backupService}.ts`
- `app/edit-items.tsx`, `app/(tabs)/analytics.tsx`
- `src/components/{ItemAnalyticsModal,analytics/PriceWatchCard}.tsx`
- İlgili migration, saf hesap ve bileşen testleri

## İlişkili karar

- [ADR-010 — Kanonik ürün kimliği ve kullanıcı kontrollü eşleştirme](ADR-010-canonical-product-identity.md)
