import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import IncomeSheet from '../IncomeSheet';
import { IncomeDao } from '../../db/incomeDao';

jest.mock('../../db/incomeDao', () => ({
  IncomeDao: {
    create: jest.fn(),
    listByDateRange: jest.fn(async () => []),
    listAll: jest.fn(async () => []),
    remove: jest.fn(),
  },
}));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'light', useThemeRevision: () => 0 }));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../BottomSheetModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: any) => (visible ? React.createElement(View, null, children) : null);
});
jest.mock('../CustomDatePicker', () => () => null);
jest.mock('../GlassDeleteModal', () => () => null);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function pressHandler(element: any): () => unknown {
  for (let node = element; node; node = node.parent) {
    if (typeof node.props?.onPress === 'function') return node.props.onPress;
  }
  for (let fiber = element.unstable_fiber; fiber; fiber = fiber.return) {
    if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress;
  }
  throw new Error('Press handler not found');
}

describe('IncomeSheet save guard (BUG-30)', () => {
  it('hızlı çift dokunuşta tek ek gelir kaydı oluşturur', async () => {
    const pending = deferred<number>();
    (IncomeDao.create as jest.Mock).mockImplementation(() => pending.promise);
    const screen = await render(
      <IncomeSheet visible onClose={jest.fn()} currency="PLN" cycleStart="2026-11-01" cycleEnd="2026-11-30" />,
    );
    await fireEvent.press(await screen.findByText('income_add_title'));
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '50');
    await fireEvent.changeText(screen.getByPlaceholderText('income_source_ph'), 'Bonus');

    const onPress = pressHandler(screen.getByText('save'));
    let taps!: Promise<unknown>;
    await act(async () => {
      taps = Promise.all([onPress(), onPress()]);
      await Promise.resolve();
    });
    await act(async () => {
      pending.resolve(1);
      await taps;
    });

    await waitFor(() => expect(IncomeDao.create).toHaveBeenCalledTimes(1));
  });
});

describe('IncomeSheet history list (UX-12)', () => {
  it('draws only the first rows of a long list and keeps expansion working', async () => {
    const incomes = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      source: `Kaynak ${index + 1}`,
      amount: 10,
      date: '2026-11-10',
      note: index === 0 ? 'ilk not' : null,
    }));
    (IncomeDao.listByDateRange as jest.Mock).mockResolvedValue(incomes);
    const screen = await render(
      <IncomeSheet visible onClose={jest.fn()} currency="PLN" cycleStart="2026-11-01" cycleEnd="2026-11-30" />,
    );

    expect(await screen.findByText('Kaynak 1')).toBeTruthy();
    expect(screen.queryByText('Kaynak 60')).toBeNull();

    await fireEvent.press(screen.getByText('Kaynak 1'));
    expect(screen.getByText('ilk not')).toBeTruthy();
  });
});
