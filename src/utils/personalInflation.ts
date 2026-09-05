// S.P.A.R.K. — Kişisel enflasyon ve harcama değişiminin ayrıştırılması
//
// Kullanıcının sorusu "harcamam arttı da, bunun ne kadarı fiyat, ne kadarı
// ben?" — kategori ya da işlem toplamları bu soruyu cevaplayamaz. Cevap için
// aynı ürünün iki dönemdeki BİRİM fiyatı gerekir; bu veri yalnız fiş satırı
// düzeyinde vardır (`expense_items.unit_price` + `quantity` + kanonik ürün).
//
// Yöntem — Laspeyres fiyat endeksi. Sepet, iki dönemde de alınmış ürünlerden
// kurulur; miktarlar BAZ dönemde sabitlenir, böylece fiyat etkisi davranış
// etkisinden temiz biçimde ayrılır:
//
//   baz değer      V0 = Σ p0·q0
//   sabit sepet    L  = Σ p1·q0      (bugünkü fiyatlarla, dünkü sepet)
//   bugünkü değer  V1 = Σ p1·q1
//
//   fiyat etkisi    = L  − V0        → "aynı sepet ne kadar pahalandı"
//   davranış etkisi = V1 − L         → "sepetin kendisi ne kadar değişti"
//
// İkisinin toplamı tam olarak V1 − V0'dır; kartta gösterilen üç sayı bu yüzden
// her zaman birbirini tutar. Bu, DESIGN_BRIEF'teki "finansal sonuçlar
// açıklanabilir olmalıdır" ilkesinin gereğidir: tek bir yüzde değil, o yüzdenin
// nereden geldiği.
//
// Birim fiyatta ORTALAMA değil MEDYAN kullanılır. Tek bir kampanyalı ya da
// yanlış okunmuş satır, dönemin fiyat seviyesini temsil etmemelidir.
import { roundMoney, roundUnitRate } from './moneyMath';

export interface InflationItemRow {
  /** Kanonik ürün kimliği ya da ad+ölçü birimi anahtarı. */
  key: string;
  name: string;
  /** ÖDENEN (indirim düşülmüş) birim fiyat. */
  unitPrice: number;
  /**
   * ETİKET (indirim öncesi) birim fiyat. Verilmezse ödenen fiyata eşit sayılır;
   * indirim bilgisi olmayan eski/manuel satırlar indirim etkisine katkı vermez,
   * ayrışmayı bozmaz.
   */
  listUnitPrice?: number;
  quantity: number;
  totalPrice: number;
}

export type PersonalInflationStatus =
  /** Sepet kuruldu, ayrıştırma yapılabildi. */
  | 'ready'
  /** Dönemlerden biri boş — karşılaştırılacak bir şey yok. */
  | 'no_data'
  /** Veri var ama iki dönemde de alınmış ortak ürün yok. */
  | 'insufficient_basket';

export interface InflationContributor {
  key: string;
  name: string;
  basePrice: number;
  currentPrice: number;
  priceChangePct: number;
  /** Bu ürünün fiyat etkisine para cinsinden katkısı: (p1 − p0)·q0. */
  contributionAmount: number;
}

export interface PersonalInflationResult {
  status: PersonalInflationStatus;
  /** Laspeyres endeksinin yüzde değişimi — ÖDENEN fiyat üzerinden enflasyon. */
  inflationPct: number;
  /** Fiyat etkisinin etiket (indirim öncesi) fiyattan gelen parçası. */
  listPriceEffectPct: number;
  listPriceEffectAmount: number;
  /** Fiyat etkisinin indirim derinliğindeki değişimden gelen parçası. */
  discountEffectPct: number;
  discountEffectAmount: number;
  /** Sepette gerçekten indirim verisi bulunan ürün var mı? */
  hasDiscountSignal: boolean;
  /** Sepetin toplam değer değişimi (fiyat + davranış). */
  totalChangePct: number;
  behaviorEffectPct: number;
  priceEffectAmount: number;
  behaviorEffectAmount: number;
  baseValue: number;
  currentValue: number;
  /** Sepetteki ürün sayısı. */
  basketSize: number;
  /** Sepetin, baz dönemin TÜM kalem harcamasını temsil oranı (%). */
  coveragePct: number;
  /** Fiyat etkisine en çok katkı yapan ürünler (mutlak katkıya göre). */
  contributors: InflationContributor[];
}

const EMPTY: PersonalInflationResult = {
  status: 'no_data',
  inflationPct: 0,
  listPriceEffectPct: 0,
  listPriceEffectAmount: 0,
  discountEffectPct: 0,
  discountEffectAmount: 0,
  hasDiscountSignal: false,
  totalChangePct: 0,
  behaviorEffectPct: 0,
  priceEffectAmount: 0,
  behaviorEffectAmount: 0,
  baseValue: 0,
  currentValue: 0,
  basketSize: 0,
  coveragePct: 0,
  contributors: [],
};

