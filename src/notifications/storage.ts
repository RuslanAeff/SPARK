import { Platform } from 'react-native';
import { getDatabase } from '../db/database';
import type { InAppNotification, RulesState, NotificationMuteChannel } from './types';

const K_FEED = 'notif_feed_v1';
const K_RULES = 'notif_rules_state_v1';
const K_MUTES = 'notif_mutes_v1';
const K_ANDROID_DELIVERY = 'notif_android_delivery_v1';
const K_ANDROID_REMINDER_SCHEDULE = 'notif_android_reminder_schedule_v1';

const MAX_FEED = 40;
// Rolling reminder horizon'ındaki feed kimlikleri de anlık Android köprüsünde
// handled olarak tutulur. 512 native plan + yakın feed geçmişi için sınırlı ama
// yeterli alan; finansal metin veya PII içermez.
const MAX_ANDROID_LIVE_REMINDER_SCHEDULES = 512;
const MAX_ANDROID_FIRED_CLEANUP_HANDLES = 512;
const MAX_ANDROID_DELIVERY_RECORDS =
  MAX_ANDROID_LIVE_REMINDER_SCHEDULES + MAX_ANDROID_FIRED_CLEANUP_HANDLES + MAX_FEED;

export interface AndroidDeliveryRecord {
  handledAt: number;
  nativeIdentifier?: string;
}

export interface AndroidDeliveryState {
  version: 1;
  initializedAt: number;
  records: Record<string, AndroidDeliveryRecord>;
}

export interface AndroidReminderScheduleRecord {
  nativeIdentifier: string;
  notificationId: string;
  revision: string;
  /** PII içermeyen kanonik feed içerik özeti; eski v1 kayıtlarında olmayabilir. */
  feedRevision?: string;
  triggerAt: number;
  scheduledAt: number;
}

export interface AndroidReminderScheduleState {
  version: 1;
  updatedAt: number;
  records: Record<string, AndroidReminderScheduleRecord>;
}

export interface AndroidReminderDeliveryBaseline {
  notificationId: string;
  nativeIdentifier: string;
  handledAt: number;
}

export interface DismissNotificationsResult {
  removedIds: string[];
  removedCount: number;
  feed: InAppNotification[];
  unreadCount: number;
}

/**
 * Feed read-modify-write işlemlerinin ortak kuyruğu. Uzun notification sync'i,
 * fiş bildirimi ekleme ve kullanıcı silme işlemleri aynı JSON snapshot'ını
 * birbirinin üstüne yazamaz. Hata kuyruğu zehirlemez; sonraki görev devam eder.
 */
let notificationMutationTail: Promise<void> = Promise.resolve();

