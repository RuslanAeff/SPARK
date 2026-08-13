jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { cache: '/tmp' },
}));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

import { getDatabase } from '../../db/database';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import {
  BACKUP_FORMAT_VERSION,
  BackupPayload,
  buildBackupPayload,
  importBackupPayload,
  pickAndParseBackupFile,
  validateAndNormalizeBackupPayload,
} from '../backupService';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;
const documentPickerMock = DocumentPicker.getDocumentAsync as jest.MockedFunction<
  typeof DocumentPicker.getDocumentAsync
>;
const FileMock = File as unknown as jest.Mock;
const exportedAt = '2026-08-09T12:00:00.000Z';

const baseData = () => ({
  expenses: [],
  categories: [],
  vendors: [],
  budgets: [],
});

const makeV3Payload = (): BackupPayload => ({
  version: 3,
  app: 'S.P.A.R.K.',
  exportedAt,
  range: { start: '2026-08-01', end: '2026-08-31' },
  data: {
    ...baseData(),
    expenses: [{
      source_id: 10,
      created_at: '2026-08-05T09:00:00.000Z',
      date: '2026-08-05',
      total_amount: 10,
      currency: 'PLN',
      note: 'Linked receipt',
      receipt_uri: null,
      vendor_name: 'ISP',
      category_name: null,
      items: [],
    }],
    vendors: [{ name: 'ISP', logo_uri: null, default_category_name: null }],
    dismissed_subscriptions: [],
    debts: [{
      source_id: 20,
      linked_expense_source_id: 10,
      linked_expense_relation_omitted: false,
      direction: 'borrowed',
      counterparty: 'Bank',
      amount: 100,
      currency: 'PLN',
      date: '2026-08-05',
      due_date: '2026-09-05',
      reminder_enabled: true,
      reminder_days_before: 3,
      reminder_time: '09:00',
      note: null,
      created_at: '2026-08-05T10:00:00.000Z',
    }],
    debt_payments: [{
      source_id: 30,
      debt_source_id: 20,
      amount: 40,
      date: '2026-08-10',
      created_at: '2026-08-10T10:00:00.000Z',
    }],
    extra_incomes: [{
      source_id: 40,
      source: 'Freelance',
      amount: 80,
      currency: 'PLN',
      date: '2026-08-11',
      note: null,
      created_at: '2026-08-11T10:00:00.000Z',
    }],
    recurring_payment_reminders: [{
      uid: '123e4567-e89b-42d3-a456-426614174000',
      title: 'Internet',
      vendor_name: 'ISP',
      expected_amount: 60,
      currency: 'PLN',
      anchor_date: '2026-08-15',
      next_due_date: '2026-09-15',
      recurrence_unit: 'month',
      recurrence_interval: 1,
      reminder_days_before: 2,
      reminder_time: '09:00',
      status: 'active',
      source: 'manual',
      note: null,
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-01T10:00:00.000Z',
    }],
  },
});

