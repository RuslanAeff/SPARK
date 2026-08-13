import {
  buildReminderNativeSchedule,
  localReminderDateTimeToEpoch,
  MAX_NATIVE_REMINDER_SCHEDULES,
  type DebtNativeScheduleInput,
  type RecurringPaymentNativeScheduleInput,
} from '../reminderNativeSchedule';

function at(ymd: string, time: string): number {
  const value = localReminderDateTimeToEpoch(ymd, time);
  if (value == null) throw new Error(`Invalid test clock: ${ymd} ${time}`);
  return value;
}

function debt(overrides: Partial<DebtNativeScheduleInput> = {}): DebtNativeScheduleInput {
  return {
    id: 7,
    direction: 'borrowed',
    counterparty: 'Private Counterparty',
    remaining: 240.5,
    currency: 'PLN',
    status: 'open',
    due_date: '2026-08-15',
    reminder_enabled: 1,
    reminder_days_before: 3,
    reminder_time: '09:00',
    ...overrides,
  };
}

function plan(
  overrides: Partial<RecurringPaymentNativeScheduleInput> = {},
): RecurringPaymentNativeScheduleInput {
  return {
    uid: '123e4567-e89b-42d3-a456-426614174000',
    title: 'Private Internet Provider',
    expected_amount: 59.99,
    currency: 'PLN',
    anchor_date: '2026-01-31',
    next_due_date: '2026-08-31',
    recurrence_unit: 'month',
    recurrence_interval: 1,
    reminder_days_before: 3,
    reminder_time: '09:00',
    status: 'active',
    source: 'manual',
    ...overrides,
  };
}

function build(
  debts: DebtNativeScheduleInput[] = [],
  recurringPayments: RecurringPaymentNativeScheduleInput[] = [],
  nowMs = at('2026-08-11', '08:00'),
) {
  return buildReminderNativeSchedule({ nowMs, debts, recurringPayments });
}

describe('reminderNativeSchedule — borç alarm planı', () => {
  it('lead > 0 için yaklaşan ve vade-günü alarmlarını feed kimlikleriyle üretir', () => {
    const result = build([debt()]);

    expect(result).toEqual([
      expect.objectContaining({
        kind: 'debt',
        stage: 'upcoming',
        entityKey: 'debt:7',
        notificationId: 'debt-due-v1-7-2026-08-15-3-0900-upcoming',
        scheduleId: 'debt:7:2026-08-15:3:0900:upcoming',
        dueDate: '2026-08-15',
        daysUntilDue: 3,
        triggerAt: at('2026-08-12', '09:00'),
        label: 'Private Counterparty',
        amount: 240.5,
        currency: 'PLN',
      }),
      expect.objectContaining({
        stage: 'today',
        notificationId: 'debt-due-v1-7-2026-08-15-3-0900-today',
        scheduleId: 'debt:7:2026-08-15:3:0900:today',
        daysUntilDue: 0,
        triggerAt: at('2026-08-15', '09:00'),
      }),
    ]);
    expect(result.every((entry) => !entry.notificationId.includes('Private'))).toBe(true);
    expect(result.every((entry) => !entry.scheduleId.includes('Private'))).toBe(true);
    expect(result.every((entry) => entry.scheduleId.length <= 170)).toBe(true);
  });

  it('lead = 0 için yalnız vade-günü alarmı üretir', () => {
    const result = build([debt({ reminder_days_before: 0 })]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ stage: 'today', triggerAt: at('2026-08-15', '09:00') });
  });

  it('geçmiş alarmı sonradan göndermek üzere kaydırmaz, yalnız gelecekte kalanı tutar', () => {
    const result = build(
      [debt({ due_date: '2026-08-12', reminder_days_before: 3 })],
      [],
      at('2026-08-11', '10:00'),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ stage: 'today', triggerAt: at('2026-08-12', '09:00') });

    expect(build(
      [debt({ due_date: '2026-08-11', reminder_days_before: 0 })],
      [],
      at('2026-08-11', '09:00'),
    )).toEqual([]);
  });

  it.each<Partial<DebtNativeScheduleInput>>([
    { direction: 'lent' },
    { status: 'settled' },
    { remaining: 0 },
    { reminder_enabled: 0 },
    { due_date: null },
    { due_date: '2026-02-30' },
    { reminder_days_before: 366 },
    { reminder_time: '25:00' },
    { counterparty: '   ' },
  ])('uygun olmayan borcu fail-closed reddeder: %j', (override) => {
    expect(build([debt(override)])).toEqual([]);
  });
});

