import { SavingsGoalRow } from '../../db/goalDao';
import { getDashboardGoalPresentation } from '../dashboardGoalPresentation';

const goal = (currentAmount: number): SavingsGoalRow => ({
  id: 1,
  title: 'New laptop',
  target_amount: 1000,
  target_date: '2026-12-31',
  currency: 'PLN',
  current_amount: currentAmount,
});

const hidden = { showPulse: false, showFull: false, showPlaceholder: false };

describe('getDashboardGoalPresentation', () => {
  it('renders nothing until all persisted state is ready', () => {
    expect(getDashboardGoalPresentation({
      goal: goal(250),
      featureEnabled: true,
      focusEnabled: true,
      ready: false,
    })).toEqual(hidden);
  });

  it('renders nothing when the goal feature is disabled', () => {
    expect(getDashboardGoalPresentation({
      goal: goal(250),
      featureEnabled: false,
      focusEnabled: true,
      ready: true,
    })).toEqual(hidden);
  });

  it('shows only the setup placeholder when no goal exists', () => {
    expect(getDashboardGoalPresentation({
      goal: null,
      featureEnabled: true,
      focusEnabled: true,
      ready: true,
    })).toEqual({ showPulse: false, showFull: false, showPlaceholder: true });
  });

  it('shows the full goal card when focus is off', () => {
    expect(getDashboardGoalPresentation({
      goal: goal(250),
      featureEnabled: true,
      focusEnabled: false,
      ready: true,
    })).toEqual({ showPulse: false, showFull: true, showPlaceholder: false });
  });

  it('shows only the pulse card for a focused incomplete goal', () => {
    expect(getDashboardGoalPresentation({
      goal: goal(250),
      featureEnabled: true,
      focusEnabled: true,
      ready: true,
    })).toEqual({ showPulse: true, showFull: false, showPlaceholder: false });
  });

  it('falls back to the full completion card after the target is reached', () => {
    expect(getDashboardGoalPresentation({
      goal: goal(1000),
      featureEnabled: true,
      focusEnabled: true,
      ready: true,
    })).toEqual({ showPulse: false, showFull: true, showPlaceholder: false });
  });
});
