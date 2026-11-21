// S.P.A.R.K. — Temaya bağlı stil üretimi için tek ortak hook (UI denetimi CQ-01)
//
// Stiller `Colors` proxy'sinden okunur; proxy o anki tema anlık görüntüsünü
// (görünüm şeması + vurgu rengi) döndürür. Bu yüzden stil nesnesi tema veya
// vurgu değişince yeniden üretilmelidir. Eskiden her bileşen bunu elle
// yazıyordu: `useMemo(() => getStyles(), [scheme, themeRevision])`.
//   • Hook kuralı (`exhaustive-deps`) `Colors` okumasını göremediği için bu
//     satırların hepsini "gereksiz bağımlılık" sanıyordu (54 yanlış alarm);
//     kural bu yüzden yalnız uyarı olarak tutuluyordu.
//   • Bazı bileşenler yalnız `[scheme]` yazmıştı; vurgu rengi değişince
//     stilleri eski renkte kalabiliyordu.
// Tema izleme artık yalnız burada, bir kez ve doğru yazılır.
import { useMemo } from 'react';

import { useAppTheme, useThemeRevision } from './themeStore';

/**
 * @param factory Modül düzeyinde tanımlı stil fabrikası (ör. `getStyles`).
 * @param args Fabrikanın ek girdileri (ör. pencere yüksekliği); değişince
 *   stiller yeniden üretilir.
 */
export function useThemedStyles<T, A extends unknown[]>(
  factory: (...args: A) => T,
  ...args: A
): T {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  // Bilinçli tek istisna: tema bağımlılıkları (`scheme`, `revision`) fabrikanın
  // okuduğu `Colors` proxy'sini temsil eder ve `args` çağrı yerinde sabit
  // uzunluktadır. Kural ikisini de statik olarak göremez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(...args), [scheme, revision, factory, ...args]);
}
