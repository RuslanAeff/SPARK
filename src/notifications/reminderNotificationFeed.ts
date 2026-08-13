import type { InAppNotification } from './types';
import type {
  ReminderNotificationCandidate,
  ReminderNotificationKind,
} from './reminderNotificationRules';
import { mergeFeedItem } from './storage';

export interface ReminderFeedEntity {
  entityKey: string;
  kind: ReminderNotificationKind;
  /** Ayar değişince eski türevi ayırt eden, aşama hariç ID öneki. */
  familyPrefix: string;
  /** Vade + tercih değişimini state üzerinde de ayıran token öneki. */
  tokenPrefix: string;
  active: boolean;
}

export interface ReminderFeedCandidate {
  candidate: ReminderNotificationCandidate;
  notification: Omit<InAppNotification, 'read'>;
}

export interface ReminderFeedState {
  debtDueLast: Record<string, string>;
  debtDueDismissed: Record<string, string>;
  paymentPlanDueLast: Record<string, string>;
  paymentPlanDueDismissed: Record<string, string>;
}

interface ReconcileInput {
  feed: InAppNotification[];
  entities: readonly ReminderFeedEntity[];
  candidates: readonly ReminderFeedCandidate[];
  state: ReminderFeedState;
  muted: Partial<Record<'debt' | 'recurring_payment', boolean>>;
}

export interface ReminderFeedReconcileResult {
  feed: InAppNotification[];
  state: ReminderFeedState;
  retiredIds: string[];
}

const DEBT_ID = /^debt-due-v1-(\d+)-/;
const PLAN_ID = /^payplan-due-v1-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-/i;
const DEBT_FAMILY = /^debt-due-v1-(\d+)-(\d{4}-\d{2}-\d{2})-(\d{1,3})-(\d{2})(\d{2})-(?:upcoming|today|overdue)$/;
const PLAN_FAMILY = /^payplan-due-v1-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(\d{4}-\d{2}-\d{2})-(\d{1,3})-(\d{2})(\d{2})-(?:upcoming|today|overdue)$/i;

/** Eski native aşama kimliğini de aynı kanonik borç/plan ailesine bağlar. */
export function reminderEntityKeyFromNotificationId(id: string): string | null {
  const debt = id.match(DEBT_ID);
  if (debt) return `debt:${debt[1]}`;
  const plan = id.match(PLAN_ID);
  if (plan) return `recurring:${plan[1].toLowerCase()}`;
  return null;
}

/** Aşama yükselse bile aynı vade/lead/saat alarmını kararlı biçimde tanır. */
export function reminderNotificationFamilyKeyFromId(id: string): string | null {
  const debt = id.match(DEBT_FAMILY);
  if (debt) {
    return `debt:${debt[1]}:${debt[2]}:${Number(debt[3])}:${debt[4]}${debt[5]}`;
  }
  const plan = id.match(PLAN_FAMILY);
  if (plan) {
    return `recurring:${plan[1].toLowerCase()}:${plan[2]}:${Number(plan[3])}:${plan[4]}${plan[5]}`;
  }
  return null;
}

function stateRecord(
  state: ReminderFeedState,
  kind: ReminderNotificationKind,
): Record<string, string> {
  return kind === 'debt' ? state.debtDueLast : state.paymentPlanDueLast;
}

function dismissedRecord(
  state: ReminderFeedState,
  kind: ReminderNotificationKind,
): Record<string, string> {
  return kind === 'debt' ? state.debtDueDismissed : state.paymentPlanDueDismissed;
}

function stateKey(entityKey: string): string {
  return entityKey.slice(entityKey.indexOf(':') + 1);
}

function canonicalUpsert(
  feed: InAppNotification[],
  value: Omit<InAppNotification, 'read'>,
): InAppNotification[] {
  const index = feed.findIndex((item) => item.id === value.id);
  if (index < 0) return mergeFeedItem(feed, value);
  const existing = feed[index];
  const next = [...feed];
  next[index] = {
    ...value,
    createdAt: existing.createdAt,
    read: existing.read,
  };
  return next;
}

