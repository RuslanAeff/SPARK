import { getDatabase } from '../../db/database';
import { setAppThemeScheme } from '../../theme/themeStore';
import { applyThemeFromDatabase } from '../themeSchedule';

jest.mock('../../db/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../theme/themeStore', () => ({
  setAppThemeScheme: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('themeSchedule latest-wins application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('discards an older database read that finishes last', async () => {
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
    ]);
    await newApply;

    oldRead.resolve([
      { key: 'auto_theme_schedule', value: '0' },
      { key: 'theme_manual', value: 'dark' },
    ]);
    await oldApply;

    expect(setAppThemeScheme).toHaveBeenCalledTimes(1);
    expect(setAppThemeScheme).toHaveBeenCalledWith('light');
  });
});
