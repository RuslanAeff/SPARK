import { formatMonthYear } from '../utils/dateUtils';
import type { InAppNotification } from './types';

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Bildirim şablonlarındaki ham domain parametrelerini hem uygulama içi kartta
 * hem de Android panelinde aynı okunabilir sunuma dönüştürür.
 */
export function localizeNotificationParams(
  params: Record<string, string | number> | undefined,
  t: Translate,
): Record<string, string | number> | undefined {
  if (params && typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month)) {
    return { ...params, month: formatMonthYear(`${params.month}-01`, t) };
  }
  return params;
}

/** Native hazırlık beklerken aynı kimliğin metni değişirse eski snapshot'ı tanır. */
export function notificationPresentationRevision(
  item: Pick<
    InAppNotification,
    'titleKey' | 'bodyKey' | 'params' | 'severity' | 'createdAt'
  >,
): string {
  const params = Object.entries(item.params ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const canonical = JSON.stringify([
    item.titleKey,
    item.bodyKey,
    item.severity,
    item.createdAt,
    params,
  ]);
  const hash = (seed: number) => {
    let value = seed >>> 0;
    for (let index = 0; index < canonical.length; index += 1) {
      value ^= canonical.charCodeAt(index);
      value = Math.imul(value, 16_777_619) >>> 0;
    }
    return value.toString(36);
  };
  // Revision transportta ham satıcı/hata parametresi taşımaz; iki bağımsız
  // 32-bit özet, yanlış metin snapshot'ını ayırmak için yeterli çakışma payı verir.
  return `v1-${hash(2_166_136_261)}-${hash(3_332_666_473)}`;
}