describe('backup payload version compatibility and validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([1, 2])('normalizes a valid v%s payload without v3 collections', (version) => {
    const input: BackupPayload = {
      version,
      app: 'S.P.A.R.K.',
      exportedAt,
      range: { start: '2026-08-01', end: '2026-08-31' },
      data: {
        ...baseData(),
        ...(version === 2
          ? { dismissed_subscriptions: [{ vendor_name: 'Old vendor' }] }
          : {}),
      },
    };

    const normalized = validateAndNormalizeBackupPayload(input);

    expect(normalized.data.debts).toEqual([]);
    expect(normalized.data.debt_payments).toEqual([]);
    expect(normalized.data.extra_incomes).toEqual([]);
    expect(normalized.data.recurring_payment_reminders).toEqual([]);
    expect(normalized.data.dismissed_subscriptions).toEqual(
      version === 2 ? [{ vendor_name: 'Old vendor' }] : [],
    );
  });

  it('rejects a future version before opening the database', async () => {
    const future = { ...makeV3Payload(), version: BACKUP_FORMAT_VERSION + 1 };

    await expect(importBackupPayload(future)).rejects.toThrow('UNSUPPORTED_VERSION');
    expect(getDatabaseMock).not.toHaveBeenCalled();
  });

  it('requires every v3 collection', () => {
    const invalid = makeV3Payload();
    delete invalid.data.debts;

    expect(() => validateAndNormalizeBackupPayload(invalid)).toThrow('INVALID_FORMAT');
  });

  it.each([
    ['strict calendar date', (p: BackupPayload) => { p.data.debts![0].due_date = '2026-02-31'; }],
    ['orphan payment', (p: BackupPayload) => { p.data.debt_payments![0].debt_source_id = 999; }],
    ['aggregate overpayment', (p: BackupPayload) => { p.data.debt_payments![0].amount = 100.01; }],
    ['non-canonical reminder UID', (p: BackupPayload) => { p.data.recurring_payment_reminders![0].uid = 'REMINDER-1'; }],
    ['out-of-schema recurrence interval', (p: BackupPayload) => { p.data.recurring_payment_reminders![0].recurrence_interval = 1000; }],
    ['next due before anchor', (p: BackupPayload) => { p.data.recurring_payment_reminders![0].next_due_date = '2026-08-14'; }],
    ['next due outside recurrence schedule', (p: BackupPayload) => {
      p.data.recurring_payment_reminders![0].next_due_date = '2026-09-14';
    }],
    ['detected reminder without vendor', (p: BackupPayload) => {
      p.data.recurring_payment_reminders![0].source = 'detected';
      p.data.recurring_payment_reminders![0].vendor_name = null;
    }],
    ['oversized reminder title', (p: BackupPayload) => {
      p.data.recurring_payment_reminders![0].title = 'x'.repeat(201);
    }],
  ])('rejects invalid v3 %s before a transaction', async (_label, mutate) => {
    const invalid = makeV3Payload();
    mutate(invalid);

    await expect(importBackupPayload(invalid)).rejects.toThrow('INVALID_FORMAT');
    expect(getDatabaseMock).not.toHaveBeenCalled();
  });

  it('accepts a zero expected amount because it is a valid nonnegative estimate', () => {
    const payload = makeV3Payload();
    payload.data.recurring_payment_reminders![0].expected_amount = 0;

    expect(() => validateAndNormalizeBackupPayload(payload)).not.toThrow();
  });

  it('normalizes a valid uppercase reminder UUID before import', () => {
    const payload = makeV3Payload();
    payload.data.recurring_payment_reminders![0].uid =
      '123E4567-E89B-42D3-A456-426614174000';

    const normalized = validateAndNormalizeBackupPayload(payload);

    expect(normalized.data.recurring_payment_reminders[0].uid)
      .toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  it('normalizes a fully paid debt reminder to the canonical disabled state', () => {
    const payload = makeV3Payload();
    payload.data.debt_payments![0].amount = 100;

    const normalized = validateAndNormalizeBackupPayload(payload);

    expect(normalized.data.debts[0].reminder_enabled).toBe(false);
  });

  it('uses the shared minor-unit policy when deciding whether a debt is settled', () => {
    const payload = makeV3Payload();
    payload.data.debts![0].amount = 1.005;
    payload.data.debt_payments![0].amount = 1.004;

    const normalized = validateAndNormalizeBackupPayload(payload);

    expect(normalized.data.debts[0].reminder_enabled).toBe(true);
  });

  it('rejects an oversized backup before reading it into memory', async () => {
    const text = jest.fn();
    documentPickerMock.mockResolvedValueOnce({
      canceled: false,
      assets: [{
        uri: 'file:///oversized.json',
        name: 'oversized.json',
        mimeType: 'application/json',
        size: 26 * 1024 * 1024,
        lastModified: Date.now(),
      }],
    });
    FileMock.mockImplementationOnce(() => ({ size: 26 * 1024 * 1024, text }));

    await expect(pickAndParseBackupFile()).rejects.toThrow('INVALID_FORMAT');
    expect(text).not.toHaveBeenCalled();
  });
});

