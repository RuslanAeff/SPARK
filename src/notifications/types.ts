export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface InAppNotification {
  id: string;
  severity: NotificationSeverity;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string>;
  createdAt: number;
  read: boolean;
}

export type NotificationMuteChannel =
  | 'budget'
  | 'category_limit'
  | 'goal'
  | 'receipt'
  | 'system';

export interface RulesState {
  budget?: Record<string, { b80?: boolean; b100?: boolean; over?: boolean }>;
  cat?: Record<string, { near?: boolean; over?: boolean }>;
  goalRisk?: Record<string, boolean>;
  monthBudgetHint?: Record<string, boolean>;
  apiDismissed?: boolean;
  scanErrorDismissed?: boolean;
}
