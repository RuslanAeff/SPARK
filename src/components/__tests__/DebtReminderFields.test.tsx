import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import DebtReminderFields from '../DebtReminderFields';

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

const noop = () => undefined;

describe('DebtReminderFields', () => {
  it('vade yokken hatırlatma anahtarını erişilebilir biçimde devre dışı bırakır', async () => {
    const onReminderEnabledChange = jest.fn();
    const screen = await render(
      <DebtReminderFields
        dueDate={null}
        reminderEnabled={false}
        reminderDaysBefore="3"
        reminderTime="09:00"
        onPressDueDate={noop}
        onClearDueDate={noop}
        onReminderEnabledChange={onReminderEnabledChange}
        onReminderDaysBeforeChange={noop}
        onReminderTimeChange={noop}
      />,
    );

    const toggle = screen.getByTestId('debt-reminder-switch');
    expect(toggle.props.disabled).toBe(true);
    expect(toggle.props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(screen.getByText('debt_reminder_requires_due_date')).toBeTruthy();
    expect(screen.queryByTestId('debt-reminder-days-3')).toBeNull();
  });

  it('vade temizlendiğinde üst form sözleşmesi hatırlatmayı da kapatır', async () => {
    function Harness() {
      const [dueDate, setDueDate] = useState<string | null>('2026-09-15');
      const [enabled, setEnabled] = useState(true);

      return (
        <DebtReminderFields
          dueDate={dueDate}
          reminderEnabled={enabled}
          reminderDaysBefore="3"
          reminderTime="09:00"
          onPressDueDate={noop}
          onClearDueDate={() => {
            setDueDate(null);
            setEnabled(false);
          }}
          onReminderEnabledChange={setEnabled}
          onReminderDaysBeforeChange={noop}
          onReminderTimeChange={noop}
        />
      );
    }

    const screen = await render(<Harness />);
    expect(screen.getByTestId('debt-reminder-switch').props.value).toBe(true);

    await fireEvent.press(screen.getByTestId('debt-due-date-clear'));

    const toggle = screen.getByTestId('debt-reminder-switch');
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.disabled).toBe(true);
    expect(screen.queryByTestId('debt-due-date-clear')).toBeNull();
  });
});