interface PeriodEntry {
  name: string;
  prices: number[];
  listPrices: number[];
  quantity: number;
  spend: number;
  hasDiscount: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function groupPeriod(rows: readonly InflationItemRow[]): Map<string, PeriodEntry> {
  const grouped = new Map<string, PeriodEntry>();
  for (const row of rows) {
    if (!row.key) continue;
    const unitPrice = Number(row.unitPrice);
    const quantity = Number(row.quantity);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const entry = grouped.get(row.key) ?? {
      name: row.name,
      prices: [],
      listPrices: [],
      quantity: 0,
      spend: 0,
      hasDiscount: false,
    };
    entry.prices.push(unitPrice);
    // Etiket fiyatı ödenenden düşük olamaz; bozuk veri indirimi negatife çeviremez.
    const rawList = Number(row.listUnitPrice);
    const listPrice = Number.isFinite(rawList) && rawList > unitPrice ? rawList : unitPrice;
    entry.listPrices.push(listPrice);
    if (listPrice > unitPrice) entry.hasDiscount = true;
    entry.quantity += quantity;
    const total = Number(row.totalPrice);
    entry.spend += Number.isFinite(total) && total > 0 ? total : unitPrice * quantity;
    if (!entry.name && row.name) entry.name = row.name;
    grouped.set(row.key, entry);
  }
  return grouped;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * İki dönemin fiş satırlarından kişisel enflasyonu ve harcama değişiminin
 * fiyat/davranış ayrışmasını hesaplar. Girdi sırası önemsizdir; aynı ürünün
 * birden çok satırı gruplanır.
 */
export function computePersonalInflation(
  currentRows: readonly InflationItemRow[],
  baseRows: readonly InflationItemRow[],
  options: { maxContributors?: number } = {},
): PersonalInflationResult {
  const maxContributors = options.maxContributors ?? 3;
  if (currentRows.length === 0 || baseRows.length === 0) return { ...EMPTY };

  const current = groupPeriod(currentRows);
  const base = groupPeriod(baseRows);
  if (current.size === 0 || base.size === 0) return { ...EMPTY };

  let baseValue = 0;
  let laspeyres = 0;
  let currentValue = 0;
  let basketSize = 0;
  let listPriceEffect = 0;
  let discountEffect = 0;
  let hasDiscountSignal = false;
  const contributors: InflationContributor[] = [];

  for (const [key, baseEntry] of base) {
    const currentEntry = current.get(key);
    if (!currentEntry) continue;

    const basePrice = roundUnitRate(median(baseEntry.prices));
    const currentPrice = roundUnitRate(median(currentEntry.prices));
    if (basePrice <= 0 || currentPrice <= 0) continue;

    const baseListPrice = roundUnitRate(median(baseEntry.listPrices));
    const currentListPrice = roundUnitRate(median(currentEntry.listPrices));

    basketSize += 1;
    baseValue += basePrice * baseEntry.quantity;
    laspeyres += currentPrice * baseEntry.quantity;
    currentValue += currentPrice * currentEntry.quantity;
    // Fiyat etkisi ikiye bölünür ve toplamları TAM olarak fiyat etkisini verir:
    //   etiket etkisi = Σ(l₁ − l₀)·q₀
    //   indirim etkisi = Σ[(p₁ − l₁) − (p₀ − l₀)]·q₀   (indirim derinliği farkı)
    listPriceEffect += (currentListPrice - baseListPrice) * baseEntry.quantity;
    discountEffect += ((currentPrice - currentListPrice) - (basePrice - baseListPrice))
      * baseEntry.quantity;
    if (baseEntry.hasDiscount || currentEntry.hasDiscount) hasDiscountSignal = true;

    contributors.push({
      key,
      name: currentEntry.name || baseEntry.name,
      basePrice,
      currentPrice,
      priceChangePct: pct(currentPrice - basePrice, basePrice),
      contributionAmount: roundMoney((currentPrice - basePrice) * baseEntry.quantity),
    });
  }

  if (basketSize === 0 || baseValue <= 0) {
    return { ...EMPTY, status: 'insufficient_basket' };
  }

  // Kapsam: sepet, baz dönemin kalem harcamasının ne kadarını temsil ediyor?
  // Kartın dürüstlüğü buna bağlı — düşük kapsamda sayı temsil gücünü yitirir.
  let baseTotalSpend = 0;
  for (const entry of base.values()) baseTotalSpend += entry.spend;

  const priceEffectAmount = laspeyres - baseValue;
  const behaviorEffectAmount = currentValue - laspeyres;

  return {
    status: 'ready',
    inflationPct: pct(priceEffectAmount, baseValue),
    listPriceEffectPct: pct(listPriceEffect, baseValue),
    listPriceEffectAmount: roundMoney(listPriceEffect),
    discountEffectPct: pct(discountEffect, baseValue),
    discountEffectAmount: roundMoney(discountEffect),
    hasDiscountSignal,
    totalChangePct: pct(currentValue - baseValue, baseValue),
    behaviorEffectPct: pct(behaviorEffectAmount, baseValue),
    priceEffectAmount: roundMoney(priceEffectAmount),
    behaviorEffectAmount: roundMoney(behaviorEffectAmount),
    baseValue: roundMoney(baseValue),
    currentValue: roundMoney(currentValue),
    basketSize,
    coveragePct: pct(baseValue, baseTotalSpend),
    contributors: contributors
      .filter(item => item.contributionAmount !== 0)
      .sort((a, b) => Math.abs(b.contributionAmount) - Math.abs(a.contributionAmount))
      .slice(0, maxContributors),
  };
}
