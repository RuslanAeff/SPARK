// S.P.A.R.K. — "En son istek kazanır" veri sorgusu iskeleti (UI denetimi CQ-06)
//
// Analiz ve Dashboard veri hook'larının altısı aynı iskeleti elle yazıyordu:
// sıra sayacı, "devre dışıysa sırayı artır" bloğu, her setState öncesi "hâlâ
// bağlı mı ve en son istek mi" koruması (16 kez). Burada bir kez yazılır ve
// test edilir.
//
// Kurallar:
//   • `enabled` false iken `refresh` sorgu başlatmaz; uçuştaki eski sorgunun
//     sonucu da yok sayılır ve `loading` false olur.
//   • Yalnız en son başlatılan sorgunun sonucu ve `loading` durumu yazılır;
//     geç biten eski sorgu yeni sonucu ezemez.
//   • `autoLoad` true iken `load` değiştikçe (ör. tarih aralığı) otomatik çalışır.
//   • `load` eşzamanlı bir değer döndürürse (ör. seçim yok → boş liste) sonuç
//     yükleniyor durumuna geçmeden doğrudan yazılır.
//   • Hata kaydedilir; `fallbackOnError` verilmişse onun değeri yazılır, yoksa
//     önceki veri korunur.
import { useCallback, useEffect, useRef, useState } from 'react';

import { logError } from '../utils/logError';

export interface LatestQueryOptions<T> {
  enabled?: boolean;
  autoLoad?: boolean;
  /** `logError` için kısa açıklama. */
  errorMessage: string;
  fallbackOnError?: () => T;
}

export interface LatestQueryResult<T> {
  data: T;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * @param load `useCallback` ile sabitlenmiş yükleyici; bağımlılıkları değişince
 *   yeni bir sorgu sayılır.
 * @param initial İlk değer (yalnız ilk render'da okunur).
 */
export function useLatestQuery<T>(
  load: () => T | Promise<T>,
  initial: T,
  { enabled = true, autoLoad = true, errorMessage, fallbackOnError }: LatestQueryOptions<T>,
): LatestQueryResult<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const sequenceRef = useRef(0);
  const fallbackRef = useRef(fallbackOnError);
  fallbackRef.current = fallbackOnError;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      sequenceRef.current += 1;
      setLoading(false);
    }
  }, [enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++sequenceRef.current;
    const isLatest = () => mountedRef.current && sequence === sequenceRef.current;
    try {
      const pending = load();
      if (!(pending instanceof Promise)) {
        if (isLatest()) {
          setData(pending);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const value = await pending;
      if (isLatest()) setData(value);
    } catch (e) {
      logError(errorMessage, e);
      const fallback = fallbackRef.current;
      if (fallback && isLatest()) setData(fallback());
    }
    if (isLatest()) setLoading(false);
  }, [load, enabled, errorMessage]);

  useEffect(() => {
    if (enabled && autoLoad) void refresh();
  }, [refresh, enabled, autoLoad]);

  return { data, loading, refresh };
}