export function enqueueNotificationMutation<T>(task: () => Promise<T>): Promise<T> {
  const result = notificationMutationTail.then(task, task);
  notificationMutationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

/** Kaldırılan geliştirme “test bildirimleri ekle” kayıtları — senkron sırasında süzülür */
function isLegacyDevDemoNotificationId(id: string): boolean {
  if (id === 'receipt-saved-900001' || id === 'sys-demo-preview') return true;
  if (/^budget-\d{4}-\d{2}-demo$/.test(id)) return true;
  if (/^catlim-\d{4}-\d{2}-\d+-demo-(?:near|over)$/.test(id)) return true;
  if (/^goal-risk-\d{4}-\d{2}-demo$/.test(id)) return true;
  return false;
}

interface ReminderDismissalBinding {
  kind: 'debt' | 'payment_plan';
  key: string;
  token: string;
}

/** Deterministik reminder ID'sini PII içermeyen dismissal state'ine çevirir. */
function parseReminderDismissal(id: string): ReminderDismissalBinding | null {
  const debt = id.match(
    /^debt-due-v1-(\d+)-(\d{4}-\d{2}-\d{2})-(\d{1,3})-(\d{2})(\d{2})-(upcoming|today|overdue)$/,
  );
  if (debt) {
    return {
      kind: 'debt',
      key: debt[1],
      token: `${debt[2]}:${Number(debt[3])}:${debt[4]}:${debt[5]}:${debt[6]}`,
    };
  }
  const plan = id.match(
    /^payplan-due-v1-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(\d{4}-\d{2}-\d{2})-(\d{1,3})-(\d{2})(\d{2})-(upcoming|today|overdue)$/i,
  );
  if (!plan) return null;
  return {
    kind: 'payment_plan',
    key: plan[1].toLowerCase(),
    token: `${plan[2]}:${Number(plan[3])}:${plan[4]}:${plan[5]}:${plan[6]}`,
  };
}

/** Future scheduler aynı occurrence için açık kullanıcı silmesini de uygular. */
export function isReminderNotificationDismissed(
  id: string,
  rules: RulesState,
): boolean {
  const binding = parseReminderDismissal(id);
  if (!binding) return false;
  const dismissed = binding.kind === 'debt'
    ? rules.debtDueDismissed
    : rules.paymentPlanDueDismissed;
  return dismissed?.[binding.key] === binding.token;
}

export function stripLegacyDevDemoNotifications(feed: InAppNotification[]): InAppNotification[] {
  return feed.filter((f) => !isLegacyDevDemoNotificationId(f.id));
}

export async function loadFeed(): Promise<InAppNotification[]> {
  try {
    return await loadFeedStrict();
  } catch {
    return [];
  }
}

export async function saveFeed(feed: InAppNotification[]): Promise<void> {
  const trimmed = feed.slice(0, MAX_FEED);
  await setSetting(K_FEED, JSON.stringify(trimmed));
}

export async function loadRulesState(): Promise<RulesState> {
  try {
    return await loadRulesStateStrict();
  } catch {
    return {};
  }
}

export async function saveRulesState(s: RulesState): Promise<void> {
  await setSetting(K_RULES, JSON.stringify(s));
}

export async function loadMutes(): Promise<Partial<Record<NotificationMuteChannel, boolean>>> {
  try {
    return await loadMutesStrict();
  } catch {
    return {};
  }
}

export async function saveMutes(m: Partial<Record<NotificationMuteChannel, boolean>>): Promise<void> {
  await setSetting(K_MUTES, JSON.stringify(m));
}

/**
 * Uygulama-içi feed ile Android notification tray arasındaki idempotency kaydı.
 * Finansal veri veya çevrilmiş bildirim metni içermez; yalnız SPARK bildirim ID'si
 * ile native request ID'sini tutar.
 */
function parseAndroidDeliveryState(raw: string | null): AndroidDeliveryState | null {
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Android notification delivery state is not an object');
  }

  const candidate = parsed as Partial<AndroidDeliveryState>;
  if (
    candidate.version !== 1 ||
    !Number.isFinite(candidate.initializedAt) ||
    !candidate.records ||
    typeof candidate.records !== 'object' ||
    Array.isArray(candidate.records)
  ) {
    throw new Error('Android notification delivery state is invalid');
  }

  const records: Record<string, AndroidDeliveryRecord> = {};
  for (const [id, value] of Object.entries(candidate.records)) {
    if (!id || id.length > 180 || !value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const record = value as Partial<AndroidDeliveryRecord>;
    if (!Number.isFinite(record.handledAt)) continue;
    if (
      record.nativeIdentifier !== undefined &&
      (typeof record.nativeIdentifier !== 'string' || record.nativeIdentifier.length > 220)
    ) {
      continue;
    }
    records[id] = {
      handledAt: Number(record.handledAt),
      ...(record.nativeIdentifier ? { nativeIdentifier: record.nativeIdentifier } : {}),
    };
  }

  return {
    version: 1,
    initializedAt: Number(candidate.initializedAt),
    records,
  };
}

export async function loadAndroidDeliveryStateStrict(): Promise<AndroidDeliveryState | null> {
  return parseAndroidDeliveryState(await getSetting(K_ANDROID_DELIVERY));
}

export async function saveAndroidDeliveryState(state: AndroidDeliveryState): Promise<void> {
  const records = Object.fromEntries(
    Object.entries(state.records)
      .sort(([, a], [, b]) => b.handledAt - a.handledAt)
      .slice(0, MAX_ANDROID_DELIVERY_RECORDS),
  );
  await setSetting(
    K_ANDROID_DELIVERY,
    JSON.stringify({
      version: 1,
      initializedAt: state.initializedAt,
      records,
    } satisfies AndroidDeliveryState),
  );
}

function parseAndroidReminderScheduleState(
  raw: string | null,
): AndroidReminderScheduleState | null {
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Android reminder schedule state is not an object');
  }
  const candidate = parsed as Partial<AndroidReminderScheduleState>;
  if (
    candidate.version !== 1
    || !Number.isFinite(candidate.updatedAt)
    || !candidate.records
    || typeof candidate.records !== 'object'
    || Array.isArray(candidate.records)
  ) {
    throw new Error('Android reminder schedule state is invalid');
  }

  const records: Record<string, AndroidReminderScheduleRecord> = {};
  for (const [scheduleId, value] of Object.entries(candidate.records)) {
    if (
      !scheduleId
      || scheduleId.length > 220
      || !value
      || typeof value !== 'object'
      || Array.isArray(value)
    ) continue;
    const record = value as Partial<AndroidReminderScheduleRecord>;
    if (
      typeof record.nativeIdentifier !== 'string'
      || !record.nativeIdentifier.startsWith('spark:future:v1:')
      || record.nativeIdentifier.length > 220
      || typeof record.notificationId !== 'string'
      || !record.notificationId
      || record.notificationId.length > 190
      || typeof record.revision !== 'string'
      || !record.revision
      || record.revision.length > 120
      || (record.feedRevision !== undefined
        && (typeof record.feedRevision !== 'string'
          || !record.feedRevision
          || record.feedRevision.length > 120))
      || !Number.isFinite(record.triggerAt)
      || !Number.isFinite(record.scheduledAt)
    ) continue;
    records[scheduleId] = {
      nativeIdentifier: record.nativeIdentifier,
      notificationId: record.notificationId,
      revision: record.revision,
      ...(record.feedRevision ? { feedRevision: record.feedRevision } : {}),
      triggerAt: Number(record.triggerAt),
      scheduledAt: Number(record.scheduledAt),
    };
  }
  return { version: 1, updatedAt: Number(candidate.updatedAt), records };
}

