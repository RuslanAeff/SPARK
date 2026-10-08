import { fetchBoundedText } from '../boundedFetch';

const originalFetch = global.fetch;
beforeEach(() => { jest.useFakeTimers(); global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it('times out during a stalled body even if fetch ignores abort', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, text: () => new Promise(() => {}) });
  const result = fetchBoundedText('https://example.invalid', undefined, 100);
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(100);
  await assertion;
  expect((fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it('external cancellation remains effective while consuming the body', async () => {
  let entered!: () => void;
  const reading = new Promise<void>(resolve => { entered = resolve; });
  (fetch as jest.Mock).mockResolvedValue({ text: () => { entered(); return new Promise(() => {}); } });
  const controller = new AbortController();
  const result = fetchBoundedText('https://example.invalid', undefined, 1000, controller.signal);
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await reading;
  controller.abort();
  await assertion;
});

it('rejects oversized declared responses without reading', async () => {
  const text = jest.fn();
  (fetch as jest.Mock).mockResolvedValue({ headers: { get: () => '100' }, text });
  await expect(fetchBoundedText('https://example.invalid', undefined, 100, undefined, 4))
    .rejects.toThrow('RESPONSE_TOO_LARGE');
  expect(text).not.toHaveBeenCalled();
});

it('counts UTF-8 bytes when streaming is unavailable', async () => {
  (fetch as jest.Mock).mockResolvedValue({ text: async () => '😀😀' });
  await expect(fetchBoundedText('https://example.invalid', undefined, 100, undefined, 7))
    .rejects.toThrow('RESPONSE_TOO_LARGE');
});

it('cancels an oversized stream and ignores a smaller declared length', async () => {
  const previous = global.TextDecoder;
  global.TextDecoder = require('node:util').TextDecoder;
  const cancel = jest.fn().mockResolvedValue(undefined);
  const read = jest.fn().mockResolvedValue({ done: false, value: new Uint8Array(8) });
  (fetch as jest.Mock).mockResolvedValue({ headers: { get: () => '1' }, body: { getReader: () => ({ read, cancel }) } });
  try {
    await expect(fetchBoundedText('https://example.invalid', undefined, 100, undefined, 4))
      .rejects.toThrow('RESPONSE_TOO_LARGE');
    expect(read).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
  } finally { global.TextDecoder = previous; }
});

it('returns valid response text and clears its timer', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, text: async () => '{"ok":true}' });
  await expect(fetchBoundedText('https://example.invalid', undefined, 100)).resolves
    .toEqual({ ok: true, status: 200, body: '{"ok":true}' });
  expect(jest.getTimerCount()).toBe(0);
});
