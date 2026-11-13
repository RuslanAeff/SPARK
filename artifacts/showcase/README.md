# SPARK — European everyday spending showcase

All transactions and prices are fictional, made for UI screenshots. Retailer
names provide familiar context; these are not advertised prices, market averages,
real receipts or evidence of a commercial relationship. The supplied personal
backup was inspected for its v6 structure only. Personal transactions, people,
notes, receipt paths and product identities were not copied.

Import `spark-showcase-europe_2026-05-01_2026-10-08.json` using SPARK's backup
import. It contains 1 May–8 October 2026: five complete months plus the current
partial month. One fictional EUR household keeps comparisons coherent rather
than mixing unrelated national currencies and lifestyles.

| Content | Count |
|---|---:|
| Transactions | 218 |
| Receipt line items | 738 |
| Canonical products/services | 54 |
| Vendors | 26 |
| Categories | 9 |
| Monthly budgets | 6 |
| Recurring payment reminders | 4 |
| Debts / repayments | 2 / 2 |
| Occasional extra incomes | 3 |

| Period | Spending, EUR | Budget, EUR |
|---|---:|---:|
| May | 1,560.95 | 2,100 |
| June | 1,728.16 | 2,100 |
| July | 1,503.77 | 2,100 |
| August | 1,720.65 | 2,100 |
| September | 1,538.20 | 2,100 |
| October 1–8 only | 1,051.78 | 2,100 for the full month |

Rent is paid at the start of each month, so October is intentionally front-loaded.
Weekend trips in June/August add variation; shopping remains occasional. Weekly
grocery baskets reuse packaged items with modest price rises, reductions and
promotions. Line totals sum to each expense total. All values use EUR; no actual
market-price claims are made. Salary is represented by the budget, not also
added as extra income. Debt payments stay separate from consumption.

## Ekran görüntüsü için kullanım

1. Ayrı bir demo kurulumunda kullan. İçe aktarma mevcut kayıtları otomatik silmez;
   gerçek verilerle aynı kuruluma yüklersen birbirlerine karışırlar. Gerçek
   yedeğini koru. Bu çalışma hiçbir cihaz verisini değiştirmedi.
2. Ayarlarda para birimini EUR, dili English, bütçe başlangıç gününü 1 seç.
   Bu tercihlerin tümü JSON ile taşınmaz. Tarihleri cihazda değiştirmene gerek yok.
3. Analiz ekranında September 2026'yı seç: tamamlanmış ayın kategori/satıcı
   dağılımı ve önceki ay karşılaştırması için uygun. Yıllık veya özel
   May–October aralığı uzun dönem grafikleri için kullanılabilir.
4. Fiyat Takibi'nde süt, kahve, yumurta veya ekmek gibi tekrarlanan ürünleri aç.
   Kalemli bir Lidl/ALDI alışverişi işlem detayları için de uygundur.
5. Güncel Dashboard, October 1–8 kayıtlarını gösterir; kira nedeniyle ayın
   başında harcama yüksek görünmesi beklenir. Ekran görüntüsü daha sonra
   alınırsa yeni işlemler kendiliğinden oluşmaz.
6. Hedef/limit ekranları için uygulamadan örneğin 1,500 EUR birikim hedefi,
   450 EUR mevcut birikim ve 320 EUR market limiti ekleyebilirsin. Bunlar
   isteğe bağlı demo değerleridir; v6 yedek bunları taşımıyor ve dosyada yoklar.

Vendor logos and receipt images are intentionally absent; SPARK can display its
normal fallbacks. This file will not populate the scanner's photo carousel.
Use separate synthetic receipt images if that screen is also needed.
Suggested GitHub caption: **“Screenshots use fictional demo data.”**

## Regeneration and validation

Run `node scripts/generate-showcase-data.cjs` from the repository. The seed,
identities and dates are fixed, so regeneration is deterministic. The generator
does not read a personal backup. Output is a separate file, not an edit to the
user's original JSON.

Checked on 8 October 2026 with `showcaseBackup.test.ts`: actual application
payload validation; real in-memory SQLite import; repeat import without duplicate
expenses; cent-level line/expense and database totals; product identity links;
debt-payment/reminder counts; export and revalidation. This does not establish
device rendering or Expo native filesystem behaviour.
