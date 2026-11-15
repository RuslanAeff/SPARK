// S.P.A.R.K. — "İhtiyaç / İstek" ayrımı (BUG-16)
//
// Sınıflandırma dil bağımsız anahtar döndürür (`needs | wants | other`); etiket
// arayüzde kullanıcının dilinde üretilir. Sistem kategorileri veritabanında
// kanonik (Türkçe) adlarıyla tutulur ve yeniden adlandırılamaz; bu yüzden eşleme
// yalnız `is_system = 1` kök kategorinin kanonik adına bakar. Alt kategori (sistem
// ya da kullanıcının eklediği) kökünün grubunu alır. Kullanıcının eklediği kök
// kategori, adı ne olursa olsun "diğer"dir: aynı adlı başka dilde bir kök kazara
// zorunlu sayılmaz.
export type SpendSegment = 'needs' | 'wants' | 'other';

export const SPEND_SEGMENTS: readonly SpendSegment[] = ['needs', 'wants', 'other'];

/** Sistem kök kategorilerinin grubu; `DEFAULT_CATEGORIES` ile birebir (test korur). */
export const SYSTEM_ROOT_SEGMENTS: Readonly<Record<string, SpendSegment>> = {
  'Yeme-İçme': 'needs',
  'Ulaşım': 'needs',
  'Faturalar': 'needs',
  'Sağlık': 'needs',
  'Eğitim': 'needs',
  'Konut': 'needs',
  'Alışveriş': 'wants',
  'Eğlence': 'wants',
  'Finans': 'other',
  'Diğer': 'other',
};

export function systemRootsFor(segment: SpendSegment): string[] {
  return Object.keys(SYSTEM_ROOT_SEGMENTS).filter(name => SYSTEM_ROOT_SEGMENTS[name] === segment);
}

export function isSpendSegment(value: unknown): value is SpendSegment {
  return value === 'needs' || value === 'wants' || value === 'other';
}

export const SPEND_SEGMENT_LABEL_KEY: Readonly<Record<SpendSegment, string>> = {
  needs: 'needs',
  wants: 'wants',
  other: 'savings_other',
};

export const SPEND_SEGMENT_COLOR: Readonly<Record<SpendSegment, string>> = {
  needs: '#FF6B6B',
  wants: '#4ECDC4',
  other: '#FFE66D',
};

/** Hafta içi/sonu dil bağımsız anahtarı (UI denetimi FN-07). */
export type DayTypeSegment = 'weekday' | 'weekend';

export function isDayTypeSegment(value: unknown): value is DayTypeSegment {
  return value === 'weekday' || value === 'weekend';
}

/** Çeviri anahtarı segment anahtarıyla aynıdır. */
export const DAY_TYPE_SEGMENT_LABEL_KEY: Readonly<Record<DayTypeSegment, string>> = {
  weekday: 'weekday',
  weekend: 'weekend',
};

export const DAY_TYPE_SEGMENT_COLOR: Readonly<Record<DayTypeSegment, string>> = {
  weekday: '#2EC4B6',
  weekend: '#FF9F1C',
};
