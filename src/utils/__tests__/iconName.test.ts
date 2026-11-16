import { DEFAULT_ICON_NAME, toIconName } from '../iconName';

// CQ-08: veritabanından gelen ikon adı haritada doğrulanır.
describe('toIconName', () => {
  it('keeps a valid MaterialCommunityIcons name', () => {
    expect(toIconName('shape-outline')).toBe('shape-outline');
  });

  it('falls back for unknown, empty or missing names', () => {
    expect(toIconName('not-a-real-icon-name')).toBe(DEFAULT_ICON_NAME);
    expect(toIconName('', 'autorenew')).toBe('autorenew');
    expect(toIconName(null, 'water-outline')).toBe('water-outline');
  });
});
