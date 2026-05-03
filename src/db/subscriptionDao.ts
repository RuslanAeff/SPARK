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

  async upsert(row: Omit<SubscriptionRow, 'id'>): Promise<void> {
    const db = await getDatabase();
    // Mevcut kayıt varsa status'u koru (kullanıcı dismiss etmiş olabilir).
    const existing = await db.getFirstAsync<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE vendor_id = ?',
      [row.vendor_id]
    );
    const finalStatus =
      existing?.status === 'dismissed' ? 'dismissed' : row.status;
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
         status             = ?,
         updated_at         = excluded.updated_at`,
      [
        row.vendor_id,
        row.amount,
        row.currency,
        row.period_days,
        row.last_seen_date,
        row.next_expected_date,
        row.occurrences,
        finalStatus,
        row.updated_at,
        finalStatus,
      ]
    );
  },

  async setStatus(vendorId: number, status: 'active' | 'dismissed'): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE subscriptions SET status = ?, updated_at = ? WHERE vendor_id = ?',
      [status, new Date().toISOString(), vendorId]
    );
  },

  async deleteForVendor(vendorId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM subscriptions WHERE vendor_id = ?', [vendorId]);
  },

  /** Tespit motoru için: artık aktif/aday olmayan satıcıların aktif kayıtlarını sil.
   *  Dismissed kayıtlar korunur (kullanıcı tekrar uyarılmasın diye). */
  async deactivateMissing(activeVendorIds: number[]): Promise<void> {
    const db = await getDatabase();
    const ph = activeVendorIds.length > 0
      ? `AND vendor_id NOT IN (${activeVendorIds.map(() => '?').join(',')})`
      : '';
    await db.runAsync(
      `DELETE FROM subscriptions WHERE status = 'active' ${ph}`,
      activeVendorIds
    );
  },

  /** Kullanıcının "abonelik değil" tepkilerini export/import için dön. */
  async getDismissedVendorNames(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ name: string }>(
      `SELECT v.name AS name
         FROM subscriptions s
         JOIN vendors v ON s.vendor_id = v.id
        WHERE s.status = 'dismissed'`
    );
    return rows.map((r) => r.name);
  },
};
