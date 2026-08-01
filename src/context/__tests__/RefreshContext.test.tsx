import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  RefreshProvider,
  useExpenseDataRefresh,
  useRefreshActions,
} from '../RefreshContext';

function RefreshHarness({
  enabled,
  onRefresh,
}: {
  enabled: boolean;
  onRefresh: () => void;
}) {
  const { triggerRefresh } = useRefreshActions();
  useExpenseDataRefresh(onRefresh, enabled);

  return (
    <Pressable testID="trigger-refresh" onPress={triggerRefresh}>
      <Text>refresh</Text>
    </Pressable>
  );
}

describe('RefreshContext', () => {
  it('refreshes the focused subscriber exactly once per invalidation', async () => {
    const onRefresh = jest.fn();
    const screen = await render(
      <RefreshProvider>
        <RefreshHarness enabled onRefresh={onRefresh} />
      </RefreshProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-refresh'));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not run an inactive tab subscriber', async () => {
    const onRefresh = jest.fn();
    const screen = await render(
      <RefreshProvider>
        <RefreshHarness enabled={false} onRefresh={onRefresh} />
      </RefreshProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-refresh'));
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not re-render an action-only hidden tab when refreshKey changes', async () => {
    const onRefresh = jest.fn();
    const renderSpy = jest.fn();

    function HiddenTab() {
      renderSpy();
      const { triggerRefresh } = useRefreshActions();
      useExpenseDataRefresh(onRefresh, false);
      return (
        <Pressable testID="hidden-trigger" onPress={triggerRefresh}>
          <Text>hidden</Text>
        </Pressable>
      );
    }

    const screen = await render(
      <RefreshProvider>
        <HiddenTab />
      </RefreshProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('hidden-trigger'));
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
