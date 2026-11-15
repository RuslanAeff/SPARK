import { act, renderHook } from '@testing-library/react-native';

import { useDashboardRefresh } from '../useDashboardRefresh';

jest.mock('../../utils/logError', () => ({ logError: jest.fn() }));

describe('useDashboardRefresh (FN-03)', () => {
  it('does not query data before the budget period is known', async () => {
    const refreshBudget = jest.fn();
    const data = [jest.fn(), jest.fn()];
    const { result } = await renderHook(() => useDashboardRefresh({ periodReady: false, refreshBudget, dataSteps: data }));
    await act(async () => { await result.current(); });
    expect(refreshBudget).not.toHaveBeenCalled();
    data.forEach(step => expect(step).not.toHaveBeenCalled());
  });

  it('first wave loads each data step once without re-reading the bootstrap budget; later waves include it', async () => {
    const order: string[] = [];
    const refreshBudget = jest.fn(async () => { order.push('budget'); });
    const data = [
      jest.fn(async () => { order.push('cats'); }),
      jest.fn(async () => { order.push('vendors'); }),
    ];
    const { result } = await renderHook(() => useDashboardRefresh({ periodReady: true, refreshBudget, dataSteps: data }));

    await act(async () => { await result.current(); });
    expect(order).toEqual(['cats', 'vendors']);

    await act(async () => { await result.current(); });
    expect(order).toEqual(['cats', 'vendors', 'budget', 'cats', 'vendors']);
  });

  it('runs overlapping calls one after another and survives a failing step', async () => {
    let running = 0;
    let maxParallel = 0;
    const step = jest.fn(async () => {
      running += 1; maxParallel = Math.max(maxParallel, running);
      await Promise.resolve();
      running -= 1;
    });
    const failing = jest.fn(async () => { throw new Error('boom'); });
    const { result } = await renderHook(() => useDashboardRefresh({ periodReady: true, refreshBudget: step, dataSteps: [failing, step] }));
    await act(async () => { await Promise.all([result.current(), result.current(), result.current()]); });
    expect(maxParallel).toBe(1);
    expect(failing).toHaveBeenCalledTimes(3);
  });
});
