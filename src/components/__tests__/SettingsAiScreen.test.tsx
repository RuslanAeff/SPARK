import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsAiScreen from '../../../app/settings-ai';
import { deleteApiKey, saveApiKey } from '../../services/geminiService';
import { SparkToast } from '../SparkToast';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('react-native-reanimated');

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 1,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../LivingSparkWordmark', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, null, 'SPARK');
});


jest.mock('../../services/geminiService', () => ({ hasApiKey: jest.fn().mockResolvedValue(true), deleteApiKey: jest.fn(), saveApiKey: jest.fn() }));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../GlassDeleteModal', () => {
  const { Pressable, Text } = require('react-native');
  return ({ visible, onDelete }: any) => visible ? <Pressable testID="confirm-delete" onPress={onDelete}><Text>confirm</Text></Pressable> : null;
});
it('preserves existing-key state and shows only error when deletion rejects', async () => {
  (deleteApiKey as jest.Mock).mockRejectedValueOnce(new Error('synthetic'));
  const screen = await render(<SettingsAiScreen />);
  await waitFor(() => expect(screen.getByText('api_key_exists')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('delete'));
  await fireEvent.press(screen.getByTestId('confirm-delete'));
  await waitFor(() => expect(SparkToast.show).toHaveBeenCalledWith('unknown_error', 'error'));
  expect(screen.getByText('api_key_exists')).toBeTruthy();
  expect(SparkToast.show).not.toHaveBeenCalledWith('api_key_deleted', 'success');
});

it('keeps input available for retry and does not announce success on cleanup failure', async () => {
  jest.clearAllMocks();
  (saveApiKey as jest.Mock).mockRejectedValueOnce(new Error('SECURE_KEY_CLEANUP_FAILED'));
  const screen = await render(<SettingsAiScreen />);
  await waitFor(() => expect(screen.getByText('api_key_exists')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText('enter_new_key'), 'synthetic-replacement');
  await fireEvent.press(screen.getByLabelText('save'));
  await waitFor(() => expect(SparkToast.show).toHaveBeenCalledWith('unknown_error', 'error'));
  expect(screen.getByDisplayValue('synthetic-replacement')).toBeTruthy();
  expect(SparkToast.show).not.toHaveBeenCalledWith('api_key_saved', 'success', 'api_key_ready');
});
