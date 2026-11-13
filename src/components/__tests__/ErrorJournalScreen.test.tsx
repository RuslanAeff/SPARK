import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import ErrorJournalScreen from '../../../app/error-journal';
import { clearErrorJournal, readErrorJournal } from '../../services/errorJournal';
import { SparkToast } from '../SparkToast';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('../../services/errorJournal', () => ({
  readErrorJournal: jest.fn(),
  clearErrorJournal: jest.fn(),
  buildErrorReport: jest.fn(() => 'REPORT_TEXT'),
}));
jest.mock('../../theme/themeStore', () => ({ useThemeRevision: () => 0, useAppTheme: () => 'light' }));
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key}:${JSON.stringify(params)}` : key),
  }),
}));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return ({ visible, onDelete }: any) => (visible
    ? React.createElement(View, null, React.createElement(Pressable, { testID: 'confirm-clear', onPress: onDelete }))
    : null);
});

const entries = [
  { at: '2026-11-12T13:03:00.000Z', tag: 'transactions bulk delete failed', kind: 'Error', detail: 'database is locked' },
  { at: '2026-11-11T08:41:00.000Z', tag: 'UI UNCAUGHT_RENDER_ERROR', kind: 'TypeError', detail: null },
];

describe('ErrorJournalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readErrorJournal as jest.Mock).mockReturnValue(entries);
  });

  it('shows the privacy notice and every entry before anything is shared', async () => {
    const screen = await render(<ErrorJournalScreen />);

    expect(screen.getByText('error_journal_privacy')).toBeTruthy();
    expect(screen.getByText('transactions bulk delete failed')).toBeTruthy();
    expect(screen.getByText('Error: database is locked')).toBeTruthy();
    expect(screen.getByText('TypeError')).toBeTruthy();
  });

  it('shares the plain-text report only when the user taps share', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const screen = await render(<ErrorJournalScreen />);
    expect(share).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByTestId('error-journal-share'));
    });

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: 'REPORT_TEXT' }));
  });

  it('clears the journal after confirmation and shows the empty state', async () => {
    const screen = await render(<ErrorJournalScreen />);
    (readErrorJournal as jest.Mock).mockReturnValue([]);

    await act(async () => {
      fireEvent.press(screen.getByTestId('error-journal-clear'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByTestId('confirm-clear'));
    });

    expect(clearErrorJournal).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('error_journal_empty')).toBeTruthy());
    expect(SparkToast.show).toHaveBeenCalledWith('error_journal_cleared', 'success');
  });

  it('disables share and clear when there is nothing to send', async () => {
    (readErrorJournal as jest.Mock).mockReturnValue([]);
    const share = jest.spyOn(Share, 'share');
    const screen = await render(<ErrorJournalScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('error-journal-share'));
    });

    expect(share).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-journal-share').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
