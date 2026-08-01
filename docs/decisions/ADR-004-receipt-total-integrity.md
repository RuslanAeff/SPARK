# ADR-004: Basılı fiş toplamı bütünlüğü

- **Status:** Accepted
- **Kayıt türü:** Retrospective
- **Kayda geçirildi:** 1 Ağustos 2026
- **Özgün karar tarihi:** Bilinmiyor; `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` P29 bu davranışı Haziran 2026 / v2.5.0 olarak kaydeder.
- **Özgün commit:** Bilinmiyor

## Bağlam

Gemini fişin basılı genel toplamını doğru okuyup bir veya daha fazla ürün satırını atlayabilir. Kayıt sırasında expense toplamını otomatik olarak item toplamına eşitlemek bu durumda kullanıcının gerçekten ödediği tutarı azaltır; Dashboard, bütçe ve analiz yanlış olur. Öte yandan kullanıcı sonradan kalemleri bilinçli biçimde düzenlediğinde item toplamı yeni kullanıcı niyetini temsil eder.

Eski edit-before-save yolu yalnız header alanlarını formda dolduruyor ve ürünleri hiç kaydetmiyordu. Header ile item'ların ayrı yazılması da yarım fiş bırakabiliyordu.

## Karar

1. Fiş ingestion anında geçerli `receipt.total` (basılı `SUMA`/`TOTAL`) expense header toplamının otoritesidir.
2. Basılı toplam geçersiz/yoksa pozitif item toplamı fallback olur; o da yoksa güvenli 0 kullanılır.
3. Item kategorileri gibi okumalar transaction öncesi çözülür; expense header ve tüm item yazıları tek transaction içinde commit edilir.
4. `processReceipt()` ingestion transaction'ında `ExpenseDao.syncExpenseTotal()` **çağrılmaz**. AI eksik satır çıkarsa basılı toplam korunur.
5. Kullanıcı `edit-items` içinde kalem ekler, siler veya fiyat/indirim değiştirirse bu explicit edit yolu `syncExpenseTotal()` çağırabilir; burada item toplamı kullanıcının yeni niyetidir.
6. Tarayıcıdaki “Düzenle” yolu önce tam fişi kalemleriyle kaydeder, sonra oluşturulan expense ID'sinin edit ekranını açar.
7. Satır fiyat modeli: `total_price` net ödenen satır toplamıdır; `line_discount` indirimdir; mevcutsa `list_line_total_before_discount` net + indirimdir. Edit formunda kullanıcıya sunulan etiket fiyatı tekrar indirim düşülmesine yol açmamalıdır.
8. Header/item farkı sessizce “düzeltilmez”. UI gerekirse farkı gösterir; gerçek toplamı ancak kullanıcı niyeti veya açık bir ürün düzenlemesi değiştirir.

## Değişmezler

- Fiş tek finansal harcamadır; finansman/borç nedeniyle bölünmez.
- Header+items ya birlikte vardır ya hiçbiri yoktur.
- İsteğe bağlı bildirim transaction dışında ve başarısızlığı fiş commit'inden bağımsızdır.
- Gemini prompt'u genel toplamı item'lardan yeniden hesaplamamasını, basılı satırı okumasını ister.
- İndirim satırının ayrı negatif “ürün” olarak kalması mümkün olduğunda merge katmanında normalize edilir; net/brüt semantiği korunur.

## Sonuçlar ve ödünleşimler

**Olumlu:** AI item eksiltse bile bütçe ve tüketim toplamı fişte ödenen gerçek tutarı korur; edit yolu veri kaybetmez; yarım fiş oluşmaz.

**Bedel:** Header toplamı ile item toplamı bilinçli olarak farklı olabilir. Analiz yapan kod hangi toplamı kullandığını açıkça seçmelidir; item bazlı ürün analizi ile expense bazlı harcama toplamı her zaman matematiksel olarak eşit olmayabilir.

## Doğrulama

- Basılı toplam 100, çıkarılan item toplamı 85 senaryosunda expense 100 kalmalı.
- Geçersiz basılı toplamda item toplamı fallback'i doğrulanmalı.
- Item yazısında hata enjekte edildiğinde header da rollback olmalı.
- Explicit item editinden sonra toplam item'lara eşitlenmeli ve indirim ikinci kez uygulanmamalı.
- Scan “Düzenle” yolu ürünleri korumalı; AbortSignal iptali yarım kayıt bırakmamalı.

## Kanıt

- `src/services/geminiService.ts`
- `src/services/receiptLineMerge.ts`
- `src/services/receiptParser.ts`
- `src/db/expenseDao.ts`
- `app/(tabs)/scanner.tsx`
- `app/add-expense.tsx`
- `app/edit-items.tsx`
- `src/utils/receiptLineDiscountUi.ts`
- Gemini/receipt/discount testleri
- `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` §3.2, §3.3, P29

## Yeniden değerlendirme koşulları

OCR kaynağı basılı toplam için güven skorları sağlarsa veya kullanıcı header toplamını doğrudan doğrulayan yeni bir reconciliation ekranı eklenirse otorite/fallback sırası yeni ADR ile ele alınmalıdır.
