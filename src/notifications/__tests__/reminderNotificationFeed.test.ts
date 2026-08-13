import type { InAppNotification } from '../types';
import type { ReminderNotificationCandidate } from '../reminderNotificationRules';
import {
  reconcileReminderNotificationFeed,
  type ReminderFeedCandidate,
  type ReminderFeedEntity,
  type ReminderFeedState,
} from '../reminderNotificationFeed';

const FAMILY = 'debt-due-v1-7-2026-08-14-3-0900-';
const TOKEN = '2026-08-14:3:09:00:';

function candidate(stage: 'upcoming' | 'today' | 'overdue'): ReminderFeedCandidate {
  const rule: ReminderNotificationCandidate = {
    kind: 'debt',
    stage,
    entityKey: 'debt:7',
    dedupeToken: `${TOKEN}${stage}`,
    notificationId: `${FAMILY}${stage}`,
    dueDate: '2026-08-14',
    daysUntilDue: stage === 'upcoming' ? 3 : stage === 'today' ? 0 : -1,
    reminderTime: '09:00',
    label: 'Ali',
    amount: 100,
    currency: 'PLN',
  };
  return {
    candidate: rule,
    notification: {
      id: rule.notificationId,
      severity: stage === 'overdue' ? 'critical' : 'warning',
      titleKey: `title_${stage}`,
      bodyKey: `body_${stage}`,
      params: { counterparty: rule.label },
      createdAt: 1000,
    },
  };
}

const entity: ReminderFeedEntity = {
  entityKey: 'debt:7',
  kind: 'debt',
  familyPrefix: FAMILY,
  tokenPrefix: TOKEN,
  active: true,
};

const EMPTY_STATE: ReminderFeedState = {
  debtDueLast: {},
  debtDueDismissed: {},
  paymentPlanDueLast: {},
  paymentPlanDueDismissed: {},
};

function reconcile(
  feed: InAppNotification[],
  candidates: ReminderFeedCandidate[],
  state: ReminderFeedState = EMPTY_STATE,
  entities: ReminderFeedEntity[] = [entity],
) {
  return reconcileReminderNotificationFeed({
    feed,
    candidates,
    entities,
    state,
    muted: {},
  });
}

describe('reminder notification feed reconciliation', () => {
  it('ilk aşamayı ekler ve açıkça silinen fingerprinti geri diriltmez', () => {
    const first = reconcile([], [candidate('upcoming')]);
    expect(first.feed.map((item) => item.id)).toEqual([`${FAMILY}upcoming`]);

    const dismissed = reconcile([], [candidate('upcoming')], {
      ...first.state,
      debtDueDismissed: { '7': candidate('upcoming').candidate.dedupeToken },
    });
    expect(dismissed.feed).toEqual([]);
  });

  it('teknik feed budamasını kullanıcı silmesi saymaz ve en acil 40 adayı korur', () => {
    const entries = Array.from({ length: 41 }, (_, index): ReminderFeedCandidate => {
      const id = index + 1;
      const family = `debt-due-v1-${id}-2026-08-14-3-0900-`;
      const base = candidate('upcoming');
      return {
        candidate: {
          ...base.candidate,
          entityKey: `debt:${id}`,
          notificationId: `${family}upcoming`,
        },
        notification: {
          ...base.notification,
          id: `${family}upcoming`,
          params: { counterparty: `Kayıt ${id}` },
        },
      };
    });
    const entities = entries.map((entry, index): ReminderFeedEntity => ({
      entityKey: entry.candidate.entityKey,
      kind: 'debt',
      familyPrefix: `debt-due-v1-${index + 1}-2026-08-14-3-0900-`,
      tokenPrefix: TOKEN,
      active: true,
    }));
    const existingState: ReminderFeedState = {
      ...EMPTY_STATE,
      debtDueLast: Object.fromEntries(
        entries.map((entry, index) => [String(index + 1), entry.candidate.dedupeToken]),
      ),
    };

    const result = reconcile([], entries, existingState, entities);

    expect(result.feed).toHaveLength(40);
    expect(result.feed[0].id).toBe(entries[0].candidate.notificationId);
    expect(result.feed.some((item) => item.id === entries[39].candidate.notificationId)).toBe(true);
    expect(result.feed.some((item) => item.id === entries[40].candidate.notificationId)).toBe(false);
  });

  it('aşama yükselince eski kartı emekliye ayırıp yenisini üretir', () => {
    const first = reconcile([], [candidate('upcoming')]);
    const next = reconcile(first.feed, [candidate('today')], first.state);
    expect(next.retiredIds).toEqual([`${FAMILY}upcoming`]);
    expect(next.feed.map((item) => item.id)).toEqual([`${FAMILY}today`]);
  });

  it('kanonik metni güncellerken okundu ve ilk oluşturulma zamanını korur', () => {
    const current = candidate('today');
    const feed: InAppNotification[] = [{
      ...current.notification,
      titleKey: 'old_title',
      createdAt: 55,
      read: true,
    }];
    const result = reconcile(feed, [current], {
      debtDueLast: { '7': current.candidate.dedupeToken },
      debtDueDismissed: {},
      paymentPlanDueLast: {},
      paymentPlanDueDismissed: {},
    });
    expect(result.feed[0]).toMatchObject({ titleKey: 'title_today', createdAt: 55, read: true });
  });

  it('kapanan veya silinen kaydın kartını ve state değerini temizler', () => {
    const current = candidate('overdue');
    const state = {
      debtDueLast: { '7': current.candidate.dedupeToken },
      debtDueDismissed: {},
      paymentPlanDueLast: {},
      paymentPlanDueDismissed: {},
    };
    const result = reconcile(
      [{ ...current.notification, read: false }],
      [],
      state,
      [{ ...entity, active: false }],
    );
    expect(result.feed).toEqual([]);
    expect(result.retiredIds).toEqual([current.candidate.notificationId]);
    expect(result.state.debtDueLast).toEqual({});
    expect(result.state.debtDueDismissed).toEqual({});
  });

  it('aynı ID içeriği değişince eski tray kopyasını emekliye ayırır', () => {
    const current = candidate('overdue');
    const existing: InAppNotification = {
      ...current.notification,
      params: { counterparty: 'Ali', amount: '100' },
      read: false,
    };
    const updated: ReminderFeedCandidate = {
      ...current,
      notification: {
        ...current.notification,
        params: { counterparty: 'Ali', amount: '90' },
      },
    };

    const result = reconcile([existing], [updated], {
      ...EMPTY_STATE,
      debtDueLast: { '7': current.candidate.dedupeToken },
    });

    expect(result.retiredIds).toEqual([current.candidate.notificationId]);
    expect(result.feed[0].params).toEqual({ counterparty: 'Ali', amount: '90' });
  });

  it('mute yeni kartı keser ama mevcut geçmişi topluca silmez', () => {
    const current = candidate('upcoming');
    const existing: InAppNotification = { ...current.notification, read: false };
    const result = reconcileReminderNotificationFeed({
      feed: [existing],
      candidates: [current],
      entities: [entity],
      state: EMPTY_STATE,
      muted: { debt: true },
    });
    expect(result.feed).toEqual([existing]);
    expect(result.state.debtDueLast).toEqual({});
  });
});
