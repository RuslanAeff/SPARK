import {
  buildReminderNotificationCandidates,
  type DebtReminderRuleInput,
  type RecurringPaymentReminderRuleInput,
  type ReminderRuleClock,
} from '../reminderNotificationRules';

const CLOCK: ReminderRuleClock = { today: '2026-08-11', localTime: '09:00' };

function debt(
  overrides: Partial<DebtReminderRuleInput> = {},
): DebtReminderRuleInput {
  return {
    id: 7,
    direction: 'borrowed',
    counterparty: 'Ali',
    remaining: 125.5,
    currency: 'PLN',
    status: 'open',
    due_date: '2026-08-14',
    reminder_enabled: 1,
    reminder_days_before: 3,
    reminder_time: '09:00',
    ...overrides,
  };
}

function recurring(
  overrides: Partial<RecurringPaymentReminderRuleInput> = {},
): RecurringPaymentReminderRuleInput {
  return {
    uid: '123e4567-e89b-42d3-a456-426614174000',
    title: 'İnternet',
    expected_amount: 79.9,
    currency: 'PLN',
    anchor_date: '2026-01-14',
    next_due_date: '2026-08-14',
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
  debts: DebtReminderRuleInput[] = [],
  recurringPayments: RecurringPaymentReminderRuleInput[] = [],
  clock: ReminderRuleClock = CLOCK,
) {
  return buildReminderNotificationCandidates({ clock, debts, recurringPayments });
}

describe('reminderNotificationRules — borç vadesi', () => {
  it.each([
    ['upcoming', '2026-08-14', 3],
    ['today', '2026-08-11', 0],
    ['overdue', '2026-08-08', -3],
  ] as const)('%s aşaması için sabit kimlik ve token üretir', (stage, dueDate, offset) => {
    const [candidate] = build([debt({ due_date: dueDate })]);

    expect(candidate).toMatchObject({
      kind: 'debt',
      stage,
      entityKey: 'debt:7',
      dedupeToken: `${dueDate}:3:09:00:${stage}`,
      notificationId: `debt-due-v1-7-${dueDate}-3-0900-${stage}`,
      dueDate,
      daysUntilDue: offset,
      label: 'Ali',
      amount: 125.5,
      currency: 'PLN',
    });
  });

  it('yaklaşan adayı yalnız kullanıcının lead-day penceresinde üretir', () => {
    expect(build([debt({ due_date: '2026-08-15', reminder_days_before: 3 })])).toEqual([]);
    expect(build([debt({ due_date: '2026-08-14', reminder_days_before: 3 })]))
      .toHaveLength(1);
    expect(build([debt({ due_date: '2026-08-12', reminder_days_before: 0 })])).toEqual([]);
  });

  it.each([
    { direction: 'lent' as const },
    { status: 'settled' as const },
    { remaining: 0 },
    { remaining: Number.NaN },
    { reminder_enabled: 0 as const },
    { due_date: null },
    { due_date: '2026-02-30' },
    { reminder_days_before: -1 },
    { reminder_days_before: 366 },
    { reminder_time: '9:00' },
    { currency: '' },
    { id: 0 },
  ])('geçersiz veya kapsam dışı borcu fail-closed atlar: %j', (overrides) => {
    expect(build([debt(overrides)])).toEqual([]);
  });
});

describe('reminderNotificationRules — kullanıcı tarafından yönetilen plan', () => {
  it.each(['manual', 'detected'] as const)(
    '%s kaynaklı aktif ve onaylanmış planı işler',
    (source) => {
      const [candidate] = build([], [recurring({ source })]);

      expect(candidate).toMatchObject({
        kind: 'recurring_payment',
        stage: 'upcoming',
        entityKey: 'recurring:123e4567-e89b-42d3-a456-426614174000',
        dedupeToken: '2026-08-14:3:09:00:upcoming',
        notificationId:
          'payplan-due-v1-123e4567-e89b-42d3-a456-426614174000-2026-08-14-3-0900-upcoming',
        dueDate: '2026-08-14',
        daysUntilDue: 3,
        label: 'İnternet',
        amount: 79.9,
        currency: 'PLN',
      });
    },
  );

  it('opsiyonel tutarı olmayan aktif planı da bildirir', () => {
    const [candidate] = build([], [recurring({ expected_amount: null })]);
    expect(candidate.amount).toBeNull();
  });

  it.each([
    { status: 'paused' as const },
    { uid: 'not-a-uuid' },
    { title: '   ' },
    { next_due_date: '2026-02-30' },
    { next_due_date: '2026-08-13' }, // Aylık 14 anchorının oluşumu değil.
    { anchor_date: '2026-08-15' },
    { recurrence_interval: 0 },
    { recurrence_interval: 1.5 },
    { reminder_days_before: 999 },
    { reminder_time: '24:00' },
    { expected_amount: -1 },
    { expected_amount: Number.POSITIVE_INFINITY },
    { currency: '   ' },
  ])('geçersiz veya pasif planı fail-closed atlar: %j', (overrides) => {
    expect(build([], [recurring(overrides)])).toEqual([]);
  });
});

describe('reminderNotificationRules — yerel saat, saflık ve determinizm', () => {
  it('yaklaşan ve bugün aşamalarını ilk gün seçilen yerel HH:MM gelmeden üretmez', () => {
    expect(build([debt({ due_date: '2026-08-14' })], [], {
      today: '2026-08-11', localTime: '08:59',
    })).toEqual([]);
    expect(build([debt({ due_date: '2026-08-11' })], [], {
      today: '2026-08-11', localTime: '08:59',
    })).toEqual([]);
    expect(build([debt({ due_date: '2026-08-14' })], [], {
      today: '2026-08-11', localTime: '09:00',
    })).toHaveLength(1);
  });

  it('planlanan an önceki gün geçtiyse sonraki gün daha erken saatte geciktirmez', () => {
    expect(build([debt({ due_date: '2026-08-14' })], [], {
      today: '2026-08-12', localTime: '08:00',
    })).toHaveLength(1);
    expect(build([debt({ due_date: '2026-08-10' })], [], {
      today: '2026-08-11', localTime: '08:00',
    })).toHaveLength(1);
  });

  it('plan hatırlatıcısında da yerel saati sınır dahil uygular', () => {
    const row = recurring({ reminder_time: '18:30' });
    expect(build([], [row], { today: '2026-08-11', localTime: '18:29' })).toEqual([]);
    expect(build([], [row], { today: '2026-08-11', localTime: '18:30' })).toHaveLength(1);
  });

  it.each([
    { today: '2026-02-30', localTime: '09:00' },
    { today: '2026-08-11', localTime: '9:00' },
    { today: '2026-08-11', localTime: '24:00' },
  ])('geçersiz canonical clock girdisini tamamen reddeder: %j', (clock) => {
    expect(build([debt()], [recurring()], clock)).toEqual([]);
  });

  it('girdileri mutasyona uğratmaz ve sonucu tarih/tür/kimliğe göre sabit sıralar', () => {
    const debtRows = Object.freeze([
      Object.freeze(debt({ id: 9, due_date: '2026-08-14' })),
      Object.freeze(debt({ id: 2, due_date: '2026-08-12' })),
    ]);
    const planRows = Object.freeze([
      Object.freeze(recurring({ next_due_date: '2026-08-14' })),
    ]);

    const candidates = buildReminderNotificationCandidates({
      clock: CLOCK,
      debts: debtRows,
      recurringPayments: planRows,
    });

    expect(candidates.map((candidate) => candidate.notificationId)).toEqual([
      'debt-due-v1-2-2026-08-12-3-0900-upcoming',
      'debt-due-v1-9-2026-08-14-3-0900-upcoming',
      'payplan-due-v1-123e4567-e89b-42d3-a456-426614174000-2026-08-14-3-0900-upcoming',
    ]);
    expect(debtRows[0].due_date).toBe('2026-08-14');
    expect(planRows[0].next_due_date).toBe('2026-08-14');
  });

  it('cihaz TZ değişse bile aynı canonical clock için aynı sonucu verir', () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = 'Europe/Warsaw';
      const warsaw = build([debt()], [recurring()]);
      process.env.TZ = 'America/Los_Angeles';
      const losAngeles = build([debt()], [recurring()]);
      process.env.TZ = 'Pacific/Kiritimati';
      const kiritimati = build([debt()], [recurring()]);

      expect(losAngeles).toEqual(warsaw);
      expect(kiritimati).toEqual(warsaw);
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });
});
