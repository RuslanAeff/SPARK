// S.P.A.R.K. — Tipli ikon adı (UI denetimi CQ-08)
//
// Kategori ve satıcı ikonları veritabanından metin olarak gelir; 21 yerde
// `icon as any` ile ikona veriliyordu. Geçersiz/eski bir ad boş kare
// çizdiriyordu. `toIconName` adı ikon haritasında doğrular, yoksa yedeğe düşer.
import type React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const DEFAULT_ICON_NAME: IconName = 'tag-outline';

export function toIconName(value: string | null | undefined, fallback: IconName = DEFAULT_ICON_NAME): IconName {
  if (!value) return fallback;
  const glyphMap = (MaterialCommunityIcons as { glyphMap?: Record<string, number> }).glyphMap;
  // Harita yoksa (test taklitleri) adı olduğu gibi geçir.
  if (!glyphMap) return value as IconName;
  return Object.prototype.hasOwnProperty.call(glyphMap, value) ? (value as IconName) : fallback;
}
