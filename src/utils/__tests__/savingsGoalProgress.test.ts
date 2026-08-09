import { SavingsGoalRow } from '../../db/goalDao';
import { getSavingsGoalProgress } from '../savingsGoalProgress';

const makeGoal = (overrides: Partial<SavingsGoalRow> = {}): SavingsGoalRow => ({
  id: 1,
  title: 'Emergency fund',
  target_amount: 100,
  target_date: '2026-01-31',
  currency: 'PLN',
  current_amount: 0,
  ...overrides,
});

const now = new Date(2026, 0, 1, 12, 0, 0);

describe('getSavingsGoalProgress', () => {
  it.each([
    ['negative savings', -10, 0, 0, 100],
    ['zero savings', 0, 0, 0, 100],
    ['25 percent', 25, 25, 0.25, 75],
  ])('normalizes and calculates %s', (_label, current, percent, progress, remaining) => {
    const result = getSavingsGoalProgress(makeGoal({ current_amount: current }), now);

    expect(result.saved).toBe(Math.max(0, current));
    expect(result.percent).toBe(percent);
    expect(result.progress).toBe(progress);
    expect(result.remaining).toBe(remaining);
    expect(result.reached).toBe(false);
    expect(result.status).toBe('active');
  });

  it('handles a zero target without NaN or a false completion', () => {
    const result = getSavingsGoalProgress(makeGoal({ target_amount: 0 }), now);

    expect(result.target).toBe(0);
    expect(result.progress).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.monthlyNeeded).toBe(0);
    expect(result.reached).toBe(false);
  });

  it('marks exactly 100 percent as reached', () => {
    const result = getSavingsGoalProgress(makeGoal({ current_amount: 100 }), now);

    expect(result.progress).toBe(1);
    expect(result.percent).toBe(100);
    expect(result.remaining).toBe(0);
    expect(result.surplus).toBe(0);
    expect(result.reached).toBe(true);
    expect(result.status).toBe('reached');
  });

  it('caps displayed progress and records the surplus above target', () => {
    const result = getSavingsGoalProgress(makeGoal({ current_amount: 125 }), now);

    expect(result.saved).toBe(125);
    expect(result.progress).toBe(1);
    expect(result.percent).toBe(100);
    expect(result.remaining).toBe(0);
    expect(result.surplus).toBe(25);
    expect(result.status).toBe('reached');
  });

  it('distinguishes a deadline due today from an overdue goal', () => {
    const dueToday = getSavingsGoalProgress(
      makeGoal({ target_date: '2026-08-09' }),
      new Date(2026, 7, 9, 23, 59, 59),
    );
    const overdue = getSavingsGoalProgress(
      makeGoal({ target_date: '2026-08-08' }),
      new Date(2026, 7, 9, 0, 1, 0),
    );

    expect(dueToday.daysLeft).toBe(0);
    expect(dueToday.status).toBe('due_today');
    expect(overdue.daysLeft).toBe(-1);
    expect(overdue.status).toBe('overdue');
  });

  it('counts calendar days across a DST boundary instead of elapsed hours', () => {
    // Europe/Warsaw enters daylight saving time on 29 March 2026. The local
    // day is 23 hours, but 28 -> 30 March must still be two calendar days.
    const beforeDst = getSavingsGoalProgress(
      makeGoal({ target_date: '2026-03-30' }),
      new Date(2026, 2, 28, 23, 30, 0),
    );
    const dstDay = getSavingsGoalProgress(
      makeGoal({ target_date: '2026-03-30' }),
      new Date(2026, 2, 29, 23, 30, 0),
    );

    expect(beforeDst.daysLeft).toBe(2);
    expect(dstDay.daysLeft).toBe(1);
  });
});
