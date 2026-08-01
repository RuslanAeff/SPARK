import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ExpenseDao } from '../../db/expenseDao';
import { useDailySpending } from '../useExpenses';

jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    getSpendingByDays: jest.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('useDailySpending tarih aralığı yenilemesi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('autoLoad kapalıyken ekran kuyruğu çağırana kadar sorgu başlatmaz', async () => {
    (ExpenseDao.getSpendingByDays as jest.Mock).mockResolvedValue([
      { date: '2026-07-23', total: 10 },
    ]);

    const { result } = await renderHook(() =>
      useDailySpending('2026-07-23', '2026-07-23', { autoLoad: false }),
    );

    expect(ExpenseDao.getSpendingByDays).not.toHaveBeenCalled();

    await act(async () => {
      await result.current!.refresh();
    });

    expect(ExpenseDao.getSpendingByDays).toHaveBeenCalledTimes(1);
    expect(result.current!.data).toEqual([{ date: '2026-07-23', total: 10 }]);
  });

  it('enabled kapalıyken manuel refresh de fallback tarih sorgusu başlatmaz', async () => {
    const { result } = await renderHook(() =>
      useDailySpending('2026-08-01', '2026-08-31', {
        enabled: false,
        autoLoad: false,
      }),
    );

    await act(async () => {
      await result.current!.refresh();
    });

    expect(ExpenseDao.getSpendingByDays).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current!.loading).toBe(false));
  });

  it('geç biten eski takvim ayı sorgusunun yeni bütçe döngüsünü ezmesine izin vermez', async () => {
    const oldCalendarQuery = deferred<{ date: string; total: number }[]>();
    (ExpenseDao.getSpendingByDays as jest.Mock)
      .mockImplementationOnce(() => oldCalendarQuery.promise)
      .mockResolvedValueOnce([{ date: '2026-07-23', total: 526.82 }]);

    type RangeProps = { start: string; end: string };
    const { result, rerender } = await renderHook<ReturnType<typeof useDailySpending>, RangeProps>(
      ({ start, end }: RangeProps) => useDailySpending(start, end),
      { initialProps: { start: '2026-08-01', end: '2026-08-31' } },
    );

    await waitFor(() => {
      expect(ExpenseDao.getSpendingByDays).toHaveBeenCalledTimes(1);
    });

    await rerender({ start: '2026-07-23', end: '2026-08-22' });

    await waitFor(() => {
      expect(ExpenseDao.getSpendingByDays).toHaveBeenCalledTimes(2);
      expect(result.current.data.find((row) => row.date === '2026-07-23')?.total).toBe(526.82);
    });

    await act(async () => {
      oldCalendarQuery.resolve([]);
      await oldCalendarQuery.promise;
      await Promise.resolve();
    });

    expect(result.current.data.find((row) => row.date === '2026-07-23')?.total).toBe(526.82);
  });
});
