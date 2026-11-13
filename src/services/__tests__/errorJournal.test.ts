const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(dir: { uri: string }, name: string) { this.uri = `${dir.uri}/${name}`; }
    get exists() { return mockFiles.has(this.uri); }
    create() { mockFiles.set(this.uri, ''); }
    write(content: string) { mockFiles.set(this.uri, content); }
    textSync() { return mockFiles.get(this.uri) ?? ''; }
    delete() { mockFiles.delete(this.uri); }
  }
  return { File, Paths: { document: { uri: 'file:///doc' } } };
});
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '3.4.0' } } }));

import {
  ERROR_JOURNAL_LIMIT,
  __resetErrorJournalForTests,
  buildErrorReport,
  clearErrorJournal,
  readErrorJournal,
  recordError,
  redactErrorDetail,
} from '../errorJournal';

beforeEach(() => {
  mockFiles.clear();
  __resetErrorJournalForTests();
});

describe('redactErrorDetail', () => {
  it.each([
    ['file:///data/user/0/app/files/spark.db is locked', '<uri> is locked'],
    ['open failed: /data/user/0/com.app/files/x.json', 'open failed: <path>'],
    ['no such vendor "Biedronka Kraków"', 'no such vendor <text>'],
    ["amount 1250.50 exceeds 999", 'amount <n> exceeds <n>'],
    ['mail ruslan@example.com failed', 'mail <email> failed'],
    ['key AIzaSyA1234567890abcdefghijklmnopqrstu leaked', 'key <secret> leaked'],
  ])('%s', (input, expected) => {
    expect(redactErrorDetail(input)).toBe(expected);
  });

  it('keeps short technical codes and caps length', () => {
    expect(redactErrorDetail('INVALID_FORMAT')).toBe('INVALID_FORMAT');
    expect(redactErrorDetail('database is locked')).toBe('database is locked');
    expect(redactErrorDetail('x'.repeat(500))!.length).toBeLessThanOrEqual(200);
  });
});

describe('error journal storage', () => {
  it('persists redacted entries to a local file and reads them newest first', () => {
    recordError('budget save failed', new Error('UNIQUE constraint failed: budgets.period_start'));
    recordError('backup export', Object.assign(new Error('BACKUP_EXPORT_INVALID'), { section: 'container_deposit_vouchers' }));

    __resetErrorJournalForTests(); // simulate app restart: read from disk
    const entries = readErrorJournal();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ tag: 'backup export', kind: 'Error', detail: 'BACKUP_EXPORT_INVALID (container_deposit_vouchers)' });
    expect(entries[1]).toMatchObject({ tag: 'budget save failed', detail: 'UNIQUE constraint failed: budgets.period_start' });
  });

  it('keeps only the newest entries up to the limit', () => {
    for (let i = 0; i < ERROR_JOURNAL_LIMIT + 15; i++) recordError(`tag ${i}`, new Error('x'));
    const entries = readErrorJournal();
    expect(entries).toHaveLength(ERROR_JOURNAL_LIMIT);
    expect(entries[0].tag).toBe(`tag ${ERROR_JOURNAL_LIMIT + 14}`);
  });

  it('can record only the error kind without its message', () => {
    recordError('UI UNCAUGHT_RENDER_ERROR', new TypeError('SYNTHETIC_PRIVATE_MARKER'), { includeDetail: false });
    expect(readErrorJournal()[0]).toMatchObject({ kind: 'TypeError', detail: null });
    expect(JSON.stringify([...mockFiles.values()])).not.toContain('SYNTHETIC_PRIVATE');
  });

  it('clear removes the file and the in-memory entries', () => {
    recordError('a', new Error('x'));
    clearErrorJournal();
    expect(readErrorJournal()).toEqual([]);
    expect(mockFiles.size).toBe(0);
  });

  it('never throws, even with a corrupt file or exotic error values', () => {
    mockFiles.set('file:///doc/error-journal.json', '{not json');
    expect(() => recordError('x', { toString() { throw new Error('bad'); } })).not.toThrow();
    expect(() => recordError('y', null)).not.toThrow();
    expect(readErrorJournal().map(e => e.tag)).toEqual(['y', 'x']);
  });
});

describe('buildErrorReport', () => {
  it('includes app/platform metadata and entries but no extra data', () => {
    recordError('transactions bulk delete failed', new Error('database is locked'));
    const report = buildErrorReport(readErrorJournal(), new Date('2026-11-12T10:00:00Z'));
    expect(report).toContain('S.P.A.R.K.');
    expect(report).toContain('3.4.0');
    expect(report).toContain('transactions bulk delete failed');
    expect(report).toContain('database is locked');
  });
});

describe('installErrorJournal', () => {
  it('routes logError and uncaught JS errors into the journal and keeps the previous handler', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { installErrorJournal } = require('../errorJournal');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { logError, reportErrorKind, setErrorSink } = require('../../utils/logError');
    const previous = jest.fn();
    let handler: ((e: unknown, fatal?: boolean) => void) | undefined;
    (globalThis as any).ErrorUtils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (h: typeof handler) => { handler = h; },
    };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      installErrorJournal();
      logError('budget save failed', new Error('database is locked'));
      reportErrorKind('UI UNCAUGHT_RENDER_ERROR', new TypeError('SECRET_MARKER'));
      const fatal = new RangeError('boom');
      handler!(fatal, true);

      expect(previous).toHaveBeenCalledWith(fatal, true);
      expect(readErrorJournal().map(e => [e.tag, e.kind, e.detail])).toEqual([
        ['JS fatal error', 'RangeError', 'boom'],
        ['UI UNCAUGHT_RENDER_ERROR', 'TypeError', null],
        ['budget save failed', 'Error', 'database is locked'],
      ]);
    } finally {
      setErrorSink(null);
      delete (globalThis as any).ErrorUtils;
    }
  });
});
