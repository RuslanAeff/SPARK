import { formatCurrency } from '../utils/formatCurrency';
import type { InAppNotification } from './types';
import type {
  ReminderNotificationCandidate,
  ReminderNotificationStage,
} from './reminderNotificationRules';

export type PresentableReminderCandidate = Pick<
  ReminderNotificationCandidate,
  | 'kind'
  | 'notificationId'
  | 'dueDate'
  | 'daysUntilDue'
  | 'label'
  | 'amount'
  | 'currency'
> & { stage: ReminderNotificationStage };

/** Feed ve gelecekteki Android alarmı aynı kanonik metin/param sözleşmesini kullanır. */
export function presentReminderNotification(
  candidate: PresentableReminderCandidate,
  createdAt: number,
): Omit<InAppNotification, 'read'> {
  const amount = candidate.amount == null
    ? null
    : formatCurrency(candidate.amount, candidate.currency);

  if (candidate.kind === 'debt') {
    const keys = candidate.stage === 'upcoming'
      ? ['notif_debt_due_upcoming_t', 'notif_debt_due_upcoming_b']
      : candidate.stage === 'today'
        ? ['notif_debt_due_today_t', 'notif_debt_due_today_b']
        : ['notif_debt_due_overdue_t', 'notif_debt_due_overdue_b'];
    return {
      id: candidate.notificationId,
      severity: candidate.stage === 'overdue'
        ? 'critical'
        : candidate.stage === 'today' ? 'warning' : 'info',
      titleKey: keys[0],
      bodyKey: keys[1],
      params: {
        counterparty: candidate.label || '—',
        date: candidate.dueDate,
        days: String(Math.max(0, candidate.daysUntilDue)),
        amount: amount ?? '—',
      },
      createdAt,
    };
  }

  const titleKey = candidate.stage === 'upcoming'
    ? 'notif_payment_plan_upcoming_t'
    : candidate.stage === 'today'
      ? 'notif_payment_plan_today_t'
      : 'notif_payment_plan_date_passed_t';
  const bodyKey = candidate.stage === 'upcoming'
    ? (amount ? 'notif_payment_plan_upcoming_amount_b' : 'notif_payment_plan_upcoming_b')
    : candidate.stage === 'today'
      ? (amount ? 'notif_payment_plan_today_amount_b' : 'notif_payment_plan_today_b')
      : 'notif_payment_plan_date_passed_b';
  return {
    id: candidate.notificationId,
    severity: candidate.stage === 'upcoming' ? 'info' : 'warning',
    titleKey,
    bodyKey,
    params: {
      title: candidate.label,
      date: candidate.dueDate,
      days: String(Math.max(0, candidate.daysUntilDue)),
      ...(amount ? { amount } : {}),
    },
    createdAt,
  };
}
