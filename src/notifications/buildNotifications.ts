import { BudgetDao } from '../db/budgetDao';
import { ExpenseDao } from '../db/expenseDao';
import { GoalDao } from '../db/goalDao';
import { CategoryLimitDao } from '../db/categoryLimitDao';
import { CategoryDao } from '../db/categoryDao';
import { hasApiKey } from '../services/geminiService';
import { peekPendingReceiptDraft } from '../services/pendingReceiptDraft';
import { getScanSessionError } from '../services/scanSession';
import { getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';
import type { InAppNotification, RulesState, NotificationSeverity } from './types';
import {
  loadFeed,
  saveFeed,
  loadRulesState,
  saveRulesState,
  mergeFeedItem,
  loadMutes,
  stripLegacyDevDemoNotifications,
} from './storage';

function monthKeyNow(): string {
  return new Date().toISOString().slice(0, 7);
}

function daysToDate(isoDate: string): number {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const e = new Date(isoDate + 'T12:00:00');
  e.setHours(0, 0, 0, 0);
  return Math.ceil((e.getTime() - t.getTime()) / (86400 * 1000));
}

function muted(
  mutes: Partial<Record<string, boolean>>,
  ch: 'budget' | 'category_limit' | 'goal' | 'receipt' | 'system'
): boolean {
  return !!mutes[ch];
}

function push(
  feed: InAppNotification[],
  id: string,
  severity: NotificationSeverity,
  titleKey: string,
  bodyKey: string,
  params?: Record<string, string>
): InAppNotification[] {
  return mergeFeedItem(feed, {
    id,
    severity,
    titleKey,
    bodyKey,
    params,
    createdAt: Date.now(),
  });
}

export async function runNotificationSync(
  mutes: Partial<Record<string, boolean>>
): Promise<{ feed: InAppNotification[]; unreadCount: number }> {
  let feed = stripLegacyDevDemoNotifications(await loadFeed());
  let rules: RulesState = await loadRulesState();

  const ym = monthKeyNow();
  const start = getStartOfMonth();
  const end = getEndOfMonth();

  // —— 1) Aylık bütçe %80 / %100 / aşım ——
  if (!muted(mutes, 'budget')) {
    const row = await BudgetDao.getForMonth(ym);
    const fallback = row ?? (await BudgetDao.getLatestActive());
    const budgetAmount = fallback ? fallback.monthly_amount : 0;

    if (budgetAmount > 0) {
      const spent = await ExpenseDao.getTotalByDateRange(start, end);
      const ratio = spent / budgetAmount;
      const over = spent > budgetAmount + 0.005;
      const atOrOverFull = !over && spent >= budgetAmount - 0.005;
      const at80 = !over && !atOrOverFull && ratio >= 0.8;

      rules.budget = rules.budget || {};
      const st = rules.budget[ym] || {};

      if (over && !st.over) {
        feed = push(feed, `budget-${ym}-over`, 'critical', 'notif_budget_over_t', 'notif_budget_over_b', {
          pct: String(Math.round(ratio * 100)),
        });
        st.over = true;
        st.b100 = true;
        st.b80 = true;
      } else if (atOrOverFull && !st.b100) {
        feed = push(feed, `budget-${ym}-100`, 'warning', 'notif_budget_100_t', 'notif_budget_100_b', {});
        st.b100 = true;
        st.b80 = true;
      } else if (at80 && !st.b80) {
        feed = push(feed, `budget-${ym}-80`, 'warning', 'notif_budget_80_t', 'notif_budget_80_b', {
          pct: String(Math.min(100, Math.round(ratio * 100))),
        });
        st.b80 = true;
      }

      rules.budget[ym] = st;
    }
  }

  // —— 2) Kategori limiti ——
  if (!muted(mutes, 'category_limit')) {
    const limits = await CategoryLimitDao.getForMonth(ym);
    rules.cat = rules.cat || {};

    for (const lim of limits) {
      const cat = await CategoryDao.getById(lim.category_id);
      if (!cat) continue;
      const spent = await ExpenseDao.getSpentForCategoryInRange(lim.category_id, start, end);
      const key = `${ym}-${lim.category_id}`;
      const cs = rules.cat[key] || {};
      const ratio = lim.limit_amount > 0 ? spent / lim.limit_amount : 0;
      const isOver = spent > lim.limit_amount + 0.005;
      const near = !isOver && ratio >= 0.8;

      if (isOver && !cs.over) {
        feed = push(feed, `catlim-${key}-over`, 'critical', 'notif_cat_over_t', 'notif_cat_over_b', {
          name: cat.name,
        });
        cs.over = true;
        cs.near = true;
      } else if (near && !cs.near) {
        feed = push(feed, `catlim-${key}-near`, 'warning', 'notif_cat_near_t', 'notif_cat_near_b', {
          name: cat.name,
          pct: String(Math.min(100, Math.round(ratio * 100))),
        });
        cs.near = true;
      }
      rules.cat[key] = cs;
    }
  }

  // —— 3) Birikim hedefi riski (tarih + yüksek harcama baskısı) ——
  if (!muted(mutes, 'goal')) {
    const goal = await GoalDao.get();
    if (goal && goal.target_amount > 0) {
      const days = daysToDate(goal.target_date);
      if (days > 0 && days <= 90) {
        const row = await BudgetDao.getForMonth(ym);
        const fallback = row ?? (await BudgetDao.getLatestActive());
        const budgetAmount = fallback ? fallback.monthly_amount : 0;
        if (budgetAmount > 0) {
          const spent = await ExpenseDao.getTotalByDateRange(start, end);
          const pct = Math.min(100, Math.round((spent / budgetAmount) * 100));
          const overSpent = spent > budgetAmount + 0.005;
          rules.goalRisk = rules.goalRisk || {};
          if ((pct >= 72 || overSpent) && !rules.goalRisk[ym]) {
            feed = push(feed, `goal-risk-${ym}`, 'warning', 'notif_goal_risk_t', 'notif_goal_risk_b', {
              days: String(days),
            });
            rules.goalRisk[ym] = true;
          }
        }
      }
    }
  }

  // —— 4) Fiş taslağı (düzenleme bekliyor) ——
  feed = feed.filter((f) => f.id !== 'receipt-pending-edit');
  if (!muted(mutes, 'receipt')) {
    const draft = peekPendingReceiptDraft();
    if (draft) {
      const v = String(draft.vendor_name || '').trim() || '—';
      feed = push(feed, 'receipt-pending-edit', 'info', 'notif_receipt_pending_t', 'notif_receipt_pending_b', {
        vendor: v,
      });
    }
  }

  // —— 5) API / tarama hatası ——
  if (!muted(mutes, 'system')) {
    const keyOk = await hasApiKey();
    if (!keyOk && !rules.apiDismissed) {
      feed = push(feed, 'sys-no-api-key', 'critical', 'notif_no_api_t', 'notif_no_api_b', {});
    }
    const scanErr = getScanSessionError();
    if (scanErr && !rules.scanErrorDismissed) {
      feed = push(feed, 'sys-scan-err', 'warning', 'notif_scan_err_t', 'notif_scan_err_b', {
        msg: scanErr.length > 120 ? scanErr.slice(0, 117) + '…' : scanErr,
      });
    }
  }

  // —— 6) Yeni ay — bütçe kaydı yok ——
  if (!muted(mutes, 'budget')) {
    const explicit = await BudgetDao.getForMonth(ym);
    rules.monthBudgetHint = rules.monthBudgetHint || {};
    if (!explicit && !rules.monthBudgetHint[ym]) {
      feed = push(feed, `month-budget-hint-${ym}`, 'info', 'notif_month_budget_t', 'notif_month_budget_b', {});
      rules.monthBudgetHint[ym] = true;
    }
  }

  await saveRulesState(rules);
  await saveFeed(feed);

  const unreadCount = feed.filter((f) => !f.read).length;
  return { feed, unreadCount };
}

/** Fiş kaydedildiğinde çağır (tarayıcı hızlı kayıt). */
export async function appendReceiptSavedNotification(vendorName: string, expenseId: number): Promise<void> {
  const mutes = await loadMutes();
  if (mutes.receipt) return;

  let feed = await loadFeed();
  feed = mergeFeedItem(feed, {
    id: `receipt-saved-${expenseId}`,
    severity: 'info',
    titleKey: 'notif_receipt_saved_t',
    bodyKey: 'notif_receipt_saved_b',
    params: { vendor: vendorName },
    createdAt: Date.now(),
    read: false,
  });
  await saveFeed(feed);
}
