import { getVendorPlaceholderExamples } from '../vendorPlaceholders';

describe('getVendorPlaceholderExamples', () => {
  it('para birimine göre örnek satıcıları döner', () => {
    expect(getVendorPlaceholderExamples('TRY')).toBe('Migros, BİM');
    expect(getVendorPlaceholderExamples('PLN')).toBe('Biedronka, Żabka');
    expect(getVendorPlaceholderExamples('USD')).toBe('Walmart, Target');
    expect(getVendorPlaceholderExamples('EUR')).toBe('Lidl, Carrefour');
    expect(getVendorPlaceholderExamples('AZN')).toBe('Bravo, Araz');
  });
});
