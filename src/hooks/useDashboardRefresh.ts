// S.P.A.R.K. — Dashboard yenileme düzeni (UI denetimi FN-03)
//
// Eskiden Dashboard'daki veri hook'ları her biri kendi effect'inde hemen
// sorgu atıyor (eşzamanlı ilk dalga), aynı anda odak efekti `refreshAll` ile
// hepsini seri kuyrukta bir kez daha çalıştırıyordu; dönem her değiştiğinde bu
// çift dalga tekrarlanıyordu. Artık tek yükleme yolu bu hook'tur:
//   • veri hook'ları `autoLoad: false` ile çağrılır;
//   • bütçe dönemi çözülmeden (periodReady=false) veri sorgusu atılmaz —
//     takvim ayı varsayımıyla boşa sorgu yapılmaz;
//   • ilk veri turunda bütçe yeniden okunmaz (useBudget onu az önce yükledi);
//     sonraki odak/çekip yenileme/veri değişikliği turları bütçeyi de tazeler;
//   • tüm adımlar ADR-002 gereği tek kuyrukta sırayla çalışır.
import { useCallback, useRef } from 'react';
import { createSerialQueue, runSequentially } from '../utils/serialQueue';
import { logError } from '../utils/logError';

type Step = () => unknown;

export function useDashboardRefresh({
  periodReady,
  refreshBudget,
  dataSteps,
}: {
  periodReady: boolean;
  refreshBudget: Step;
  /** Referans olarak kararlı tutulmalı (useMemo). */
  dataSteps: ReadonlyArray<Step>;
}): () => Promise<void> {
  const queueRef = useRef(createSerialQueue());
  const firstDataWaveDoneRef = useRef(false);

  return useCallback(() => queueRef.current(async () => {
    if (!periodReady) return;
    const steps = firstDataWaveDoneRef.current ? [refreshBudget, ...dataSteps] : dataSteps;
    firstDataWaveDoneRef.current = true;
    await runSequentially(steps, (error) => { logError('dashboard refresh step failed', error); });
  }), [periodReady, refreshBudget, dataSteps]);
}
