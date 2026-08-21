import type { ReminderRecurrenceUnit } from '../db/schema';

export function scheduleFromDetectedPeriod(periodDays: number): {
  unit: ReminderRecurrenceUnit;
  interval: number;
} {
  if (periodDays === 7 || periodDays === 14) {
    return { unit: 'week', interval: periodDays / 7 };
  }
  if (periodDays >= 28 && periodDays <= 31) return { unit: 'month', interval: 1 };
  if (periodDays >= 56 && periodDays <= 62) return { unit: 'month', interval: 2 };
  if (periodDays >= 84 && periodDays <= 95) return { unit: 'month', interval: 3 };
  if (periodDays >= 360 && periodDays <= 370) return { unit: 'year', interval: 1 };
  return { unit: 'day', interval: Math.max(1, Math.min(999, Math.round(periodDays))) };
}
