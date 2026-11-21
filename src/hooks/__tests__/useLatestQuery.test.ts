// CQ-06: Yarış koruması, devre dışı bırakma ve hata yedeği tek yerde test edilir.
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useLatestQuery } from '../useLatestQuery';

jest.mock('../../utils/logError', () => ({ logError: jest.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

describe('useLatestQuery', () => {
  it('ignores a slow older result once a newer query started', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const queue = [first.promise, second.promise];
    const load = jest.fn(() => queue.shift()!);
    const { result } = await renderHook(() =>
      useLatestQuery(load, 'initial', { autoLoad: false, errorMessage: 'x' }),
    );

    let firstRun!: Promise<void>;
    let secondRun!: Promise<void>;
    await act(async () => {
      firstRun = result.current!.refresh();
      secondRun = result.current!.refresh();
    });
    await act(async () => { second.resolve('new'); await secondRun; });
    await act(async () => { first.resolve('old'); await firstRun; });

    expect(result.current!.data).toBe('new');
    expect(result.current!.loading).toBe(false);
  });

  it('does not query while disabled and drops an in-flight result when disabled', async () => {
    const pending = deferred<number>();
    const load = jest.fn(() => pending.promise);
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useLatestQuery(load, 0, { enabled, autoLoad: false, errorMessage: 'x' }),
      { initialProps: { enabled: true } },
    );

    let run!: Promise<void>;
    await act(async () => { run = result.current!.refresh(); });
    await rerender({ enabled: false });
    await act(async () => { pending.resolve(42); await run; });
    expect(result.current!.data).toBe(0);
    expect(result.current!.loading).toBe(false);

    await act(async () => { await result.current!.refresh(); });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('writes a synchronous value without a loading phase', async () => {
    const { result } = await renderHook(() =>
      useLatestQuery(() => 'sync', 'initial', { errorMessage: 'x' }),
    );
    await waitFor(() => expect(result.current!.data).toBe('sync'));
    expect(result.current!.loading).toBe(false);
  });

  it('keeps old data on error, or uses the fallback when given', async () => {
    const failing = () => Promise.reject(new Error('db'));
    const kept = await renderHook(() =>
      useLatestQuery(failing, 'kept', { errorMessage: 'x' }),
    );
    await waitFor(() => expect(kept.result.current!.loading).toBe(false));
    expect(kept.result.current!.data).toBe('kept');

    const replaced = await renderHook(() =>
      useLatestQuery(failing, 'kept', { errorMessage: 'x', fallbackOnError: () => 'fallback' }),
    );
    await waitFor(() => expect(replaced.result.current!.data).toBe('fallback'));
    expect(replaced.result.current!.loading).toBe(false);
  });
});