describe('buildBackupPayload v3 relational closure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exports full debt payment history and the complete vendor union', async () => {
    const getAllAsync = jest.fn(async (sql: string) => {
      if (sql.includes('FROM expenses e')) return [{
        id: 1, vendor_id: 1, category_id: null, total_amount: 10,
        currency: 'PLN', note: null, receipt_uri: null, date: '2026-08-05',
        created_at: exportedAt, vendor_name: 'Shop', category_name: null,
      }];
      if (sql.includes('FROM expense_items i')) return [];
      if (sql.includes("WHERE s.status = 'dismissed'")) return [{ vendor_name: 'Dismissed vendor' }];
      if (sql.includes('SELECT d.id, d.direction')) return [{
        id: 7, direction: 'borrowed', counterparty: 'Bank', amount: 100,
        remaining: 50, currency: 'PLN', date: '2026-01-10', status: 'open', due_date: null,
        reminder_enabled: 0, reminder_days_before: 3, reminder_time: '09:00',
        linked_expense_id: 1, note: null, created_at: '2026-01-10T10:00:00.000Z',
      }];
      if (sql.includes('SELECT p.id, p.debt_id')) return [
        { id: 70, debt_id: 7, amount: 20, date: '2026-02-01', created_at: '2026-02-01T10:00:00.000Z' },
        { id: 71, debt_id: 7, amount: 30, date: '2026-08-12', created_at: '2026-08-12T10:00:00.000Z' },
      ];
      if (sql.includes('FROM extra_incomes')) return [{
        id: 8, source: 'Gift', amount: 25, currency: 'PLN', date: '2026-08-03',
        note: null, created_at: '2026-08-03T10:00:00.000Z',
      }];
      if (sql.includes('FROM recurring_payment_reminders r')) return [{
        uid: '223e4567-e89b-42d3-a456-426614174000', title: 'Internet', vendor_name: 'ISP', expected_amount: 60,
        currency: 'PLN', anchor_date: '2026-08-15', next_due_date: '2026-09-15',
        recurrence_unit: 'month', recurrence_interval: 1, reminder_days_before: 2,
        reminder_time: '09:00', status: 'active', source: 'manual', note: null,
        created_at: exportedAt, updated_at: exportedAt,
      }];
      if (sql.includes('FROM vendors v')) return [
        { id: 1, name: 'Shop', logo_uri: null, default_category_id: null, created_at: exportedAt, default_category_name: null },
        { id: 2, name: 'Dismissed vendor', logo_uri: null, default_category_id: null, created_at: exportedAt, default_category_name: null },
        { id: 3, name: 'ISP', logo_uri: null, default_category_id: null, created_at: exportedAt, default_category_name: null },
        { id: 4, name: 'Unrelated', logo_uri: null, default_category_id: null, created_at: exportedAt, default_category_name: null },
      ];
      if (sql === 'SELECT * FROM categories') return [];
      if (sql.includes('FROM budgets WHERE active = 1')) return [];
      throw new Error(`Unexpected query: ${sql}`);
    });
    getDatabaseMock.mockResolvedValue({ getAllAsync } as any);

    const payload = await buildBackupPayload({ start: '2026-08-01', end: '2026-08-31' });

    expect(payload.version).toBe(3);
    expect(payload.data.debts).toHaveLength(1);
    expect(payload.data.debt_payments?.map(payment => payment.source_id)).toEqual([70, 71]);
    expect(payload.data.extra_incomes).toHaveLength(1);
    expect(payload.data.recurring_payment_reminders).toHaveLength(1);
    expect(payload.data.vendors.map(vendor => vendor.name)).toEqual([
      'Shop', 'Dismissed vendor', 'ISP',
    ]);
    const debtQueryCall = getAllAsync.mock.calls.find(call => String(call[0]).includes('SELECT d.id')) as
      | [string, unknown[]]
      | undefined;
    expect(debtQueryCall?.[1])
      .toEqual(['2026-08-01', '2026-08-31', '2026-08-01', '2026-08-31']);
  });
});

