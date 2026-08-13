import { DebtDao } from '../db/debtDao';
import { RecurringPaymentReminderDao } from '../db/recurringPaymentReminderDao';
import type { NotificationMuteChannel } from '../notifications/types';
import { buildReminderNativeSchedule } from '../notifications/reminderNativeSchedule';
import { presentReminderNotification } from '../notifications/reminderNotificationPresentation';
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
  type AndroidReminderScheduleResult,
} from './androidNotificationsSetup';

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function clampNativeText(value: string, maxLength: number): string {
  const text = value.trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Kalıcı borç/ödeme-planı kaynaklarını seri okuyup native desired-state üretir.
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
  const rules = await loadRulesStateStrict();
  const plan = buildReminderNativeSchedule({ nowMs, debts, recurringPayments })
    .filter((item) => (item.kind === 'debt' ? !mutes.debt : !mutes.payment_plan)
      && !isReminderNotificationDismissed(item.notificationId, rules));

  const desired = plan.map((item) => {
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

  return reconcileAndroidReminderSchedules(desired, { now: nowMs, mutes });
}
