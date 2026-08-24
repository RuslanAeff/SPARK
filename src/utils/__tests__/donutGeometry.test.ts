import { buildDonutGeometry } from '../donutGeometry';

describe('buildDonutGeometry', () => {
  it('kategori yaylarını etkin bütçe paydasında tutar ve kalan kısmı boş bırakır', () => {
    const geometry = buildDonutGeometry([180, 12, 4.49], 600, 3260);
    const spentArc = geometry.arcs.reduce((sum, arc) => sum + arc.length, 0);

    expect(geometry.scaleTotal).toBe(3260);
    expect(spentArc).toBeCloseTo((196.49 / 3260) * 600, 5);
  });

  it('boşluk küçük bir kategorinin renkli yayını tamamen yok etmez', () => {
    const geometry = buildDonutGeometry([99, 1], 600);
    const tinyArc = geometry.arcs[1];

    expect(tinyArc.length).toBe(6);
    expect(tinyArc.gap).toBeLessThan(tinyArc.length);
    expect(tinyArc.dashLength).toBeGreaterThan(0);
  });

  it('bütçe aşımında segmentleri kesmek yerine harcama toplamını ölçek yapar', () => {
    const geometry = buildDonutGeometry([80, 40], 600, 100);

    expect(geometry.scaleTotal).toBe(120);
    expect(geometry.arcs.reduce((sum, arc) => sum + arc.ratio, 0)).toBeCloseTo(1, 8);
  });
});
