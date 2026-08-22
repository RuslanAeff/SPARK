import {
  buildAllCardsHiddenConfig,
  hasActiveAnalyticsCard,
  resolveAnalyticsCardEditExit,
} from '../analyticsCardConfig';

describe('buildAllCardsHiddenConfig', () => {
  it('tüm kartları aktif listeden kullanılabilir listeye taşır', () => {
    expect(buildAllCardsHiddenConfig(['chart', 'streak', 'vendors'])).toEqual({
      active: [],
      hidden: ['chart', 'streak', 'vendors'],
    });
  });

  it('kanonik sırayı korur ve yinelenen kimlikleri tekilleştirir', () => {
    expect(buildAllCardsHiddenConfig(['chart', 'vendors', 'chart'])).toEqual({
      active: [],
      hidden: ['chart', 'vendors'],
    });
  });

  it('yalnız en az bir aktif kart olduğunda düzenlemeyi geçerli sayar', () => {
    expect(hasActiveAnalyticsCard([])).toBe(false);
    expect(hasActiveAnalyticsCard(['chart'])).toBe(true);
  });

  it('boş taslağın onaylanmasını engeller', () => {
    expect(resolveAnalyticsCardEditExit(
      { active: [], hidden: ['chart'] },
      { active: ['chart'], hidden: [] },
      'confirm',
    )).toBeNull();
  });

  it('sekmeden ayrılınca boş taslağı atıp son onaylanan kartları geri yükler', () => {
    const committed = { active: ['chart'], hidden: ['streak'] };
    const restored = resolveAnalyticsCardEditExit(
      { active: [], hidden: ['chart', 'streak'] },
      committed,
      'discard',
    );

    expect(restored).toEqual(committed);
    expect(restored).not.toBe(committed);
    expect(restored?.active).not.toBe(committed.active);
  });

  it('en az bir kartlı taslağı onaylanabilir yapılandırma olarak döndürür', () => {
    expect(resolveAnalyticsCardEditExit(
      { active: ['streak'], hidden: ['chart'] },
      { active: ['chart'], hidden: ['streak'] },
      'confirm',
    )).toEqual({ active: ['streak'], hidden: ['chart'] });
  });
});
