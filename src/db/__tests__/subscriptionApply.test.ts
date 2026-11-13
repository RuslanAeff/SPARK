// PERF-07: değişmeyen abonelik tespiti yazılmaz; yazılar tek transaction'da.
jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { SubscriptionDao } from '../subscriptionDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;
let writes: string[];

const detection = (vendorId: number, patch: Record<string, unknown> = {}) => ({
  vendor_id: vendorId, amount: 39.99, currency: 'PLN', period_days: 30,
  last_seen_date: '2026-11-01', next_expected_date: '2026-12-01', occurrences: 3,
  status: 'active' as const, updated_at: '2026-11-13T10:00:00.000Z', ...patch,
});

beforeEach(async () => {
  db = sqliteTestDatabase();
  await db.execAsync(CREATE_TABLES_SQL);
  await db.execAsync("INSERT INTO vendors (id, name) VALUES (1, 'Netflix'), (2, 'Spotify'), (3, 'Gym');");
  writes = [];
  const realRun = db.runAsync;
  const tracked = {
    ...db,
    runAsync: (sql: string, params?: unknown[]) => { writes.push(sql.trim().split(/\s+/)[0]); return realRun(sql, params); },
  };
  (getDatabase as jest.Mock).mockResolvedValue(tracked);
});
afterEach(async () => db.close());

const rows = () => db.getAllAsync('SELECT vendor_id, amount, status, updated_at FROM subscriptions ORDER BY vendor_id');

it('writes new detections, then skips an unchanged second sync entirely', async () => {
  expect(await SubscriptionDao.applyDetections([detection(1), detection(2)])).toBe(2);
  writes = [];
  const later = '2026-11-14T08:00:00.000Z';
  expect(await SubscriptionDao.applyDetections([detection(1, { updated_at: later }), detection(2, { updated_at: later })])).toBe(0);
  expect(writes).toEqual([]);
  expect((await rows()).map((r: any) => r.updated_at)).toEqual(['2026-11-13T10:00:00.000Z', '2026-11-13T10:00:00.000Z']);
});

it('updates only the changed vendor and removes active rows no longer detected', async () => {
  await SubscriptionDao.applyDetections([detection(1), detection(2)]);
  writes = [];
  expect(await SubscriptionDao.applyDetections([detection(1, { amount: 43.99 })])).toBe(2);
  expect(writes.filter(w => w !== 'BEGIN' && w !== 'COMMIT')).toEqual(['INSERT', 'DELETE']);
  expect(await rows()).toEqual([{ vendor_id: 1, amount: 43.99, status: 'active', updated_at: '2026-11-13T10:00:00.000Z' }]);
});

it('keeps a dismissed decision even when it is no longer detected or its amount changes', async () => {
  await SubscriptionDao.applyDetections([detection(1), detection(3)]);
  await db.runAsync("UPDATE subscriptions SET status = 'dismissed' WHERE vendor_id IN (1, 3)");
  await SubscriptionDao.applyDetections([detection(1, { amount: 10 })]);
  expect(await rows()).toEqual([
    { vendor_id: 1, amount: 10, status: 'dismissed', updated_at: '2026-11-13T10:00:00.000Z' },
    { vendor_id: 3, amount: 39.99, status: 'dismissed', updated_at: '2026-11-13T10:00:00.000Z' },
  ]);
  // Değişmeyen dismissed kayıt yeniden yazılmaz.
  expect(await SubscriptionDao.applyDetections([detection(1, { amount: 10 })])).toBe(0);
});

it('rolls back every write when one fails', async () => {
  await SubscriptionDao.applyDetections([detection(1)]);
  await expect(SubscriptionDao.applyDetections([detection(2), detection(99)])).rejects.toThrow();
  expect((await rows()).map((r: any) => r.vendor_id)).toEqual([1]);
});
