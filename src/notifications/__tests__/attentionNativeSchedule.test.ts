import type { SavingsGoalRow } from '../../db/goalDao';
import type { BudgetCycle } from '../../utils/budgetCycle';
import {
  buildAttentionNativeSchedule,
  getCurrentAttentionNotifications,
} from '../attentionNativeSchedule';

const goal: SavingsGoalRow = {
  id: 1,
  title: 'Emergency fund',
  target_amount: 5_000,
  current_amount: 1_200,
  target_date: '2026-10-30',
  currency: 'PLN',
};

const augustCycle: BudgetCycle = {
  start: '2026-08-01',
  end: '2026-08-31',
  key: '2026-08',
  totalDays: 31,
  startDay: 1,
};

describe('closed-app attention native schedule', () => {
  it('pre-schedules deterministic goal milestones and budget checkpoints at local times', () => {
    const now = new Date(2026, 7, 1, 8, 0, 0, 0).getTime();
    const plan = buildAttentionNativeSchedule({
      nowMs: now,
      goal,
      budgetCycle: augustCycle,
      budgetAmount: 3_600,
    });

    expect(plan.filter((item) => item.kind === 'goal_deadline')).toHaveLength(7);
    expect(plan.filter((item) => item.kind === 'budget_review')).toHaveLength(3);
    expect(plan.map((item) => item.scheduleId)).toContain(
      'goal:1:2026-10-30:90:0900',
    );
    expect(plan.map((item) => item.scheduleId)).toContain(
      'budget:2026-08-01:50:1900',
    );

    const firstGoal = plan.find((item) => item.scheduleId.endsWith(':90:0900'));
    const firstBudget = plan.find((item) => item.scheduleId.includes(':50:1900'));
    expect(new Date(firstGoal!.triggerAt).getHours()).toBe(9);
    expect(new Date(firstBudget!.triggerAt).getHours()).toBe(19);
    expect(plan.every((item) => item.triggerAt > now)).toBe(true);
  });

  it('does not schedule completed goals or a cycle without a positive budget', () => {
    const plan = buildAttentionNativeSchedule({
      nowMs: new Date(2026, 7, 1, 8, 0, 0, 0).getTime(),
      goal: { ...goal, current_amount: goal.target_amount },
      budgetCycle: augustCycle,
      budgetAmount: 0,
    });

    expect(plan).toEqual([]);
  });

  it('returns only the latest crossed milestone per family instead of a backlog', () => {
    const now = new Date(2026, 7, 25, 20, 0, 0, 0).getTime();
    const current = getCurrentAttentionNotifications({
      nowMs: now,
      goal: { ...goal, target_date: '2026-09-24' },
      budgetCycle: augustCycle,
      budgetAmount: 3_600,
    });

    expect(current.map((item) => item.id).sort()).toEqual([
      'budget-review-v1-2026-08-01-75',
      'goal-deadline-v1-2026-09-24-30',
    ]);
    expect(current).toHaveLength(2);
  });

  it('keeps past budget periods and expired goals out of the current feed', () => {
    const now = new Date(2026, 8, 2, 12, 0, 0, 0).getTime();
    const current = getCurrentAttentionNotifications({
      nowMs: now,
      goal: { ...goal, target_date: '2026-08-31' },
      budgetCycle: augustCycle,
      budgetAmount: 3_600,
    });

    expect(current).toEqual([]);
  });
});
