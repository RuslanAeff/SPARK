import type { Budget, BudgetRollover } from '../db/schema';
import { periodsOverlap } from './budgetPeriodConflicts';
import { isSupportedYmd } from './inputValidation';

export type BudgetHealthIssueCode =
  | 'invalid_bounds'
  | 'overlap'
  | 'orphan_rollover';

export interface BudgetHealthIssue {
  code: BudgetHealthIssueCode;
  budgetIds: number[];
  detail: string;
}

/** Read-only structural audit. Missing saved months are valid because the last plan repeats. */
export function inspectBudgetPeriodHealth(
  budgets: readonly Budget[],
  rollovers: readonly BudgetRollover[],
): BudgetHealthIssue[] {
  const issues: BudgetHealthIssue[] = [];
  const valid = budgets.filter((budget) => {
    const okay = isSupportedYmd(budget.period_start)
      && isSupportedYmd(budget.period_end)
      && budget.period_start! <= budget.period_end!;
    if (!okay) issues.push({
      code: 'invalid_bounds',
      budgetIds: [budget.id],
      detail: `${budget.period_start ?? '?'}–${budget.period_end ?? '?'}`,
    });
    return okay;
  });

  for (let left = 0; left < valid.length; left += 1) {
    for (let right = left + 1; right < valid.length; right += 1) {
      const a = valid[left];
      const b = valid[right];
      if (periodsOverlap(a.period_start!, a.period_end!, b.period_start!, b.period_end!)) {
        issues.push({
          code: 'overlap',
          budgetIds: [a.id, b.id],
          detail: `${a.period_start}–${a.period_end} / ${b.period_start}–${b.period_end}`,
        });
      }
    }
  }

  for (const rollover of rollovers) {
    const source = valid.filter((budget) => budget.period_start === rollover.source_start
      && budget.period_end === rollover.source_end && budget.currency === rollover.currency);
    const target = valid.filter((budget) => budget.period_start === rollover.target_start
      && budget.period_end === rollover.target_end && budget.currency === rollover.currency);
    if (source.length !== 1 || target.length !== 1) {
      issues.push({
        code: 'orphan_rollover',
        budgetIds: [...source, ...target].map((row) => row.id),
        detail: `${rollover.source_start}–${rollover.source_end} → ${rollover.target_start}–${rollover.target_end}`,
      });
    }
  }
  return issues;
}
