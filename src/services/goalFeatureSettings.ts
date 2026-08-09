// S.P.A.R.K. — Ana ekranda birikim hedefi görünürlüğü ve odak tercihi
import { getDatabase } from '../db/database';

const FEATURE_KEY = 'goal_feature_enabled';
const DASHBOARD_FOCUS_KEY = 'goal_dashboard_focus_enabled';

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
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM settings WHERE key IN (?, ?)',
      [FEATURE_KEY, DASHBOARD_FOCUS_KEY],
    );
    const values = new Map(rows.map(row => [row.key, row.value]));
    return {
      enabled: values.get(FEATURE_KEY) !== '0',
      dashboardFocusEnabled: values.get(DASHBOARD_FOCUS_KEY) === '1',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function getGoalFeatureEnabled(): Promise<boolean> {
  return (await getGoalFeaturePreferences()).enabled;
}

export async function setGoalFeatureEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [
    FEATURE_KEY,
    enabled ? '1' : '0',
  ]);
}

export async function setGoalDashboardFocusEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [
    DASHBOARD_FOCUS_KEY,
    enabled ? '1' : '0',
  ]);
}
