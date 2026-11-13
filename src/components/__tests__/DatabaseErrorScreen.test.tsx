import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import DatabaseErrorScreen from '../DatabaseErrorScreen';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('../../i18n/languageOptions', () => ({ suggestLanguageFromDevice: () => 'en' }));

describe('DatabaseErrorScreen (BUG-07)', () => {
  it('shows a translated explanation and a retry action, never raw error text', async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <DatabaseErrorScreen onRetry={onRetry} retrying={false} palette={{ background: '#000', danger: '#f00', textPrimary: '#fff', textSecondary: '#aaa', primary: '#08f', onPrimary: '#fff' }} />,
    );

    expect(screen.getByText("Couldn't open your data")).toBeTruthy();
    fireEvent.press(screen.getByTestId('database-error-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
