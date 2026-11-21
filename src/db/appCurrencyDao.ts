// BUG-01 (ürün kararı A, 6b): uygulama tek para birimlidir ve para birimi bir
// etikettir. Ayarlar'da değiştirildiğinde tutarlar çevrilmez (kur bilinmez);
// bütün kayıtların etiketi aynı transaction'da yeni koda geçer. Böylece
// para birimine göre süzen kuponlar, devirler ve eşleşmeler kaybolmaz.
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from './database';
import { SettingsDao } from './settingsDao';
import { SETTINGS_KEYS } from './settingsKeys';

export const DISPLAY_CURRENCY_SETTING = SETTINGS_KEYS.displayCurrency;

/** Para birimi kolonu taşıyan bütün tablolar (src/db/schema.ts). */
export const CURRENCY_TABLES = [
  'expenses',
  'budgets',
  'debts',
  'extra_incomes',
  'container_deposit_vouchers',
  'container_deposit_recoveries',
  'budget_rollovers',
  'recurring_payment_reminders',
  'subscriptions',
  'savings_goal',
] as const;

/**
 * Bütün para birimi etiketlerini `code` yapar; çağıranın transaction'ına
 * katılır (Ayarlar'da değişiklik ve yedekten içe aktarım).
 */
export async function relabelCurrencyRows(
  db: Pick<SQLiteDatabase, 'runAsync'>,
  code: string,
): Promise<void> {
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('INVALID_CURRENCY');
  for (const table of CURRENCY_TABLES) {
    await db.runAsync(
      `UPDATE ${table} SET currency = ? WHERE currency IS NULL OR currency <> ?`,
      [code, code],
    );
  }
}

/**
 * Kayıtlı uygulama para birimine göre etiketler (ayar yoksa uygulamanın
 * gösterdiği varsayılan PLN). Tek SQL alt sorgusuyla; çağıranın transaction'ına
 * katılır. Yedekten içe aktarım sonunda kullanılır.
 */
export async function relabelCurrencyRowsToAppCurrency(
  db: Pick<SQLiteDatabase, 'runAsync'>,
): Promise<void> {
  const appCurrency = `COALESCE((SELECT value FROM settings WHERE key = '${DISPLAY_CURRENCY_SETTING}'
      AND length(value) = 3 AND value = upper(value)), 'PLN')`;
  for (const table of CURRENCY_TABLES) {
    await db.runAsync(
      `UPDATE ${table} SET currency = ${appCurrency}
        WHERE currency IS NULL OR currency <> ${appCurrency}`,
    );
  }
}

export async function setAppCurrency(code: string): Promise<void> {
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('INVALID_CURRENCY');
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await relabelCurrencyRows(db, code);
    await SettingsDao.set(DISPLAY_CURRENCY_SETTING, code, db);
  });
}
