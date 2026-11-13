import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import BackupSection from '../BackupSection';
import { exportBackupToFile, getAllDataRange, pickAndImportBackup } from '../../services/backupService';
import { loadBackupMeta } from '../../services/backupMeta';

jest.mock('../../services/backupService', () => ({
  exportBackupToFile: jest.fn(),
  pickAndImportBackup: jest.fn(),
  getAllDataRange: jest.fn(async () => ({ start: '2024-03-05', end: '2026-11-13' })),
}));
jest.mock('../../services/backupMeta', () => ({
  loadBackupMeta: jest.fn().mockResolvedValue({ lastAt: null, reminderInterval: 'off' }),
  recordBackupSuccess: jest.fn(), setBackupReminderInterval: jest.fn(),
}));
jest.mock('../../context/NotificationsContext', () => ({ useNotifications: () => ({ sync: jest.fn() }) }));
jest.mock('../../context/RefreshContext', () => ({ useRefreshActions: () => ({ triggerRefresh: jest.fn() }) }));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ language: 'tr', t: (key: string) => key }) }));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../SettingsInfoHint', () => ({ SettingsInfoHintModal: () => null, SettingsInfoIconButton: () => null }));
jest.mock('../SettingsList', () => ({ SettingsSection: ({ children }: any) => children }));
jest.mock('../CustomDatePicker', () => {
  const { View, Pressable } = require('react-native');
  return ({ visible, onClose, onSelectDate }: any) => visible ? <View>
    <Pressable testID="date-cancel" onPress={onClose} />
    <Pressable testID="date-select" onPress={() => { onSelectDate('2020-01-01'); onClose(); }} />
  </View> : null;
});
jest.mock('../ConfirmModal', () => {
  const { Text, View, Pressable } = require('react-native');
  return ({ visible, title, message, children, onConfirm, onCancel, confirmDisabled, confirmTestID, cancelTestID }: any) => visible ? <View>
    <Text>{title}</Text>
    <Text>{message}</Text>
    {children}
    <Pressable testID={confirmTestID ?? 'confirm-ok'} disabled={confirmDisabled} accessibilityState={{ disabled: !!confirmDisabled }} onPress={onConfirm} />
    <Pressable testID={cancelTestID ?? 'confirm-cancel'} onPress={onCancel} />
  </View> : null;
});

describe('BackupSection range controls', () => {
  beforeEach(() => jest.clearAllMocks());
  it('starts with the full-data range so the default export is a complete backup (BUG-31)', async () => {
    const screen = await render(<BackupSection />);
    expect(screen.getByTestId('backup-preset-all_data')).toHaveProp('accessibilityState', { selected: true, disabled: false });
    await waitFor(() => expect(screen.getByTestId('backup-start-date'))
      .toHaveProp('accessibilityLabel', 'backup_start_date: 2024-03-05'));
    expect(screen.getByTestId('backup-end-date')).toHaveProp('accessibilityLabel', 'backup_end_date: 2026-11-13');
    expect(getAllDataRange).toHaveBeenCalledTimes(1);
  });
  it('shows the range covered by the last backup (BUG-31)', async () => {
    (loadBackupMeta as jest.Mock).mockResolvedValueOnce({
      lastAt: Date.UTC(2026, 10, 1), lastCount: 3, lastItemCount: 4,
      lastRangeStart: '2026-11-01', lastRangeEnd: '2026-11-13', reminderInterval: 'off',
    });
    const screen = await render(<BackupSection />);
    expect(await screen.findByTestId('backup-last-range')).toHaveTextContent('backup_last_range');
  });
  it('offers five shortcuts and preserves selection when a date picker is cancelled', async () => {
    const screen = await render(<BackupSection />);
    expect(screen.queryByText('backup_preset_custom')).toBeNull();
    await fireEvent.press(screen.getByTestId('backup-preset-last_month'));
    await fireEvent.press(screen.getByTestId('backup-start-date'));
    await fireEvent.press(screen.getByTestId('date-cancel'));
    expect(screen.getByTestId('backup-preset-last_month')).toHaveProp('accessibilityState', { selected: true, disabled: false });
    await fireEvent.press(screen.getByTestId('backup-start-date'));
    await fireEvent.press(screen.getByTestId('date-select'));
    expect(screen.getByTestId('backup-preset-last_month')).toHaveProp('accessibilityState', { selected: false, disabled: false });
    expect(screen.getByTestId('backup-start-date')).toHaveProp('accessibilityLabel', 'backup_start_date: 2020-01-01');
  });
  it('keeps export and restore behind their existing confirmations', async () => {
    const screen = await render(<BackupSection />);
    await fireEvent.press(screen.getByTestId('backup-export'));
    await waitFor(() => expect(screen.getByText('backup_export_confirm_title')).toBeTruthy());
    expect(exportBackupToFile).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('backup-import'));
    expect(screen.getByText('backup_import_confirm_title')).toBeTruthy();
    expect(pickAndImportBackup).not.toHaveBeenCalled();
  });
});

