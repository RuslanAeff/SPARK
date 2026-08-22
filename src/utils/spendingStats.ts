const DAY_MS = 86_400_000;

export interface DailySpendingEntry {
  date: string;
  total: number;
}

export interface SpendingStatsTargetRange {
  start: string;
  end: string;
}

export interface ComputeSpendingStatsInput {
  dailyData: readonly DailySpendingEntry[];
  startDate: string;
  endDate: string;
  /** Deterministic local "today", supplied as YYYY-MM-DD by the caller. */
  today: string;
  /** Tracking mode: observation never begins before the first real expense. */
  trackingMode?: boolean;
  /** First expense date across the database; null explicitly means no tracking history. */
  trackingStartDate?: string | null;
  /** Stable daily target. It is used only together with a valid targetRange. */
  dailyTarget?: number | null;
  targetRange?: SpendingStatsTargetRange | null;
  /** A result becomes an achievement/statistic only after this many completed days. */
  minimumCompletedDays?: number;
}

export type SpendingStatsStatus =
  | 'ready'
  | 'no_data'
  | 'no_completed_days'
  | 'insufficient_history';
export type SpendingStatsStreakMode = 'current' | 'period_end';

export interface SpendingStatsResult {
  status: SpendingStatsStatus;
  streakMode: SpendingStatsStreakMode;
  scopeStart: string | null;
  scopeEnd: string | null;
  dailyTarget: number | null;
  zeroSpendDays: number;
  currentStreak: number;
  underBudgetDays: number;
  totalDays: number;
  recordedDays: number;
  coveragePct: number;
  zeroSpendDates: string[];
  currentStreakDates: string[];
  underBudgetEntries: { date: string; total: number }[];
}

interface ValidTarget {
  cents: number;
  amount: number;
  startOrdinal: number;
  endOrdinal: number;
}

/**
 * Convert a strict calendar date to a UTC day ordinal. Date arithmetic then
 * remains independent of local DST transitions and timezone offsets.
 */
function ymdToOrdinal(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(timestamp / DAY_MS);
}

