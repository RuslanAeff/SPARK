import { purgeBackupCopies } from './temporaryFiles';
// S.P.A.R.K. — Tüm finansal verilerin sıfırlanması
//
// Geri alınamaz tek yıkıcı işlem burada tanımlıdır. Kapsam BİLİNÇLİ olarak
// dardır: kullanıcının GİRDİĞİ finansal veri silinir, uygulamanın kendisi
// (tercihler, sistem kategorileri, migration bayrakları, API anahtarı) durur.
// Böylece sıfırlama "uygulamayı yeniden kur" değil, "defteri temizle" demektir.
//
// KORUNANLAR ve nedenleri:
//  • `settings` tablosu — dil, tema, para birimi, döngü günü, kart düzeni ve
//    MIGRATION BAYRAKLARI burada. Silinirse tamamlanmış migration'lar yeniden
//    çalışır; veri kaybı değil ama gereksiz risk.
//  • Sistem kategorileri (`is_system = 1`) — uygulamanın iskeleti, kullanıcı
//    verisi değil. Kullanıcının eklediği kategoriler silinir.
//  • Gemini API anahtarı — SecureStore'da, bu tabloların dışında.
//
// NATIVE ALARMLAR: burada ledger'a DOKUNULMAZ. Ledger, uygulamanın işletim
// sistemine yazdığı alarmların tek kaydıdır; silinirse alarmlar OS'ta öksüz
// kalır ve bir daha iptal edilemez. Doğru sıra: veriyi sil → çağıran taraf
// bildirim senkronunu tetikler → istenen durum boş olduğu için uzlaştırıcı
// alarmların hepsini iptal eder.
import { getDatabase } from '../db/database';

export interface UserDataSummary {
  expenses: number;
  items: number;
  vendors: number;
  budgets: number;
  debts: number;
  incomes: number;
  paymentPlans: number;
  products: number;
  /** Kullanıcının eklediği kategoriler (sistem ağacı sayılmaz). */
  customCategories: number;
  categoryLimits: number;
  /** Birikim hedefi tanımlı mı (0 veya 1). */
  goals: number;
  /** Yukarıdakilerin toplamı — "silinecek bir şey var mı" kapısı. */
  total: number;
}

/**
 * Silinecek tablolar, YABANCI ANAHTAR sırasına göre. Çocuk tablolar önce
 * gelir: `ON DELETE CASCADE` tanımlı olsa bile sıralı silme, cascade'i
 * desteklemeyen/kapalı olan ortamlarda da aynı sonucu verir.
 */
const WIPE_ORDER: readonly string[] = [
  'budget_rollovers',
  'debt_payments',
  'debts',
  'expense_items',
  'expenses',
  'extra_incomes',
  'recurring_payment_reminders',
  'subscriptions',
  'category_limits',
  'savings_goal',
  'product_aliases',
  'canonical_products',
  'vendors',
  'budgets',
];

/**
 * Silinen borç/plan kayıtlarına atıfta bulunan bildirim durumu. Feed ve kural
 * durumu temizlenir (yoksa artık var olmayan bir borcun uyarısı listede kalır);
 * sessize alma tercihleri KULLANICI TERCİHİDİR, korunur.
 */
const NOTIFICATION_STATE_KEYS: readonly string[] = [
  'notif_feed_v1',
  'notif_rules_state_v1',
];

/** Onay ekranında gösterilecek sayımlar. Hiçbir şey yazmaz. */
export async function summarizeUserData(): Promise<UserDataSummary> {
  const db = await getDatabase();
  const count = async (sql: string): Promise<number> => {
    const row = await db.getFirstAsync<{ value: number }>(sql);
    return Number(row?.value) || 0;
  };

  const summary = {
    expenses: await count('SELECT COUNT(*) AS value FROM expenses'),
    items: await count('SELECT COUNT(*) AS value FROM expense_items'),
    vendors: await count('SELECT COUNT(*) AS value FROM vendors'),
    budgets: await count('SELECT COUNT(*) AS value FROM budgets'),
    debts: await count('SELECT COUNT(*) AS value FROM debts'),
    incomes: await count('SELECT COUNT(*) AS value FROM extra_incomes'),
    paymentPlans: await count('SELECT COUNT(*) AS value FROM recurring_payment_reminders'),
    products: await count('SELECT COUNT(*) AS value FROM canonical_products'),
    customCategories: await count(
      'SELECT COUNT(*) AS value FROM categories WHERE COALESCE(is_system, 0) = 0',
    ),
    categoryLimits: await count('SELECT COUNT(*) AS value FROM category_limits'),
    goals: await count('SELECT COUNT(*) AS value FROM savings_goal'),
  };

  return {
    ...summary,
    total: summary.expenses
      + summary.vendors
      + summary.budgets
      + summary.debts
      + summary.incomes
      + summary.paymentPlans
      + summary.products
      + summary.customCategories
      + summary.categoryLimits
      + summary.goals,
  };
}

/**
 * Kullanıcının bütün finansal verisini tek transaction içinde siler. Ya hepsi
 * gider ya hiçbiri: yarım silinmiş bir defter, silinmemiş defterden kötüdür.
 *
 * Çağıran taraf, dönüşün ardından bildirim senkronunu tetiklemelidir; aksi
 * hâlde silinmiş borçların native alarmları OS'ta çalmaya devam eder.
 */
export async function resetAllUserData(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const table of WIPE_ORDER) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    // Kullanıcının eklediği kategoriler gider, sistem ağacı kalır.
    await db.runAsync('DELETE FROM categories WHERE COALESCE(is_system, 0) = 0');
    for (const key of NOTIFICATION_STATE_KEYS) {
      await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
    }
  });
  await purgeBackupCopies(true);
}
