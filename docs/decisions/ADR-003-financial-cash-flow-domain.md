# ADR-003: Finansal olaylar ve nakit-akışı modeli

- **Status:** Accepted
- **Kayıt türü:** Retrospective
- **Kayda geçirildi:** 1 Ağustos 2026
- **Özgün karar tarihi:** Bilinmiyor; borç özelliği `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` içinde Haziran 2026, ek gelir Temmuz 2026 olarak kayıtlıdır.
- **Özgün commit:** Bilinmiyor

## Bağlam

Harcama, borç alma, borç geri ödemesi ve geri ödeme yükümlülüğü olmayan ek gelir aynı “para değişimi” gibi görünse de farklı domain olaylarıdır. Bunları tek expense tablosunda veya bütçeyi elle değiştirerek modellemek kategori/satıcı analizini kirletir, geri ödemeyi iki kez tüketim sayar, tek seferlik geliri sonraki döngülere taşır ve silinen/düzeltilen kaydın etkisini kalıcı bir toplama dönüştürebilir.

## Karar

1. **Harcama/fiş tüketimdir.** `expenses` ve `expense_items` gerçek tüketimi saklar; finansman yöntemi yüzünden fiş bölünmez.
2. **Borç ayrı olaydır.** `debts` orijinal tutar/kalan/status bilgisini; `debt_payments` geri ödeme olaylarını saklar. Linked expense yalnız referanstır ve expense silinirse `SET NULL` olur.
3. **Borç geri ödemesi harcama değildir.** Kategori, satıcı, heatmap ve tüketim toplamına eklenmez.
4. **Ek gelir ayrı olaydır.** `extra_incomes` geri ödemesiz, pozitif ve yalnız gerçekleştiği bütçe döngüsünü etkileyen nakit girişidir. Borç status/remaining modelini kullanmaz; negatif expense değildir ve temel aylık bütçeyi değiştirmez.
5. Döngü `[start, end]` için tek matematik:

   `effectiveBudget = monthlyBudget + borrowedIn - repaidIn + extraIncomeIn`

   `remaining = effectiveBudget - totalSpent`

   Yüzde ve aşım durumu `effectiveBudget` tabanlıdır.
6. `outstandingDebt`, döngüden bağımsız olarak açık `borrowed` borçların kalan toplamıdır. `lent` şemada desteklenen gelecek yönüdür; mevcut v1 UI ağırlıklı olarak `borrowed` akışıdır.
7. Borç ödeme tutarı kalan borca kıstırılır; ödeme INSERT'i ve remaining/status güncellemesi tek transaction'dır. Borç silinirse bağlı ödemeler CASCADE ile silinir.
8. Bütçe etkileri additive cache olarak saklanmaz. Her refresh'te mevcut kanonik borç, ödeme ve gelir satırlarından tarih aralığı toplamları yeniden hesaplanır. Bu nedenle yanlış kayıt silindiğinde etkisi de kalkar; yeni kayıt eski etkinin üstüne yapışmaz.

## Değişmezler

- `totalSpent` yalnız gerçek expenses toplamıdır.
- Borç alınan döngüde `+borrowedIn`, ödendiği döngüde `-repaidIn` uygulanır; iki dönem net borç akışı hayalî para üretmez.
- Ek gelir yalnız kendi `date` değerinin düştüğü döngüde `+extraIncomeIn` olur ve sonraki döngüye devrolmaz.
- Borç/ödeme/gelir silme veya düzeltmesi ilgili refresh/invalidation kanalını tetikler; UI yeniden DB'den hesaplanır.
- Yeni bir nakit terimi saf hesap fonksiyonuna opsiyonel ve varsayılanı 0 alan olarak eklenir; eski davranış korunur.
- Bütçe, Dashboard ve projeksiyon aynı cycle start/end ile aynı `effectiveBudget` tabanını kullanır.

## Sonuçlar ve ödünleşimler

**Olumlu:** tüketim analizi temiz kalır; finansman ve gelir etkileri açıklanabilir; kayıt silme/düzeltme idempotent biçimde doğru toplam üretir; formül saf Jest testleriyle korunur.

**Bedel:** UI ve `useBudget` birden fazla DAO toplamını birleştirir. Aynı ekonomik olay farklı tablolarda ilişkilendirilebildiği için refresh ve backup kapsamları her yeni finansal varlıkta birlikte güncellenmelidir.

## Doğrulama

- `debtMath.test.ts`: borçsuz geriye uyum, +borrowed, -repaid, iki dönem neti, extra income, aşım/yüzde sınırları.
- DAO testleri: overpay clamp, settled geçişi, CASCADE ve silme sonrası aggregate.
- En az bir regresyon senaryosu: yanlış borcu sil → refresh → `borrowedIn` ve `outstandingDebt` düşer → yeni borç ekle → yalnız yeni kayıt etki eder.
- Projeksiyon testleri aynı cycle/effectiveBudget tabanını kullanmalıdır.

## Kanıt

- `src/db/schema.ts`
- `src/db/debtDao.ts`
- `src/db/incomeDao.ts`
- `src/utils/debtMath.ts`
- `src/utils/__tests__/debtMath.test.ts`
- `src/hooks/useBudget.ts`
- `src/utils/budgetCycle.ts`
- `src/components/BudgetCard.tsx`
- `app/(tabs)/index.tsx`
- `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` §5.11, §5.13, §5.14, P27, P30

## Yeniden değerlendirme koşulları

Çoklu hesap, faiz, taksit planı, alacak (`lent`) UX'i veya döviz dönüşümü eklenirse mevcut skaler formülün sınırları yeni ADR ile yeniden değerlendirilmelidir.
