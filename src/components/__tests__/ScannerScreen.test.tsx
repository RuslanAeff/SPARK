import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import ScannerScreen from '../../../app/(tabs)/scanner';
import { DarkTheme, LightTheme } from '../../theme/colors';

let mockScheme: 'light' | 'dark' = 'dark';
const mockUseAppTheme = jest.fn(() => mockScheme);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => mockUseAppTheme(),
  getAppThemeSnapshot: () => mockScheme,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'tr',
  }),
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: jest.fn() }),
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
}));

jest.mock('../../services/geminiService', () => ({
  parseReceipt: jest.fn(),
  hasApiKey: jest.fn(),
}));

jest.mock('../../services/receiptParser', () => ({
  processReceipt: jest.fn(),
}));

jest.mock('../../services/scanSession', () => ({
  setScanSessionError: jest.fn(),
}));

jest.mock('../../utils/imageCompressor', () => ({
  compressImageToBase64: jest.fn(),
}));

jest.mock('../SparkToast', () => ({
  SparkToast: { show: jest.fn() },
}));

jest.mock('../AnimatedCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children, style }: any) => React.createElement(View, { style }, children);
});

describe('Scanner runtime theme', () => {
  beforeEach(() => {
    mockScheme = 'dark';
    mockUseAppTheme.mockClear();
  });

  it('rebuilds its mounted shell when the app switches from dark to light', async () => {
    const screen = await render(<ScannerScreen />);

    expect(
      StyleSheet.flatten(screen.getByTestId('scanner-screen').props.style).backgroundColor,
    ).toBe(DarkTheme.background);
    expect(StyleSheet.flatten(screen.getByText('scanner_title').props.style).color).toBe(
      DarkTheme.textPrimary,
    );

    mockScheme = 'light';
    await screen.rerender(<ScannerScreen />);

    expect(
      StyleSheet.flatten(screen.getByTestId('scanner-screen').props.style).backgroundColor,
    ).toBe(LightTheme.background);
    expect(StyleSheet.flatten(screen.getByText('scanner_title').props.style).color).toBe(
      LightTheme.textPrimary,
    );
    expect(mockUseAppTheme).toHaveBeenCalled();
  });
});