function createFakeDatabase() {
  const state = {
    vendors: [] as any[],
    expenses: [] as any[],
    debts: [] as any[],
    payments: [] as any[],
    incomes: [] as any[],
    reminders: [] as any[],
  };
  let nextId = 100;
  const normalizedSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

  const getAllAsync = jest.fn(async (sql: string) => {
    const query = normalizedSql(sql);
    if (query === 'SELECT * FROM categories') return [];
    if (query.includes('FROM vendors')) return state.vendors;
    if (query.includes('FROM expenses ORDER BY id ASC')) return state.expenses;
    if (query.includes('FROM debts ORDER BY id ASC')) return state.debts;
    if (query.includes('FROM debt_payments ORDER BY id ASC')) return state.payments;
    if (query.includes('FROM extra_incomes ORDER BY id ASC')) return state.incomes;
    throw new Error(`Unexpected getAllAsync: ${query}`);
  });

  const getFirstAsync = jest.fn(async (sql: string, params: any[] = []) => {
    const query = normalizedSql(sql);
    if (query.includes('SELECT id FROM expenses')) {
      const [date, amount, vendorId, note] = params;
      return state.expenses.find(expense => expense.date === date
        && Math.abs(expense.total_amount - amount) < 0.005
        && (expense.vendor_id ?? -1) === (vendorId ?? -1)
        && (expense.note ?? '') === (note ?? '')) ?? null;
    }
    if (query.includes('FROM debts WHERE created_at')) {
      return state.debts.find(debt => debt.created_at === params[0]) ?? null;
    }
    if (query.includes('FROM debt_payments WHERE debt_id') && query.includes('created_at')) {
      return state.payments.find(payment => payment.debt_id === params[0]
        && payment.created_at === params[1]) ?? null;
    }
    if (query === 'SELECT amount FROM debts WHERE id = ?') {
      const debt = state.debts.find(row => row.id === params[0]);
      return debt ? { amount: debt.amount } : null;
    }
    if (query.includes('SUM(amount)') && query.includes('FROM debt_payments')) {
      return { total: state.payments
        .filter(payment => payment.debt_id === params[0])
        .reduce((sum, payment) => sum + payment.amount, 0) };
    }
    if (query.includes('FROM extra_incomes WHERE created_at')) {
      return state.incomes.find(income => income.created_at === params[0]) ?? null;
    }
    if (query.includes('FROM recurring_payment_reminders WHERE uid')) {
      return state.reminders.find(reminder => reminder.uid === params[0]) ?? null;
    }
    if (query.includes("WHERE source = 'detected'")) {
      return state.reminders.find(reminder => reminder.source === 'detected'
        && reminder.vendor_id === params[0]) ?? null;
    }
    if (query.includes('FROM budgets WHERE start_date')) return null;
    throw new Error(`Unexpected getFirstAsync: ${query}`);
  });

  const runAsync = jest.fn(async (sql: string, params: any[] = []) => {
    const query = normalizedSql(sql);
    if (query.startsWith('INSERT INTO vendors')) {
      const row = { id: nextId++, name: params[0], logo_uri: params[1], default_category_id: params[2], created_at: exportedAt };
      state.vendors.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (query.startsWith('INSERT INTO expenses')) {
      const row = {
        id: nextId++,
        vendor_id: params[0],
        category_id: params[1],
        total_amount: params[2],
        currency: params[3],
        note: params[4],
        receipt_uri: params[5],
        date: params[6],
        created_at: params[7] ?? exportedAt,
      };
      state.expenses.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (query.startsWith('INSERT INTO debts')) {
      const row = {
        id: nextId++, direction: params[0], counterparty: params[1], amount: params[2],
        remaining: params[3], currency: params[4], date: params[5], status: 'open',
        linked_expense_id: params[6], note: params[7], created_at: params[8],
        due_date: params[9], reminder_enabled: params[10], reminder_days_before: params[11],
        reminder_time: params[12],
      };
      state.debts.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (query.startsWith('INSERT INTO debt_payments')) {
      const row = { id: nextId++, debt_id: params[0], amount: params[1], date: params[2], created_at: params[3] };
      state.payments.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (query.startsWith('UPDATE debts SET remaining')) {
      const debt = state.debts.find(row => row.id === params[3]);
      debt.remaining = params[0];
      debt.status = params[1];
      if (params[2] === 0) debt.reminder_enabled = 0;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (query.startsWith('INSERT INTO extra_incomes')) {
      const row = { id: nextId++, source: params[0], amount: params[1], currency: params[2], date: params[3], note: params[4], created_at: params[5] };
      state.incomes.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (query.startsWith('INSERT INTO recurring_payment_reminders')) {
      const row = {
        id: nextId++, uid: params[0], title: params[1], vendor_id: params[2],
        expected_amount: params[3], currency: params[4], anchor_date: params[5],
        next_due_date: params[6], recurrence_unit: params[7], recurrence_interval: params[8],
        reminder_days_before: params[9], reminder_time: params[10], status: params[11],
        source: params[12], note: params[13], created_at: params[14], updated_at: params[15],
      };
      state.reminders.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (query.startsWith('UPDATE vendors')) return { lastInsertRowId: 0, changes: 1 };
    throw new Error(`Unexpected runAsync: ${query}`);
  });

  return {
    state,
    db: {
      getAllAsync,
      getFirstAsync,
      runAsync,
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    },
  };
}

describe('importBackupPayload v3 mapping and idempotency', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps generated IDs, derives debt state, restores income/reminder, and reimports once', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    const payload = makeV3Payload();

    const first = await importBackupPayload(payload);

    expect(first).toMatchObject({
      expensesAdded: 1,
      debtsAdded: 1,
      debtPaymentsAdded: 1,
      extraIncomesAdded: 1,
      remindersAdded: 1,
    });
    expect(fake.state.debts[0].linked_expense_id).toBe(fake.state.expenses[0].id);
    expect(fake.state.payments[0].debt_id).toBe(fake.state.debts[0].id);
    expect(fake.state.debts[0]).toMatchObject({ remaining: 60, status: 'open' });
    expect(fake.state.incomes).toHaveLength(1);
    expect(fake.state.reminders[0]).toMatchObject({
      uid: '123e4567-e89b-42d3-a456-426614174000',
      vendor_id: fake.state.vendors[0].id,
    });

    const second = await importBackupPayload(payload);

    expect(second).toMatchObject({
      expensesAdded: 0,
      expensesSkipped: 1,
      debtsAdded: 0,
      debtsSkipped: 1,
      debtPaymentsAdded: 0,
      debtPaymentsSkipped: 1,
      extraIncomesAdded: 0,
      extraIncomesSkipped: 1,
      remindersAdded: 0,
      remindersSkipped: 1,
    });
    expect(fake.state.expenses).toHaveLength(1);
    expect(fake.state.debts).toHaveLength(1);
    expect(fake.state.payments).toHaveLength(1);
    expect(fake.state.incomes).toHaveLength(1);
    expect(fake.state.reminders).toHaveLength(1);
    expect(fake.state.debts[0]).toMatchObject({ remaining: 60, status: 'open' });
  });

  it('disables an imported debt reminder when complete payment history settles it', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    const payload = makeV3Payload();
    payload.data.debt_payments![0].amount = 100;

    await importBackupPayload(payload);
    const second = await importBackupPayload(payload);

    expect(fake.state.debts[0]).toMatchObject({
      remaining: 0,
      status: 'settled',
      reminder_enabled: 0,
    });
    expect(second).toMatchObject({
      debtsAdded: 0,
      debtsSkipped: 1,
      debtPaymentsAdded: 0,
      debtPaymentsSkipped: 1,
    });
    expect(fake.state.debts).toHaveLength(1);
    expect(fake.state.payments).toHaveLength(1);
  });

  it('keeps two legitimate expenses with identical business fields distinct', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    const payload = makeV3Payload();
    payload.data.expenses!.push({
      ...payload.data.expenses![0],
      source_id: 11,
      created_at: '2026-08-05T09:00:01.000Z',
      items: [],
    });

    const first = await importBackupPayload(payload);
    const second = await importBackupPayload(payload);

    expect(first.expensesAdded).toBe(2);
    expect(fake.state.expenses).toHaveLength(2);
    expect(second.expensesSkipped).toBe(2);
    expect(fake.state.expenses).toHaveLength(2);
  });

  it('keeps identical legitimate debts, payments, and incomes distinct and reimportable', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    const payload = makeV3Payload();
    payload.data.debts!.push({
      ...payload.data.debts![0],
      source_id: 21,
    });
    payload.data.debt_payments!.push({
      ...payload.data.debt_payments![0],
      source_id: 31,
      debt_source_id: 21,
    });
    payload.data.extra_incomes!.push({
      ...payload.data.extra_incomes![0],
      source_id: 41,
    });

    const first = await importBackupPayload(payload);
    const second = await importBackupPayload(payload);

    expect(first).toMatchObject({
      debtsAdded: 2,
      debtPaymentsAdded: 2,
      extraIncomesAdded: 2,
    });
    expect(second).toMatchObject({
      debtsAdded: 0,
      debtsSkipped: 2,
      debtPaymentsAdded: 0,
      debtPaymentsSkipped: 2,
      extraIncomesAdded: 0,
      extraIncomesSkipped: 2,
    });
    expect(fake.state.debts).toHaveLength(2);
    expect(fake.state.payments).toHaveLength(2);
    expect(fake.state.incomes).toHaveLength(2);
    expect(new Set(fake.state.payments.map(payment => payment.debt_id)).size).toBe(2);
  });

  it('treats a range-omitted linked expense as absent relation data, not a new debt', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    await importBackupPayload(makeV3Payload());
    const partialRange = makeV3Payload();
    partialRange.data.expenses = [];
    partialRange.data.debts![0].linked_expense_source_id = null;
    partialRange.data.debts![0].linked_expense_relation_omitted = true;

    const result = await importBackupPayload(partialRange);

    expect(result).toMatchObject({
      expensesAdded: 0,
      debtsAdded: 0,
      debtsSkipped: 1,
      debtPaymentsAdded: 0,
      debtPaymentsSkipped: 1,
    });
    expect(fake.state.debts).toHaveLength(1);
    expect(fake.state.debts[0].linked_expense_id).toBe(fake.state.expenses[0].id);
  });

  it('does not collapse a truly unlinked debt into an otherwise identical linked debt', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    await importBackupPayload(makeV3Payload());
    const unlinked = makeV3Payload();
    unlinked.data.expenses = [];
    unlinked.data.debts![0].linked_expense_source_id = null;
    unlinked.data.debts![0].linked_expense_relation_omitted = false;

    const result = await importBackupPayload(unlinked);

    expect(result).toMatchObject({ debtsAdded: 1, debtsSkipped: 0 });
    expect(fake.state.debts).toHaveLength(2);
    expect(fake.state.debts[0].linked_expense_id).toBe(fake.state.expenses[0].id);
    expect(fake.state.debts[1].linked_expense_id).toBeNull();
  });

  it('rejects a merged local-plus-backup payment history that would overpay', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    const payload = makeV3Payload();
    await importBackupPayload(payload);
    const targetDebtId = fake.state.debts[0].id;
    fake.state.payments.push({
      id: 999,
      debt_id: targetDebtId,
      amount: 60,
      date: '2026-08-20',
      created_at: '2026-08-20T10:00:00.000Z',
    });

    const conflicting = makeV3Payload();
    conflicting.data.debt_payments![0] = {
      ...conflicting.data.debt_payments![0],
      amount: 10,
      date: '2026-08-21',
      created_at: '2026-08-21T10:00:00.000Z',
    };

    await expect(importBackupPayload(conflicting)).rejects.toThrow('INVALID_FORMAT');
    expect(fake.state.payments).toHaveLength(2);
  });

  it('rejects a conflicting payload that reuses an existing reminder UID', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    await importBackupPayload(makeV3Payload());
    const conflicting = makeV3Payload();
    conflicting.data.recurring_payment_reminders![0].title = 'Changed title';

    await expect(importBackupPayload(conflicting)).rejects.toThrow('INVALID_FORMAT');
    expect(fake.state.reminders).toHaveLength(1);
  });

  it('rejects a different detected UID for the same vendor', async () => {
    const fake = createFakeDatabase();
    getDatabaseMock.mockResolvedValue(fake.db as any);
    const first = makeV3Payload();
    first.data.recurring_payment_reminders![0].source = 'detected';
    await importBackupPayload(first);
    const conflicting = makeV3Payload();
    conflicting.data.recurring_payment_reminders![0] = {
      ...conflicting.data.recurring_payment_reminders![0],
      uid: '223e4567-e89b-42d3-a456-426614174000',
      source: 'detected',
    };

    await expect(importBackupPayload(conflicting)).rejects.toThrow('INVALID_FORMAT');
    expect(fake.state.reminders).toHaveLength(1);
  });
});
