// S.P.A.R.K. — Ana ekranda birikim hedefi görünürlüğü ve odak tercihi
import { SettingsDao } from '../db/settingsDao';
import { SETTINGS_KEYS } from '../db/settingsKeys';

const FEATURE_KEY = SETTINGS_KEYS.goalFeatureEnabled;
const DASHBOARD_FOCUS_KEY = SETTINGS_KEYS.goalDashboardFocusEnabled;

export interface GoalFeaturePreferences {
  enabled: boolean;
  dashboardFocusEnabled: boolean;
}

const DEFAULT_PREFERENCES: GoalFeaturePreferences = {
  enabled: true,
  dashboardFocusEnabled: false,
};

/** İki ilişkili tercihi aynı SQLite sorgusunda ve güvenli varsayılanlarla okur. */
export async function getGoalFeaturePreferences(): Promise<GoalFeaturePreferences> {
  try {
    const values = await SettingsDao.getMany([FEATURE_KEY, DASHBOARD_FOCUS_KEY]);
    return {
      enabled: values.get(FEATURE_KEY) !== '0',
      dashboardFocusEnabled: values.get(DASHBOARD_FOCUS_KEY) === '1',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function setGoalFeatureEnabled(enabled: boolean): Promise<void> {
  await SettingsDao.set(FEATURE_KEY, enabled ? '1' : '0');
}

export async function setGoalDashboardFocusEnabled(enabled: boolean): Promise<void> {
  await SettingsDao.set(DASHBOARD_FOCUS_KEY, enabled ? '1' : '0');
}
