import { resetAllUserData, summarizeUserData } from '../dataReset';
import { getDatabase } from '../../db/database';

jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));

function mockDb() {
  const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
  const getFirstAsync = jest.fn().mockResolvedValue({ value: 3 });
  const database = {
    runAsync,
    getFirstAsync,
    withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
  };
  (getDatabase as jest.Mock).mockResolvedValue(database);
  return { database, runAsync, getFirstAsync };
}

describe('resetAllUserData', () => {
  it('bütün finansal tabloları tek transaction içinde boşaltır', async () => {
    const { database, runAsync } = mockDb();

    await resetAllUserData();

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    const wiped = runAsync.mock.calls
      .map(([sql]) => String(sql))
      .filter(sql => sql.startsWith('DELETE FROM'));
    for (const table of [
      'expenses', 'expense_items', 'vendors', 'budgets', 'debts', 'debt_payments',
      'extra_incomes', 'recurring_payment_reminders', 'subscriptions',
      'category_limits', 'savings_goal', 'canonical_products', 'product_aliases',
    ]) {
      expect(wiped).toContain(`DELETE FROM ${table}`);
    }
  });

  it('çocuk tabloyu ebeveyninden önce siler (FK sırası)', async () => {
    const { runAsync } = mockDb();

    await resetAllUserData();

    const order = runAsync.mock.calls.map(([sql]) => String(sql));
    const before = (child: string, parent: string) =>
      order.indexOf(`DELETE FROM ${child}`) < order.indexOf(`DELETE FROM ${parent}`);
    expect(before('debt_payments', 'debts')).toBe(true);
    expect(before('expense_items', 'expenses')).toBe(true);
    expect(before('expenses', 'vendors')).toBe(true);
    expect(before('subscriptions', 'vendors')).toBe(true);
    expect(before('product_aliases', 'canonical_products')).toBe(true);
  });

  it('sistem kategorilerini ve tercihleri korur', async () => {
    const { runAsync } = mockDb();

    await resetAllUserData();

    const statements = runAsync.mock.calls.map(([sql]) => String(sql));
    // Kategoriler koşulsuz silinmez: yalnız kullanıcının eklediği satırlar.
    expect(statements).not.toContain('DELETE FROM categories');
    expect(statements).toContain(
      'DELETE FROM categories WHERE COALESCE(is_system, 0) = 0',
    );
    // Ayarlar tablosu toptan silinmez — dil/tema/migration bayrakları orada.
    expect(statements).not.toContain('DELETE FROM settings');
  });

  it('silinen kayıtlara atıfta bulunan bildirim durumunu temizler, susturmayı korur', async () => {
    const { runAsync } = mockDb();

    await resetAllUserData();

    const settingsDeletes = runAsync.mock.calls
      .filter(([sql]) => String(sql) === 'DELETE FROM settings WHERE key = ?')
      .map(([, params]) => (params as string[])[0]);
    expect(settingsDeletes).toEqual(['notif_feed_v1', 'notif_rules_state_v1']);
    // Native alarm defteri BURADA silinmez; silinirse alarmlar OS'ta öksüz kalır.
    expect(settingsDeletes).not.toContain('notif_android_reminder_schedule_v1');
    expect(settingsDeletes).not.toContain('notif_mutes_v1');
  });
});

describe('summarizeUserData', () => {
  it('sayımları toplar ve toplamı kalem sayısını iki kez saymadan verir', async () => {
    const { getFirstAsync } = mockDb();
    // Her sorgu 3 döndürür: 11 sorgu, 10'u toplama girer (kalemler hariç).
    const summary = await summarizeUserData();

    expect(getFirstAsync).toHaveBeenCalledTimes(11);
    expect(summary.expenses).toBe(3);
    expect(summary.items).toBe(3);
    expect(summary.total).toBe(30);
  });

  it('boş veritabanında toplamı sıfır bildirir', async () => {
    const { getFirstAsync } = mockDb();
    getFirstAsync.mockResolvedValue({ value: 0 });

    const summary = await summarizeUserData();

    expect(summary.total).toBe(0);
  });
});
