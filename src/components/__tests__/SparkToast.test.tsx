import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, AppState, type AppStateStatus } from 'react-native';
import { SparkToast, SparkToastContainer } from '../SparkToast';

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemePalette: () => jest.requireActual('../../theme/colors').DarkTheme,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 20, left: 0 }),
}));

describe('SparkToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
  it('removes a pressed toast even when pressOut never arrives', async () => {
    const screen = await render(<SparkToastContainer />);
    await act(async () => { SparkToast.show('Saved'); jest.advanceTimersByTime(20); });
    await fireEvent(screen.getByTestId('spark-toast-body'), 'pressIn');
    await act(async () => { jest.advanceTimersByTime(5100); });
    expect(screen.queryByTestId('spark-toast-host')).toBeNull();
  });

  it('clears interrupted exits without requiring a native animation completion callback', async () => {
    jest.spyOn(Animated, 'parallel').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as any);
    const screen = await render(<SparkToastContainer />);
    await act(async () => { SparkToast.show('Deleted'); jest.advanceTimersByTime(4000); });
    expect(screen.queryByTestId('spark-toast-host')).toBeNull();
  });

  it('keeps the newest toast when an older exit was interrupted', async () => {
    jest.spyOn(Animated, 'parallel').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as any);
    const screen = await render(<SparkToastContainer />);
    await act(async () => { SparkToast.show('Old'); jest.advanceTimersByTime(3600); });
    await act(async () => { SparkToast.show('New'); jest.advanceTimersByTime(500); });
    expect(screen.getByText('New')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(screen.queryByTestId('spark-toast-host')).toBeNull();
  });

  it('expires a burst of mixed messages in both root and modal hosts', async () => {
    const screen = await render(<><SparkToastContainer /><SparkToastContainer /></>);
    await act(async () => {
      for (let i = 0; i < 20; i++) SparkToast.show(`Message ${i}`, i % 2 ? 'error' : 'success');
      SparkToast.show('Last', 'success');
      SparkToast.show('Last', 'success');
      jest.advanceTimersByTime(20);
    });
    expect(screen.getAllByText('Last')).toHaveLength(2);
    await act(async () => { jest.advanceTimersByTime(5100); });
    expect(screen.queryAllByTestId('spark-toast-host')).toHaveLength(0);
  });

  it('clears transient feedback when the app loses foreground', async () => {
    let listener: (state: AppStateStatus) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listener = callback;
      return { remove };
    });
    const screen = await render(<SparkToastContainer />);
    await act(async () => { SparkToast.show('Saved'); jest.advanceTimersByTime(20); });
    await act(async () => listener('background'));
    expect(screen.queryByTestId('spark-toast-host')).toBeNull();
    await screen.unmount();
    expect(remove).toHaveBeenCalled();
  });

});
