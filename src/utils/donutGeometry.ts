// S.P.A.R.K. — Donut geometry (pure, testable)

export interface DonutArcGeometry {
  ratio: number;
  length: number;
  gap: number;
  offset: number;
  dashLength: number;
}
export interface DonutGeometry {
  scaleTotal: number;
  arcs: DonutArcGeometry[];
}

/**
 * Segmentleri isteğe bağlı bir dış paydaya (örn. etkin bütçe) yerleştirir.
 * Payda segmentlerden küçükse kesme yapmaz; bütçe aşımı tam halka olarak kalır.
 */
export function buildDonutGeometry(
  values: number[],
  circumference: number,
  totalValue?: number,
): DonutGeometry {
  const safeValues = values.map(value => Number.isFinite(value) ? Math.max(0, value) : 0);
  const segmentTotal = safeValues.reduce((sum, value) => sum + value, 0);
  const safeTotalValue = Number.isFinite(totalValue) ? Math.max(0, totalValue ?? 0) : 0;
  const scaleTotal = Math.max(segmentTotal, safeTotalValue);
  let accumulated = 0;

  const arcs = safeValues.map(value => {
    const ratio = scaleTotal > 0 ? value / scaleTotal : 0;
    const length = ratio * Math.max(0, circumference);
    const gap = safeValues.length > 1 ? Math.min(4, length * 0.35) : 0;
    const offset = accumulated;
    accumulated += length;
    return {
      ratio,
      length,
      gap,
      offset,
      dashLength: Math.max(0, length - gap),
    };
  });

  return { scaleTotal, arcs };
}
