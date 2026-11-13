import { addLocalDays, getToday } from './dateUtils';

/**
 * BUG-17 (ürün kararı A): fiş tarihi bugünden en çok iki gün ileride olabilir.
 * İki günlük pay saat dilimi ve gece yarısı taramaları içindir; yapay zekânın
 * yanlış okuduğu yıllar (ör. 2062) kesin yakalanır.
 */
export const MAX_RECEIPT_FUTURE_DAYS = 2;

export function latestAllowedReceiptDate(today: string = getToday()): string {
  return addLocalDays(today, MAX_RECEIPT_FUTURE_DAYS) ?? today;
}

export function isReceiptDateTooFarAhead(date: string, today: string = getToday()): boolean {
  return date > latestAllowedReceiptDate(today);
}
