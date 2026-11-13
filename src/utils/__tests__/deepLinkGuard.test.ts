// SEC-08: bozuk veya aşırı uzun gelen bağlantı yönlendiriciye ulaşmaz.
import { filterIncomingLink, isSafeIncomingLink, MAX_INCOMING_LINK_LENGTH } from '../deepLinkGuard';
import { redirectSystemPath } from '../../../app/+native-intent';

describe('incoming link guard', () => {
  it('passes the app\'s own links through unchanged', () => {
    for (const link of [
      'spark://add-expense?id=1',
      'spark://recurring-payment?vendorId=12&name=%C5%BBabka%20Nano',
      '/edit-items?expenseId=5',
      'exp+spark://expo-development-client/?url=http%3A%2F%2F192.168.1.2%3A8081',
    ]) {
      expect(filterIncomingLink(link)).toBe(link);
      expect(redirectSystemPath({ path: link, initial: true })).toBe(link);
    }
  });

  it('drops malformed percent-encoding (the vulnerable input class)', () => {
    expect(filterIncomingLink('spark://add-expense?id=%E0%A4%A')).toBeNull();
    expect(filterIncomingLink(`spark://x?q=${'%C0%'.repeat(300)}`)).toBeNull();
    expect(filterIncomingLink('spark://x?q=%zz')).toBeNull();
  });

  it('drops oversized links and control characters', () => {
    expect(isSafeIncomingLink(`spark://x?q=${'a'.repeat(MAX_INCOMING_LINK_LENGTH)}`)).toBe(false);
    expect(isSafeIncomingLink('spark://x?q=a\u0000b')).toBe(false);
    expect(isSafeIncomingLink('spark://x?q=a\nb')).toBe(false);
  });

  it('never throws on unexpected input', () => {
    for (const value of [undefined, null, 42, {}, '']) {
      expect(filterIncomingLink(value)).toBeNull();
    }
  });

  it('stays fast on a hostile-looking payload at the length limit', () => {
    const payload = `spark://x?q=${'%25'.repeat(Math.floor((MAX_INCOMING_LINK_LENGTH - 12) / 3))}`;
    const started = Date.now();
    for (let i = 0; i < 200; i++) filterIncomingLink(payload);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
