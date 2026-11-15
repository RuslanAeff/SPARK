import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import DecisionModal from '../DecisionModal';
import ConfirmModal from '../ConfirmModal';

jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'light', useThemeRevision: () => 0 }));
jest.mock('../SparkToast', () => ({ SparkToastContainer: () => null }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

const base = {
  visible: true, title: 'Başlık', message: 'Uzun açıklama '.repeat(80),
  confirmLabel: 'Onayla', cancelLabel: 'Vazgeç', onCancel: jest.fn(), onConfirm: jest.fn(),
};

describe('DecisionModal (CQ-05, UX-03, A11Y-03)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps title and actions outside the scrollable message body', async () => {
    const screen = await render(<DecisionModal {...base} cardTestID="card" />);
    const body = within(screen.getByTestId('decision-modal-body'));
    // Mesaj kaydırılabilir gövdede; başlık ve düğmeler onun dışında, hep görünür.
    expect(body.getByText(base.message)).toBeTruthy();
    expect(body.queryByText('Başlık')).toBeNull();
    expect(body.queryByText('Onayla')).toBeNull();
    expect(screen.getByText('Onayla')).toBeTruthy();
  });

  it('announces itself as a modal with a header for every tone', async () => {
    const screen = await render(<ConfirmModal {...base} />);
    expect(screen.getByRole('header')).toBeTruthy();
    const card = await render(<DecisionModal {...base} cardTestID="card" />);
    expect(card.getByTestId('card').props.accessibilityViewIsModal).toBe(true);
  });

  it('uses a warning haptic only for destructive decisions', async () => {
    const screen = await render(<DecisionModal {...base} tone="danger" confirmTestID="ok" />);
    await fireEvent.press(screen.getByTestId('ok'));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    expect(base.onConfirm).toHaveBeenCalledTimes(1);

    const primary = await render(<DecisionModal {...base} confirmTestID="ok2" />);
    await fireEvent.press(primary.getByTestId('ok2'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('does not confirm while disabled', async () => {
    const onConfirm = jest.fn();
    const screen = await render(<DecisionModal {...base} onConfirm={onConfirm} confirmDisabled confirmTestID="ok" />);
    await fireEvent.press(screen.getByTestId('ok'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
