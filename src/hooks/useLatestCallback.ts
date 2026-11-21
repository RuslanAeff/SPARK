// S.P.A.R.K. — Kimliği değişmeyen, her çağrıda en güncel fonksiyonu çalıştıran
// sarmalayıcı (UI denetimi CQ-01)
//
// Ekranlar "odaklanınca yükle" efektlerinde bileşen içinde tanımlı `loadX`
// fonksiyonlarını çağırır. Bu fonksiyonlar her çizimde yeniden oluşur:
//   • bağımlılık listesine yazılırsa efekt her çizimde yeniden çalışır;
//   • yazılmazsa hook kuralı uyarır ve efekt eski bir kopyayı tutabilir.
// Bu hook ikisini de çözer: döndürdüğü fonksiyonun kimliği hiç değişmez
// (bağımlılığa güvenle yazılır), çağrıldığında ise en son çizimdeki sürümü
// çalıştırır.
import { useCallback, useLayoutEffect, useRef } from 'react';

export function useLatestCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
