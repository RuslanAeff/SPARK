// S.P.A.R.K. — Kullanıcı tarafından onaylanmış düzenli ödeme hatırlatıcıları
import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import {
  RecurringPaymentReminder,
  RecurringPaymentReminderSource,
  RecurringPaymentReminderStatus,
  ReminderRecurrenceUnit,
} from './schema';
import {
  isSupportedYmd,
  normalizeCanonicalUuid,
  sanitizeAmount,
  sanitizeText,
} from '../utils/inputValidation';
import { getNextOccurrence, isRecurringOccurrence } from '../utils/recurringSchedule';

const HH_MM_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const RECURRENCE_UNITS = new Set<ReminderRecurrenceUnit>(['day', 'week', 'month', 'year']);
const STATUSES = new Set<RecurringPaymentReminderStatus>(['active', 'paused']);
const SOURCES = new Set<RecurringPaymentReminderSource>(['manual', 'detected']);

export interface CreateRecurringPaymentReminderInput {
  /** Backup/import UID'si; verilmezse cihazda yeni UUID üretilir. */
  uid?: string;
  title: string;
  vendorId?: number | null;
  expectedAmount?: number | null;
  currency?: string;
  anchorDate: string;
  nextDueDate: string;
  recurrenceUnit: ReminderRecurrenceUnit;
  recurrenceInterval?: number;
  reminderDaysBefore?: number;
  reminderTime?: string;
  status?: RecurringPaymentReminderStatus;
  source?: RecurringPaymentReminderSource;
  note?: string | null;
}

export interface UpdateRecurringPaymentReminderInput {
  title?: string;
  vendorId?: number | null;
  expectedAmount?: number | null;
  currency?: string;
  anchorDate?: string;
  nextDueDate?: string;
  recurrenceUnit?: ReminderRecurrenceUnit;
  recurrenceInterval?: number;
  reminderDaysBefore?: number;
  reminderTime?: string;
  status?: RecurringPaymentReminderStatus;
  source?: RecurringPaymentReminderSource;
  note?: string | null;
}

function requireTitle(value: string): string {
  const title = sanitizeText(value, 200);
  if (!title) throw new Error('Reminder title is required');
  return title;
}

function requireCurrency(value: string | undefined): string {
  const currency = sanitizeText(value || 'PLN', 10).toUpperCase();
  if (!currency) throw new Error('Reminder currency is required');
  return currency;
}

function requireDate(value: string, field: string): string {
  if (!isSupportedYmd(value)) throw new Error(`Invalid ${field}`);
  return value;
}

function requireTime(value: string | undefined): string {
  const time = value ?? '09:00';
  if (!HH_MM_PATTERN.test(time)) throw new Error('Invalid reminder time');
  return time;
}

function requireInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < min || result > max) {
    throw new Error('Invalid reminder interval');
  }
  return result;
}

function normalizeVendorId(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value <= 0) throw new Error('Invalid reminder vendor');
  return value;
}

function normalizeExpectedAmount(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid expected amount');
  return sanitizeAmount(value);
}

function requireUnit(value: ReminderRecurrenceUnit): ReminderRecurrenceUnit {
  if (!RECURRENCE_UNITS.has(value)) throw new Error('Invalid recurrence unit');
  return value;
}

function requireStatus(value: RecurringPaymentReminderStatus | undefined): RecurringPaymentReminderStatus {
  const status = value ?? 'active';
  if (!STATUSES.has(status)) throw new Error('Invalid reminder status');
  return status;
}

function requireSource(value: RecurringPaymentReminderSource | undefined): RecurringPaymentReminderSource {
  const source = value ?? 'manual';
  if (!SOURCES.has(source)) throw new Error('Invalid reminder source');
  return source;
}

function normalizeUid(value: string): string {
  const uid = normalizeCanonicalUuid(value);
  if (!uid) throw new Error('Invalid reminder uid');
  return uid;
}

function createUid(value: string | undefined): string {
  return normalizeUid(value?.trim() || Crypto.randomUUID());
}

function normalizeNote(value: string | null | undefined): string | null {
  if (value == null) return null;
  return sanitizeText(value, 1000) || null;
}

