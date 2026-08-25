import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import SavingsGoalContributionSheet from '../SavingsGoalContributionSheet';
import { GoalDao } from '../../db/goalDao';
import { SparkToast } from '../SparkToast';
import * as Haptics from 'expo-haptics';

const mockTriggerRefresh = jest.fn();
const mockSyncNotifications = jest.fn(async () => undefined);

function getPressHandler(instance: any): () => Promise<void> {
  let node = instance;
  while (node) {
    if (typeof node.props?.onPress === 'function') return node.props.onPress;
    node = node.parent;
  }

  let fiber = instance.unstable_fiber;
  while (fiber) {
    if (typeof fiber.memoizedProps?.onPress === 'function') {
      return fiber.memoizedProps.onPress;
    }
    fiber = fiber.return;
  }
  throw new Error('Press handler not found');
}

jest.mock('../../db/goalDao', () => ({
  GoalDao: { addContribution: jest.fn() },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: mockTriggerRefresh }),
}));

jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({ sync: mockSyncNotifications }),
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('../SparkToast', () => ({
  SparkToast: { show: jest.fn() },
}));

jest.mock('../BottomSheetModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? React.createElement(View, null, children) : null;
});

describe('SavingsGoalContributionSheet durability', () => {
  const addContribution = GoalDao.addContribution as jest.MockedFunction<
    typeof GoalDao.addContribution
  >;
  const toastShow = SparkToast.show as jest.MockedFunction<typeof SparkToast.show>;
  const haptic = Haptics.notificationAsync as jest.MockedFunction<
    typeof Haptics.notificationAsync
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps a committed contribution successful when best-effort haptics reject', async () => {
    addContribution.mockResolvedValue(12.5);
    haptic.mockRejectedValue(new Error('haptics unavailable'));
    const onClose = jest.fn();
    const screen = await render(
      <SavingsGoalContributionSheet visible onClose={onClose} />,
    );

    await fireEvent.changeText(screen.getByTestId('goal-contribution-input'), '12,50');
    await fireEvent.press(screen.getByTestId('goal-contribution-save'));

    await waitFor(() => expect(addContribution).toHaveBeenCalledWith(12.5));
    expect(toastShow).toHaveBeenCalledWith('goal_contribution_added', 'success');
    expect(toastShow).not.toHaveBeenCalledWith('error_saving_data', 'error');
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
    expect(mockSyncNotifications).toHaveBeenCalledTimes(1);
    expect(addContribution.mock.invocationCallOrder[0]).toBeLessThan(
      mockSyncNotifications.mock.invocationCallOrder[0],
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid duplicate saves while the DAO write is pending', async () => {
    let resolveWrite: (value: number) => void = () => {};
    const pendingWrite = new Promise<number>((resolve) => {
      resolveWrite = resolve;
    });
    addContribution.mockReturnValue(pendingWrite);
    haptic.mockResolvedValue(undefined);
    const onClose = jest.fn();
    const screen = await render(
      <SavingsGoalContributionSheet visible onClose={onClose} />,
    );

    await fireEvent.changeText(screen.getByTestId('goal-contribution-input'), '25');
    const save = screen.getByTestId('goal-contribution-save');
    const pressSave = getPressHandler(save);

    await act(async () => {
      const first = pressSave();
      const duplicate = pressSave();

      expect(addContribution).toHaveBeenCalledTimes(1);
      resolveWrite(25);
      await Promise.all([first, duplicate]);
    });

    expect(addContribution).toHaveBeenCalledTimes(1);
    expect(toastShow).toHaveBeenCalledTimes(1);
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
    expect(mockSyncNotifications).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the committed contribution successful when notification sync rejects', async () => {
    addContribution.mockResolvedValue(15);
    haptic.mockResolvedValue(undefined);
    mockSyncNotifications.mockRejectedValueOnce(new Error('native scheduler unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const screen = await render(
      <SavingsGoalContributionSheet visible onClose={onClose} />,
    );

    await fireEvent.changeText(screen.getByTestId('goal-contribution-input'), '15');
    await fireEvent.press(screen.getByTestId('goal-contribution-save'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(addContribution).toHaveBeenCalledTimes(1);
    expect(mockSyncNotifications).toHaveBeenCalledTimes(1);
    expect(toastShow).toHaveBeenCalledWith('goal_contribution_added', 'success');
    expect(toastShow).not.toHaveBeenCalledWith('error_saving_data', 'error');
    warn.mockRestore();
  });
});
