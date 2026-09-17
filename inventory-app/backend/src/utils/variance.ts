export interface VarianceResult {
  systemQty: number;
  countedQty: number;
  varianceQty: number;
  variancePct: number; // signed, e.g. -12.5 means 12.5% short
  flaggedForRecount: boolean;
}

/**
 * Computes the variance between the system (theoretical) quantity and what
 * was actually counted, and decides whether it crosses the recount threshold.
 *
 * The threshold can come from three places, in priority order:
 *   1. The item's own recountTolerancePct override
 *   2. The task's generalRecountTolerancePct
 *   3. A hard-coded fallback (10%) if neither admin setting is present
 */
export function computeVariance(
  systemQty: number,
  countedQty: number,
  itemTolerancePct: number | null | undefined,
  taskTolerancePct: number | null | undefined
): VarianceResult {
  const varianceQty = countedQty - systemQty;
  const variancePct = systemQty === 0 ? (countedQty === 0 ? 0 : 100) : (varianceQty / systemQty) * 100;

  const tolerance = itemTolerancePct ?? taskTolerancePct ?? 10;
  const flaggedForRecount = Math.abs(variancePct) > tolerance;

  return { systemQty, countedQty, varianceQty, variancePct, flaggedForRecount };
}
