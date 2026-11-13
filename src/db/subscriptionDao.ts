// S.P.A.R.K. — Tekrar eden ödeme (abonelik) DAO
import { getDatabase } from './database';
import type { SubscriptionRow, SubscriptionWithDetails } from './schema';

export const SubscriptionDao = {
  async getAll(): Promise<SubscriptionWithDetails[]> {
    const db = await getDatabase();
    return db.getAllAsync<SubscriptionWithDetails>(
      `SELECT s.*,
              v.name        AS vendor_name,
              v.logo_uri    AS vendor_logo,
              v.default_category_id AS category_id,
              c.name        AS category_name,
              c.icon        AS category_icon,
              c.color       AS category_color
         FROM subscriptions s
         JOIN vendors v ON s.vendor_id = v.id
         LEFT JOIN categories c ON v.default_category_id = c.id
        ORDER BY s.status ASC, s.next_expected_date ASC`
    );
  },

  async getActive(): Promise<SubscriptionWithDetails[]> {
    const db = await getDatabase();
    return db.getAllAsync<SubscriptionWithDetails>(
      `SELECT s.*,
              v.name        AS vendor_name,
              v.logo_uri    AS vendor_logo,
              v.default_category_id AS category_id,
              c.name        AS category_name,
              c.icon        AS category_icon,
              c.color       AS category_color
         FROM subscriptions s
         JOIN vendors v ON s.vendor_id = v.id
         LEFT JOIN categories c ON v.default_category_id = c.id
        WHERE s.status = 'active'
        ORDER BY s.next_expected_date ASC`
    );
  },

  async setStatus(vendorId: number, status: 'active' | 'dismissed'): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE subscriptions SET status = ?, updated_at = ? WHERE vendor_id = ?',
      [status, new Date().toISOString(), vendorId]
    );
  },

  /**
   * PERF-07: tespit sonuçlarını tek transaction'da uygular. Mevcut satırlar bir kez
   * okunur; aynı kalan tespit yazılmaz, yalnız değişen/yeni satırlar yazılır ve
   * artık tespit edilmeyen aktif kayıtlar silinir. Kullanıcının "abonelik değil"
   * kararı (dismissed) korunur. Yazılan satır sayısını döndürür.
   */
  async applyDetections(detections: Omit<SubscriptionRow, 'id'>[]): Promise<number> {
    const db = await getDatabase();
    const existingRows = await db.getAllAsync<SubscriptionRow>('SELECT * FROM subscriptions');
    const existing = new Map(existingRows.map(row => [row.vendor_id, row]));
    const detected = new Set<number>();
    const writes: Array<Omit<SubscriptionRow, 'id'>> = [];
    for (const row of detections) {
      detected.add(row.vendor_id);
      const current = existing.get(row.vendor_id);
      const status = current?.status === 'dismissed' ? 'dismissed' : row.status;
      if (current
        && current.amount === row.amount
        && current.currency === row.currency
        && current.period_days === row.period_days
        && current.last_seen_date === row.last_seen_date
        && current.next_expected_date === row.next_expected_date
        && current.occurrences === row.occurrences
        && current.status === status) continue;
      writes.push({ ...row, status });
    }
    const stale = existingRows
      .filter(row => row.status === 'active' && !detected.has(row.vendor_id))
      .map(row => row.id);
    if (writes.length === 0 && stale.length === 0) return 0;
    await db.withTransactionAsync(async () => {
      for (const row of writes) {
        await db.runAsync(
          `INSERT INTO subscriptions
             (vendor_id, amount, currency, period_days, last_seen_date,
              next_expected_date, occurrences, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(vendor_id) DO UPDATE SET
             amount             = excluded.amount,
             currency           = excluded.currency,
             period_days        = excluded.period_days,
             last_seen_date     = excluded.last_seen_date,
             next_expected_date = excluded.next_expected_date,
             occurrences        = excluded.occurrences,
             status             = excluded.status,
             updated_at         = excluded.updated_at`,
          [row.vendor_id, row.amount, row.currency, row.period_days, row.last_seen_date,
            row.next_expected_date, row.occurrences, row.status, row.updated_at],
        );
      }
      for (const id of stale) {
        await db.runAsync("DELETE FROM subscriptions WHERE id = ? AND status = 'active'", [id]);
      }
    });
    return writes.length + stale.length;
  },

};
