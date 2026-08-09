import {
  formatMoneyInput,
  parseMoneyInput,
  roundMoney,
  sumMoney,
  toMinorUnits,
} from '../moneyMath';
import { calculateReceiptLineAmounts, normalizeReceiptItemAmounts } from '../receiptMoney';

describe('minor-unit para matematiği', () => {
  it('binary float artıklarını kuruşa sabitler', () => {
    expect(roundMoney(55.00000000000003)).toBe(55);
    expect(formatMoneyInput(55.00000000000003)).toBe('55.00');
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    expect(roundMoney(10.075)).toBe(10.08);
  });

  it('virgüllü manuel para girişini doğru okur', () => {
    expect(parseMoneyInput('55,93')).toBe(55.93);
    expect(parseMoneyInput('0,20')).toBe(0.2);
    expect(parseMoneyInput('55,9x')).toBeNull();
  });

  it('9,49 − 3,17 satırını tam 6,32 hesaplar', () => {
    expect(calculateReceiptLineAmounts(1, 9.49, 3.17)).toEqual({
      listLineTotal: 9.49,
      discountAmount: 3.17,
      netTotal: 6.32,
      netUnitPrice: 6.32,
    });
  });

  it('örnek Biedronka fişini tam 55,93 toplar', () => {
    const totals = [
      6.49, 0.5, 6.49, 0.5, 6.49, 0.5,
      12.99, 6.33, 6.33, 6.32, 2.99,
    ];
    expect(sumMoney(totals)).toBe(55.93);
  });

  it('0,20 indirim değişimini toplamda tam 0,20 yansıtır', () => {
    expect(calculateReceiptLineAmounts(1, 9.49, 3.37).netTotal).toBe(6.12);
    expect(sumMoney([55.93, -0.2])).toBe(55.73);
  });

  it('tamamen indirimli ürünün geçerli sıfır toplamını korur', () => {
    expect(normalizeReceiptItemAmounts({
      quantity: 1,
      unit_price: 10,
      total_price: 0,
    })).toEqual({ quantity: 1, unitPrice: 10, totalPrice: 0 });
  });
});
