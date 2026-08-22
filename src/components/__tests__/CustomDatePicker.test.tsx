import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import CustomDatePicker from '../CustomDatePicker';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

describe('CustomDatePicker', () => {
  it('31. günden sonraki aya geçerken ay taşması yapmaz ve erişilebilir gün seçer', async () => {
    const onSelectDate = jest.fn();
    const screen = await render(
      <CustomDatePicker
        visible
        initialDate="2026-01-31"
        onSelectDate={onSelectDate}
        onClose={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText('calendar_next_month'));

    expect(screen.getByText('month_02 2026')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('28 month_02 2026'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-02-28');
  });

  it('2000–2100 yıl aralığını sunar ve üst sınırdan ileri gitmez', async () => {
    const screen = await render(
      <CustomDatePicker
        visible
        initialDate="2100-12-31"
        onSelectDate={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('calendar_next_month')).toBeDisabled();

    await fireEvent.press(screen.getByLabelText('calendar_select_year: 2100'));
    expect(screen.getByLabelText('2000')).toBeTruthy();
    expect(screen.getByLabelText('2100')).toHaveProp('accessibilityState', {
      selected: true,
    });
  });

  it('alt yıl sınırından önceki aya geçişi devre dışı bırakır', async () => {
    const screen = await render(
      <CustomDatePicker
        visible
        initialDate="2000-01-01"
        onSelectDate={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('calendar_previous_month')).toBeDisabled();
  });

  it('seçili günü ekran okuyucu durumuyla belirtir', async () => {
    const screen = await render(
      <CustomDatePicker
        visible
        initialDate="2026-05-15"
        onSelectDate={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('15 month_05 2026')).toHaveProp('accessibilityState', {
      selected: true,
      disabled: false,
    });
  });

  it('maximumDate sonrasındaki günleri ve ay geçişini devre dışı bırakır', async () => {
    const onSelectDate = jest.fn();
    const screen = await render(
      <CustomDatePicker
        visible
        initialDate="2026-08-20"
        maximumDate="2026-08-22"
        onSelectDate={onSelectDate}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('23 month_08 2026')).toBeDisabled();
    expect(screen.getByLabelText('calendar_next_month')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('23 month_08 2026'));
    expect(onSelectDate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('22 month_08 2026'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-22');
  });
});
