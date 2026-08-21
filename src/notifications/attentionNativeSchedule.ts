// S.P.A.R.K. — Uygulama süreci çalışmıyorken de teslim edilebilen, sınırlı
// dikkat planı. Finansal eşikler burada yeniden hesaplanmaz; yalnız önceden
// bilinen hedef tarihi ve bütçe dönemi zaman çizelgesi native alarma çevrilir.

import type { SavingsGoalRow } from '../db/goalDao';
import type { BudgetCycle } from '../utils/budgetCycle';
import {
  getCalendarDayOffset,
  isValidYmd,
  shiftCalendarDate,
} from '../utils/recurringSchedule';
import type { InAppNotification } from './types';
import { localReminderDateTimeToEpoch } from './reminderNativeSchedule';

export const GOAL_ATTENTION_MILESTONES = [90, 30, 14, 7, 3, 1, 0] as const;
export const BUDGET_REVIEW_CHECKPOINTS = [50, 75, 90] as const;
export const GOAL_ATTENTION_TIME = '09:00';
export const BUDGET_REVIEW_TIME = '19:00';

export type AttentionNativeScheduleKind = 'goal_deadline' | 'budget_review';

export interface AttentionNativeSchedule {
  kind: AttentionNativeScheduleKind;
  notificationId: string;
  scheduleId: string;
  triggerAt: number;
  stage: number;
}

export interface BuildAttentionNativeScheduleInput {
  nowMs: number;
  goal: SavingsGoalRow | null;
  budgetCycle: BudgetCycle | null;
  budgetAmount: number;
}

function localYmdAt(epochMs: number): string | null {
  if (!Number.isFinite(epochMs)) return null;
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validActiveGoal(goal: SavingsGoalRow | null): goal is SavingsGoalRow {
  return !!goal
    && Number.isFinite(goal.target_amount)
    && goal.target_amount > 0
    && Number.isFinite(goal.current_amount)
    && goal.current_amount + 0.005 < goal.target_amount
    && isValidYmd(goal.target_date);
}

function goalSchedules(
  goal: SavingsGoalRow | null,
): AttentionNativeSchedule[] {
  if (!validActiveGoal(goal)) return [];
  return GOAL_ATTENTION_MILESTONES.flatMap((days) => {
    const triggerDate = shiftCalendarDate(goal.target_date, -days);
    if (!triggerDate) return [];
    const triggerAt = localReminderDateTimeToEpoch(triggerDate, GOAL_ATTENTION_TIME);
    if (triggerAt == null) return [];
    return [{
      kind: 'goal_deadline' as const,
      notificationId: `goal-deadline-v1-${goal.target_date}-${days}`,
      scheduleId: `goal:1:${goal.target_date}:${days}:0900`,
      triggerAt,
      stage: days,
    }];
  });
}

function validBudgetCycle(cycle: BudgetCycle | null, budgetAmount: number): cycle is BudgetCycle {
  return !!cycle
    && Number.isFinite(budgetAmount)
    && budgetAmount > 0
    && isValidYmd(cycle.start)
    && isValidYmd(cycle.end)
    && Number.isInteger(cycle.totalDays)
    && cycle.totalDays > 0
    && cycle.totalDays <= 62;
}

function budgetSchedules(
  cycle: BudgetCycle | null,
  budgetAmount: number,
): AttentionNativeSchedule[] {
  if (!validBudgetCycle(cycle, budgetAmount)) return [];
  return BUDGET_REVIEW_CHECKPOINTS.flatMap((checkpoint) => {
    // 1 tabanlı dönem ilerlemesini, aynı gün birden fazla checkpoint üretmeden
    // deterministik bir takvim gününe sabitle.
    const dayIndex = Math.min(
      cycle.totalDays - 1,
      Math.max(0, Math.ceil((cycle.totalDays * checkpoint) / 100) - 1),
    );
    const triggerDate = shiftCalendarDate(cycle.start, dayIndex);
    if (!triggerDate || triggerDate > cycle.end) return [];
    const triggerAt = localReminderDateTimeToEpoch(triggerDate, BUDGET_REVIEW_TIME);
    if (triggerAt == null) return [];
    return [{
      kind: 'budget_review' as const,
      notificationId: `budget-review-v1-${cycle.start}-${checkpoint}`,
      scheduleId: `budget:${cycle.start}:${checkpoint}:1900`,
      triggerAt,
      stage: checkpoint,
    }];
  });
}

function scheduleSort(
  left: AttentionNativeSchedule,
  right: AttentionNativeSchedule,
): number {
  if (left.triggerAt !== right.triggerAt) return left.triggerAt - right.triggerAt;
  return left.scheduleId.localeCompare(right.scheduleId);
}

/** Gelecekteki hedef ve dönem-kontrol alarmlarını üretir. */
export function buildAttentionNativeSchedule(
  input: BuildAttentionNativeScheduleInput,
): AttentionNativeSchedule[] {
  if (!input || !Number.isFinite(input.nowMs)) return [];
  return [
    ...goalSchedules(input.goal),
    ...budgetSchedules(input.budgetCycle, input.budgetAmount),
  ]
    .filter((item) => item.triggerAt > input.nowMs)
    .sort(scheduleSort);
}

export function presentAttentionNotification(
  item: AttentionNativeSchedule,
  createdAt = item.triggerAt,
): InAppNotification {
  if (item.kind === 'goal_deadline') {
    return {
      id: item.notificationId,
      severity: 'warning',
      titleKey: 'notif_goal_deadline_t',
      bodyKey: item.stage === 0
        ? 'notif_goal_deadline_today_b'
        : 'notif_goal_deadline_b',
      params: item.stage === 0 ? undefined : { days: String(item.stage) },
      createdAt,
      read: false,
    };
  }
  return {
    id: item.notificationId,
    severity: 'warning',
    titleKey: 'notif_budget_review_t',
    bodyKey: 'notif_budget_review_b',
    params: { progress: String(item.stage) },
    createdAt,
    read: false,
  };
}

/**
 * Native alarm tetiklendikten sonra uygulama açıldığında aynı olayın kanonik
 * uygulama-içi karşılığını bulur. Her ailede yalnız son geçilen eşik döner;
 * haftalarca açılmayan uygulama bir anda geçmiş alarm yığını üretmez.
 */
export function getCurrentAttentionNotifications(
  input: BuildAttentionNativeScheduleInput,
): InAppNotification[] {
  const today = localYmdAt(input.nowMs);
  if (!today) return [];
  const candidates = [
    ...goalSchedules(input.goal),
    ...budgetSchedules(input.budgetCycle, input.budgetAmount),
  ].filter((item) => item.triggerAt <= input.nowMs);

  const current: InAppNotification[] = [];
  if (validActiveGoal(input.goal)) {
    const daysRemaining = getCalendarDayOffset(today, input.goal.target_date);
    if (daysRemaining != null && daysRemaining >= 0) {
      const goal = candidates
        .filter((item) => item.kind === 'goal_deadline')
        .sort(scheduleSort)
        .at(-1);
      if (goal) current.push(presentAttentionNotification(goal));
    }
  }
  if (validBudgetCycle(input.budgetCycle, input.budgetAmount)
    && today >= input.budgetCycle.start
    && today <= input.budgetCycle.end) {
    const budget = candidates
      .filter((item) => item.kind === 'budget_review')
      .sort(scheduleSort)
      .at(-1);
    if (budget) current.push(presentAttentionNotification(budget));
  }
  return current;
}