/**
 * Geleceğe tarihli Android isteklerinin PII içermeyen yerel uzlaştırma ledger'ı.
 * Native OS listesi gerçek kaynaktır; bu state crash/retry ve tez kanıtı için
 * metadata tutar, backup payload'ına dahil edilmez.
 */
export async function loadAndroidReminderScheduleStateStrict(): Promise<
  AndroidReminderScheduleState | null
> {
  return parseAndroidReminderScheduleState(await getSetting(K_ANDROID_REMINDER_SCHEDULE));
}

/**
 * Başarılı future schedule kayıtlarıyla anlık Android teslim baseline'ını aynı
 * SQLite commit'inde yazar. Böylece alarm tetiklendikten sonra Faz 4 feed aynı
 * kimliği oluşturduğunda ikinci bir tray bildirimi gönderilmez.
 */
export async function saveAndroidReminderScheduleSnapshot(
  state: AndroidReminderScheduleState,
  baselines: readonly AndroidReminderDeliveryBaseline[],
): Promise<void> {
  const entries = Object.entries(state.records);
  // Canlı/pending OS alarmları cleanup retry backlog'u tarafından asla
  // budanmaz. Fired/stale handle'lar ayrı, sonlu bir havuzda en yeniler önce
  // korunur; Android tray kapasitesinin çok ötesinde sınırsız ledger büyümez.
  const liveRecords = entries
    .filter(([, record]) => record.triggerAt > state.updatedAt)
    .sort(([, a], [, b]) => a.triggerAt - b.triggerAt)
    .slice(0, MAX_ANDROID_LIVE_REMINDER_SCHEDULES);
  const firedCleanupRecords = entries
    .filter(([, record]) => record.triggerAt <= state.updatedAt)
    .sort(([, a], [, b]) => b.triggerAt - a.triggerAt)
    .slice(0, MAX_ANDROID_FIRED_CLEANUP_HANDLES);
  const scheduleRecords = Object.fromEntries([...liveRecords, ...firedCleanupRecords]);
  const db = await getDatabase();
  const task = async (txn: Pick<typeof db, 'getFirstAsync' | 'runAsync'>) => {
    const deliveryRow = await txn.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [K_ANDROID_DELIVERY],
    );
    const delivery = parseAndroidDeliveryState(deliveryRow?.value ?? null) ?? {
      version: 1,
      initializedAt: state.updatedAt,
      records: {},
    } satisfies AndroidDeliveryState;
    const retainedFutureNativeIds = new Set(
      Object.values(scheduleRecords).map((record) => record.nativeIdentifier),
    );
    for (const [notificationId, record] of Object.entries(delivery.records)) {
      if (
        record.nativeIdentifier?.startsWith('spark:future:v1:')
        && !retainedFutureNativeIds.has(record.nativeIdentifier)
      ) {
        delete delivery.records[notificationId];
      }
    }
    for (const baseline of baselines) {
      if (
        !baseline.notificationId
        || baseline.notificationId.length > 190
        || !baseline.nativeIdentifier.startsWith('spark:future:v1:')
        || !Number.isFinite(baseline.handledAt)
      ) continue;
      delivery.records[baseline.notificationId] = {
        handledAt: baseline.handledAt,
        nativeIdentifier: baseline.nativeIdentifier,
      };
    }
    const deliveryRecords = Object.fromEntries(
      Object.entries(delivery.records)
        .sort(([, a], [, b]) => b.handledAt - a.handledAt)
        .slice(0, MAX_ANDROID_DELIVERY_RECORDS),
    );

    await txn.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [
        K_ANDROID_REMINDER_SCHEDULE,
        JSON.stringify({
          version: 1,
          updatedAt: state.updatedAt,
          records: scheduleRecords,
        } satisfies AndroidReminderScheduleState),
      ],
    );
    await txn.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [
        K_ANDROID_DELIVERY,
        JSON.stringify({ ...delivery, records: deliveryRecords } satisfies AndroidDeliveryState),
      ],
    );
  };
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => task(db));
  } else {
    await db.withExclusiveTransactionAsync(task);
  }
}