describe('BackupSection password protection (SEC-01)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for a password twice and passes it only to the export call', async () => {
    (exportBackupToFile as jest.Mock).mockResolvedValue({
      recordCount: 1, itemCount: 0, destination: 'shared', encrypted: true,
    });
    const screen = await render(<BackupSection />);
    await waitFor(() => expect(getAllDataRange).toHaveBeenCalled());
    await fireEvent(screen.getByTestId('backup-encrypt-switch'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('backup-export'));
    expect(screen.getByText('backup_password_set_title')).toBeTruthy();
    expect(screen.queryByText('backup_export_confirm_title')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('backup-password-input'), 'parola-12345');
    await fireEvent.changeText(screen.getByTestId('backup-password-repeat'), 'parola-1234X');
    expect(screen.getByTestId('backup-password-error')).toHaveTextContent('backup_password_mismatch');
    expect(screen.getByTestId('backup-password-submit')).toHaveProp('accessibilityState', { disabled: true });

    await fireEvent.changeText(screen.getByTestId('backup-password-repeat'), 'parola-12345');
    await fireEvent.press(screen.getByTestId('backup-password-submit'));
    await waitFor(() => expect(exportBackupToFile).toHaveBeenCalledWith(
      { start: '2024-03-05', end: '2026-11-13' },
      expect.objectContaining({ password: 'parola-12345' }),
    ));
  });

  it('rejects a short password before exporting', async () => {
    const screen = await render(<BackupSection />);
    await fireEvent(screen.getByTestId('backup-encrypt-switch'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('backup-export'));
    await fireEvent.changeText(screen.getByTestId('backup-password-input'), 'kisa');
    expect(screen.getByTestId('backup-password-error')).toHaveTextContent('backup_password_too_short');
    await fireEvent.press(screen.getByTestId('backup-password-submit'));
    expect(exportBackupToFile).not.toHaveBeenCalled();
  });

  it('prompts for the password of an encrypted backup and shows a wrong-password retry', async () => {
    const seen: Array<string | null> = [];
    (pickAndImportBackup as jest.Mock).mockImplementation(async (requestPassword: (wrong: boolean) => Promise<string | null>) => {
      seen.push(await requestPassword(false));
      seen.push(await requestPassword(true));
      return null;
    });
    const screen = await render(<BackupSection />);
    await fireEvent.press(screen.getByTestId('backup-import'));
    // İçe aktarım parola beklerken askıda kalır; bu basmalar beklenmez.
    void fireEvent.press(screen.getByTestId('confirm-ok'));
    await waitFor(() => expect(screen.getByText('backup_password_enter_title')).toBeTruthy());
    expect(screen.queryByTestId('backup-password-error')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('backup-password-input'), 'ilk-deneme');
    void fireEvent.press(screen.getByTestId('backup-password-submit'));

    await waitFor(() => expect(screen.getByTestId('backup-password-error')).toHaveTextContent('backup_password_wrong'));
    void fireEvent.press(screen.getByTestId('backup-password-cancel'));
    await waitFor(() => expect(seen).toEqual(['ilk-deneme', null]));
  });
});
