import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import ReceiptHolographicCarousel, { triggerReceiptHapticFeedback } from '../ReceiptHolographicCarousel';

jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }: any) => children,
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View, createAnimatedComponent: (component: unknown) => component },
  useSharedValue: (value: number) => require('react').useRef({ value }).current,
  useAnimatedStyle: (factory: () => unknown) => factory(),
  cancelAnimation: jest.fn(),
  Easing: { linear: (value: number) => value },
  useReducedMotion: () => true,
}));
jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemePalette: () => jest.requireActual('../../theme/colors').DarkTheme,
}));
jest.mock('expo-haptics', () => ({
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  AndroidHaptics: { Context_Click: 'context-click' },
  ImpactFeedbackStyle: { Rigid: 'rigid' },
}));

it('changes focus accessibly, clamps both ends and pulses only on a changed selection', async () => {
  const onCardSelected = jest.fn();
  const feedback = jest.fn();
  const screen = await render(<ReceiptHolographicCarousel
    images={[{ uri: 'file://one.jpg' }, { uri: 'file://two.jpg' }]}
    accessibilityLabel="Receipt pages" onCardSelected={onCardSelected} triggerHapticFeedback={feedback} />);
  const adjust = async (name: string) => fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', { nativeEvent: { actionName: name } });
  expect(feedback).not.toHaveBeenCalled();
  await adjust('decrement');
  expect(feedback).not.toHaveBeenCalled();
  await adjust('increment');
  expect(screen.getByRole('adjustable').props.accessibilityValue.now).toBe(2);
  expect(onCardSelected).toHaveBeenLastCalledWith(1);
  await adjust('increment');
  expect(feedback).toHaveBeenCalledTimes(1);
  await adjust('decrement');
  expect(onCardSelected).toHaveBeenLastCalledWith(0);
  expect(feedback).toHaveBeenCalledTimes(2);
});

it.each(['android', 'ios'])('uses the accent selector haptic profile on %s', os => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  try {
    triggerReceiptHapticFeedback();
    if (os === 'android') expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(Haptics.AndroidHaptics.Context_Click);
    else expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Rigid);
  } finally { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); }
});
