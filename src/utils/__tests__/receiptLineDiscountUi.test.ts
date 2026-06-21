import { lineHasDiscount, effectiveLineDiscount } from '../receiptLineDiscountUi';

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

describe('effectiveLineDiscount', () => {
  it('açık line_discount değerini döner', () => {
    expect(effectiveLineDiscount({ total_price: 5, line_discount: 1.41 })).toBe(1.41);
  });

  it('line_discount yoksa liste - net farkını döner', () => {
    expect(effectiveLineDiscount({ total_price: 5, list_line_total_before_discount: 6.5 })).toBe(1.5);
  });

  it('indirim yoksa 0 döner', () => {
    expect(effectiveLineDiscount({ total_price: 5 })).toBe(0);
  });
});
