import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsGeneralScreen from '../../../app/settings-general';
import {
  loadThemeSettings,
  setAutoThemeSchedule,
  setManualTheme,
  setThemeAccent,
} from '../../utils/themeSchedule';
import { SparkToast } from '../SparkToast';

const mockPalette = {
  background: '#050505',
  surface: '#161618',
  surfaceLight: '#1E1E22',
  surfaceElevated: '#26262C',
  primary: '#2EE88C',
  primaryLight: '#62F2AA',
  primaryDark: '#00A85A',
  primaryAction: '#007A3D',
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(46, 232, 140, 0.13)',
  primaryGlow: 'rgba(46, 232, 140, 0.16)',
  secondary: '#CCFF00',
  secondaryLight: '#D4FF33',
  secondaryDark: '#A3CC00',
  success: '#2EE88C',
  successDark: '#00A344',
  danger: '#FF453A',
  dangerDark: '#CC0000',
  warning: '#FFCC00',
  info: '#33CCFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#666677',
  textInverse: '#000000',
  chartPurple: '#9D00FF',
  chartBlue: '#00FFFF',
  chartOrange: '#FF6600',
  chartGreen: '#00FF66',
  chartPink: '#FF00AA',
  chartYellow: '#CCFF00',
  chartCyan: '#00CCFF',
  chartRed: '#FF3333',
  border: '#2A2A2A',
  borderLight: '#3D3D3D',
  divider: 'rgba(255, 255, 255, 0.08)',
  cardBorder: '#505060',
  cardSurface: '#1C1C1E',
  inputBackground: '#252528',
  inputBorder: '#3D3D3D',
  glass: 'rgba(10, 10, 10, 0.90)',
  glassBorder: 'rgba(46, 232, 140, 0.30)',
  shadowColor: '#2EE88C',
  tabActive: '#2EE88C',
  tabInactive: '#666677',
  tabBackground: '#050505',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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
  impactAsync: jest.fn(),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  AndroidHaptics: { Segment_Tick: 'segment-tick' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: () => ({
    currentStatus: { isLoaded: true },
    play: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    volume: 1,
  }),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeAccent: () => 'green',
  useThemePalette: () => mockPalette,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'tr',
    setLanguage: jest.fn(),
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        key,
      );
    },
  }),
}));

jest.mock('../../i18n/languageOptions', () => ({
  languageNativeLabel: () => 'Türkçe',
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN', setCurrency: jest.fn() }),
  DISPLAY_CURRENCIES: ['PLN'],
  CURRENCY_META: { PLN: { symbol: 'zł' } },
}));

jest.mock('../../utils/themeSchedule', () => ({
  loadThemeSettings: jest.fn(),
  setAutoThemeSchedule: jest.fn(),
  setManualTheme: jest.fn(),
  setThemeAccent: jest.fn(),
}));

jest.mock('../LanguagePickerSheet', () => () => null);
jest.mock('../AutoThemeScheduleToggle', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({
    enabled,
    onToggle,
    disabled,
    testID,
    labelOn,
    labelOff,
  }: any) => React.createElement(
    Pressable,
    {
      testID,
      disabled,
      onPress: () => onToggle(!enabled),
      accessibilityRole: 'switch',
      accessibilityState: { checked: enabled, disabled },
    },
    React.createElement(Text, null, enabled ? labelOn : labelOff),
  );
});
jest.mock('../SettingsInfoHint', () => ({
  SettingsInfoHintModal: ({ visible, title, paragraphs }: any) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    if (!visible) return null;
    return React.createElement(
      View,
      { testID: `settings-info-modal-${title}` },
      React.createElement(Text, null, title),
      ...paragraphs.map((paragraph: string) => React.createElement(Text, { key: paragraph }, paragraph)),
    );
  },
  SettingsInfoIconButton: ({ onPress, accessibilityLabel }: any) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { testID: 'settings-info-button', onPress, accessibilityLabel },
      React.createElement(Text, null, 'info'),
    );
  },
}));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));

