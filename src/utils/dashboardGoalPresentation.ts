import type { SavingsGoalRow } from '../db/goalDao';

type Input = {
  goal: SavingsGoalRow | null;
  featureEnabled: boolean;
  focusEnabled: boolean;
  ready: boolean;
};

export interface DashboardGoalPresentation {
  showPulse: boolean;
  showFull: boolean;
  showPlaceholder: boolean;
}

/** Dashboard'da hedefin tek bir varyantla ve yükleme sıçraması olmadan gösterimi. */
export function getDashboardGoalPresentation({
  goal,
  featureEnabled,
  focusEnabled,
  ready,
}: Input): DashboardGoalPresentation {
  if (!ready || !featureEnabled) {
    return { showPulse: false, showFull: false, showPlaceholder: false };
  }

  if (!goal) {
    return { showPulse: false, showFull: false, showPlaceholder: true };
  }

  const target = Number(goal.target_amount);
  const current = Math.max(0, Number(goal.current_amount) || 0);
  const isActiveIncomplete = Number.isFinite(target) && target > 0 && current < target;
  const showPulse = focusEnabled && isActiveIncomplete;

  return {
    showPulse,
    showFull: !showPulse,
    showPlaceholder: false,
  };
}
