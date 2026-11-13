import type { Category } from '../db/schema';

/** SQLite `LOWER()` ile aynı: yalnız ASCII A–Z küçültülür (BUG-14 ayrı ele alınır). */
function sqliteAsciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

/**
 * Fiş kalemlerinin kategori adını kimliğe çevirir; kategoriler bir kez okunur
 * (PERF-04). Eskiden kalem başına 1–3 sorgu çalışıyordu.
 *
 * Davranış `CategoryDao.findByName` + `receiptParser` geri dönüşleriyle aynıdır:
 * - `LOWER(name) = LOWER(?) LIMIT 1` → ASCII büyük/küçük harf duyarsız, çakışmada
 *   en önce eklenen (en küçük id) kategori;
 * - bulunamazsa "Diğer", o da yoksa listedeki ilk kategori, liste boşsa 1.
 */
export function createCategoryNameResolver(
  categories: ReadonlyArray<Pick<Category, 'id' | 'name'>>,
): (name: string) => number {
  const byName = new Map<string, number>();
  for (const category of [...categories].sort((a, b) => a.id - b.id)) {
    const key = sqliteAsciiLower(category.name);
    if (!byName.has(key)) byName.set(key, category.id);
  }
  const fallback = byName.get(sqliteAsciiLower('Diğer')) ?? categories[0]?.id ?? 1;
  return (name: string) => byName.get(sqliteAsciiLower(name)) ?? fallback;
}