function parseStoredFeed(raw: string | null): InAppNotification[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Notification feed is not an array');
  }
  return parsed as InAppNotification[];
}

function parseStoredRules(raw: string | null): RulesState {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Notification rules are not an object');
  }
  return parsed as RulesState;
}

function parseStoredMutes(
  raw: string | null,
): Partial<Record<NotificationMuteChannel, boolean>> {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Notification mutes are not an object');
  }
  return parsed as Partial<Record<NotificationMuteChannel, boolean>>;
}

/**
 * Mutasyon yolları toleranslı loader kullanmaz: DB/JSON hatasında boş snapshot'ı
 * gerçek veri sanıp diske geri yazarak geçmişi silmek yerine işlem başarısız olur.
 */
export async function loadFeedStrict(): Promise<InAppNotification[]> {
  return parseStoredFeed(await getSetting(K_FEED));
}

export async function loadRulesStateStrict(): Promise<RulesState> {
  return parseStoredRules(await getSetting(K_RULES));
}

export async function loadMutesStrict(): Promise<
  Partial<Record<NotificationMuteChannel, boolean>>
> {
  return parseStoredMutes(await getSetting(K_MUTES));
}

/**
 * Sync'in ürettiği feed ve "üretildi" kural bayrakları tek commit'tir. Kurallar
 * yazılıp feed yazılamazsa bildirimin kalıcı biçimde kaybolması engellenir.
 */
