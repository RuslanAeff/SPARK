import {
  lineHasDiscount,
  effectiveLineDiscount,
  effectiveListLineTotal,
  formatReceiptDiscountAmount,
} from '../receiptLineDiscountUi';

describe('lineHasDiscount', () => {
  it('line_discount pozitifse true', () => {
    expect(lineHasDiscount({ total_price: 5, line_discount: 1 })).toBe(true);
  });

  it('liste fiyatı net fiyattan büyükse true', () => {
    expect(lineHasDiscount({ total_price: 5, list_line_total_before_discount: 6 })).toBe(true);
  });

  it('indirim yoksa false', () => {
    expect(lineHasDiscount({ total_price: 5 })).toBe(false);
    expect(lineHasDiscount({ total_price: 5, line_discount: 0 })).toBe(false);
    expect(lineHasDiscount({ total_price: 5, list_line_total_before_discount: 5 })).toBe(false);
  });
});

describe('effectiveListLineTotal', () => {
  it('eski kayıtta eksik liste toplamını net + indirimden kurar', () => {
    expect(effectiveListLineTotal({
      total_price: 6.32,
      line_discount: 3.17,
    })).toBe(9.49);
  });
});

describe('formatReceiptDiscountAmount', () => {
  it('indirim tutarını iki ondalıkla gösterir', () => {
    expect(formatReceiptDiscountAmount(3.17, 'PLN')).toBe('3,17 zł');
  });
});

describe('effectiveLineDiscount', () => {
  it('açık line_discount değerini döner', () => {
    expect(effectiveLineDiscount({ total_price: 5, line_discount: 1.41 })).toBe(1.41);
  });

  it('line_discount yoksa liste - net farkını döner', () => {
    expect(effectiveLineDiscount({ total_price: 5, list_line_total_before_discount: 6.5 })).toBe(1.5);
  });

  it('binary float artığını kullanıcıya sızdırmadan kuruşa yuvarlar', () => {
    expect(effectiveLineDiscount({
      total_price: 6.319999999999999,
      list_line_total_before_discount: 9.490000000000002,
    })).toBe(3.17);
  });

  it('indirim yoksa 0 döner', () => {
    expect(effectiveLineDiscount({ total_price: 5 })).toBe(0);
  });
});
