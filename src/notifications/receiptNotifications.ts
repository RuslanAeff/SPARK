import { ExpenseDao } from '../db/expenseDao';
import type { InAppNotification } from './types';
import {
  enqueueNotificationMutation,
  loadFeedStrict,
  loadMutesStrict,
  mergeFeedItem,
  saveFeed,
} from './storage';

export interface ReceiptNotificationSubject {
  expense_id: number;
  vendor_name: string | null;
}

const RECEIPT_SAVED_ID = /^receipt-saved-([1-9]\d*)$/;

export function receiptSavedExpenseId(notificationId: string): number | null {
  const match = RECEIPT_SAVED_ID.exec(notificationId);
  if (!match) return null;

  const expenseId = Number(match[1]);
  return Number.isSafeInteger(expenseId) ? expenseId : null;
}

export function receiptSavedExpenseIds(feed: readonly InAppNotification[]): number[] {
  const ids = new Set<number>();
  for (const item of feed) {
    const expenseId = receiptSavedExpenseId(item.id);
    if (expenseId != null) ids.add(expenseId);
  }
  return Array.from(ids);
}

/**
 * Kalıcı feed, bildirimin üretildiği anda görülen satıcı adını taşır. Bu saf
 * uzlaştırma adımı hâlâ mevcut olan harcamaların satıcı parametresini kanonik
 * DB değeriyle günceller; okundu durumu, tarih ve sıralama korunur. Harcaması
 * silinmiş fiş bildirimi artık geçerli bir domain olayına bağlı olmadığı için
 * stale kabul edilir ve feed'den çıkarılır.
 *
 * Feed'de bulunmayan harcamalar için bildirim üretmez.
 */
export function reconcileReceiptSavedNotifications(
  feed: InAppNotification[],
  subjects: readonly ReceiptNotificationSubject[],
): InAppNotification[] {
  const vendorByExpenseId = new Map<number, string>();
  for (const subject of subjects) {
    if (!Number.isSafeInteger(subject.expense_id) || subject.expense_id <= 0) continue;
    vendorByExpenseId.set(subject.expense_id, subject.vendor_name?.trim() || '—');
  }

  let changed = false;
  const next: InAppNotification[] = [];
  for (const item of feed) {
    const expenseId = receiptSavedExpenseId(item.id);
    if (expenseId == null) {
      next.push(item);
      continue;
    }
    if (!vendorByExpenseId.has(expenseId)) {
      changed = true;
      continue;
    }

    const vendor = vendorByExpenseId.get(expenseId)!;
    if (item.params?.vendor === vendor) {
      next.push(item);
      continue;
    }

    changed = true;
    next.push({
      ...item,
      params: {
        ...item.params,
        vendor,
      },
    });
  }

  return changed ? next : feed;
}

export async function reconcileReceiptSavedNotificationsFromDatabase(
  feed: InAppNotification[],
): Promise<InAppNotification[]> {
  const expenseIds = receiptSavedExpenseIds(feed);
  if (expenseIds.length === 0) return feed;

  const subjects = await ExpenseDao.getNotificationSubjectsByIds(expenseIds);
  return reconcileReceiptSavedNotifications(feed, subjects);
}

/**
 * Bir harcama düzenlendikten sonra varsa ona bağlı fiş bildirimini yeniler.
 * Bildirim yoksa yeni kayıt oluşturmaz; böylece manuel harcama düzenlemeleri
 * yanlışlıkla fiş bildirimi üretmez.
 */
export async function refreshReceiptSavedNotification(expenseId: number): Promise<void> {
  if (!Number.isSafeInteger(expenseId) || expenseId <= 0) return;

  await enqueueNotificationMutation(async () => {
    const feed = await loadFeedStrict();
    if (!feed.some((item) => receiptSavedExpenseId(item.id) === expenseId)) return;

    const subjects = await ExpenseDao.getNotificationSubjectsByIds([expenseId]);
    const next = reconcileReceiptSavedNotifications(feed, subjects);
    if (next !== feed) await saveFeed(next);
  });
}

/** Fiş kaydı tamamlandığında satıcıyı çağıranın geçici metninden değil DB'den alır. */
export async function appendReceiptSavedNotification(expenseId: number): Promise<void> {
  if (!Number.isSafeInteger(expenseId) || expenseId <= 0) return;

  await enqueueNotificationMutation(async () => {
    const mutes = await loadMutesStrict();
    if (mutes.receipt) return;

    const [subject] = await ExpenseDao.getNotificationSubjectsByIds([expenseId]);
    if (!subject) return;

    const feed = await loadFeedStrict();
    const next = mergeFeedItem(feed, {
      id: `receipt-saved-${expenseId}`,
      severity: 'info',
      titleKey: 'notif_receipt_saved_t',
      bodyKey: 'notif_receipt_saved_b',
      params: { vendor: subject.vendor_name?.trim() || '—' },
      createdAt: Date.now(),
      read: false,
    });
    await saveFeed(next);
  });
}
