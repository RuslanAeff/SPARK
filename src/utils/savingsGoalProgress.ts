import type { SavingsGoalRow } from '../db/goalDao';

export type SavingsGoalStatus = 'active' | 'due_today' | 'overdue' | 'reached';

export interface SavingsGoalProgress {
  saved: number;
  target: number;
  remaining: number;
  surplus: number;
  progress: number;
  percent: number;
  daysLeft: number;
  monthsLeft: number;
  monthlyNeeded: number;
  reached: boolean;
  status: SavingsGoalStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function finiteNonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

/**
 * Birikim hedefinin tüm kartlarda aynı şekilde yorumlanmasını sağlar.
 * Gün farkı takvim parçaları üzerinden UTC'de hesaplanır; DST geçişleri sonucu
 * 23/25 saatlik günlerin kullanıcıya yanlış gün sayısı göstermesi engellenir.
 */
export function getSavingsGoalProgress(
  goal: SavingsGoalRow,
  now: Date = new Date(),
): SavingsGoalProgress {
  const saved = finiteNonNegative(goal.current_amount);
  const target = finiteNonNegative(goal.target_amount);
  const remaining = Math.max(0, target - saved);
  const surplus = Math.max(0, saved - target);
  const progress = target > 0 ? Math.min(1, saved / target) : 0;
  const percent = Math.round(progress * 100);
  const reached = target > 0 && saved >= target;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(goal.target_date);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : todayUtc;
  const daysLeft = Math.round((targetUtc - todayUtc) / DAY_MS);
  const monthsLeft = Math.max(1, Math.ceil(Math.max(0, daysLeft) / 30));

  const status: SavingsGoalStatus = reached
    ? 'reached'
    : daysLeft < 0
      ? 'overdue'
      : daysLeft === 0
        ? 'due_today'
        : 'active';

  return {
    saved,
    target,
    remaining,
    surplus,
    progress,
    percent,
    daysLeft,
    monthsLeft,
    monthlyNeeded: remaining / monthsLeft,
    reached,
    status,
  };
}