export const RecurringPaymentReminderDao = {
  async create(input: CreateRecurringPaymentReminderInput): Promise<number> {
    const uid = createUid(input.uid);
    const title = requireTitle(input.title);
    const vendorId = normalizeVendorId(input.vendorId);
    const expectedAmount = normalizeExpectedAmount(input.expectedAmount);
    const currency = requireCurrency(input.currency);
    const anchorDate = requireDate(input.anchorDate, 'anchor date');
    const nextDueDate = requireDate(input.nextDueDate, 'next due date');
    if (nextDueDate < anchorDate) throw new Error('Next due date cannot precede anchor date');
    const recurrenceUnit = requireUnit(input.recurrenceUnit);
    const recurrenceInterval = requireInteger(input.recurrenceInterval, 1, 1, 999);
    if (!isRecurringOccurrence(
      recurrenceUnit,
      recurrenceInterval,
      anchorDate,
      nextDueDate,
    )) {
      throw new Error('Next due date is not a recurrence occurrence');
    }
    const reminderDaysBefore = requireInteger(input.reminderDaysBefore, 3, 0, 365);
    const reminderTime = requireTime(input.reminderTime);
    const status = requireStatus(input.status);
    const source = requireSource(input.source);
    if (source === 'detected' && vendorId == null) {
      throw new Error('Detected reminder requires a vendor');
    }
    const note = normalizeNote(input.note);
    const now = new Date().toISOString();
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO recurring_payment_reminders
         (uid, title, vendor_id, expected_amount, currency, anchor_date,
          next_due_date, recurrence_unit, recurrence_interval,
          reminder_days_before, reminder_time, status, source, note,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        title,
        vendorId,
        expectedAmount,
        currency,
        anchorDate,
        nextDueDate,
        recurrenceUnit,
        recurrenceInterval,
        reminderDaysBefore,
        reminderTime,
        status,
        source,
        note,
        now,
        now,
      ],
    );
    return result.lastInsertRowId;
  },

  async getById(id: number): Promise<RecurringPaymentReminder | null> {
    if (!Number.isInteger(id) || id <= 0) return null;
    const db = await getDatabase();
    return db.getFirstAsync<RecurringPaymentReminder>(
      'SELECT * FROM recurring_payment_reminders WHERE id = ?',
      [id],
    );
  },

  async getByUid(uid: string): Promise<RecurringPaymentReminder | null> {
    const safeUid = normalizeUid(uid);
    const db = await getDatabase();
    return db.getFirstAsync<RecurringPaymentReminder>(
      'SELECT * FROM recurring_payment_reminders WHERE uid = ?',
      [safeUid],
    );
  },

  async listAll(): Promise<RecurringPaymentReminder[]> {
    const db = await getDatabase();
    return db.getAllAsync<RecurringPaymentReminder>(
      'SELECT * FROM recurring_payment_reminders ORDER BY next_due_date ASC, id ASC',
    );
  },

  async listActive(): Promise<RecurringPaymentReminder[]> {
    const db = await getDatabase();
    return db.getAllAsync<RecurringPaymentReminder>(
      `SELECT * FROM recurring_payment_reminders
        WHERE status = 'active'
        ORDER BY next_due_date ASC, id ASC`,
    );
  },

  async listDue(onOrBefore: string): Promise<RecurringPaymentReminder[]> {
    const cutoff = requireDate(onOrBefore, 'reminder cutoff date');
    const db = await getDatabase();
    return db.getAllAsync<RecurringPaymentReminder>(
      `SELECT * FROM recurring_payment_reminders
        WHERE status = 'active' AND next_due_date <= ?
        ORDER BY next_due_date ASC, id ASC`,
      [cutoff],
    );
  },

  /**
   * Vadesi geçmiş aktif planların imlecini, referans günündeki veya sonraki
   * ilk gerçek tekrar oluşumuna taşır. Referans gününde vadesi olan kayıtlar
   * henüz geçmiş sayılmaz ve değiştirilmez.
   */
  async advancePastDue(referenceDate: string): Promise<number> {
    const reference = requireDate(referenceDate, 'reference date');
    const db = await getDatabase();
    let advancedCount = 0;

    await db.withTransactionAsync(async () => {
      const pastDue = await db.getAllAsync<Pick<
        RecurringPaymentReminder,
        'id' | 'anchor_date' | 'next_due_date' | 'recurrence_unit' | 'recurrence_interval'
      >>(
        `SELECT id, anchor_date, next_due_date, recurrence_unit, recurrence_interval
           FROM recurring_payment_reminders
          WHERE status = 'active' AND next_due_date < ?
          ORDER BY id ASC`,
        [reference],
      );

      for (const reminder of pastDue) {
        const nextDueDate = getNextOccurrence({
          kind: 'recurring',
          unit: reminder.recurrence_unit,
          interval: reminder.recurrence_interval,
          anchorDate: reminder.anchor_date,
        }, reference, 'on_or_after');
        if (!isSupportedYmd(nextDueDate) || nextDueDate === reminder.next_due_date) continue;

        const result = await db.runAsync(
          `UPDATE recurring_payment_reminders
              SET next_due_date = ?, updated_at = ?
            WHERE id = ?
              AND next_due_date = ?
              AND anchor_date = ?
              AND recurrence_unit = ?
              AND recurrence_interval = ?
              AND status = 'active'`,
          [
            nextDueDate,
            new Date().toISOString(),
            reminder.id,
            reminder.next_due_date,
            reminder.anchor_date,
            reminder.recurrence_unit,
            reminder.recurrence_interval,
          ],
        );
        if (result.changes > 0) advancedCount += 1;
      }
    });

    return advancedCount;
  },

  async update(id: number, input: UpdateRecurringPaymentReminderInput): Promise<boolean> {
    if (!Number.isInteger(id) || id <= 0) return false;
    const assignments: string[] = [];
    const values: Array<string | number | null> = [];
    let normalizedVendorId: number | null | undefined;
    let normalizedAnchorDate: string | undefined;
    let normalizedNextDueDate: string | undefined;
    let normalizedSource: RecurringPaymentReminderSource | undefined;
    let normalizedRecurrenceUnit: ReminderRecurrenceUnit | undefined;
    let normalizedRecurrenceInterval: number | undefined;
    const set = (column: string, value: string | number | null): void => {
      assignments.push(`${column} = ?`);
      values.push(value);
    };

    if (input.title !== undefined) set('title', requireTitle(input.title));
    if (input.vendorId !== undefined) {
      normalizedVendorId = normalizeVendorId(input.vendorId);
      set('vendor_id', normalizedVendorId);
    }
    if (input.expectedAmount !== undefined) {
      set('expected_amount', normalizeExpectedAmount(input.expectedAmount));
    }
    if (input.currency !== undefined) set('currency', requireCurrency(input.currency));
    if (input.anchorDate !== undefined) {
      normalizedAnchorDate = requireDate(input.anchorDate, 'anchor date');
      set('anchor_date', normalizedAnchorDate);
    }
    if (input.nextDueDate !== undefined) {
      normalizedNextDueDate = requireDate(input.nextDueDate, 'next due date');
      set('next_due_date', normalizedNextDueDate);
    }
    if (input.recurrenceUnit !== undefined) {
      normalizedRecurrenceUnit = requireUnit(input.recurrenceUnit);
      set('recurrence_unit', normalizedRecurrenceUnit);
    }
    if (input.recurrenceInterval !== undefined) {
      normalizedRecurrenceInterval = requireInteger(input.recurrenceInterval, 1, 1, 999);
      set('recurrence_interval', normalizedRecurrenceInterval);
    }
    if (input.reminderDaysBefore !== undefined) {
      set('reminder_days_before', requireInteger(input.reminderDaysBefore, 3, 0, 365));
    }
    if (input.reminderTime !== undefined) set('reminder_time', requireTime(input.reminderTime));
    if (input.status !== undefined) set('status', requireStatus(input.status));
    if (input.source !== undefined) {
      normalizedSource = requireSource(input.source);
      set('source', normalizedSource);
    }
    if (input.note !== undefined) set('note', normalizeNote(input.note));
    if (assignments.length === 0) return false;

    set('updated_at', new Date().toISOString());
    values.push(id);
    const db = await getDatabase();
    let updated = false;
    await db.withTransactionAsync(async () => {
      const current = await db.getFirstAsync<Pick<
        RecurringPaymentReminder,
        'vendor_id' | 'anchor_date' | 'next_due_date' | 'source'
          | 'recurrence_unit' | 'recurrence_interval'
      >>(
        `SELECT vendor_id, anchor_date, next_due_date, source,
                recurrence_unit, recurrence_interval
           FROM recurring_payment_reminders WHERE id = ?`,
        [id],
      );
      if (!current) return;

      const effectiveVendorId = normalizedVendorId !== undefined
        ? normalizedVendorId
        : current.vendor_id;
      const effectiveAnchorDate = normalizedAnchorDate ?? current.anchor_date;
      const effectiveNextDueDate = normalizedNextDueDate ?? current.next_due_date;
      const effectiveSource = normalizedSource ?? current.source;
      const effectiveRecurrenceUnit = normalizedRecurrenceUnit ?? current.recurrence_unit;
      const effectiveRecurrenceInterval = normalizedRecurrenceInterval
        ?? current.recurrence_interval;
      if (effectiveNextDueDate < effectiveAnchorDate) {
        throw new Error('Next due date cannot precede anchor date');
      }
      if (effectiveSource === 'detected' && effectiveVendorId == null) {
        throw new Error('Detected reminder requires a vendor');
      }
      if (!isRecurringOccurrence(
        effectiveRecurrenceUnit,
        effectiveRecurrenceInterval,
        effectiveAnchorDate,
        effectiveNextDueDate,
      )) {
        throw new Error('Next due date is not a recurrence occurrence');
      }

      const result = await db.runAsync(
        `UPDATE recurring_payment_reminders SET ${assignments.join(', ')} WHERE id = ?`,
        values,
      );
      updated = result.changes > 0;
    });
    return updated;
  },

  async pause(id: number): Promise<boolean> {
    if (!Number.isInteger(id) || id <= 0) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE recurring_payment_reminders
          SET status = 'paused', updated_at = ?
        WHERE id = ?`,
      [new Date().toISOString(), id],
    );
    return result.changes > 0;
  },

  async resume(id: number): Promise<boolean> {
    if (!Number.isInteger(id) || id <= 0) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE recurring_payment_reminders
          SET status = 'active', updated_at = ?
        WHERE id = ?`,
      [new Date().toISOString(), id],
    );
    return result.changes > 0;
  },

  async remove(id: number): Promise<boolean> {
    if (!Number.isInteger(id) || id <= 0) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      'DELETE FROM recurring_payment_reminders WHERE id = ?',
      [id],
    );
    return result.changes > 0;
  },
};
