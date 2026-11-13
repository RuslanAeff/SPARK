import { createSerialQueue, runSequentially } from '../serialQueue';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('serial DB work helpers (BUG-12)', () => {
  it('runSequentially starts each task only after the previous one settles', async () => {
    const log: string[] = [];
    const first = deferred();
    const pending = runSequentially([
      async () => { log.push('a:start'); await first.promise; log.push('a:end'); },
      async () => { log.push('b:start'); },
    ]);
    await Promise.resolve();
    expect(log).toEqual(['a:start']);
    first.resolve();
    await pending;
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
  });

  it('runSequentially keeps going after a failing task and reports it', async () => {
    const onError = jest.fn();
    const ran: string[] = [];
    await runSequentially([
      async () => { throw new Error('boom'); },
      async () => { ran.push('b'); },
    ], onError);
    expect(ran).toEqual(['b']);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
  });

  it('createSerialQueue never overlaps two enqueued batches, even after a rejection', async () => {
    const enqueue = createSerialQueue();
    const log: string[] = [];
    const gate = deferred();
    const a = enqueue(async () => { log.push('a:start'); await gate.promise; throw new Error('a failed'); });
    const b = enqueue(async () => { log.push('b:start'); return 2; });
    await Promise.resolve();
    expect(log).toEqual(['a:start']);
    gate.resolve();
    await expect(a).rejects.toThrow('a failed');
    await expect(b).resolves.toBe(2);
    expect(log).toEqual(['a:start', 'b:start']);
  });
});
