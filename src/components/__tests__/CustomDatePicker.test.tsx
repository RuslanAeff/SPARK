import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CustomDatePicker from '../CustomDatePicker';

jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

it('marks days used by another budget period as disabled', async () => {
  const onSelect = jest.fn();
  const screen = await render(
    <CustomDatePicker
      visible
      initialDate="2026-08-20"
      onClose={jest.fn()}
      onSelectDate={onSelect}
      disabledDateRanges={[{ start: '2026-08-21', end: '2026-08-25' }]}
      disabledDateHint="used by another period"
    />,
  );

  const blocked = screen.getByLabelText('21 month_08 2026, used by another period');
  expect(blocked.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(blocked);
  expect(onSelect).not.toHaveBeenCalled();

  const available = screen.getByLabelText('20 month_08 2026');
  expect(available.props.accessibilityState.disabled).toBe(false);
  fireEvent.press(available);
  expect(onSelect).toHaveBeenCalledWith('2026-08-20');
});