describe('reminderNativeSchedule — düzenli ödeme rolling horizon', () => {
  it('geçmiş next_due değerini özgün anchor kuralından bugün veya sonrasına taşır', () => {
    const result = build([], [plan({ next_due_date: '2026-07-31' })]);

    expect(result[0]).toMatchObject({
      kind: 'recurring_payment',
      stage: 'upcoming',
      entityKey: 'recurring:123e4567-e89b-42d3-a456-426614174000',
      dueDate: '2026-08-31',
      daysUntilDue: 3,
      triggerAt: at('2026-08-28', '09:00'),
      notificationId:
        'payplan-due-v1-123e4567-e89b-42d3-a456-426614174000-2026-08-31-3-0900-upcoming',
      scheduleId:
        'plan:123e4567-e89b-42d3-a456-426614174000:2026-08-31:3:0900:upcoming',
    });
    expect(result.some((entry) => entry.dueDate === '2026-09-30')).toBe(true);
  });

  it('400 günlük ufukta plan başına en fazla 14 oluşum üretir', () => {
    const result = build([], [plan({
      anchor_date: '2026-08-12',
      next_due_date: '2026-08-12',
      recurrence_unit: 'day',
      reminder_days_before: 0,
    })]);

    expect(result).toHaveLength(14);
    expect(result[0]).toMatchObject({ dueDate: '2026-08-12', stage: 'today' });
    expect(result[13]).toMatchObject({ dueDate: '2026-08-25', stage: 'today' });
  });

  it('400 günün dışındaki oluşumu planlamaz', () => {
    expect(build([], [plan({
      anchor_date: '2027-09-16',
      next_due_date: '2027-09-16',
      recurrence_unit: 'year',
      reminder_days_before: 0,
    })])).toEqual([]);
  });

  it.each<Partial<RecurringPaymentNativeScheduleInput>>([
    { status: 'paused' },
    { source: 'automatic' as 'manual' },
    { uid: 'not-a-uuid' },
    { title: '   ' },
    { next_due_date: '2026-08-30' },
    { recurrence_interval: 0 },
    { reminder_days_before: -1 },
    { reminder_time: '9:00' },
    { expected_amount: Number.NaN },
  ])('uygun olmayan ödeme planını fail-closed reddeder: %j', (override) => {
    expect(build([], [plan(override)])).toEqual([]);
  });
});

describe('reminderNativeSchedule — yerel saat ve kapasite güvenliği', () => {
  it('DST boşluğunda occurrence kaybetmeden aynı gün ileri normalize eder', () => {
    const normalized = localReminderDateTimeToEpoch('2026-03-29', '02:30');
    expect(normalized).not.toBeNull();
    expect(new Date(normalized as number).getHours()).toBe(3);
    expect(new Date(normalized as number).getMinutes()).toBe(30);
    expect(localReminderDateTimeToEpoch('2026-03-29', '03:30')).not.toBeNull();
    const result = buildReminderNativeSchedule({
      nowMs: at('2026-03-28', '10:00'),
      debts: [debt({
        due_date: '2026-03-29',
        reminder_days_before: 0,
        reminder_time: '02:30',
      })],
      recurringPayments: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.triggerAt).toBe(normalized);
  });

  it('512 sınırında her varlığın ilk alarmını ek alarmlardan önce korur', () => {
    const plans = Array.from({ length: 300 }, (_, index) => plan({
      uid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      anchor_date: '2026-08-12',
      next_due_date: '2026-08-12',
      recurrence_unit: 'day',
      reminder_days_before: 0,
    }));
    const result = build([], plans);

    expect(result).toHaveLength(MAX_NATIVE_REMINDER_SCHEDULES);
    expect(new Set(result.map((entry) => entry.entityKey)).size).toBe(300);
    expect(result.every((entry) => entry.triggerAt > at('2026-08-11', '08:00'))).toBe(true);
  });

  it('geçersiz clock veya koleksiyonlarda exception yerine boş plan döndürür', () => {
    expect(buildReminderNativeSchedule({
      nowMs: Number.NaN,
      debts: [debt()],
      recurringPayments: [],
    })).toEqual([]);
    expect(buildReminderNativeSchedule({
      nowMs: at('2026-08-11', '08:00'),
      debts: null as unknown as DebtNativeScheduleInput[],
      recurringPayments: null as unknown as RecurringPaymentNativeScheduleInput[],
    })).toEqual([]);
  });
});
