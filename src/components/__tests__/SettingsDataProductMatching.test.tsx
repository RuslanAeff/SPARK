import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsDataScreen from '../../../app/settings-data';
import { VendorDao } from '../../db/vendorDao';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const entering: any = {};
  entering.delay = () => entering;
  entering.duration = () => entering;
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement(View, props, children),
    },
    FadeInDown: entering,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefresh: () => ({ refreshKey: 0, triggerRefresh: jest.fn() }),
}));

jest.mock('../../db/vendorDao', () => ({
  VendorDao: {
    getAll: jest.fn(),
    updateLogo: jest.fn(),
    delete: jest.fn(),
    countExpenses: jest.fn(),
  },
}));

jest.mock('../BackupSection', () => () => null);
jest.mock('../GlassDeleteModal', () => () => null);
jest.mock('../VendorOptionsSheet', () => () => null);
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../SettingsInfoHint', () => ({
  SettingsInfoHintModal: () => null,
  SettingsInfoIconButton: () => null,
}));

describe('SettingsDataScreen product identity route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (VendorDao.getAll as jest.Mock).mockResolvedValue([]);
  });

  it('opens similar-product management from Data & backup', async () => {
    const screen = await render(<SettingsDataScreen />);
    await waitFor(() => expect(VendorDao.getAll).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByTestId('manage-product-matching'));
    expect(mockPush).toHaveBeenCalledWith('/product-matching');
  });
});
