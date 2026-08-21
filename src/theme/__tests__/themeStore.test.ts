import {
  getAppThemeSnapshot,
  getAppThemeStateSnapshot,
  setAppThemeAccent,
  setAppThemeSelection,
} from '../themeStore';

describe('themeStore atomic snapshot', () => {
  beforeEach(() => {
    setAppThemeSelection({ scheme: 'light', accent: 'green' });
  });

  it('changes accent without changing the selected scheme', () => {
    const before = getAppThemeStateSnapshot();

    setAppThemeAccent('purple');
    const after = getAppThemeStateSnapshot();

    expect(getAppThemeSnapshot()).toBe('light');
    expect(after.scheme).toBe(before.scheme);
    expect(after.accent).toBe('purple');
    expect(after.palette.primary).not.toBe(before.palette.primary);
    expect(after.revision).toBe(before.revision + 1);
  });

  it('publishes scheme, accent and resolved palette in one immutable snapshot', () => {
    const before = getAppThemeStateSnapshot();
    setAppThemeSelection({ scheme: 'dark', accent: 'red' });
    const after = getAppThemeStateSnapshot();

    expect(after).not.toBe(before);
    expect(after).toMatchObject({ scheme: 'dark', accent: 'red' });
    expect(after.palette.primary).toBe('#FF727B');
    expect(after.revision).toBe(before.revision + 1);
    expect(Object.isFrozen(after)).toBe(true);
  });

  it('does not publish a revision for an identical selection', () => {
    const before = getAppThemeStateSnapshot();
    setAppThemeSelection({ scheme: 'light', accent: 'green' });
    expect(getAppThemeStateSnapshot()).toBe(before);
  });
});
