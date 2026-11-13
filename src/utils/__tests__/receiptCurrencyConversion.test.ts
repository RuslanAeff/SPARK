import { convertReceiptToAppCurrency, receiptNeedsCurrencyConversion } from '../receiptCurrencyConversion';
import type { ParsedReceipt } from '../../services/geminiService';

const eurReceipt: ParsedReceipt = {
  vendor_name: 'Rewe',
  date: '2026-11-10',
  currency: 'EUR',
  total: 50,
  container_deposit_paid: 0.25,
  container_voucher_used: 0,
  items: [
    { name: 'Brot', suggested_category: 'Market', quantity: 1, unit_price: 2.99, total_price: 2.99 },
    { name: 'Käse', suggested_category: 'Market', quantity: 2, unit_price: 9.5, total_price: 17, line_discount: 2, list_line_total_before_discount: 19 },
    { name: 'Wein', suggested_category: 'Market', quantity: 1, unit_price: 29.76, total_price: 29.76 },
    { name: 'Pfand', suggested_category: 'Diğer', quantity: 1, unit_price: 0.25, total_price: 0.25, financial_kind: 'container_deposit' },
  ],
};

describe('receipt currency conversion (BUG-01, ürün kararı A)', () => {
  it('detects a receipt in a different currency than the app', () => {
    expect(receiptNeedsCurrencyConversion(eurReceipt, 'PLN')).toBe(true);
    expect(receiptNeedsCurrencyConversion(eurReceipt, 'eur')).toBe(false);
    expect(receiptNeedsCurrencyConversion({ ...eurReceipt, currency: '' }, 'TRY')).toBe(false);
  });

  it('scales every money field by the paid ratio and keeps the paid total exact', () => {
    const converted = convertReceiptToAppCurrency(eurReceipt, 'PLN', 215);

    expect(converted.currency).toBe('PLN');
    expect(converted.total).toBe(215);
    expect(converted.items.map(i => i.total_price)).toEqual([12.86, 73.1, 127.97, 1.08]);
    expect(converted.items[1]).toMatchObject({ line_discount: 8.6, list_line_total_before_discount: 81.7, unit_price: 40.85 });
    expect(converted.container_deposit_paid).toBe(1.08);
    expect(converted.original).toEqual({ currency: 'EUR', total: 50 });
    // Girdi değiştirilmez.
    expect(eurReceipt.currency).toBe('EUR');
  });

  it('converts a return voucher amount', () => {
    const voucher: ParsedReceipt = {
      ...eurReceipt, document_type: 'container_return_voucher', total: 3, items: [],
      voucher_issued: { amount: 3, expires_on: null },
    };
    expect(convertReceiptToAppCurrency(voucher, 'PLN', 12.9).voucher_issued).toEqual({ amount: 12.9, expires_on: null });
  });

  it('only relabels a zero-total receipt', () => {
    const free: ParsedReceipt = { ...eurReceipt, total: 0, items: [{ name: 'Gratis', suggested_category: 'Market', quantity: 1, unit_price: 0, total_price: 0 }] };
    const converted = convertReceiptToAppCurrency(free, 'PLN', 0);
    expect(converted).toMatchObject({ currency: 'PLN', total: 0 });
    expect(converted.items[0].total_price).toBe(0);
  });
});
