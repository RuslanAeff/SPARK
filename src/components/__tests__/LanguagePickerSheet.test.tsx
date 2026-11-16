import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import LanguagePickerSheet from '../LanguagePickerSheet';

jest.mock('../../theme/themeStore', () => ({
  useThemePalette: () => jest.requireActual('../../theme/colors').resolveTheme('dark', 'blue'),
}));
jest.mock('../BottomSheetModal', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  return ({ visible, children, onClose, backdropAccessibilityLabel }: any) => visible
    ? React.createElement(View, null,
      React.createElement(Pressable, { testID: 'backdrop', onPress: onClose, accessibilityLabel: backdropAccessibilityLabel }),
      children)
    : null;
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'light' } }));

describe('LanguagePickerSheet (UX-08)', () => {
  it('selects a new language, closes, and exposes radio state', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <LanguagePickerSheet visible current="tr" title="Dil" closeLabel="Close" onSelect={onSelect} onClose={onClose} />,
    );
    expect(screen.getByTestId('language-option-tr').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('backdrop').props.accessibilityLabel).toBe('Close');
    await fireEvent.press(screen.getByTestId('language-option-en'));
    expect(onSelect).toHaveBeenCalledWith('en');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('only closes when the current language is picked again', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <LanguagePickerSheet visible current="tr" title="Dil" closeLabel="Close" onSelect={onSelect} onClose={onClose} />,
    );
    await fireEvent.press(screen.getByTestId('language-option-tr'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
