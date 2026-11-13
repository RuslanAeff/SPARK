import { foldSearchText, matchesSearch, nameIdentityKey } from '../searchText';

describe('foldSearchText (BUG-11/14)', () => {
  it('Türkçe, Azerbaycan ve Lehçe harfleri büyük/küçük ve aksandan bağımsız eşler', () => {
    expect(foldSearchText('ŞOK Market')).toBe('sok market');
    expect(foldSearchText('İSTANBUL ıhlamur')).toBe('istanbul ihlamur');
    expect(foldSearchText('ŻABKA')).toBe(foldSearchText('Żabka'));
    expect(foldSearchText('Łódź')).toBe('lodz');
    expect(foldSearchText('Əlavə')).toBe('elave');
    expect(foldSearchText('ПЯТЁРОЧКА')).toBe('пятерочка');
    expect(foldSearchText('  çok   boşluk ')).toBe('cok bosluk');
    expect(foldSearchText(null)).toBe('');
  });

  it('matchesSearch alanlardan herhangi birinde arar', () => {
    expect(matchesSearch(['Biedronka', null, 'süt aldım'], 'SUT')).toBe(true);
    expect(matchesSearch(['Biedronka', 'Market'], 'lidl')).toBe(false);
    expect(matchesSearch([null], '   ')).toBe(true);
  });
});

describe('nameIdentityKey (BUG-14)', () => {
  it('büyük/küçük harf ve boşluk farkını yok sayar, aksanı korur', () => {
    expect(nameIdentityKey('ŞOK')).toBe(nameIdentityKey('Şok'));
    expect(nameIdentityKey('ŻABKA')).toBe(nameIdentityKey(' żabka '));
    expect(nameIdentityKey('IŞIK')).toBe(nameIdentityKey('Işık'));
    expect(nameIdentityKey('İSTANBUL')).toBe(nameIdentityKey('istanbul'));
    expect(nameIdentityKey('Lidl  Sp. z o.o.')).toBe('lidl sp. z o.o.');
    expect(nameIdentityKey('Şok')).not.toBe(nameIdentityKey('Sok'));
  });
});
