import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import ScannerScreen from '../../../app/(tabs)/scanner';
import { DarkTheme, LightTheme, resolveTheme, type ThemeAccent } from '../../theme/colors';

let mockScheme: 'light' | 'dark' = 'dark';
let mockAccent: ThemeAccent = 'green';
const mockUseAppTheme = jest.fn(() => mockScheme);
const mockRequestCameraPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCameraPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissionsAsync(...args),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => mockUseAppTheme(),
  useThemePalette: () => jest.requireActual('../../theme/colors').resolveTheme(mockUseAppTheme(), mockAccent),
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
    mockAccent = 'green';
    mockUseAppTheme.mockClear();
    mockRequestCameraPermissionsAsync.mockReset();
    mockRequestMediaLibraryPermissionsAsync.mockReset();
    mockLaunchCameraAsync.mockReset();
    mockLaunchImageLibraryAsync.mockReset();
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

  it('keeps the two source capsules accessible and theme-aware', async () => {
    const screen = await render(<ScannerScreen />);
    const camera = screen.getByTestId('scanner-camera-action');
    const gallery = screen.getByTestId('scanner-gallery-action');

    expect(camera.props.accessibilityRole).toBe('button');
    expect(camera.props.accessibilityLabel).toBe('camera');
    expect(camera.props.accessibilityHint).toBe('scanner_subtitle');
    expect(gallery.props.accessibilityRole).toBe('button');
    expect(gallery.props.accessibilityLabel).toBe('gallery');
    expect(StyleSheet.flatten(camera.props.style).backgroundColor).toBe(DarkTheme.cardSurface);
    expect(StyleSheet.flatten(gallery.props.style).backgroundColor).toBe(DarkTheme.cardSurface);

    mockScheme = 'light';
    await screen.rerender(<ScannerScreen />);

    expect(
      StyleSheet.flatten(screen.getByTestId('scanner-camera-action').props.style).backgroundColor,
    ).toBe(LightTheme.cardSurface);
    expect(
      StyleSheet.flatten(screen.getByTestId('scanner-gallery-action').props.style).backgroundColor,
    ).toBe(LightTheme.cardSurface);
  });

  it('updates accent surfaces on the mounted scanner without changing scheme', async () => {
    const screen = await render(<ScannerScreen />);
    expect(StyleSheet.flatten(screen.getByTestId('scanner-hero-mark').props.style).backgroundColor)
      .toBe(resolveTheme('dark', 'green').primarySoft);

    mockAccent = 'purple';
    await screen.rerender(<ScannerScreen />);

    expect(StyleSheet.flatten(screen.getByTestId('scanner-hero-mark').props.style).backgroundColor)
      .toBe(resolveTheme('dark', 'purple').primarySoft);
  });

  it('routes camera and gallery capsules to their matching picker APIs', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mockLaunchCameraAsync.mockResolvedValue({ canceled: true });
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true });
    const screen = await render(<ScannerScreen />);

    await fireEvent.press(screen.getByTestId('scanner-camera-action'));
    await waitFor(() => expect(mockLaunchCameraAsync).toHaveBeenCalledTimes(1));
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('scanner-gallery-action'));
    await waitFor(() => expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1));
    expect(mockLaunchCameraAsync).toHaveBeenCalledTimes(1);
  });
});
