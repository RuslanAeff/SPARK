import { DebtDao } from '../db/debtDao';
import { BudgetDao } from '../db/budgetDao';
import { GoalDao } from '../db/goalDao';
import { RecurringPaymentReminderDao } from '../db/recurringPaymentReminderDao';
import type { NotificationMuteChannel } from '../notifications/types';
import { buildReminderNativeSchedule } from '../notifications/reminderNativeSchedule';
import { presentReminderNotification } from '../notifications/reminderNotificationPresentation';
import {
  buildAttentionNativeSchedule,
  presentAttentionNotification,
} from '../notifications/attentionNativeSchedule';
import {
  isReminderNotificationDismissed,
  loadRulesStateStrict,
} from '../notifications/storage';
import {
  localizeNotificationParams,
  notificationContentRevision,
  notificationPresentationRevision,
} from '../notifications/presentation';
import {
  reconcileAndroidReminderSchedules,
  type AndroidReminderScheduleItem,
  type AndroidReminderScheduleResult,
} from './androidNotificationsSetup';
import { getCycleStartDay } from './budgetCycleSettings';
import {
  budgetCycleFromBounds,
  getCurrentCycle,
} from '../utils/budgetCycle';

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function clampNativeText(value: string, maxLength: number): string {
  const text = value.trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function localYmdAt(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Kalıcı borç/ödeme-planı, hedef ve bütçe kaynaklarını seri okuyup native
 * desired-state üretir.
 * Finansal veya reminder domain yazısı yapmaz; native hata kaynak veriyi geri
 * alamaz. Geçmiş plan cursor'ı çağıran sync tarafından önceden ilerletilir.
 */
export async function syncAndroidReminderSchedules(
  t: Translate,
  mutes: Partial<Record<NotificationMuteChannel, boolean>>,
  nowMs = Date.now(),
): Promise<AndroidReminderScheduleResult> {
  // ADR-002: aynı SQLite bağlantısındaki sorgular Promise.all ile paralel değil.
  const debts = await DebtDao.listAll('borrowed');
  const recurringPayments = await RecurringPaymentReminderDao.listAll();
  const goal = await GoalDao.get();
  const cycleStartDay = await getCycleStartDay();
  const computedCycle = getCurrentCycle(cycleStartDay, new Date(nowMs));
  const today = localYmdAt(nowMs);
  const exactBudget = await BudgetDao.getContainingDate(today);
  const fallbackBudget = exactBudget ?? await BudgetDao.getLatestActive();
  const budgetCycle = exactBudget?.period_start && exactBudget.period_end
    ? budgetCycleFromBounds(
        exactBudget.period_start,
        exactBudget.period_end,
        exactBudget.cycle_start_day ?? cycleStartDay,
      )
    : computedCycle;
  const rules = await loadRulesStateStrict();
  const reminderPlan = buildReminderNativeSchedule({ nowMs, debts, recurringPayments })
    .filter((item) => (item.kind === 'debt' ? !mutes.debt : !mutes.payment_plan)
      && !isReminderNotificationDismissed(item.notificationId, rules));

  const attentionPlan = buildAttentionNativeSchedule({
    nowMs,
    goal,
    budgetCycle,
    budgetAmount: fallbackBudget?.monthly_amount ?? 0,
  }).filter((item) => (
    item.kind === 'goal_deadline' ? !mutes.goal : !mutes.budget
  ));

  const desiredReminders: AndroidReminderScheduleItem[] = reminderPlan.map((item) => {
    const notification = presentReminderNotification({
      kind: item.kind,
      stage: item.stage,
      notificationId: item.notificationId,
      dueDate: item.dueDate,
      daysUntilDue: item.daysUntilDue,
      label: item.label,
      amount: item.amount,
      currency: item.currency,
    }, item.triggerAt);
    // Geleceğe tarihli hatırlatıcı kullanıcı tarafından açıkça seçildiği için
    // upcoming aşaması da Android alerts kanalında dikkat gerektiren uyarıdır.
    const nativeNotification = { ...notification, severity: 'warning' as const };
    const localizedParams = localizeNotificationParams(notification.params, t);
    const title = clampNativeText(t(notification.titleKey, localizedParams), 120);
    const body = clampNativeText(t(notification.bodyKey, localizedParams), 280);
    return {
      scheduleId: item.scheduleId,
      notificationId: item.notificationId,
      triggerAt: item.triggerAt,
      title,
      body,
      severity: nativeNotification.severity,
      feedRevision: notificationContentRevision(notification),
      // OS request sunum metnini snapshot olarak saklar. Dil/copy değiştiğinde
      // aynı tarihli alarmın da actual-vs-desired uzlaştırmada yenilenmesi için
      // revision, native'e gidecek kırpılmış metni ve kanalı da kapsar.
      revision: notificationPresentationRevision({
        titleKey: title,
        bodyKey: body,
        severity: nativeNotification.severity,
        createdAt: item.triggerAt,
        params: { channel: 'alerts' },
      }),
    };
  });

  const desiredAttention: AndroidReminderScheduleItem[] = attentionPlan.map((item) => {
    const notification = presentAttentionNotification(item);
    const localizedParams = localizeNotificationParams(notification.params, t);
    const title = clampNativeText(t(notification.titleKey, localizedParams), 120);
    const body = clampNativeText(t(notification.bodyKey, localizedParams), 280);
    return {
      scheduleId: item.scheduleId,
      notificationId: item.notificationId,
      triggerAt: item.triggerAt,
      title,
      body,
      severity: notification.severity,
      feedRevision: notificationContentRevision(notification),
      revision: notificationPresentationRevision({
        titleKey: title,
        bodyKey: body,
        severity: notification.severity,
        createdAt: item.triggerAt,
        params: { channel: 'alerts' },
      }),
    };
  });

  // Android sahiplik sınırı değişmez. Dikkat planı en fazla 10'a yakın kayıt
  // ekler; kapasite aşılırsa en yakın alarmı korumak profesyonel ve öngörülebilir
  // davranıştır. Sonraki sync rolling horizon'ı yeniden doldurur.
  const desired = [...desiredReminders, ...desiredAttention]
    .sort((left, right) => left.triggerAt - right.triggerAt
      || left.scheduleId.localeCompare(right.scheduleId))
    .slice(0, 512);

  return reconcileAndroidReminderSchedules(desired, { now: nowMs, mutes });
}
