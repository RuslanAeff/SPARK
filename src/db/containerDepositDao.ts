import * as Crypto from 'expo-crypto';

import { getDatabase } from './database';
import type { ContainerDepositVoucher } from './schema';
import { sanitizeAmount, sanitizeDate, sanitizeText } from '../utils/inputValidation';
import { getToday } from '../utils/dateUtils';
import { roundMoney } from '../utils/moneyMath';

export interface ContainerDepositSummary {
  depositPaid: number;
  recovered: number;
  availableVoucher: number;
}

function safeCurrency(value: string): string {
  return sanitizeText(value || 'PLN', 10).trim().toUpperCase() || 'PLN';
}

export const ContainerDepositDao = {
  async createVoucher(input: {
    amount: number;
    currency: string;
    issuedDate: string;
    expiresOn?: string | null;
    note?: string | null;
  }): Promise<number> {
    const amount = roundMoney(sanitizeAmount(input.amount));
    const issuedDate = sanitizeDate(input.issuedDate);
    const expiresOn = input.expiresOn ? sanitizeDate(input.expiresOn) : null;
    if (amount <= 0 || !issuedDate || (input.expiresOn && !expiresOn)) {
      throw new Error('INVALID_CONTAINER_VOUCHER');
    }
    if (expiresOn && expiresOn < issuedDate) throw new Error('INVALID_CONTAINER_VOUCHER_EXPIRY');
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO container_deposit_vouchers
        (uid, amount, currency, issued_date, expires_on, status, redeemed_date,
         redemption_expense_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, 'available', NULL, NULL, ?, ?)`,
      [
        Crypto.randomUUID(),
        amount,
        safeCurrency(input.currency),
        issuedDate,
        expiresOn,
        input.note ? sanitizeText(input.note, 1000) : null,
        new Date().toISOString(),
      ],
    );
    return Number(result.lastInsertRowId);
  },

  async expirePastDue(today: string = getToday()): Promise<void> {
    const safeToday = sanitizeDate(today);
    if (!safeToday) return;
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE container_deposit_vouchers
          SET status = 'expired'
        WHERE status = 'available' AND expires_on IS NOT NULL AND expires_on < ?`,
      [safeToday],
    );
  },

  async getAll(): Promise<ContainerDepositVoucher[]> {
    await ContainerDepositDao.expirePastDue();
    const db = await getDatabase();
    return db.getAllAsync<ContainerDepositVoucher>(
      `SELECT * FROM container_deposit_vouchers
       ORDER BY CASE status WHEN 'available' THEN 0 WHEN 'redeemed' THEN 1 ELSE 2 END,
                COALESCE(expires_on, '9999-12-31') ASC, issued_date DESC, id DESC`,
    );
  },

  async getSummary(currency: string): Promise<ContainerDepositSummary> {
    await ContainerDepositDao.expirePastDue();
    const db = await getDatabase();
    const normalized = safeCurrency(currency);
    const expense = await db.getFirstAsync<{ paid: number | null }>(
      `SELECT SUM(container_deposit_paid) AS paid
         FROM expenses WHERE currency = ?`,
      [normalized],
    );
    const recovery = await db.getFirstAsync<{ recovered: number | null }>(
      `SELECT SUM(amount) AS recovered
         FROM container_deposit_recoveries WHERE currency = ?`,
      [normalized],
    );
    const voucher = await db.getFirstAsync<{ available: number | null }>(
      `SELECT SUM(amount) AS available
         FROM container_deposit_vouchers
        WHERE currency = ? AND status = 'available'`,
      [normalized],
    );
    return {
      depositPaid: roundMoney(Number(expense?.paid) || 0),
      recovered: roundMoney(Number(recovery?.recovered) || 0),
      availableVoucher: roundMoney(Number(voucher?.available) || 0),
    };
  },

  async getRecoveredByDateRange(start: string, end: string, currency: string): Promise<number> {
    const safeStart = sanitizeDate(start);
    const safeEnd = sanitizeDate(end);
    if (!safeStart || !safeEnd || safeStart > safeEnd) return 0;
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(amount) AS total
         FROM container_deposit_recoveries
        WHERE date BETWEEN ? AND ? AND currency = ?`,
      [safeStart, safeEnd, safeCurrency(currency)],
    );
    return roundMoney(Number(row?.total) || 0);
  },

  async markRedeemed(id: number, date: string = getToday(), expenseId?: number | null): Promise<void> {
    const safeDate = sanitizeDate(date);
    if (!Number.isSafeInteger(id) || id <= 0 || !safeDate) throw new Error('INVALID_CONTAINER_VOUCHER');
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      const voucher = await db.getFirstAsync<ContainerDepositVoucher>(
        `SELECT * FROM container_deposit_vouchers WHERE id = ? AND status = 'available'`,
        [id],
      );
      if (!voucher) throw new Error('CONTAINER_VOUCHER_NOT_AVAILABLE');
      await db.runAsync(
        `UPDATE container_deposit_vouchers
            SET status = 'redeemed', redeemed_date = ?, redemption_expense_id = ?
          WHERE id = ? AND status = 'available'`,
        [safeDate, expenseId ?? null, id],
      );
      if (expenseId == null) {
        await db.runAsync(
          `INSERT INTO container_deposit_recoveries
            (uid, voucher_id, expense_id, amount, currency, date, method, created_at)
           VALUES (?, ?, NULL, ?, ?, ?, 'cash', ?)`,
          [Crypto.randomUUID(), id, voucher.amount, voucher.currency, safeDate, new Date().toISOString()],
        );
      }
    });
  },

  async recordPurchaseRecovery(input: {
    amount: number;
    currency: string;
    date: string;
    expenseId: number;
    voucherId?: number | null;
  }): Promise<void> {
    const amount = roundMoney(sanitizeAmount(input.amount));
    const date = sanitizeDate(input.date);
    if (amount <= 0 || !date || !Number.isSafeInteger(input.expenseId) || input.expenseId <= 0) {
      throw new Error('INVALID_CONTAINER_RECOVERY');
    }
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO container_deposit_recoveries
        (uid, voucher_id, expense_id, amount, currency, date, method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'purchase_voucher', ?)`,
      [
        Crypto.randomUUID(), input.voucherId ?? null, input.expenseId, amount,
        safeCurrency(input.currency), date, new Date().toISOString(),
      ],
    );
  },

  /** Must be called inside the expense write transaction. */
  async syncPurchaseRecovery(expenseId: number): Promise<void> {
    const db = await getDatabase();
    const expense = await db.getFirstAsync<{
      container_voucher_used: number;
      currency: string;
      date: string;
    }>(
      `SELECT container_voucher_used, currency, date FROM expenses WHERE id = ?`,
      [expenseId],
    );
    if (!expense) throw new Error('EXPENSE_NOT_FOUND');

    await db.runAsync(
      `UPDATE container_deposit_vouchers
          SET status = 'available', redeemed_date = NULL, redemption_expense_id = NULL
        WHERE redemption_expense_id = ? AND status = 'redeemed'`,
      [expenseId],
    );
    await db.runAsync('DELETE FROM container_deposit_recoveries WHERE expense_id = ?', [expenseId]);

    const amount = roundMoney(Number(expense.container_voucher_used) || 0);
    if (amount <= 0) return;
    const matches = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM container_deposit_vouchers
        WHERE status = 'available' AND currency = ? AND ROUND(amount, 2) = ?
        ORDER BY COALESCE(expires_on, '9999-12-31') ASC, issued_date ASC, id ASC
        LIMIT 2`,
      [safeCurrency(expense.currency), amount],
    );
    const voucherId = matches.length === 1 ? matches[0].id : null;
    if (voucherId != null) {
      await db.runAsync(
        `UPDATE container_deposit_vouchers
            SET status = 'redeemed', redeemed_date = ?, redemption_expense_id = ?
          WHERE id = ? AND status = 'available'`,
        [expense.date, expenseId, voucherId],
      );
    }
    await ContainerDepositDao.recordPurchaseRecovery({
      amount,
      currency: expense.currency,
      date: expense.date,
      expenseId,
      voucherId,
    });
  },

  async deleteVoucher(id: number): Promise<void> {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    const db = await getDatabase();
    await db.runAsync('DELETE FROM container_deposit_vouchers WHERE id = ?', [id]);
  },

  /** Exact single-voucher match is safe; ambiguous or split payments stay unlinked. */
  async linkExactAvailableVoucher(input: {
    amount: number;
    currency: string;
    date: string;
    expenseId: number;
  }): Promise<number | null> {
    const amount = roundMoney(sanitizeAmount(input.amount));
    if (amount <= 0) return null;
    const db = await getDatabase();
    const matches = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM container_deposit_vouchers
        WHERE status = 'available' AND currency = ? AND ROUND(amount, 2) = ?
        ORDER BY COALESCE(expires_on, '9999-12-31') ASC, issued_date ASC, id ASC
        LIMIT 2`,
      [safeCurrency(input.currency), amount],
    );
    if (matches.length !== 1) return null;
    const db2 = await getDatabase();
    await db2.runAsync(
      `UPDATE container_deposit_vouchers
          SET status = 'redeemed', redeemed_date = ?, redemption_expense_id = ?
        WHERE id = ? AND status = 'available'`,
      [input.date, input.expenseId, matches[0].id],
    );
    return matches[0].id;
  },
};
