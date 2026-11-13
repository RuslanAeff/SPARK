// BUG-11 kabul kriteri: 200 harcamalı veritabanında en eski kaydın satıcı adı
// aramada bulunur. Gerçek SQLite; eşleştirme dil bağımsız (ŻABKA ↔ "zabka").
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../../db/database';
import { CREATE_TABLES_SQL } from '../../db/schema';
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';
import { useExpenseSearch } from '../useExpenses';

let db: ReturnType<typeof sqliteTestDatabase>;
const label = (name: string) => (name === 'Ulaşım' ? 'Transport' : name);

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  await db.execAsync(`
    INSERT INTO vendors (id, name) VALUES (1, 'ŻABKA Nano'), (2, 'Biedronka');
    INSERT INTO categories (id, name) VALUES (1, 'Ulaşım');
    INSERT INTO expenses (id, vendor_id, category_id, total_amount, currency, date, note, created_at)
      VALUES (1, 1, NULL, 5, 'PLN', '2025-01-01', NULL, '2025-01-01 10:00:00');
  `);
  for (let id = 2; id <= 200; id++) {
    await db.runAsync(
      "INSERT INTO expenses (id, vendor_id, category_id, total_amount, currency, date, note, created_at) VALUES (?, 2, ?, 1, 'PLN', '2026-11-01', ?, '2026-11-01 10:00:00')",
      [id, id % 2 === 0 ? 1 : null, id === 150 ? 'Şeker ve süt' : null],
    );
  }
});
afterEach(async () => db.close());

describe('useExpenseSearch (BUG-11)', () => {
  it('en eski kaydı satıcı adıyla, büyük/küçük harf ve aksandan bağımsız bulur', async () => {
    const { result } = await renderHook(() => useExpenseSearch('zabka', label, 60));
    await waitFor(() => expect(result.current.items.map(e => e.id)).toEqual([1]));
    expect(result.current.items[0].vendor_name).toBe('ŻABKA Nano');
    expect(result.current.hasMore).toBe(false);
  });

  it('notta ve ekranda görünen (çevrilmiş) kategori adında arar', async () => {
    const { result, rerender } = await renderHook(
      ({ q }: { q: string }) => useExpenseSearch(q, label, 60),
      { initialProps: { q: 'SEKER' } },
    );
    await waitFor(() => expect(result.current.items.map(e => e.id)).toEqual([150]));

    await rerender({ q: 'transport' });
    await waitFor(() => expect(result.current.items).toHaveLength(60));
    expect(result.current.hasMore).toBe(true);
    await act(async () => { await result.current.loadMore(); });
    await waitFor(() => expect(result.current.items).toHaveLength(100));
    expect(result.current.hasMore).toBe(false);
    expect(new Set(result.current.items.map(e => e.id)).size).toBe(100);
  });

  it('boş aramada pasif kalır ve veritabanına dokunmaz', async () => {
    const getAll = jest.spyOn(db, 'getAllAsync');
    const { result } = await renderHook(() => useExpenseSearch('   ', label, 60));
    await waitFor(() => expect(result.current.searching).toBe(false));
    expect(result.current.active).toBe(false);
    expect(getAll).not.toHaveBeenCalled();
  });
});
