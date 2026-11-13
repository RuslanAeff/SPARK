// BUG-20 (ürün kararı A) kabul kriteri: yedek alındıktan sonra cihazda kendiliğinden
// değişen kayıtlar (süresi dolan kupon, vadesi ilerleyen hatırlatıcı) aynı yedeğin
// geri yüklenmesini engellemez; cihazdaki hâl korunur ve işlem başarıyla biter.
// Gerçek SQLite ve uygulamanın tam açılış zinciri.
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

function load() {
  let m!: {
    database: typeof import('../../db/database');
    backup: typeof import('../backupService');
    deposits: typeof import('../../db/containerDepositDao');
    reminders: typeof import('../../db/recurringPaymentReminderDao');
    currency: typeof import('../../db/appCurrencyDao');
  };
  jest.isolateModules(() => {
    m = {
      database: require('../../db/database'),
      backup: require('../backupService'),
      deposits: require('../../db/containerDepositDao'),
      reminders: require('../../db/recurringPaymentReminderDao'),
      currency: require('../../db/appCurrencyDao'),
    };
  });
  return m;
}

describe('içe aktarımda cihaz kazanır (BUG-20)', () => {
  it('süresi dolan kupon ve vadesi ilerleyen hatırlatıcı aynı yedeğin geri yüklenmesini engellemez', async () => {
    const { database, backup, deposits, reminders } = load();
    const db = await database.getDatabase();
    await deposits.ContainerDepositDao.createVoucher({
      amount: 2, currency: 'PLN', issuedDate: '2026-10-01', expiresOn: '2026-10-15',
    });
    await reminders.RecurringPaymentReminderDao.create({
      title: 'Kira', expectedAmount: 2000, currency: 'PLN',
      anchorDate: '2026-10-01', nextDueDate: '2026-10-01', recurrenceUnit: 'month',
    });
    await db.runAsync(
      "INSERT INTO expenses (total_amount, currency, date, created_at) VALUES (40, 'PLN', '2026-10-05', '2026-10-05T10:00:00Z')",
    );
    const payload = JSON.parse(JSON.stringify(
      await backup.buildBackupPayload({ start: '2026-10-01', end: '2026-10-31' }),
    ));

    // Yedekten sonra zaman geçti: kupon süresi doldu, hatırlatıcı bir ay ilerledi.
    await deposits.ContainerDepositDao.expirePastDue('2026-11-11');
    await reminders.RecurringPaymentReminderDao.advancePastDue('2026-11-11');
    const before = {
      voucher: await db.getFirstAsync('SELECT status FROM container_deposit_vouchers'),
      reminder: await db.getFirstAsync('SELECT next_due_date FROM recurring_payment_reminders'),
    };
    expect(before.voucher).toEqual({ status: 'expired' });

    const summary = await backup.importBackupPayload(payload);

    expect(summary).toMatchObject({
      depositVouchersSkipped: 1, remindersSkipped: 1, expensesSkipped: 1, expensesAdded: 0, keptLocal: 2,
    });
    expect(await db.getFirstAsync('SELECT status FROM container_deposit_vouchers')).toEqual(before.voucher);
    expect(await db.getFirstAsync('SELECT next_due_date FROM recurring_payment_reminders')).toEqual(before.reminder);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM expenses')).toEqual({ n: 1 });
  });

  it('para birimi yedekten sonra değiştiyse aynı kayıtlar çoğalmaz ve yeni etiketi alır (BUG-01 6b)', async () => {
    const { database, backup, currency } = load();
    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT INTO expenses (total_amount, currency, date, created_at) VALUES (40, 'PLN', '2026-10-05', '2026-10-05T10:00:00Z')",
    );
    await db.runAsync(
      "INSERT INTO extra_incomes (source, amount, currency, date, created_at) VALUES ('Bonus', 50, 'PLN', '2026-10-06', '2026-10-06T10:00:00Z')",
    );
    const payload = JSON.parse(JSON.stringify(
      await backup.buildBackupPayload({ start: '2026-10-01', end: '2026-10-31' }),
    ));
    // Yedekte olmayan, PLN etiketli yeni bir kayıt: içe aktarımla gelmiş gibi
    // davranır; içe aktarım sonunda o da uygulama para birimine çekilmeli.
    payload.data.extra_incomes.push({
      source_id: 999, uid: '923e4567-e89b-42d3-a456-426614174000', source: 'Hediye', amount: 10, currency: 'PLN',
      date: '2026-10-07', note: null, created_at: '2026-10-07T10:00:00Z',
    });

    await currency.setAppCurrency('EUR');
    const summary = await backup.importBackupPayload(payload);

    expect(summary).toMatchObject({ expensesAdded: 0, expensesSkipped: 1, extraIncomesAdded: 1, extraIncomesSkipped: 1 });
    expect(await db.getAllAsync('SELECT DISTINCT currency FROM expenses')).toEqual([{ currency: 'EUR' }]);
    expect(await db.getAllAsync('SELECT DISTINCT currency FROM extra_incomes')).toEqual([{ currency: 'EUR' }]);
  });
});
