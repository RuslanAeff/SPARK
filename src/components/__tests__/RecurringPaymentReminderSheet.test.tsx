import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import RecurringPaymentReminderForm, {
  RecurringPaymentReminderFormValue,
} from '../RecurringPaymentReminderSheet';
import { RecurringPaymentReminderDao } from '../../db/recurringPaymentReminderDao';

jest.mock('../../db/recurringPaymentReminderDao', () => ({
  RecurringPaymentReminderDao: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'light', useThemeRevision: () => 0 }));
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        key,
      );
    },
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../CustomDatePicker', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return ({ visible, onClose, onSelectDate }: any) => visible
    ? React.createElement(Pressable, {
        testID: 'mock-recurring-date',
        onPress: () => {
          onSelectDate('2026-10-20');
          onClose();
        },
      })
    : null;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function getPressHandler(instance: any): () => Promise<void> {
  let node = instance;
  while (node) {
    if (typeof node.props?.onPress === 'function') return node.props.onPress;
    node = node.parent;
  }
  let fiber = instance.unstable_fiber;
  while (fiber) {
    if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress;
    fiber = fiber.return;
  }
  throw new Error('Press handler not found');
}

const detectedValue: RecurringPaymentReminderFormValue = {
  title: 'Internet Provider',
  vendorId: 8,
  expectedAmount: 79.9,
  currency: 'PLN',
  anchorDate: '2026-09-15',
  nextDueDate: '2026-09-15',
  recurrenceUnit: 'month',
  recurrenceInterval: 1,
  reminderDaysBefore: 3,
  reminderTime: '09:00',
  status: 'active',
  source: 'detected',
  note: null,
};

describe('RecurringPaymentReminderForm', () => {
  const create = RecurringPaymentReminderDao.create as jest.MockedFunction<
    typeof RecurringPaymentReminderDao.create
  >;
  const update = RecurringPaymentReminderDao.update as jest.MockedFunction<
    typeof RecurringPaymentReminderDao.update
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue(1);
    update.mockResolvedValue(true);
  });

  it('manuel planı tek create çağrısıyla kaydeder', async () => {
    const onSaved = jest.fn(async () => undefined);
    const screen = await render(
      <RecurringPaymentReminderForm
        initialValue={null}
        defaultCurrency="PLN"
        onClose={jest.fn()}
        onSaved={onSaved}
      />,
    );
    await fireEvent.changeText(screen.getByTestId('recurring-plan-title'), 'Internet');
    await fireEvent.changeText(screen.getByTestId('recurring-plan-amount'), '29,90');
    await fireEvent.press(screen.getByTestId('recurring-plan-date'));
    await fireEvent.press(screen.getByTestId('mock-recurring-date'));
    await fireEvent.press(screen.getByTestId('recurring-plan-save'));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      title: 'Internet',
      vendorId: null,
      expectedAmount: 29.9,
      currency: 'PLN',
      anchorDate: '2026-10-20',
      nextDueDate: '2026-10-20',
      recurrenceUnit: 'month',
      recurrenceInterval: 1,
      reminderDaysBefore: 3,
      reminderTime: '09:00',
      status: 'active',
      source: 'manual',
      note: null,
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('algılanan öneriyi vendor ve para birimiyle ancak açık kayıtta oluşturur', async () => {
    const screen = await render(
      <RecurringPaymentReminderForm
        initialValue={detectedValue}
        defaultCurrency="EUR"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('recurring-plan-save'));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Internet Provider',
      vendorId: 8,
      expectedAmount: 79.9,
      currency: 'PLN',
      source: 'detected',
      anchorDate: '2026-09-15',
      nextDueDate: '2026-09-15',
    }));
  });

  it('tarih değişen düzenlemede takvimi yeni tarihe yeniden sabitler', async () => {
    const screen = await render(
      <RecurringPaymentReminderForm
        initialValue={{ ...detectedValue, id: 41, anchorDate: '2026-01-31' }}
        defaultCurrency="PLN"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('recurring-plan-date'));
    await fireEvent.press(screen.getByTestId('mock-recurring-date'));
    await fireEvent.press(screen.getByTestId('recurring-plan-save'));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(41, expect.objectContaining({
      anchorDate: '2026-10-20',
      nextDueDate: '2026-10-20',
    }));
  });

  it('hızlı çift kayıtta yalnız bir DB yazısı yapar', async () => {
    const pending = deferred<number>();
    create.mockReturnValue(pending.promise);
    const screen = await render(
      <RecurringPaymentReminderForm
        initialValue={detectedValue}
        defaultCurrency="PLN"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    const save = getPressHandler(screen.getByTestId('recurring-plan-save'));
    let firstSave!: Promise<void>;
    let secondSave!: Promise<void>;
    await act(async () => {
      firstSave = save();
      secondSave = save();
      await Promise.resolve();
    });
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(1);
      await firstSave;
      await secondSave;
    });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it('tekrar aralığını anlaşılır özetler ve stepper değişikliğini kaydeder', async () => {
    const screen = await render(
      <RecurringPaymentReminderForm
        initialValue={detectedValue}
        defaultCurrency="PLN"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(screen.getByTestId('recurring-plan-interval-summary').props.children)
      .toBe('recurring_plan_interval_every_month');
    await fireEvent.press(screen.getByTestId('recurring-plan-interval-plus'));
    expect(screen.getByTestId('recurring-plan-interval').props.value).toBe('2');
    expect(screen.getByTestId('recurring-plan-interval-summary').props.children)
      .toBe('recurring_plan_interval_month');

    await fireEvent.press(screen.getByTestId('recurring-plan-save'));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      recurrenceUnit: 'month',
      recurrenceInterval: 2,
    })));
  });

});
