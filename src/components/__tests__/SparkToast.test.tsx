import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SparkToast, SparkToastContainer } from '../SparkToast';

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 20, left: 0 }),
}));

describe('SparkToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders success feedback in the persistent React overlay', async () => {
    const screen = await render(<SparkToastContainer />);

    await act(async () => {
      SparkToast.show('Fiş başarıyla okundu', 'success', '42,00 zł');
      jest.advanceTimersByTime(20);
    });

    expect(screen.getByTestId('spark-toast-host')).toBeTruthy();
    expect(screen.getByTestId('spark-toast-success')).toBeTruthy();
    expect(screen.getByText('Fiş başarıyla okundu')).toBeTruthy();
    expect(screen.getByText('42,00 zł')).toBeTruthy();
  });

  it('replaces an active toast without an empty or stale-content phase', async () => {
    const screen = await render(<SparkToastContainer />);

    await act(async () => {
      SparkToast.show('İlk bildirim', 'success');
      jest.advanceTimersByTime(20);
      SparkToast.show('Yeni bildirim', 'success');
      jest.advanceTimersByTime(20);
    });

    expect(screen.queryByText('İlk bildirim')).toBeNull();
    expect(screen.getByText('Yeni bildirim')).toBeTruthy();
    expect(screen.getAllByTestId('spark-toast-host')).toHaveLength(1);
  });

  it('mirrors feedback into an active modal-local host', async () => {
    const screen = await render(
      <>
        <SparkToastContainer />
        <SparkToastContainer />
      </>,
    );

    await act(async () => {
      SparkToast.show('Modal üstü bildirim', 'error');
      jest.advanceTimersByTime(20);
    });

    expect(screen.getAllByTestId('spark-toast-host')).toHaveLength(2);
    expect(screen.getAllByText('Modal üstü bildirim')).toHaveLength(2);
  });
});
