import { getCycleForYmd, normalizeCycleStartDay, type BudgetCycle } from './budgetCycle';

function parseYmd(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month, day];
}

export function addCalendarDays(value: string, amount: number): string {
  const [year, month, day] = parseYmd(value);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export interface BudgetCycleTransitionPreview {
  preserved: { start: string; end: string };
  bridge: BudgetCycle | null;
  firstRegular: BudgetCycle;
  nextStartDay: number;
}

/**
 * A cycle rule change never rewrites the period already in progress. When the
 * new anchor does not line up with the following day, one explicit bridge
 * period closes the calendar gap. All later cycles follow the new anchor.
 */
export function previewBudgetCycleTransition(
  currentStart: string,
  currentEnd: string,
  nextStartDayRaw: number,
): BudgetCycleTransitionPreview {
  const nextStartDay = normalizeCycleStartDay(nextStartDayRaw);
  const bridgeStart = addCalendarDays(currentEnd, 1);
  const [year, month, day] = parseYmd(bridgeStart);
  const containing = getCycleForYmd(nextStartDay, year, month - 1, day);

  if (containing.start === bridgeStart) {
    return {
      preserved: { start: currentStart, end: currentEnd },
      bridge: null,
      firstRegular: containing,
      nextStartDay,
    };
  }

  const bridge: BudgetCycle = {
    start: bridgeStart,
    end: containing.end,
    key: bridgeStart.slice(0, 7),
    totalDays: calendarDayDiff(bridgeStart, containing.end) + 1,
    startDay: nextStartDay,
  };
  const regularStart = addCalendarDays(bridge.end, 1);
  const [regularYear, regularMonth, regularDay] = parseYmd(regularStart);
  return {
    preserved: { start: currentStart, end: currentEnd },
    bridge,
    firstRegular: getCycleForYmd(nextStartDay, regularYear, regularMonth - 1, regularDay),
    nextStartDay,
  };
}

function calendarDayDiff(start: string, end: string): number {
  const [sy, sm, sd] = parseYmd(start);
  const [ey, em, ed] = parseYmd(end);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000);
}
