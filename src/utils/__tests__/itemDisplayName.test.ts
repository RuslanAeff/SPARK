import { itemDisplayName } from '../itemDisplayName';

describe('itemDisplayName', () => {
  it('kullanıcı etiketini öne çıkarırken özgün fiş adını korur', () => {
    expect(itemDisplayName({
      name: 'SKRZYDELKA KURCZAKA',
      turkish_name: 'Tavuk Kanadı',
      user_label: 'Tavuk Kanat',
    })).toEqual({
      primary: 'Tavuk Kanat',
      secondary: 'SKRZYDELKA KURCZAKA',
    });
  });

  it('çeviri orijinalden farklıysa iki satır döner', () => {
    expect(
      itemDisplayName({ name: 'Coca-Cola Zero 1.75L', turkish_name: 'Coca-Cola Zero İçecek 1.75L' }),
    ).toEqual({ primary: 'Coca-Cola Zero İçecek 1.75L', secondary: 'Coca-Cola Zero 1.75L' });
  });

  it('çeviri yoksa orijinali birincil, ikincil null', () => {
    expect(itemDisplayName({ name: 'Mleko 2%', turkish_name: undefined })).toEqual({
      primary: 'Mleko 2%',
      secondary: null,
    });
    expect(itemDisplayName({ name: 'Mleko 2%', turkish_name: '' })).toEqual({
      primary: 'Mleko 2%',
      secondary: null,
    });
  });

  it('çeviri orijinalle aynıysa (büyük/küçük + boşluk farkı dahil) tek satır', () => {
    expect(itemDisplayName({ name: 'Ekmek', turkish_name: 'ekmek' })).toEqual({
      primary: 'ekmek',
      secondary: null,
    });
    expect(itemDisplayName({ name: '  Süt  ', turkish_name: 'Süt' })).toEqual({
      primary: 'Süt',
      secondary: null,
    });
  });

  it('orijinal yoksa çeviriyi birincil döner', () => {
    expect(itemDisplayName({ name: null, turkish_name: 'Kalem' })).toEqual({
      primary: 'Kalem',
      secondary: null,
    });
  });

  it('ikisi de boşsa boş birincil döner', () => {
    expect(itemDisplayName({ name: null, turkish_name: null })).toEqual({
      primary: '',
      secondary: null,
    });
  });
});
