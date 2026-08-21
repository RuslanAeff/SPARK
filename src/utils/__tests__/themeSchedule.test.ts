import { getDatabase } from '../../db/database';
import {
  setAppThemeAccent,
  setAppThemeSelection,
} from '../../theme/themeStore';
import {
  applyThemeFromDatabase,
  loadThemeSettings,
  setThemeAccent,
} from '../themeSchedule';

jest.mock('../../db/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../theme/themeStore', () => ({
  setAppThemeAccent: jest.fn(),
  setAppThemeScheme: jest.fn(),
  setAppThemeSelection: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('themeSchedule atomik tema uygulaması', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('eski veritabanı okuması en son bitse bile onu uygulatmaz', async () => {
    const oldRead = deferred<Array<{ key: string; value: string }>>();
    const newRead = deferred<Array<{ key: string; value: string }>>();
    const db = {
      getAllAsync: jest
        .fn()
        .mockReturnValueOnce(oldRead.promise)
        .mockReturnValueOnce(newRead.promise),
    };
    (getDatabase as jest.Mock).mockResolvedValue(db);

    const oldApply = applyThemeFromDatabase();
    await Promise.resolve();
    const newApply = applyThemeFromDatabase();
    await Promise.resolve();

    newRead.resolve([
      { key: 'auto_theme_schedule', value: '0' },
      { key: 'theme_manual', value: 'light' },
      { key: 'theme_accent', value: 'purple' },
    ]);
    await newApply;

    oldRead.resolve([
      { key: 'auto_theme_schedule', value: '0' },
      { key: 'theme_manual', value: 'dark' },
      { key: 'theme_accent', value: 'orange' },
    ]);
    await oldApply;

    expect(setAppThemeSelection).toHaveBeenCalledTimes(1);
    expect(setAppThemeSelection).toHaveBeenCalledWith({
      scheme: 'light',
      accent: 'purple',
    });
  });

  it('scheme ve accent ayarlarını aynı SELECT ile yükler, geçersiz accentte yeşile düşer', async () => {
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([
        { key: 'auto_theme_schedule', value: '0' },
        { key: 'theme_manual', value: 'light' },
        { key: 'theme_accent', value: 'rainbow' },
      ]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(db);

    await applyThemeFromDatabase();

    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    expect(db.getAllAsync.mock.calls[0][1]).toEqual([
      'auto_theme_schedule',
      'theme_manual',
      'theme_accent',
    ]);
    expect(setAppThemeSelection).toHaveBeenCalledWith({ scheme: 'light', accent: 'green' });
  });

  it('eksik accent ayarını loadThemeSettings içinde yeşil varsayar', async () => {
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([
        { key: 'auto_theme_schedule', value: '1' },
        { key: 'theme_manual', value: 'dark' },
      ]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(db);

    await expect(loadThemeSettings()).resolves.toEqual({
      autoEnabled: true,
      manual: 'dark',
      accent: 'green',
    });
    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('hızlı accent seçimlerini sıraya alır ve yalnız son seçimi store’a yayınlar', async () => {
    const firstWrite = deferred<unknown>();
    const db = {
      runAsync: jest
        .fn()
        .mockReturnValueOnce(firstWrite.promise)
        .mockResolvedValueOnce(undefined),
    };
    (getDatabase as jest.Mock).mockResolvedValue(db);

    const first = setThemeAccent('blue');
    await Promise.resolve();
    const last = setThemeAccent('red');
    await Promise.resolve();

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    firstWrite.resolve(undefined);
    await first;
    await last;

    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(db.runAsync.mock.calls[0][1]).toEqual(['theme_accent', 'blue']);
    expect(db.runAsync.mock.calls[1][1]).toEqual(['theme_accent', 'red']);
    expect(setAppThemeAccent).toHaveBeenCalledTimes(1);
    expect(setAppThemeAccent).toHaveBeenCalledWith('red');
  });
});
