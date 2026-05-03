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
  | 'system'
  | 'subscription'
  | 'backup';

export interface RulesState {
  budget?: Record<string, { b80?: boolean; b100?: boolean; over?: boolean }>;
  cat?: Record<string, { near?: boolean; over?: boolean }>;
  goalRisk?: Record<string, boolean>;
  monthBudgetHint?: Record<string, boolean>;
  apiDismissed?: boolean;
  scanErrorDismissed?: boolean;
  /** Aylık özet bildiriminin (önceki ay için) gönderilip gönderilmediğini takip eder. */
  monthSummary?: Record<string, boolean>;
  /** Yedek hatırlatması için: en son ne zaman gösterildi (timestamp ms). */
  backupRemindedAt?: number;
  /** Abonelik yaklaşan ödeme bildirimi: vendor_id'ye göre son tetikleme tarihi (YYYY-MM-DD). */
  subscriptionDueLast?: Record<string, string>;
}
