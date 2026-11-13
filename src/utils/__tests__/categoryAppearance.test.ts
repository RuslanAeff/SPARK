import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  safeCategoryColor,
  safeCategoryIcon,
} from '../categoryAppearance';

describe('category icon/color validation (SEC-09)', () => {
  it('keeps real #RRGGBB colors and falls back otherwise', () => {
    expect(safeCategoryColor('#FFA654')).toBe('#FFA654');
    expect(safeCategoryColor('#ffa654')).toBe('#ffa654');
    for (const bad of ['red', '#FFF', '#FFA65480', 'expression(1)', '', null, 42]) {
      expect(safeCategoryColor(bad)).toBe(DEFAULT_CATEGORY_COLOR);
    }
  });

  it('keeps known MaterialCommunityIcons names and falls back otherwise', () => {
    expect(safeCategoryIcon('cart-outline')).toBe('cart-outline');
    expect(safeCategoryIcon('food-apple-outline')).toBe('food-apple-outline');
    for (const bad of ['not-an-icon', '__proto__', 'constructor', '', null, 7]) {
      expect(safeCategoryIcon(bad)).toBe(DEFAULT_CATEGORY_ICON);
    }
  });

  it('every default category uses a valid icon and color', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_CATEGORIES } = require('../../db/schema');
    for (const parent of DEFAULT_CATEGORIES) {
      for (const cat of [parent, ...(parent.children ?? [])]) {
        expect(safeCategoryIcon(cat.icon)).toBe(cat.icon);
        expect(safeCategoryColor(cat.color)).toBe(cat.color);
      }
    }
  });
});
