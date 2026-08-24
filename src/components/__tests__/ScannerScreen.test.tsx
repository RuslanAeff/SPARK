import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import ScannerScreen from '../../../app/(tabs)/scanner';
import { DarkTheme, LightTheme, resolveTheme, type ThemeAccent } from '../../theme/colors';

let mockScheme: 'light' | 'dark' = 'dark';
let mockAccent: ThemeAccent = 'green';
let mockLanguage: 'tr' | 'en' | 'az' | 'ru' = 'tr';
const mockUseAppTheme = jest.fn(() => mockScheme);
const mockRequestCameraPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockGetPendingResultAsync = jest.fn();
const mockParseReceipt = jest.fn();
const mockHasApiKey = jest.fn();
const mockProcessReceipt = jest.fn();
const mockCompressImageToBase64 = jest.fn();

function getPressHandler(instance: any): () => any {
  let node = instance;
  while (node) {
    if (typeof node.props?.onPress === 'function') return node.props.onPress;
    node = node.parent;
  }
  let fiber = instance.unstable_fiber;
  while (fiber) {
    if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress;
    fiber = fiber.return;
  }
  throw new Error('Press handler not found');
}

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
  getPendingResultAsync: (...args: unknown[]) => mockGetPendingResultAsync(...args),
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
    tc: (name: string) => `tc:${name}`,
    language: mockLanguage,
  }),
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: jest.fn() }),
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
}));

jest.mock('../../services/geminiService', () => ({
  parseReceipt: (...args: unknown[]) => mockParseReceipt(...args),
  hasApiKey: (...args: unknown[]) => mockHasApiKey(...args),
}));

jest.mock('../../services/receiptParser', () => ({
  processReceipt: (...args: unknown[]) => mockProcessReceipt(...args),
}));

jest.mock('../../services/scanSession', () => ({
  setScanSessionError: jest.fn(),
}));

jest.mock('../../utils/imageCompressor', () => ({
  compressImageToBase64: (...args: unknown[]) => mockCompressImageToBase64(...args),
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
  const receipt = {
    vendor_name: 'Biedronka',
    date: '2026-08-23',
    translation_language: 'en',
    total: 6,
    currency: 'PLN',
    items: [{
      name: 'Chleb', turkish_name: 'Bread', quantity: 1,
      measurement_unit: 'piece', unit_price: 6, total_price: 6,
      category_key: 'market', suggested_category: 'Market',
    }],
  };

  beforeEach(() => {
    mockScheme = 'dark';
    mockAccent = 'green';
    mockLanguage = 'tr';
    mockUseAppTheme.mockClear();
    mockRequestCameraPermissionsAsync.mockReset();
    mockRequestMediaLibraryPermissionsAsync.mockReset();
    mockLaunchCameraAsync.mockReset();
    mockLaunchImageLibraryAsync.mockReset();
    mockGetPendingResultAsync.mockReset().mockResolvedValue(null);
    mockParseReceipt.mockReset().mockResolvedValue(receipt);
    mockHasApiKey.mockReset().mockResolvedValue(true);
    mockProcessReceipt.mockReset().mockResolvedValue(1);
    mockCompressImageToBase64.mockReset().mockResolvedValue('compressed-base64');
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

  it.each(['tr', 'en', 'az', 'ru'] as const)(
    'passes the active %s language through the successful camera pipeline',
    async (language) => {
      mockLanguage = language;
      mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
      mockLaunchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://receipt.jpg', width: 1600, height: 4000, type: 'image' }],
      });
      const screen = await render(<ScannerScreen />);

      await fireEvent.press(screen.getByTestId('scanner-camera-action'));
      await waitFor(() => expect(mockParseReceipt).toHaveBeenCalled());

      expect(mockCompressImageToBase64).toHaveBeenCalledWith(
        'file://receipt.jpg',
        expect.objectContaining({ width: 1600, height: 4000, signal: expect.objectContaining({ aborted: false }) }),
      );
      expect(mockParseReceipt).toHaveBeenCalledWith(
        'compressed-base64',
        language,
        expect.objectContaining({ aborted: false }),
      );
      expect(screen.getByText('tc:Market')).toBeTruthy();
    },
  );

  it('shows a localized safe error instead of accepting an invalid AI result', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://bad.jpg', width: 1000, height: 1600, type: 'image' }],
    });
    mockParseReceipt.mockRejectedValue(new Error('RECEIPT_INVALID_RESULT'));
    const screen = await render(<ScannerScreen />);

    await fireEvent.press(screen.getByTestId('scanner-camera-action'));
    await waitFor(() => expect(screen.getByText('scan_invalid_result')).toBeTruthy());
    expect(mockProcessReceipt).not.toHaveBeenCalled();
  });

  it('recovers an Android camera result after the Activity is recreated', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockGetPendingResultAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://recovered.jpg', width: 1800, height: 3600, type: 'image' }],
    });
    const screen = await render(<ScannerScreen />);

    try {
      await waitFor(() => expect(mockGetPendingResultAsync).toHaveBeenCalled());
      await waitFor(() => expect(mockParseReceipt).toHaveBeenCalledWith(
        'compressed-base64',
        'tr',
        expect.objectContaining({ aborted: false }),
      ));
      expect(mockCompressImageToBase64).toHaveBeenCalledWith(
        'file://recovered.jpg',
        expect.objectContaining({ width: 1800, height: 3600 }),
      );
    } finally {
      screen.unmount();
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  });

  it('releases the source lock immediately when an active scan is stopped', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://slow.jpg', width: 1600, height: 4000, type: 'image' }],
    });
    mockParseReceipt.mockImplementation(
      (_base64: string, _language: string, signal: AbortSignal) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      }),
    );
    const screen = await render(<ScannerScreen />);

    let scanPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      scanPromise = getPressHandler(screen.getByTestId('scanner-camera-action'))();
      while (mockParseReceipt.mock.calls.length === 0) await Promise.resolve();
    });
    await act(async () => {
      getPressHandler(screen.getByTestId('scanner-stop-action'))();
      await scanPromise;
    });

    expect(screen.getByTestId('scanner-camera-action').props.accessibilityState.disabled).toBe(false);
  });
});
