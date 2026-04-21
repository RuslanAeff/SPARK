// S.P.A.R.K. — Fiş tarama sonrası "Düzenle" ile add-expense’a aktarım (kısa ömürlü bellek)
import type { ParsedReceipt } from './geminiService';

let pending: ParsedReceipt | null = null;

export function setPendingReceiptDraft(receipt: ParsedReceipt): void {
  try {
    pending = JSON.parse(JSON.stringify(receipt)) as ParsedReceipt;
  } catch {
    pending = receipt;
  }
}

/** Tek seferlik okuma — add-expense yalnızca bir kez doldurur */
export function takePendingReceiptDraft(): ParsedReceipt | null {
  const p = pending;
  pending = null;
  return p;
}

/** Fiş taslağı var mı? (tüketmeden — bildirim için) */
export function peekPendingReceiptDraft(): ParsedReceipt | null {
  return pending;
}
