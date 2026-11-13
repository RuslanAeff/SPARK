// Kategori ikon/renk doğrulaması (SEC-09). Yedekten veya ekrandan gelen değer
// yalnız uzunluk sınırından geçiyordu; renk doğrudan stile ve `color + '22'`
// gibi birleştirmelere, ikon ise ikon bileşenine giriyor. Bozuk değer reddedilmez,
// güvenli varsayılana döner — tek bozuk satır yedeği kullanılamaz yapmasın.
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

export const DEFAULT_CATEGORY_ICON = 'tag-outline';
export const DEFAULT_CATEGORY_COLOR = '#7C6BFF';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function safeCategoryColor(value: unknown): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : DEFAULT_CATEGORY_COLOR;
}

export function safeCategoryIcon(value: unknown): string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(glyphMap, value)
    ? value
    : DEFAULT_CATEGORY_ICON;
}
