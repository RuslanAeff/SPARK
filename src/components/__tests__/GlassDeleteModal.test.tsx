import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import GlassDeleteModal from '../GlassDeleteModal';

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      cancel: 'İptal',
      delete: 'Sil',
      delete_confirmation_title: 'Silmeyi onayla',
      system_warning: 'Sistem uyarısı',
    }[key] ?? key),
  }),
}));

jest.mock('../SparkToast', () => ({
  SparkToastContainer: () => null,
}));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Warning: 'warning' },
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

describe('GlassDeleteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sade başlık, geri alınamaz açıklaması ve iki eylemi gösterir', async () => {
    const view = await render(
      <GlassDeleteModal
        visible
        title="İşlemi sil?"
        message="Seçili işlem kalıcı olarak silinecek. Bu işlem geri alınamaz."
        onCancel={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(view.getByTestId('delete-confirm-modal')).toBeTruthy();
    expect(view.getByText('İşlemi sil?')).toBeTruthy();
    expect(view.getByText('Seçili işlem kalıcı olarak silinecek. Bu işlem geri alınamaz.')).toBeTruthy();
    expect(view.getByText('İptal')).toBeTruthy();
    expect(view.getByText('Sil')).toBeTruthy();
  });

  it('iptal ve silme eylemlerini ayrı tutar', async () => {
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    const view = await render(
      <GlassDeleteModal
        visible
        title="İşlemi sil?"
        message="Bu işlem geri alınamaz."
        onCancel={onCancel}
        onDelete={onDelete}
      />,
    );

    await fireEvent.press(view.getByTestId('delete-confirm-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('delete-confirm-action'));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