export async function saveNotificationSnapshot(
  feed: InAppNotification[],
  rules: RulesState,
): Promise<void> {
  const db = await getDatabase();
  const task = async (txn: Pick<typeof db, 'runAsync'>) => {
    await txn.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [K_FEED, JSON.stringify(feed.slice(0, MAX_FEED))],
    );
    await txn.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [K_RULES, JSON.stringify(rules)],
    );
  };

  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => task(db));
  } else {
    await db.withExclusiveTransactionAsync(task);
  }
}

/**
 * Bir veya daha fazla bildirimi tek SQLite transaction'ında kaldırır.
 * System dismissal bayrakları feed ile aynı commit'te yazılır; yarım durum yoktur.
 */
export async function dismissFeedItems(
  ids: readonly string[],
): Promise<DismissNotificationsResult> {
  const requested = new Set(ids.filter(Boolean));
  if (requested.size === 0) {
    const feed = await loadFeedStrict();
    return {
      removedIds: [],
      removedCount: 0,
      feed,
      unreadCount: feed.filter((item) => !item.read).length,
    };
  }

  const db = await getDatabase();
  let result: DismissNotificationsResult | null = null;

  const task = async (txn: Pick<typeof db, 'getFirstAsync' | 'runAsync'>) => {
    const feedRow = await txn.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [K_FEED],
    );

    const feed = parseStoredFeed(feedRow?.value ?? null);
    const removedIds = feed
      .filter((item) => requested.has(item.id))
      .map((item) => item.id);
    const removed = new Set(removedIds);
    const nextFeed = feed.filter((item) => !removed.has(item.id));

    if (removedIds.length > 0) {
      let rulesChanged = false;
      let rules: RulesState | null = null;
      const reminderDismissals = removedIds
        .map(parseReminderDismissal)
        .filter((binding): binding is ReminderDismissalBinding => binding != null);
      if (
        removed.has('sys-no-api-key')
        || removed.has('sys-scan-err')
        || reminderDismissals.length > 0
      ) {
        const rulesRow = await txn.getFirstAsync<{ value: string }>(
          'SELECT value FROM settings WHERE key = ?',
          [K_RULES],
        );
        rules = parseStoredRules(rulesRow?.value ?? null);
        if (removed.has('sys-no-api-key') && !rules.apiDismissed) {
          rules.apiDismissed = true;
          rulesChanged = true;
        }
        if (removed.has('sys-scan-err') && !rules.scanErrorDismissed) {
          rules.scanErrorDismissed = true;
          rulesChanged = true;
        }
        for (const binding of reminderDismissals) {
          const dismissed = binding.kind === 'debt'
            ? (rules.debtDueDismissed ??= {})
            : (rules.paymentPlanDueDismissed ??= {});
          if (dismissed[binding.key] !== binding.token) {
            dismissed[binding.key] = binding.token;
            rulesChanged = true;
          }
        }
      }

      await txn.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [K_FEED, JSON.stringify(nextFeed.slice(0, MAX_FEED))],
      );
      if (rulesChanged && rules) {
        await txn.runAsync(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [K_RULES, JSON.stringify(rules)],
        );
      }
    }

    result = {
      removedIds,
      removedCount: removedIds.length,
      feed: nextFeed,
      unreadCount: nextFeed.filter((item) => !item.read).length,
    };
  };

  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => task(db));
  } else {
    await db.withExclusiveTransactionAsync(task);
  }

  if (!result) {
    throw new Error('Notification dismissal transaction produced no result');
  }
  return result;
}

export function mergeFeedItem(
  feed: InAppNotification[],
  item: Omit<InAppNotification, 'read'> & { read?: boolean }
): InAppNotification[] {
  if (feed.some((f) => f.id === item.id)) return feed;
  const next: InAppNotification = {
    ...item,
    read: item.read ?? false,
    createdAt: item.createdAt ?? Date.now(),
  };
  return [next, ...feed].slice(0, MAX_FEED);
}
