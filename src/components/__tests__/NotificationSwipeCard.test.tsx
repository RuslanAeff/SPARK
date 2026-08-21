import React from 'react';
import {
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import NotificationSwipeCard from '../NotificationSwipeCard';

const mockSwipeMethods = {
  close: jest.fn(),
  openLeft: jest.fn(),
  openRight: jest.fn(),
  reset: jest.fn(),
};

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const ReactRuntime = require('react');
  const { Pressable, View } = require('react-native');
  return {
    __esModule: true,
    default: ReactRuntime.forwardRef((props: any, ref: any) => {
      ReactRuntime.useImperativeHandle(ref, () => mockSwipeMethods);
      return (
        <View testID={`${props.testID}-harness`}>
          {props.children}
          {props.renderRightActions(
            { value: 0 },
            { value: 0 },
            mockSwipeMethods,
          )}
          <Pressable
            testID={`${props.testID}-will-open`}
            onPress={props.onSwipeableWillOpen}
          />
          <Pressable
            testID={`${props.testID}-did-close`}
            onPress={props.onSwipeableClose}
          />
        </View>
      );
    }),
  };
});

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
}));

describe('NotificationSwipeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the delete reveal fixed-width and disables it during selection', async () => {
    const view = await render(
      <NotificationSwipeCard
        enabled
        deleteLabel="Sil"
        onDelete={jest.fn(async () => undefined)}
        testID="swipe"
      >
        <Text>Kart</Text>
      </NotificationSwipeCard>,
    );

    const action = view.getByTestId('swipe-delete-action');
    expect(StyleSheet.flatten(action.props.style)).toMatchObject({
      width: 88,
      height: '100%',
    });
    expect(StyleSheet.flatten(action.props.style).flex).toBeUndefined();

    await view.rerender(
      <NotificationSwipeCard
        enabled={false}
        deleteLabel="Sil"
        onDelete={jest.fn(async () => undefined)}
        testID="swipe"
      >
        <Text>Kart</Text>
      </NotificationSwipeCard>,
    );

    const disabledAction = view.getByTestId('swipe-delete-action', {
      includeHiddenElements: true,
    });
    expect(disabledAction.props.accessibilityState).toMatchObject({ disabled: true });
    expect(disabledAction.props.accessibilityElementsHidden).toBe(true);
    expect(disabledAction.props.importantForAccessibility).toBe('no-hide-descendants');
    await waitFor(() => expect(mockSwipeMethods.close).toHaveBeenCalled());
    await view.unmount();
  });

  it('unregisters the exact open row on close and unmount', async () => {
    const onWillOpen = jest.fn();
    const onDidClose = jest.fn();
    const view = await render(
      <NotificationSwipeCard
        enabled
        deleteLabel="Sil"
        onDelete={jest.fn(async () => undefined)}
        onWillOpen={onWillOpen}
        onDidClose={onDidClose}
        testID="swipe"
      >
        <Text>Kart</Text>
      </NotificationSwipeCard>,
    );

    await fireEvent.press(view.getByTestId('swipe-will-open'));
    expect(onWillOpen).toHaveBeenCalledWith(mockSwipeMethods);

    await fireEvent.press(view.getByTestId('swipe-did-close'));
    expect(onDidClose).toHaveBeenLastCalledWith(mockSwipeMethods);

    await fireEvent.press(view.getByTestId('swipe-will-open'));
    await view.unmount();
    expect(onDidClose).toHaveBeenLastCalledWith(mockSwipeMethods);
    expect(onDidClose).toHaveBeenCalledTimes(2);
  });
});
