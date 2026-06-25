// S.P.A.R.K. — Fiş ürünü görüntüleme adı (çeviri + orijinal)
//
// `turkish_name` alanı yanıltıcıdır: içeriği TARAMA ANINDAKİ aktif dile göre dolar
// (Gemini ürün adını seçili dile çevirir — bkz. geminiService.buildReceiptPrompt).
// `name` ise fişin üstündeki ORİJİNAL addır (ör. Lehçe).
//
// Tüm fiş ekranlarında TUTARLI gösterim için tek kaynak: çeviri birincil (primary),
// orijinal ad ikincil (secondary) satırda gösterilir. Çeviri yoksa ya da orijinalle
// aynıysa (ör. manuel eklenen kalemde name === turkish_name) tek satır döner.

export interface ItemDisplayName {
  /** Birincil ad — seçili dildeki çeviri (yoksa orijinal). */
  primary: string;
  /** İkincil ad — fişteki orijinal ad; çeviriyle aynıysa veya yoksa null. */
  secondary: string | null;
}

export function itemDisplayName(
  item: { name?: string | null; turkish_name?: string | null },
): ItemDisplayName {
  const translated = (item.turkish_name ?? '').trim();
  const original = (item.name ?? '').trim();

  if (
    translated &&
    original &&
    translated.toLocaleLowerCase() !== original.toLocaleLowerCase()
  ) {
    return { primary: translated, secondary: original };
  }

  return { primary: translated || original, secondary: null };
}