describe('SettingsGeneralScreen theme personalization', () => {
  const loadSettings = loadThemeSettings as jest.MockedFunction<typeof loadThemeSettings>;
  const setAuto = setAutoThemeSchedule as jest.MockedFunction<typeof setAutoThemeSchedule>;
  const setManual = setManualTheme as jest.MockedFunction<typeof setManualTheme>;
  const setAccent = setThemeAccent as jest.MockedFunction<typeof setThemeAccent>;
  const toastShow = SparkToast.show as jest.MockedFunction<typeof SparkToast.show>;

  beforeEach(() => {
    jest.clearAllMocks();
    loadSettings.mockResolvedValue({ autoEnabled: true, manual: 'dark', accent: 'green' });
    setAuto.mockResolvedValue(undefined);
    setManual.mockResolvedValue(undefined);
    setAccent.mockResolvedValue(undefined);
  });

  it('restores the original automatic toggle and hides manual buttons while it is on', async () => {
    const screen = await render(<SettingsGeneralScreen />);

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByTestId('theme-auto-toggle').props.accessibilityState.checked).toBe(true);
    });

    expect(screen.queryByTestId('theme-appearance-light')).toBeNull();
    expect(screen.queryByTestId('theme-appearance-dark')).toBeNull();
    expect(screen.getByTestId('theme-accent-green').props.accessibilityState.selected)
      .toBe(true);
  });

  it('turns automatic appearance off before exposing the original light/dark controls', async () => {
    const screen = await render(<SettingsGeneralScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('theme-auto-toggle').props.accessibilityState.checked).toBe(true);
    });

    await fireEvent.press(screen.getByTestId('theme-auto-toggle'));

    await waitFor(() => expect(setAuto).toHaveBeenCalledWith(false));
    expect(setManual).not.toHaveBeenCalled();
    expect(setAccent).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('theme-appearance-light')).toBeTruthy());
    expect(screen.getByTestId('theme-appearance-dark').props.accessibilityState.selected).toBe(true);
  });

  it('persists a manual appearance without touching the accent preference', async () => {
    loadSettings.mockResolvedValue({ autoEnabled: false, manual: 'dark', accent: 'green' });
    const screen = await render(<SettingsGeneralScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('theme-appearance-dark').props.accessibilityState.selected).toBe(true);
    });

    await fireEvent.press(screen.getByTestId('theme-appearance-light'));

    expect(setManual).toHaveBeenCalledWith('light');
    expect(setAuto).not.toHaveBeenCalled();
    expect(setAccent).not.toHaveBeenCalled();
    expect(toastShow).toHaveBeenCalledWith(
      'theme_changed',
      'success',
      'theme_restart',
    );
  });

  it('keeps the carousel gesture available while an accent write is pending', async () => {
    let finishAccent!: () => void;
    setAccent.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishAccent = resolve; }),
    );
    const screen = await render(<SettingsGeneralScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('theme-accent-green').props.accessibilityState.selected)
        .toBe(true);
    });
    await fireEvent.press(screen.getByTestId('theme-accent-blue'));
    await waitFor(() => expect(setAccent).toHaveBeenCalledWith('blue'));

    expect(screen.getByTestId('theme-accent-scroll').props.accessibilityState.disabled)
      .toBe(false);

    finishAccent();
    await waitFor(() => expect(toastShow).toHaveBeenCalled());
  });

  it('persists a return to the original accent after an in-flight selection', async () => {
    let finishBlue!: () => void;
    setAccent
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { finishBlue = resolve; }),
      )
      .mockResolvedValueOnce(undefined);
    const screen = await render(<SettingsGeneralScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('theme-accent-green').props.accessibilityState.selected)
        .toBe(true);
    });
    await fireEvent.press(screen.getByTestId('theme-accent-blue'));
    await waitFor(() => expect(setAccent).toHaveBeenNthCalledWith(1, 'blue'));

    await fireEvent.press(screen.getByTestId('theme-accent-green'));
    expect(setAccent).toHaveBeenCalledTimes(1);

    finishBlue();
    await waitFor(() => expect(setAccent).toHaveBeenCalledTimes(2));
    expect(setAccent).toHaveBeenNthCalledWith(2, 'green');
  });

  it('persists an accent change', async () => {
    let completeAccent!: () => void;
    setAccent.mockImplementation(
      () => new Promise<void>((resolve) => { completeAccent = resolve; }),
    );
    const screen = await render(<SettingsGeneralScreen />);

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));

    const purpleOption = screen.getByTestId('theme-accent-purple');
    const pendingPress = fireEvent.press(purpleOption);

    expect(setAccent).toHaveBeenCalledTimes(1);
    expect(setAccent).toHaveBeenCalledWith('purple');
    completeAccent();
    await pendingPress;

    await waitFor(() => {
      expect(toastShow).toHaveBeenCalledWith(
        'theme_accent_changed',
        'success',
        'theme_restart',
      );
    });
  });

  it('moves accent explanations out of the card and into its info modal', async () => {
    const screen = await render(<SettingsGeneralScreen />);

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('theme_accent_hint')).toBeNull();
    expect(screen.queryByText('theme_accent_semantic_hint')).toBeNull();
    expect(screen.getByText('theme_accent_swipe_hint')).toBeTruthy();

    const infoButtons = screen.getAllByTestId('settings-info-button');
    await fireEvent.press(infoButtons[2]);

    expect(screen.getByText('theme_accent_hint')).toBeTruthy();
    expect(screen.getByText('theme_accent_semantic_hint')).toBeTruthy();
  });
});
