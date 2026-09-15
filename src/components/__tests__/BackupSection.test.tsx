import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import BackupSection from '../BackupSection';
import { exportBackupToFile, pickAndImportBackup } from '../../services/backupService';

jest.mock('../../services/backupService', () => ({ exportBackupToFile: jest.fn(), pickAndImportBackup: jest.fn() }));
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
  const { Text } = require('react-native');
  return ({ visible, title }: any) => visible ? <Text>{title}</Text> : null;
});

describe('BackupSection range controls', () => {
  beforeEach(() => jest.clearAllMocks());
  it('offers four shortcuts and preserves selection when a date picker is cancelled', async () => {
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
