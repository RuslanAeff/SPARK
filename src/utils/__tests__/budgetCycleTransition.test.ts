import { previewBudgetCycleTransition } from '../budgetCycleTransition';

describe('budget cycle transition preview', () => {
  it('keeps the current period and creates a bridge when 23 changes to 21', () => {
    const result = previewBudgetCycleTransition('2026-07-23', '2026-08-22', 21);
    expect(result.preserved).toEqual({ start: '2026-07-23', end: '2026-08-22' });
    expect(result.bridge).toMatchObject({ start: '2026-08-23', end: '2026-09-20' });
    expect(result.firstRegular).toMatchObject({ start: '2026-09-21', end: '2026-10-20' });
  });

  it('does not invent a bridge when the next period already starts on the following day', () => {
    const result = previewBudgetCycleTransition('2026-07-23', '2026-08-22', 23);
    expect(result.bridge).toBeNull();
    expect(result.firstRegular).toMatchObject({ start: '2026-08-23', end: '2026-09-22' });
  });

  it('handles a later anchor with a short bridge and month-end clamping', () => {
    const later = previewBudgetCycleTransition('2026-07-23', '2026-08-22', 25);
    expect(later.bridge).toMatchObject({ start: '2026-08-23', end: '2026-08-24' });
    expect(later.firstRegular.start).toBe('2026-08-25');

    const clamped = previewBudgetCycleTransition('2027-01-31', '2027-02-27', 31);
    expect(clamped.firstRegular.start).toBe('2027-02-28');
    expect(clamped.firstRegular.end).toBe('2027-03-30');
  });
});
