// S.P.A.R.K. — Dil bağımsız arama/eşleştirme metni (BUG-11, BUG-14)
//
// SQLite `LOWER`/`LIKE` yalnız ASCII harflerde büyük/küçük farkını yok sayar;
// "ŞOK" ile "şok", "ŻABKA" ile "Żabka" eşleşmez. Bu katlama JS'te yapılır:
// küçük harfe çevirir ve Türkçe, Azerbaycan dili ve Lehçedeki aksanlı harfleri
// temel harfe indirir ("sok" → "ŞOK" bulunur). `String.prototype.normalize`
// her Hermes sürümünde garanti olmadığı için eşleme açıkça yazılmıştır.
const FOLD_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', ə: 'e',
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  â: 'a', î: 'i', û: 'u', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', ä: 'a', í: 'i', ú: 'u',
  ё: 'е',
};
const FOLD_PATTERN = new RegExp(`[${Object.keys(FOLD_MAP).join('')}]`, 'g');

/** Arama ve kopya tespiti için katlanmış metin; boşluklar tek boşluğa iner. */
export function foldSearchText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    // "İ".toLowerCase() → "i" + U+0307 (birleşen nokta); nokta atılır.
    .replace(/̇/g, '')
    .replace(FOLD_PATTERN, ch => FOLD_MAP[ch])
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alanlardan biri katlanmış sorguyu içeriyor mu? Boş sorgu her şeyle eşleşir. */
export function matchesSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const needle = foldSearchText(query);
  if (!needle) return true;
  return fields.some(field => foldSearchText(field).includes(needle));
}

/**
 * BUG-14: satıcı/kategori KİMLİĞİ için anahtar. Aramadan daha katı: yalnız
 * büyük/küçük harf ve boşluk farkını yok sayar ("ŞOK" = "Şok", "ŻABKA" = "Żabka",
 * "IŞIK" = "Işık"); aksanı silmez ("Şok" ≠ "Sok"), çünkü birleştirme geri alınamaz.
 * Türkçe noktasız ı, i ile eşlenir; "İ"nin küçük hâlindeki birleşen nokta atılır.
 */
export function nameIdentityKey(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/̇/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}
