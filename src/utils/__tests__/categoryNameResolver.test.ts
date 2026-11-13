import { createCategoryNameResolver } from '../categoryNameResolver';

const cat = (id: number, name: string, parent_id: number | null = null) => ({ id, name, parent_id }) as any;

describe('createCategoryNameResolver (PERF-04)', () => {
  it('matches like SQLite LOWER(): ASCII case-insensitive, non-ASCII exact', () => {
    const resolve = createCategoryNameResolver([cat(3, 'Market'), cat(4, 'Şarküteri'), cat(1, 'Diğer')]);
    expect(resolve('market')).toBe(3);
    expect(resolve('MARKET')).toBe(3);
    expect(resolve('Şarküteri')).toBe(4);
    // SQLite LOWER yalnız ASCII çevirir; davranış korunur (BUG-14 ayrı ele alınır).
    expect(resolve('şarküteri')).toBe(1);
  });

  it('picks the earliest inserted category when names collide, like LIMIT 1 on rowid order', () => {
    const resolve = createCategoryNameResolver([cat(9, 'Market', 2), cat(5, 'market'), cat(1, 'Diğer')]);
    expect(resolve('Market')).toBe(5);
  });

  it('falls back to Diğer, then to the first listed category, then to 1', () => {
    expect(createCategoryNameResolver([cat(8, 'A'), cat(2, 'Diğer')])('Unknown')).toBe(2);
    expect(createCategoryNameResolver([cat(8, 'A'), cat(6, 'B')])('Unknown')).toBe(8);
    expect(createCategoryNameResolver([])('Unknown')).toBe(1);
  });
});
