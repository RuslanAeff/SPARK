import {
  getCycleForYmd,
  getCurrentCycle,
  getCycleForKey,
  getCycleProgress,
  shiftCycleKey,
  normalizeCycleStartDay,
} from '../budgetCycle';

describe('normalizeCycleStartDay', () => {
  it('1–31 aralığına kıstırır', () => {
    expect(normalizeCycleStartDay(0)).toBe(1);
    expect(normalizeCycleStartDay(40)).toBe(31);
    expect(normalizeCycleStartDay(23)).toBe(23);
  });
  it('geçersiz girdide varsayılan (1)', () => {
    expect(normalizeCycleStartDay('abc')).toBe(1);
    expect(normalizeCycleStartDay(undefined)).toBe(1);
    expect(normalizeCycleStartDay(NaN)).toBe(1);
  });
  it('string sayıyı çözer', () => {
    expect(normalizeCycleStartDay('23')).toBe(23);
  });
});

describe('anchor = 1 → takvim ayına BİREBİR eşit (geriye dönük garanti)', () => {
  it('Mayıs 2026 döngüsü = takvim ayı', () => {
    const c = getCurrentCycle(1, new Date(2026, 4, 15));
    expect(c.start).toBe('2026-05-01');
    expect(c.end).toBe('2026-05-31');
    expect(c.key).toBe('2026-05');
    expect(c.totalDays).toBe(31);
  });
  it('Şubat 2026 (normal) son gün 28', () => {
    expect(getCurrentCycle(1, new Date(2026, 1, 10)).end).toBe('2026-02-28');
  });
  it('Şubat 2024 (artık) son gün 29', () => {
    expect(getCurrentCycle(1, new Date(2024, 1, 10)).end).toBe('2024-02-29');
  });
  it('Aralık → yıl sınırı', () => {
    const c = getCurrentCycle(1, new Date(2026, 11, 31));
    expect(c.start).toBe('2026-12-01');
    expect(c.end).toBe('2026-12-31');
  });
});

describe("anchor = 23 (kullanıcı senaryosu — ayın 23'ü gelir günü)", () => {
  it('23 Mayıs → döngü 23 May–22 Haz', () => {
    const c = getCurrentCycle(23, new Date(2026, 4, 23));
    expect(c.start).toBe('2026-05-23');
    expect(c.end).toBe('2026-06-22');
    expect(c.key).toBe('2026-05');
    expect(c.totalDays).toBe(31);
  });
  it('24 Mayıs → hâlâ aynı (yeni) döngü', () => {
    const c = getCurrentCycle(23, new Date(2026, 4, 24));
    expect(c.start).toBe('2026-05-23');
    expect(c.key).toBe('2026-05');
  });
  it('22 Mayıs → önceki döngü (23 Nis–22 May)', () => {
    const c = getCurrentCycle(23, new Date(2026, 4, 22));
    expect(c.start).toBe('2026-04-23');
    expect(c.end).toBe('2026-05-22');
    expect(c.key).toBe('2026-04');
  });
  it('10 Ocak → döngü önceki yılın Aralık 23ünde başlar', () => {
    const c = getCurrentCycle(23, new Date(2026, 0, 10));
    expect(c.start).toBe('2025-12-23');
    expect(c.end).toBe('2026-01-22');
    expect(c.key).toBe('2025-12');
  });
});

describe('clamp — anchor kısa aya denk gelince ay sonuna çekilir', () => {
  it('anchor = 31, Şubat 2026 → 28e çekilir, zincir boşluksuz', () => {
    // Ocakta başlayan döngü Şubat 27de biter; Şubat 28de yeni döngü başlar.
    const janCycle = getCycleForYmd(31, 2026, 1, 15); // 15 Şubat referans
    expect(janCycle.start).toBe('2026-01-31');
    expect(janCycle.end).toBe('2026-02-27');

    const febCycle = getCycleForYmd(31, 2026, 1, 28); // 28 Şubat referans
    expect(febCycle.start).toBe('2026-02-28');
    expect(febCycle.end).toBe('2026-03-30');
  });
  it('anchor = 30, Şubat → 28e çekilir', () => {
    const c = getCycleForYmd(30, 2026, 1, 1); // 1 Şubat
    expect(c.start).toBe('2026-01-30');
    expect(c.end).toBe('2026-02-27');
  });
});

describe('getCycleForKey — anahtardan döngüyü geri kurar', () => {
  it('güncel döngünün anahtarı aynı döngüyü verir (round-trip)', () => {
    const cur = getCurrentCycle(23, new Date(2026, 4, 24));
    const byKey = getCycleForKey(23, cur.key);
    expect(byKey.start).toBe(cur.start);
    expect(byKey.end).toBe(cur.end);
    expect(byKey.key).toBe(cur.key);
  });
  it('anchor=1 anahtar = takvim ayı', () => {
    const c = getCycleForKey(1, '2026-05');
    expect(c.start).toBe('2026-05-01');
    expect(c.end).toBe('2026-05-31');
  });
});

describe('shiftCycleKey', () => {
  it('ay bazında kaydırır, yıl sınırını aşar', () => {
    expect(shiftCycleKey('2026-05', -1)).toBe('2026-04');
    expect(shiftCycleKey('2026-01', -1)).toBe('2025-12');
    expect(shiftCycleKey('2026-12', 1)).toBe('2027-01');
  });
});

describe('getCycleProgress — geçen/kalan gün', () => {
  it('anchor=1, 24 Mayıs → eski davranışla aynı (kalan 7)', () => {
    const c = getCurrentCycle(1, new Date(2026, 4, 24));
    const p = getCycleProgress(c, new Date(2026, 4, 24));
    expect(p.dayOfCycle).toBe(24);
    expect(p.daysRemaining).toBe(7); // 31 - 24
  });
  it('anchor=23, 24 Mayıs → yeni para günü: kalan 29 (eskiden 7 görünürdü)', () => {
    const c = getCurrentCycle(23, new Date(2026, 4, 24));
    const p = getCycleProgress(c, new Date(2026, 4, 24));
    expect(p.dayOfCycle).toBe(2);
    expect(p.daysRemaining).toBe(29);
  });
  it('döngünün son günü → kalan 0', () => {
    const c = getCurrentCycle(23, new Date(2026, 5, 22));
    const p = getCycleProgress(c, new Date(2026, 5, 22));
    expect(p.daysRemaining).toBe(0);
  });
});
