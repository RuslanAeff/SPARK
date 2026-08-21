import { BudgetDao } from '../db/budgetDao';
import { ExpenseDao } from '../db/expenseDao';
import { getDatabase } from '../db/database';
import { formatCurrency } from '../utils/formatCurrency';
import { GoalDao } from '../db/goalDao';
import { CategoryLimitDao } from '../db/categoryLimitDao';
import { CategoryDao } from '../db/categoryDao';
import { SubscriptionDao } from '../db/subscriptionDao';
import { DebtDao } from '../db/debtDao';
import { RecurringPaymentReminderDao } from '../db/recurringPaymentReminderDao';
import { hasApiKey } from '../services/geminiService';
import { peekPendingReceiptDraft } from '../services/pendingReceiptDraft';
import { getScanSessionError } from '../services/scanSession';
import { getCycleStartDay } from '../services/budgetCycleSettings';
import {
  budgetCycleFromBounds,
  getCurrentCycle,
  getCycleForKey,
  getCycleProgress,
  shiftCycleKey,
} from '../utils/budgetCycle';
import { loadBackupMeta, isBackupOverdue } from '../services/backupMeta';
import { syncSubscriptions } from '../services/subscriptionDetector';
import { getToday } from '../utils/dateUtils';
import { getCalendarDayOffset } from '../utils/recurringSchedule';
import type { InAppNotification, RulesState, NotificationSeverity } from './types';
import {
  loadFeedStrict,
  loadRulesStateStrict,
  saveNotificationSnapshot,
  mergeFeedItem,
  stripLegacyDevDemoNotifications,
} from './storage';
import { reconcileReceiptSavedNotificationsFromDatabase } from './receiptNotifications';
import {
  buildReminderNotificationCandidates,
  type ReminderNotificationCandidate,
} from './reminderNotificationRules';
import {
  reconcileReminderNotificationFeed,
  type ReminderFeedCandidate,
  type ReminderFeedEntity,
} from './reminderNotificationFeed';
import { presentReminderNotification } from './reminderNotificationPresentation';
import { getCurrentAttentionNotifications } from './attentionNativeSchedule';

function daysToDate(isoDate: string): number {
  return getCalendarDayOffset(getToday(), isoDate) ?? Number.NaN;
}

function muted(
  mutes: Partial<Record<string, boolean>>,
  ch:
    | 'budget'
    | 'category_limit'
    | 'goal'
    | 'receipt'
    | 'debt'
    | 'payment_plan'
    | 'system'
    | 'subscription'
    | 'backup'
): boolean {
  return !!mutes[ch];
}

function todayIso(): string {
  return getToday();
}

function currentLocalTime(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function candidateNotification(
  candidate: ReminderNotificationCandidate,
  createdAt: number,
): ReminderFeedCandidate {
  return {
    candidate,
    notification: presentReminderNotification(candidate, createdAt),
  };
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

/** Kullanıcının görüntüleme para birimi (settings.display_currency). Bildirim
 *  tutarları uygulamanın geri kalanıyla aynı sembolle gösterilsin diye. */
async function getDisplayCurrencySetting(): Promise<string> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'display_currency'",
    );
    return row?.value || 'PLN';
  } catch {
    return 'PLN';
  }
}