function ordinalToYmd(ordinal: number): string {
  const date = new Date(ordinal * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

function requireOrdinal(value: string, field: string): number {
  const ordinal = ymdToOrdinal(value);
  if (ordinal === null) throw new RangeError(`${field} must be a valid YYYY-MM-DD date`);
  return ordinal;
}

function toCents(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function resolveTarget(
  dailyTarget: number | null | undefined,
  targetRange: SpendingStatsTargetRange | null | undefined,
): ValidTarget | null {
  if (!targetRange) return null;
  const cents = dailyTarget == null ? null : toCents(dailyTarget);
  const startOrdinal = ymdToOrdinal(targetRange.start);
  const endOrdinal = ymdToOrdinal(targetRange.end);
  if (
    cents === null ||
    cents <= 0 ||
    startOrdinal === null ||
    endOrdinal === null ||
    startOrdinal > endOrdinal
  ) {
    return null;
  }
  return {
    cents,
    amount: cents / 100,
    startOrdinal,
    endOrdinal,
  };
}

function emptyResult(
  status: Exclude<SpendingStatsStatus, 'ready'>,
  streakMode: SpendingStatsStreakMode,
  dailyTarget: number | null,
  scopeStart: string | null = null,
): SpendingStatsResult {
  return {
    status,
    streakMode,
    scopeStart,
    scopeEnd: null,
    dailyTarget,
    zeroSpendDays: 0,
    currentStreak: 0,
    underBudgetDays: 0,
    totalDays: 0,
    recordedDays: 0,
    coveragePct: 0,
    zeroSpendDates: [],
    currentStreakDates: [],
    underBudgetEntries: [],
  };
}

/**
 * Compute spending-day statistics from daily totals.
 *
 * Only completed calendar days are evaluated: `today` is never part of the
 * zero-day, target-day, or denominator counts. Every comparison is performed
 * in integer currency cents. Multiple source rows for one date are summed.
 */
export function computeSpendingStats({
  dailyData,
  startDate,
  endDate,
  today,
  trackingMode = false,
  trackingStartDate,
  dailyTarget,
  targetRange,
  minimumCompletedDays = 3,
}: ComputeSpendingStatsInput): SpendingStatsResult {
  const selectedStart = requireOrdinal(startDate, 'startDate');
  const selectedEnd = requireOrdinal(endDate, 'endDate');
  const todayOrdinal = requireOrdinal(today, 'today');
  if (selectedStart > selectedEnd) {
    throw new RangeError('startDate must not be after endDate');
  }

  const streakMode: SpendingStatsStreakMode =
    selectedStart <= todayOrdinal && todayOrdinal <= selectedEnd ? 'current' : 'period_end';
  const target = resolveTarget(dailyTarget, targetRange);

  const totalsByOrdinal = new Map<number, number>();
  let firstSourceOrdinal: number | null = null;
  for (const entry of dailyData) {
    const ordinal = ymdToOrdinal(entry.date);
    const cents = toCents(entry.total);
    if (
      ordinal === null ||
      cents === null ||
      ordinal < selectedStart ||
      ordinal > selectedEnd
    ) {
      continue;
    }
    totalsByOrdinal.set(ordinal, (totalsByOrdinal.get(ordinal) ?? 0) + cents);
    // useDailySpending short ranges for charts with synthetic zero rows. Only
    // a real non-zero expense day proves that tracking has started.
    if (cents !== 0 && (firstSourceOrdinal === null || ordinal < firstSourceOrdinal)) {
      firstSourceOrdinal = ordinal;
    }
  }

  let resolvedTrackingStart = firstSourceOrdinal;
  if (trackingMode && trackingStartDate !== undefined) {
    resolvedTrackingStart = trackingStartDate === null
      ? null
      : requireOrdinal(trackingStartDate, 'trackingStartDate');
  }
  if (
    trackingMode &&
    (resolvedTrackingStart === null || resolvedTrackingStart > selectedEnd)
  ) {
    return emptyResult('no_data', streakMode, target?.amount ?? null);
  }

  const scopeStartOrdinal = trackingMode
    ? Math.max(selectedStart, resolvedTrackingStart as number)
    : selectedStart;
  const completedEndOrdinal = Math.min(selectedEnd, todayOrdinal - 1);
  const scopeStart = ordinalToYmd(scopeStartOrdinal);

  if (completedEndOrdinal < scopeStartOrdinal) {
    return emptyResult(
      'no_completed_days',
      streakMode,
      target?.amount ?? null,
      scopeStart,
    );
  }

  const zeroSpendDates: string[] = [];
  const underBudgetEntries: { date: string; total: number }[] = [];
  let recordedDays = 0;

  for (let ordinal = scopeStartOrdinal; ordinal <= completedEndOrdinal; ordinal += 1) {
    const totalCents = totalsByOrdinal.get(ordinal) ?? 0;
    const date = ordinalToYmd(ordinal);
    if (totalCents === 0) zeroSpendDates.push(date);
    else recordedDays += 1;

    if (
      target &&
      ordinal >= target.startOrdinal &&
      ordinal <= target.endOrdinal &&
      totalCents > 0 &&
      totalCents <= target.cents
    ) {
      underBudgetEntries.push({ date, total: totalCents / 100 });
    }
  }

  const totalDays = completedEndOrdinal - scopeStartOrdinal + 1;
  const coveragePct = totalDays > 0 ? Math.round((recordedDays / totalDays) * 100) : 0;
  const normalizedMinimumDays = Math.max(1, Math.floor(minimumCompletedDays));
  if (totalDays < normalizedMinimumDays) {
    return {
      status: 'insufficient_history',
      streakMode,
      scopeStart,
      scopeEnd: ordinalToYmd(completedEndOrdinal),
      dailyTarget: target?.amount ?? null,
      zeroSpendDays: 0,
      currentStreak: 0,
      underBudgetDays: 0,
      totalDays,
      recordedDays,
      coveragePct,
      zeroSpendDates: [],
      currentStreakDates: [],
      underBudgetEntries: [],
    };
  }

  const currentStreakDates: string[] = [];
  const todayHasSpending = (totalsByOrdinal.get(todayOrdinal) ?? 0) !== 0;
  if (!(streakMode === 'current' && todayHasSpending)) {
    for (let ordinal = completedEndOrdinal; ordinal >= scopeStartOrdinal; ordinal -= 1) {
      if ((totalsByOrdinal.get(ordinal) ?? 0) !== 0) break;
      currentStreakDates.push(ordinalToYmd(ordinal));
    }
    currentStreakDates.reverse();
  }

  return {
    status: 'ready',
    streakMode,
    scopeStart,
    scopeEnd: ordinalToYmd(completedEndOrdinal),
    dailyTarget: target?.amount ?? null,
    zeroSpendDays: zeroSpendDates.length,
    currentStreak: currentStreakDates.length,
    underBudgetDays: underBudgetEntries.length,
    totalDays,
    recordedDays,
    coveragePct,
    zeroSpendDates,
    currentStreakDates,
    underBudgetEntries,
  };
}