function canonicalContentSignature(
  value: Pick<InAppNotification, 'severity' | 'titleKey' | 'bodyKey' | 'params'>,
): string {
  return JSON.stringify([
    value.severity,
    value.titleKey,
    value.bodyKey,
    Object.entries(value.params ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  ]);
}

/**
 * Hatırlatıcı feed'i kanonik domain ile uzlaştırır. Kapanmış/silinmiş veya
 * yeniden planlanmış türevleri kaldırır; kullanıcı aynı aşamayı sildiyse state
 * sayesinde geri diriltmez; metin değişimini okundu/zaman bilgisini koruyarak
 * günceller. Native tray temizliği çağıran katmanın best-effort yan etkisidir.
 */
export function reconcileReminderNotificationFeed(
  input: ReconcileInput,
): ReminderFeedReconcileResult {
  const entities = new Map(input.entities.map((entity) => [entity.entityKey, entity]));
  const candidates = new Map(
    input.candidates.map((entry) => [entry.candidate.entityKey, entry]),
  );
  const retired = new Set<string>();
  const state: ReminderFeedState = {
    debtDueLast: { ...input.state.debtDueLast },
    debtDueDismissed: { ...input.state.debtDueDismissed },
    paymentPlanDueLast: { ...input.state.paymentPlanDueLast },
    paymentPlanDueDismissed: { ...input.state.paymentPlanDueDismissed },
  };

  let feed = input.feed.filter((item) => {
    const entityKey = reminderEntityKeyFromNotificationId(item.id);
    if (!entityKey) return true;
    const entity = entities.get(entityKey);
    if (!entity || !entity.active || !item.id.startsWith(entity.familyPrefix)) {
      retired.add(item.id);
      return false;
    }
    if (input.muted[entity.kind]) return true;
    const current = candidates.get(entityKey);
    if (!current || item.id !== current.candidate.notificationId) {
      retired.add(item.id);
      return false;
    }
    return true;
  });

  for (const [kind, record, dismissed] of [
    ['debt', state.debtDueLast, state.debtDueDismissed],
    ['recurring_payment', state.paymentPlanDueLast, state.paymentPlanDueDismissed],
  ] as const) {
    const keys = new Set([...Object.keys(record), ...Object.keys(dismissed)]);
    for (const key of keys) {
      const entityKey = kind === 'debt' ? `debt:${key}` : `recurring:${key}`;
      const entity = entities.get(entityKey);
      if (!entity || !entity.active) {
        delete record[key];
        delete dismissed[key];
        continue;
      }
      if (record[key] && !record[key].startsWith(entity.tokenPrefix)) delete record[key];
      if (dismissed[key] && !dismissed[key].startsWith(entity.tokenPrefix)) {
        delete dismissed[key];
      }
    }
  }

  // Adaylar kural motorundan en acil vade önce gelir. mergeFeedItem yeni öğeyi
  // başa aldığı için tersten eklemek, MAX_FEED baskısında en acil adayların
  // korunmasını sağlar.
  for (const entry of [...input.candidates].reverse()) {
    const { candidate, notification } = entry;
    const entity = entities.get(candidate.entityKey);
    if (!entity?.active || input.muted[candidate.kind]) continue;
    const record = stateRecord(state, candidate.kind);
    const dismissed = dismissedRecord(state, candidate.kind);
    const key = stateKey(candidate.entityKey);
    if (dismissed[key] === candidate.dedupeToken) {
      // Yalnız açık kullanıcı silmesi tekrar üretimi engeller. MAX_FEED yüzünden
      // teknik olarak budanan kartın burada yeniden eklenmesi gerekir.
      continue;
    }
    if (dismissed[key]) delete dismissed[key];
    const current = feed.find((item) => item.id === candidate.notificationId);
    if (
      current
      && canonicalContentSignature(current) !== canonicalContentSignature(notification)
    ) {
      // Aynı schedule kimliğinde tutar/başlık değişti. Feed kanonik olarak
      // güncellenirken eski Android tray kopyası da kaldırılıp yeniden
      // teslim edilebilsin.
      retired.add(candidate.notificationId);
    }
    feed = canonicalUpsert(feed, notification);
    record[key] = candidate.dedupeToken;
  }

  return { feed, state, retiredIds: [...retired] };
}
