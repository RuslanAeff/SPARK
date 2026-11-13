import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import DataResetSection from '../DataResetSection';

const mockTriggerRefresh = jest.fn();
const mockSync = jest.fn(async () => undefined);

jest.mock('../../services/dataReset', () => ({
  resetAllUserData: jest.fn(async () => undefined),
  summarizeUserData: jest.fn(async () => ({ total: 3 })),
}));
jest.mock('../../context/NotificationsContext', () => ({ useNotifications: () => ({ sync: mockSync }) }));
jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: mockTriggerRefresh }),
}));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'light', useThemeRevision: () => 0 }));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../SettingsList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { SettingsSection: ({ children }: any) => React.createElement(View, null, children) };
});
jest.mock('../DataResetModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return ({ visible, onConfirm }: any) => (visible
    ? React.createElement(View, null, React.createElement(Pressable, { testID: 'mock-confirm-reset', onPress: onConfirm }))
    : null);
});

describe('DataResetSection (BUG-30)', () => {
  it('sıfırlamadan sonra ekranların yenilenmesini tetikler', async () => {
    const screen = await render(<DataResetSection />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('data-reset-open'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByTestId('mock-confirm-reset'));
    });

    await waitFor(() => expect(mockTriggerRefresh).toHaveBeenCalledTimes(1));
  });
});