export async function runNotificationSync(
  mutes: Partial<Record<string, boolean>>
): Promise<{
  feed: InAppNotification[];
  unreadCount: number;
  createdIds: string[];
  retiredIds: string[];
}> {
  let feed = stripLegacyDevDemoNotifications(await loadFeedStrict());
  let rules: RulesState = await loadRulesStateStrict();
  const retiredIds = new Set<string>();
  let confirmedPlanVendorIds = new Set<number>();
  let confirmedPlansResolved = false;

  // Eski ve yeni fiş bildirimleri, oluşturma anındaki AI metnine değil mevcut
  // harcamanın kanonik satıcısına bağlı kalır. Silinen harcamaya bağlı kartlar
  // stale sayılıp Android tray cleanup listesine eklenir. Tek batch sorgu kullanılır.
  const receiptIdsBefore = new Set(
    feed.filter((item) => item.id.startsWith('receipt-saved-')).map((item) => item.id),
  );
  feed = await reconcileReceiptSavedNotificationsFromDatabase(feed);
  const receiptIdsAfter = new Set(
    feed.filter((item) => item.id.startsWith('receipt-saved-')).map((item) => item.id),
  );
  for (const id of receiptIdsBefore) {
    if (!receiptIdsAfter.has(id)) retiredIds.add(id);
  }
  const idsBeforeRuleEvaluation = new Set(feed.map((item) => item.id));

  // Bütçe dönemi takvim ayı değil, kullanıcının döngü başlangıç gününe göredir.
  // anchor=1'de cycle = takvim ayı → tüm aşağıdaki bölümler eski davranışı korur.
  const anchor = await getCycleStartDay();
  const cycle = getCurrentCycle(anchor);
  const ym = cycle.key;
  const start = cycle.start;
  const end = cycle.end;

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

  // —— 3b) Kapalı uygulama dikkat planı ——
  // Hedef son tarihi ve bütçe dönemi kontrol noktaları native tarafta önceden
  // planlanır. Uygulama alarmdan sonra açıldığında aynı olayın yalnız en güncel
  // kanonik kartını feed'e bağla; geçmiş milestone yığını oluşturma.
  try {
    const attentionGoal = await GoalDao.get();
    const exactBudget = await BudgetDao.getContainingDate(todayIso());
    const fallbackBudget = exactBudget ?? await BudgetDao.getLatestActive();
    const attentionCycle = exactBudget?.period_start && exactBudget.period_end
      ? budgetCycleFromBounds(
          exactBudget.period_start,
          exactBudget.period_end,
          exactBudget.cycle_start_day ?? anchor,
        )
      : cycle;
    const currentAttention = getCurrentAttentionNotifications({
      nowMs: Date.now(),
      goal: attentionGoal,
      budgetCycle: attentionCycle,
      budgetAmount: fallbackBudget?.monthly_amount ?? 0,
    });
    const currentAttentionIds = new Set(currentAttention.map((item) => item.id));
    feed = feed.filter((item) => {
      const managed = item.id.startsWith('goal-deadline-v1-')
        || item.id.startsWith('budget-review-v1-');
      if (!managed || currentAttentionIds.has(item.id)) return true;
      retiredIds.add(item.id);
      return false;
    });
    for (const item of currentAttention) {
      const isGoal = item.id.startsWith('goal-deadline-v1-');
      if (muted(mutes, isGoal ? 'goal' : 'budget')) continue;
      const previous = isGoal ? rules.goalDeadlineLast : rules.budgetReviewLast;
      if (previous === item.id) continue;
      feed = mergeFeedItem(feed, item);
      if (isGoal) rules.goalDeadlineLast = item.id;
      else rules.budgetReviewLast = item.id;
    }
  } catch (e) {
    if (__DEV__) console.warn('[notif] scheduled_attention', e);
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

  // —— 7) Yedekleme hatırlatması ——
  // Kullanıcı haftalık veya aylık hatırlatıcıyı açtıysa ve son yedekten itibaren
  // bu süre geçtiyse tek seferlik bir bildirim gönderilir. Sonraki tetiklenme
  // bir sonraki "interval" geçtiğinde olur (rules.backupRemindedAt ile takip).
  if (!muted(mutes, 'backup')) {
    try {
      const meta = await loadBackupMeta();
      if (isBackupOverdue(meta)) {
        const intervalMs =
          meta.reminderInterval === 'weekly' ? 7 * 86400000 : 30 * 86400000;
        const lastReminded = rules.backupRemindedAt ?? 0;
        if (Date.now() - lastReminded >= intervalMs * 0.9) {
          const dayCount = meta.lastAt
            ? Math.max(1, Math.round((Date.now() - meta.lastAt) / 86400000))
            : 0;
          const id = `backup-due-${Math.floor(Date.now() / (86400000 * 7))}`;
          feed = push(feed, id, 'info', 'notif_backup_due_t', 'notif_backup_due_b', {
            days: String(dayCount),
            interval: meta.reminderInterval,
          });
          rules.backupRemindedAt = Date.now();
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[notif] backup_due', e);
    }
  }

  // —— 8) Borç vadeleri ve kullanıcı tarafından onaylanmış ödeme planları ——
  // Bu iki kaynak türetilmiş abonelik tahmininden ayrıdır. Kural motoru yalnız
  // yerel canonical gün/saat alır; feed uzlaştırması kapanmış, duraklatılmış veya
  // yeniden planlanmış eski kartları kaldırır ve aynı fingerprint'i kullanıcı
  // sildiyse geri diriltmez. Native gelecek-tarih scheduler'ı Faz 5 işidir.
  try {
    const debtRows = await DebtDao.listAll('borrowed');
    const planRows = await RecurringPaymentReminderDao.listAll();
    confirmedPlansResolved = true;
    confirmedPlanVendorIds = new Set(
      planRows
        .filter((plan) => plan.source === 'detected' && plan.vendor_id != null)
        .map((plan) => plan.vendor_id as number),
    );

    // Tahmin kullanıcı tarafından kalıcı plana dönüştürüldüğünde eski tahmin
    // kartını ve Android kopyasını aynı sync'te emekliye ayır. Bu cleanup mute
    // durumundan bağımsızdır; bayat domain türevi geçmiş olarak saklanmaz.
    feed = feed.filter((item) => {
      const match = item.id.match(/^sub-due-(\d+)-/);
      if (!match || !confirmedPlanVendorIds.has(Number(match[1]))) return true;
      retiredIds.add(item.id);
      return false;
    });
    if (rules.subscriptionDueLast) {
      for (const vendorId of confirmedPlanVendorIds) {
        delete rules.subscriptionDueLast[String(vendorId)];
      }
    }

    const now = new Date();
    const candidates = buildReminderNotificationCandidates({
      clock: { today: getToday(), localTime: currentLocalTime(now) },
      debts: debtRows,
      recurringPayments: planRows,
    });

    const entities: ReminderFeedEntity[] = [
      ...debtRows.map((debt): ReminderFeedEntity => {
        const dueDate = debt.due_date ?? 'none';
        const timeId = debt.reminder_time.replace(':', '');
        return {
          entityKey: `debt:${debt.id}`,
          kind: 'debt',
          familyPrefix:
            `debt-due-v1-${debt.id}-${dueDate}-${debt.reminder_days_before}-${timeId}-`,
          tokenPrefix: `${dueDate}:${debt.reminder_days_before}:${debt.reminder_time}:`,
          active: debt.direction === 'borrowed'
            && debt.status === 'open'
            && debt.remaining > 0
            && debt.reminder_enabled === 1
            && debt.due_date != null,
        };
      }),
      ...planRows.map((plan): ReminderFeedEntity => {
        const uid = plan.uid.toLowerCase();
        const timeId = plan.reminder_time.replace(':', '');
        return {
          entityKey: `recurring:${uid}`,
          kind: 'recurring_payment',
          familyPrefix:
            `payplan-due-v1-${uid}-${plan.next_due_date}-${plan.reminder_days_before}-${timeId}-`,
          tokenPrefix:
            `${plan.next_due_date}:${plan.reminder_days_before}:${plan.reminder_time}:`,
          active: plan.status === 'active',
        };
      }),
    ];

    const reconciled = reconcileReminderNotificationFeed({
      feed,
      entities,
      candidates: candidates.map((candidate) => candidateNotification(candidate, now.getTime())),
      state: {
        debtDueLast: rules.debtDueLast ?? {},
        debtDueDismissed: rules.debtDueDismissed ?? {},
        paymentPlanDueLast: rules.paymentPlanDueLast ?? {},
        paymentPlanDueDismissed: rules.paymentPlanDueDismissed ?? {},
      },
      muted: {
        debt: muted(mutes, 'debt'),
        recurring_payment: muted(mutes, 'payment_plan'),
      },
    });
    feed = reconciled.feed;
    rules.debtDueLast = reconciled.state.debtDueLast;
    rules.debtDueDismissed = reconciled.state.debtDueDismissed;
    rules.paymentPlanDueLast = reconciled.state.paymentPlanDueLast;
    rules.paymentPlanDueDismissed = reconciled.state.paymentPlanDueDismissed;
    reconciled.retiredIds.forEach((id) => retiredIds.add(id));
  } catch (e) {
    if (__DEV__) console.warn('[notif] persisted_reminders', e);
  }

  // —— 9) Türetilmiş tekrar eden ödeme tahminleri ——
  // Önce tespiti güncel tut (ucuz, lookback penceresinde indeksli sorgu).
  // Ardından 3 gün veya daha az kala next_expected_date'i olan aktif aboneliği
  // bildir. Kullanıcı aynı satıcıyı kalıcı plana dönüştürdüyse tahmin ikinci bir
  // bildirim üretmez; onaylı plan yukarıdaki ayrı kanalın yetkisindedir.
  if (!muted(mutes, 'subscription') && confirmedPlansResolved) {
    try {
      await syncSubscriptions();
      const subs = await SubscriptionDao.getActive();
      rules.subscriptionDueLast = rules.subscriptionDueLast || {};
      const today = todayIso();
      for (const s of subs) {
        if (confirmedPlanVendorIds.has(s.vendor_id)) continue;
        const days = daysToDate(s.next_expected_date);
        if (days < 0 || days > 3) continue;
        const key = String(s.vendor_id);
        const lastSent = rules.subscriptionDueLast[key];
        if (lastSent === s.next_expected_date) continue;
        const id = `sub-due-${s.vendor_id}-${s.next_expected_date}`;
        feed = push(
          feed,
          id,
          days <= 0 ? 'warning' : 'info',
          'notif_sub_due_t',
          days <= 0 ? 'notif_sub_due_today_b' : 'notif_sub_due_b',
          {
            vendor: s.vendor_name,
            days: String(Math.max(0, days)),
            date: s.next_expected_date,
          }
        );
        rules.subscriptionDueLast[key] = s.next_expected_date;
      }
      // Eski tarihli kayıtları temizle (sonsuz büyümesin)
      for (const k of Object.keys(rules.subscriptionDueLast)) {
        if (rules.subscriptionDueLast[k] < today) delete rules.subscriptionDueLast[k];
      }
    } catch (e) {
      if (__DEV__) console.warn('[notif] sub_due', e);
    }
  }

  // —— 10) Otomatik döngü özeti (önceki döngü) ——
  // Her döngünün başında (ilk 7 gün içinde) bir kez gönderilir. Önceki döngünün
  // toplam harcama, bütçeye göre yüzde ve en yüksek harcanan kategori bilgisini içerir.
  // anchor=1'de "döngü" = takvim ayıdır (eski "aylık özet" davranışı korunur).
  if (!muted(mutes, 'budget')) {
    try {
      const { dayOfCycle } = getCycleProgress(cycle);
      if (dayOfCycle <= 7) {
        const prevCycle = getCycleForKey(anchor, shiftCycleKey(cycle.key, -1));
        const prevYm = prevCycle.key;
        rules.monthSummary = rules.monthSummary || {};
        if (!rules.monthSummary[prevYm]) {
          const ps = prevCycle.start;
          const pe = prevCycle.end;
          const totalPrev = await ExpenseDao.getTotalByDateRange(ps, pe);
          if (totalPrev > 0) {
            const prevBudgetRow =
              (await BudgetDao.getForMonth(prevYm)) ?? (await BudgetDao.getLatestActive());
            const budgetAmount = prevBudgetRow ? prevBudgetRow.monthly_amount : 0;
            const pct = budgetAmount > 0
              ? Math.min(999, Math.round((totalPrev / budgetAmount) * 100))
              : 0;
            const cats = (await ExpenseDao.getCategorySpending(ps, pe)) as Array<{
              category_name: string;
              total: number;
            }>;
            const top = cats?.[0];
            const topName = top?.category_name ?? '—';
            const topShare = totalPrev > 0 && top
              ? Math.round((Number(top.total) / totalPrev) * 100)
              : 0;
            // Para birimi: kullanıcının görüntüleme para birimi (yoksa bütçenin / PLN).
            // Şablonlarda sabit '₺' YOK; tutar uygulamanın formatlayıcısıyla biçimlenir.
            const summaryCurrency = (await getDisplayCurrencySetting()) || prevBudgetRow?.currency || 'PLN';
            feed = push(
              feed,
              `month-summary-${prevYm}`,
              'info',
              'notif_month_summary_t',
              budgetAmount > 0 ? 'notif_month_summary_b' : 'notif_month_summary_no_budget_b',
              {
                month: prevYm,
                total: formatCurrency(totalPrev, summaryCurrency, false),
                pct: String(pct),
                top: topName,
                top_pct: String(topShare),
              }
            );
            rules.monthSummary[prevYm] = true;
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[notif] month_summary', e);
    }
  }

  await saveNotificationSnapshot(feed, rules);

  const unreadCount = feed.filter((f) => !f.read).length;
  const createdIds = feed
    .filter((item) => !idsBeforeRuleEvaluation.has(item.id))
    .map((item) => item.id);
  return { feed, unreadCount, createdIds, retiredIds: [...retiredIds] };
}
