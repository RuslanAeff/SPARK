import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import ConfirmHost from '../ConfirmHost';
import { confirmAiTransfer } from '../../utils/confirmAiTransfer';

jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../SparkToast', () => ({ SparkToastContainer: () => null }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Warning: 'warning' },
  impactAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

const t = (key: string) => key;

describe('ConfirmHost + confirmAiTransfer (UX-09)', () => {
  it('uses the themed dialog instead of the system alert and resolves only on send', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = await render(<ConfirmHost />);

    let sent: Promise<boolean> = Promise.resolve(false);
    await act(async () => { sent = confirmAiTransfer(t, 'receipt'); });
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByText('ai_transfer_receipt')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-host-confirm'));
    await expect(sent).resolves.toBe(true);

    let cancelled: Promise<boolean> = Promise.resolve(true);
    await act(async () => { cancelled = confirmAiTransfer(t, 'products'); });
    await fireEvent.press(screen.getByTestId('confirm-host-cancel'));
    await expect(cancelled).resolves.toBe(false);
    alert.mockRestore();
  });

  it('closes the dialog and denies when the operation is aborted', async () => {
    await render(<ConfirmHost />);
    const controller = new AbortController();
    let result: Promise<boolean> = Promise.resolve(true);
    await act(async () => { result = confirmAiTransfer(t, 'receipt', controller.signal); });
    await act(async () => { controller.abort(); });
    await expect(result).resolves.toBe(false);
  });

  it('a newer request denies the previous pending one', async () => {
    await render(<ConfirmHost />);
    let first: Promise<boolean> = Promise.resolve(true);
    await act(async () => { first = confirmAiTransfer(t, 'receipt'); });
    await act(async () => { void confirmAiTransfer(t, 'products'); });
    await expect(first).resolves.toBe(false);
  });
});
