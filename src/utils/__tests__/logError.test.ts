import { logError } from '../logError';

describe('logError (SEC-02)', () => {
  const originalDev = (global as any).__DEV__;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    warn.mockRestore();
    error.mockRestore();
  });

  it('geliştirmede tam hata nesnesini yazar', () => {
    (global as any).__DEV__ = true;
    const failure = new Error('UNIQUE constraint failed: vendors.name');

    logError('transactions.delete', failure);

    expect(warn).toHaveBeenCalledWith('[transactions.delete]', failure);
  });

  it('yayın sürümünde yalnız etiketi yazar; hata ayrıntısı sistem günlüğüne düşmez', () => {
    (global as any).__DEV__ = false;

    logError('transactions.delete', new Error('UNIQUE constraint failed: vendors.name'));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[transactions.delete]');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('vendors.name');
    expect(error).not.toHaveBeenCalled();
  });

  it('hata nesnesi olmadan da çağrılabilir ve asla fırlatmaz', () => {
    (global as any).__DEV__ = false;
    expect(() => logError('secureKeyStore.read')).not.toThrow();
    expect(() => logError('x', { toString() { throw new Error('bad'); } })).not.toThrow();
  });
});

describe('logError sink', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setErrorSink } = require('../logError');
  afterEach(() => setErrorSink(null));

  it('forwards every logged error to the installed sink and survives a throwing sink', () => {
    const sink = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    setErrorSink(sink);
    const failure = new Error('boom');
    logError('a', failure);
    expect(sink).toHaveBeenCalledWith('a', failure);
    setErrorSink(() => { throw new Error('sink failed'); });
    expect(() => logError('b', failure)).not.toThrow();
  });
});
