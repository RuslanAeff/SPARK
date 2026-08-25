import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

import {
  enqueueNotificationMutation,
  loadAndroidDeliveryStateStrict,
  loadAndroidReminderScheduleStateStrict,
  loadFeedStrict,
  saveAndroidDeliveryState,
  saveAndroidReminderScheduleSnapshot,
  type AndroidDeliveryState,
  type AndroidReminderScheduleRecord,
} from '../notifications/storage';
import type { NotificationMuteChannel, NotificationSeverity } from '../notifications/types';
import {
  notificationContentRevision,
  notificationPresentationRevision,
} from '../notifications/presentation';
import { isNotificationMuted } from '../notifications/channels';

type ExpoNotificationsModule = typeof import('expo-notifications');

export const ANDROID_UPDATES_CHANNEL_ID = 'spark-updates-v1';
export const ANDROID_ALERTS_CHANNEL_ID = 'spark-alerts-v1';

const FIRST_ENABLE_FRESHNESS_MS = 2 * 60 * 1000;
const NOTIFICATION_ACCENT = '#00EB64';
const FUTURE_REMINDER_PREFIX = 'spark:future:v1:';
const FUTURE_REMINDER_OWNER = 'spark-reminder-v1';
// Saf planner da aynı üst sınırı uygular. Buradaki ikinci savunma, iptali
// başarısız stale native istekler varken OS sahipliğinin 512'yi aşmasını önler.
const MAX_OWNED_FUTURE_REMINDERS = 512;

export type AndroidNotificationSetupStatus =
  | 'ready'
  | 'denied'
  | 'not_ready'
  | 'unsupported'
  | 'expo_go'
  | 'error';

export interface AndroidSystemNotificationItem {
  id: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  createdAt: number;
  read: boolean;
  revision: string;
}

export interface AndroidDeliveryResult {
  status: AndroidNotificationSetupStatus;
  deliveredIds: string[];
  failedIds: string[];
}

export interface AndroidNotificationChannelCopy {
  updatesName: string;
  updatesDescription: string;
  alertsName: string;
  alertsDescription: string;
}

export interface AndroidReminderScheduleItem {
  /** PII içermeyen, prefixsiz mantıksal schedule kimliği. */
  scheduleId: string;
  /** Aynı olayın uygulama-içi feed kimliği; tap ve double-delivery baseline'ı. */
  notificationId: string;
  triggerAt: number;
  title: string;
  body: string;
  severity: NotificationSeverity;
  revision: string;
  /** createdAt'ten bağımsız, kanonik feed içerik özeti. */
  feedRevision: string;
}

export interface AndroidReminderScheduleResult {
  status: AndroidNotificationSetupStatus;
  /** Geçerli ve gelecekteki kanonik desired-state öğesi sayısı. */
  desiredCount: number;
  /** Uzlaştırma sonunda native scheduled-request envanterinde doğrulanan öğe sayısı. */
  verifiedCount: number;
  scheduledIds: string[];
  canceledIds: string[];
  failedScheduleIds: string[];
  failedCancelIds: string[];
}

export type AndroidAlertChannelStatus =
  | 'ready'
  | 'degraded'
  | 'blocked'
  | 'unknown';

export interface AndroidFutureScheduleSummary {
  status: AndroidNotificationSetupStatus;
  count: number;
  nextTriggerAt: number | null;
  alertChannelStatus: AndroidAlertChannelStatus;
}

const DEFAULT_CHANNEL_COPY: AndroidNotificationChannelCopy = {
  updatesName: 'S.P.A.R.K updates',
  updatesDescription: 'Receipts, summaries and reminders',
  alertsName: 'S.P.A.R.K alerts',
  alertsDescription: 'Budget, category and goal alerts',
};

let modulePromise: Promise<ExpoNotificationsModule> | null = null;
let setupInFlight: Promise<AndroidNotificationSetupStatus> | null = null;
let deliveryActivated = false;
let activeChannelCopy = DEFAULT_CHANNEL_COPY;
const sessionScheduledIds = new Set<string>();

/** @internal Jest, Expo Go guard'ını delmeden dinamik native modülü enjekte eder. */
export function __setAndroidNotificationsModuleForTests(
  module: ExpoNotificationsModule | null,
): void {
  modulePromise = module ? Promise.resolve(module) : null;
  setupInFlight = null;
  deliveryActivated = false;
  activeChannelCopy = DEFAULT_CHANNEL_COPY;
  sessionScheduledIds.clear();
}

/** Kök açılış perdesi kalktıktan sonra çağrılır; native izin UI'ı ilk kareye sızmaz. */
export function activateAndroidNotificationDelivery(): void {
  deliveryActivated = true;
}

/** Sync başlangıcının reveal/cold-response bariyerinin hangi tarafında olduğunu
 * sabitlemek için salt-okunur snapshot. Uzun bir pre-reveal sync sürerken global
 * aktivasyon değişse bile o eski çalışma cursor ilerletme yetkisi kazanmaz. */
export function isAndroidNotificationDeliveryActivated(): boolean {
  return deliveryActivated;
}

function canUseAndroidNotifications(): AndroidNotificationSetupStatus | null {
  if (Platform.OS !== 'android') return 'unsupported';
  // Proje sözleşmesi: Expo Go native bildirim yüzeyi gerçek APK kanıtı sayılmaz
  // ve mevcut guard kaldırılmaz. Standalone/development build bu kola girmez.
  if (isRunningInExpoGo()) return 'expo_go';
  return null;
}

function loadNotificationsModule(): Promise<ExpoNotificationsModule> {
  modulePromise ??= import('expo-notifications');
  return modulePromise;
}

function notificationIdentifier(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 170);
  return `spark:${safe || 'notification'}`;
}

function futureReminderIdentifier(scheduleId: string): string {
  const safe = scheduleId.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 170);
  return `${FUTURE_REMINDER_PREFIX}${safe || 'invalid'}`;
}

function emptyReminderScheduleResult(
  status: AndroidNotificationSetupStatus,
): AndroidReminderScheduleResult {
  return {
    status,
    desiredCount: 0,
    verifiedCount: 0,
    scheduledIds: [],
    canceledIds: [],
    failedScheduleIds: [],
    failedCancelIds: [],
  };
}

function validReminderScheduleItem(
  item: AndroidReminderScheduleItem,
  now: number,
): boolean {
  return Boolean(
    item
    && typeof item.scheduleId === 'string'
    && item.scheduleId.length > 0
    && item.scheduleId.length <= 170
    && typeof item.notificationId === 'string'
    && item.notificationId.length > 0
    && item.notificationId.length <= 190
    && Number.isFinite(item.triggerAt)
    && item.triggerAt > now
    && typeof item.title === 'string'
    && typeof item.body === 'string'
    && typeof item.revision === 'string'
    && item.revision.length > 0
    && item.revision.length <= 120
    && typeof item.feedRevision === 'string'
    && item.feedRevision.length > 0
    && item.feedRevision.length <= 120
  );
}

function attentionRequired(severity: NotificationSeverity): boolean {
  return severity === 'warning' || severity === 'critical';
}

function clampText(value: string, maxLength: number): string {
  const text = value.trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

async function performAndroidNotificationSetup(
  requestPermission: boolean,
  channelCopy: AndroidNotificationChannelCopy,
): Promise<AndroidNotificationSetupStatus> {
  const unsupported = canUseAndroidNotifications();
  if (unsupported) return unsupported;

  try {
    const Notifications = await loadNotificationsModule();

    // SDK 55: handler yoksa ön planda alınan yerel bildirim varsayılan olarak
    // gösterilmez. Bilgi bildirimleri yalnız panelde sessiz kalır; uyarı ve kritik
    // kayıtlar banner + ses kullanır.
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const severity = notification.request.content.data?.sparkSeverity;
        const alert = severity === 'warning' || severity === 'critical';
        return {
          shouldShowBanner: alert,
          shouldShowList: true,
          shouldPlaySound: alert,
          shouldSetBadge: false,
          priority: alert
            ? Notifications.AndroidNotificationPriority.HIGH
            : Notifications.AndroidNotificationPriority.DEFAULT,
        };
      },
    });

    // Android 13 izin penceresi ancak en az bir kanal oluşturulduktan sonra
    // açılabilir. Finans uygulaması olduğu için kilit ekranında içerik gizlidir.
    await Notifications.setNotificationChannelAsync(ANDROID_UPDATES_CHANNEL_ID, {
      name: channelCopy.updatesName,
      description: channelCopy.updatesDescription,
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      lightColor: NOTIFICATION_ACCENT,
      showBadge: true,
      sound: null,
      enableLights: true,
      enableVibrate: false,
    });
    await Notifications.setNotificationChannelAsync(ANDROID_ALERTS_CHANNEL_ID, {
      name: channelCopy.alertsName,
      description: channelCopy.alertsDescription,
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      lightColor: NOTIFICATION_ACCENT,
      showBadge: true,
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      vibrationPattern: [0, 220, 160, 220],
    });

    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return 'ready';

    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
    if (
      apiLevel >= 33 &&
      requestPermission &&
      current.status === 'undetermined' &&
      current.canAskAgain !== false
    ) {
      const requested = await Notifications.requestPermissionsAsync();
      return requested.status === 'granted' ? 'ready' : 'denied';
    }

    // Android 12 ve altı normalde kurulumla birlikte granted döner. Farklı bir
    // cihaz politikası bildirimi kapattıysa bunu yine açıkça denied kabul ederiz.
    return 'denied';
  } catch {
    return 'error';
  }
}

/** Kanal, SDK 55 foreground handler'ı ve Android 13+ iznini hazırlar. */
export function ensureAndroidNotificationSetup(
  requestPermission = true,
  channelCopy?: AndroidNotificationChannelCopy,
): Promise<AndroidNotificationSetupStatus> {
  if (channelCopy) activeChannelCopy = channelCopy;
  if (setupInFlight) return setupInFlight;
  setupInFlight = performAndroidNotificationSetup(requestPermission, activeChannelCopy).finally(() => {
    setupInFlight = null;
  });
  return setupInFlight;
}

function emptyDeliveryResult(status: AndroidNotificationSetupStatus): AndroidDeliveryResult {
  return { status, deliveredIds: [], failedIds: [] };
}

/**
 * Uygulama-içi feed'deki yeni, okunmamış kayıtları Android notification tray'e
 * bir kez teslim eder. İlk etkinleştirmede eski feed topluca gönderilmez; yalnız
 * bu sync'te üretilen veya son iki dakikada eklenen kayıtlar adaydır.
 */
export async function deliverAndroidSystemNotifications(
  items: readonly AndroidSystemNotificationItem[],
  options: {
    newlyCreatedIds?: readonly string[];
    suppressedIds?: readonly string[];
    now?: number;
  } = {},
): Promise<AndroidDeliveryResult> {
  if (!deliveryActivated) return emptyDeliveryResult('not_ready');
  // Otomatik sync kullanıcıya tekrar tekrar izin penceresi açmaz. İlk açık izin
  // isteği reveal sonrası bootstrap'te yapılır; ret sonrası dönüş OS ayarlarıdır.
  const status = await ensureAndroidNotificationSetup(false);
  if (status !== 'ready') return emptyDeliveryResult(status);

  const Notifications = await loadNotificationsModule();
  const now = options.now ?? Date.now();
  const newlyCreated = new Set(options.newlyCreatedIds ?? []);
  const suppressed = new Set(options.suppressedIds ?? []);

  return enqueueNotificationMutation(async () => {
    // Setup/izin beklerken kullanıcı bildirimi okuyabilir veya silebilir. Native
    // planlamadan hemen önce aynı serileştirilmiş kuyrukta kanonik feed'i tekrar
    // doğrula; eski React snapshot'ı silinen kaydı tray'e geri getiremesin.
    const canonicalFeed = await loadFeedStrict();
    const canonicalById = new Map(canonicalFeed.map((item) => [item.id, item]));
    let state = await loadAndroidDeliveryStateStrict();
    const firstEnable = state === null;
    state ??= {
      version: 1,
      initializedAt: now,
      records: {},
    } satisfies AndroidDeliveryState;

    let stateChanged = firstEnable;
    const pending: AndroidSystemNotificationItem[] = [];

    // Mute uygulama-içi geçmişi silmez; ancak sessizde oluşan kayıt unmute
    // sonrasında eski backlog olarak native panele düşmemelidir. İçeriği native
    // planlayıcıya vermeden, kanonik feed'de bulunan ID'yi handled baseline yap.
    for (const id of suppressed) {
      if (!id || state.records[id] || !canonicalById.has(id)) continue;
      state.records[id] = { handledAt: now };
      stateChanged = true;
    }

    for (const item of items) {
      if (!item.id || state.records[item.id] || sessionScheduledIds.has(item.id)) continue;

      const canonical = canonicalById.get(item.id);
      if (
        canonical &&
        item.revision !== notificationPresentationRevision(canonical)
      ) {
        // Aynı ID kullanıcı düzeltmesiyle yeni satıcı/metin aldı. Eski snapshot'ı
        // handled sayma; sonraki sync güncel revision'ı teslim etsin.
        continue;
      }
      const renderable = Boolean(item.title.trim() || item.body.trim());
      const isFresh = item.createdAt >= now - FIRST_ENABLE_FRESHNESS_MS;
      const eligibleForDelivery = newlyCreated.has(item.id) || isFresh;

      if (
        !canonical ||
        canonical.read ||
        item.read ||
        !renderable ||
        !eligibleForDelivery
      ) {
        // Baseline/read kaydı: ledger eksilse veya başka bir işlem genel sync
        // tetiklese bile saatler önceki feed öğesi yeni sistem bildirimi olarak
        // dirilmesin. Başarısız güncel teslim iki dakikalık tazelik penceresinde
        // yeniden denenebilir; açıkça yeni ID ise pencere dışında da teslim edilir.
        state.records[item.id] = { handledAt: now };
        stateChanged = true;
        continue;
      }
      pending.push(item);
    }

    if (stateChanged) await saveAndroidDeliveryState(state);

    // Eski → yeni sırada gönder; panelde son gönderilen (en yeni) en üstte kalır.
    pending.sort((a, b) => a.createdAt - b.createdAt);
    const deliveredIds: string[] = [];
    const failedIds: string[] = [];

    for (const item of pending) {
      const alert = attentionRequired(item.severity);
      const nativeIdentifier = notificationIdentifier(item.id);
      let scheduled = false;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: nativeIdentifier,
          content: {
            title: clampText(item.title, 120),
            body: clampText(item.body, 280),
            color: NOTIFICATION_ACCENT,
            sound: alert ? 'default' : false,
            priority: alert
              ? Notifications.AndroidNotificationPriority.HIGH
              : Notifications.AndroidNotificationPriority.DEFAULT,
            data: {
              sparkNotificationId: item.id,
              sparkSeverity: item.severity,
              url: '/notifications',
            },
          },
          trigger: {
            channelId: alert ? ANDROID_ALERTS_CHANNEL_ID : ANDROID_UPDATES_CHANNEL_ID,
          },
        });

        scheduled = true;
        sessionScheduledIds.add(item.id);
        state.records[item.id] = { handledAt: Date.now(), nativeIdentifier };
        await saveAndroidDeliveryState(state);
        sessionScheduledIds.delete(item.id);
        deliveredIds.push(item.id);
      } catch {
        delete state.records[item.id];
        if (scheduled) {
          // OS side-effect başarılı, ledger yazımı başarısızsa görünür kaydı geri
          // almaya çalış. Böylece güvenli retry aynı bildirimi yeniden uyarmadan
          // yapılabilir. Dismiss de başarısızsa session guard ikinci uyarıyı keser.
          try {
            await Notifications.dismissNotificationAsync(nativeIdentifier);
            sessionScheduledIds.delete(item.id);
          } catch {
            // Süreç kapanırsa OS/SQLite arasında mutlak exactly-once atomikliği
            // kurulamaz; deterministik identifier ve kalıcı ledger ana korumadır.
          }
        }
        // Feed kalıcıdır; başarısız kayıt ledger'a yazılmaz ve sonraki sync'te
        // yeniden denenebilir. Bir öğe diğerlerinin teslimini engellemez.
        failedIds.push(item.id);
      }
    }

    return { status: 'ready', deliveredIds, failedIds };
  });
}

function ownedFutureReminderRequest(
  request: import('expo-notifications').NotificationRequest,
): boolean {
  return request.identifier.startsWith(FUTURE_REMINDER_PREFIX)
    && request.content.data?.sparkReminderOwner === FUTURE_REMINDER_OWNER;
}

function nativeFutureRequestMatches(
  request: import('expo-notifications').NotificationRequest,
  desired: AndroidReminderScheduleItem,
): boolean {
  const data = request.content.data;
  return data?.sparkReminderRevision === desired.revision
    && data?.sparkNotificationId === desired.notificationId
    && Number(data?.sparkReminderTriggerAt) === desired.triggerAt;
}

async function scheduleAndroidFutureReminder(
  Notifications: ExpoNotificationsModule,
  nativeId: string,
  desired: AndroidReminderScheduleItem,
): Promise<void> {
  const alert = attentionRequired(desired.severity);
  await Notifications.scheduleNotificationAsync({
    identifier: nativeId,
    content: {
      title: clampText(desired.title, 120),
      body: clampText(desired.body, 280),
      color: NOTIFICATION_ACCENT,
      sound: alert ? 'default' : false,
      priority: alert
        ? Notifications.AndroidNotificationPriority.HIGH
        : Notifications.AndroidNotificationPriority.DEFAULT,
      data: {
        sparkNotificationId: desired.notificationId,
        sparkSeverity: desired.severity,
        sparkReminderOwner: FUTURE_REMINDER_OWNER,
        sparkReminderRevision: desired.revision,
        sparkFeedRevision: desired.feedRevision,
        sparkReminderTriggerAt: desired.triggerAt,
        url: '/notifications',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(desired.triggerAt),
      channelId: ANDROID_ALERTS_CHANNEL_ID,
    },
  });
}

function alertChannelStatus(
  Notifications: ExpoNotificationsModule,
  channel: import('expo-notifications').NotificationChannel | null,
): AndroidAlertChannelStatus {
  if (!channel) return 'unknown';
  if (channel.importance === Notifications.AndroidImportance.NONE) return 'blocked';
  if (channel.importance < Notifications.AndroidImportance.DEFAULT) return 'degraded';
  return 'ready';
}

/** Ayarlar ekranı için salt-okunur native alarm özeti. SQLite ledger tahmini
 * yerine Expo'nun Android'de tuttuğu kalıcı scheduled-request envanterini
 * kullanır. Bu okuma AlarmManager kuyruğunun ayrıcalıklı bir dump'ı değildir. */
export async function getAndroidFutureScheduleSummary(): Promise<AndroidFutureScheduleSummary> {
  const unsupported = canUseAndroidNotifications();
  if (unsupported) {
    return {
      status: unsupported,
      count: 0,
      nextTriggerAt: null,
      alertChannelStatus: 'unknown',
    };
  }
  const status = await ensureAndroidNotificationSetup(false);
  if (status !== 'ready') {
    return { status, count: 0, nextTriggerAt: null, alertChannelStatus: 'unknown' };
  }
  try {
    const Notifications = await loadNotificationsModule();
    const owned = (await Notifications.getAllScheduledNotificationsAsync())
      .filter(ownedFutureReminderRequest);
    const triggerTimes = owned
      .map((request) => Number(request.content.data?.sparkReminderTriggerAt))
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((left, right) => left - right);
    let channelStatus: AndroidAlertChannelStatus = 'unknown';
    try {
      const channel = await Notifications.getNotificationChannelAsync(
        ANDROID_ALERTS_CHANNEL_ID,
      );
      channelStatus = alertChannelStatus(Notifications, channel);
    } catch {
      // Envanter okunabildiği için plan sayısını koru; kanal tanısı ayrıca
      // bilinmiyor olarak gösterilir ve bir sonraki açılışta yeniden denenir.
    }
    return {
      status: 'ready',
      count: triggerTimes.length,
      nextTriggerAt: triggerTimes[0] ?? null,
      alertChannelStatus: channelStatus,
    };
  } catch {
    return {
      status: 'error',
      count: 0,
      nextTriggerAt: null,
      alertChannelStatus: 'unknown',
    };
  }
}

/**
 * Kalıcı borç/ödeme-planı verisinden türetilen gelecekteki Android alarmlarını
 * OS gerçekliğiyle uzlaştırır. Yalnız `spark:future:v1:` sahiplik alanını yönetir;
 * başka uygulama veya SPARK'ın anlık feed isteklerine dokunmaz.
 */
export async function reconcileAndroidReminderSchedules(
  desiredItems: readonly AndroidReminderScheduleItem[],
  options: {
    now?: number;
    mutes?: Partial<Record<NotificationMuteChannel, boolean>>;
  } = {},
): Promise<AndroidReminderScheduleResult> {
  if (!deliveryActivated) return emptyReminderScheduleResult('not_ready');
  const unsupported = canUseAndroidNotifications();
  if (unsupported) return emptyReminderScheduleResult(unsupported);

  const now = options.now ?? Date.now();
  const setupStatus = await ensureAndroidNotificationSetup(false);
  if (setupStatus === 'error' || setupStatus === 'unsupported' || setupStatus === 'expo_go') {
    return emptyReminderScheduleResult(setupStatus);
  }
  const Notifications = await loadNotificationsModule();

  return enqueueNotificationMutation(async () => {
    let allScheduled: import('expo-notifications').NotificationRequest[];
    try {
      allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    } catch {
      // Native scheduled-request envanteri okunamazsa yalnız yerel ledger'a
      // güvenip alarm silmek veya
      // çoğaltmak güvenli değildir.
      return emptyReminderScheduleResult('error');
    }

    const previousState = await loadAndroidReminderScheduleStateStrict();
    let activeReminderPresentations: Map<string, string>;
    try {
      activeReminderPresentations = new Map(
        (await loadFeedStrict())
          .filter((item) => !isNotificationMuted(item.id, options.mutes ?? {}))
          .map((item) => [item.id, notificationContentRevision(item)]),
      );
    } catch {
      // Feed kanonik bağlamı okunamazsa fired tray'i yanlışlıkla stale sayma.
      return emptyReminderScheduleResult('error');
    }
    const validDesiredByNativeId = new Map<string, AndroidReminderScheduleItem>();
    for (const item of desiredItems) {
      if (!validReminderScheduleItem(item, now)) continue;
      const nativeId = futureReminderIdentifier(item.scheduleId);
      if (!validDesiredByNativeId.has(nativeId)) validDesiredByNativeId.set(nativeId, item);
    }
    const desiredByNativeId = setupStatus === 'ready'
      ? validDesiredByNativeId
      : new Map<string, AndroidReminderScheduleItem>();

    const ownedActual = new Map<string, import('expo-notifications').NotificationRequest>();
    for (const request of allScheduled) {
      if (ownedFutureReminderRequest(request)) ownedActual.set(request.identifier, request);
    }

    const result = emptyReminderScheduleResult(setupStatus);
    result.desiredCount = validDesiredByNativeId.size;
    const blockedNativeIds = new Set<string>();
    const dismissedNativeIds = new Set<string>();
    const finalRecords: Record<string, AndroidReminderScheduleRecord> = {};

    // Önce stale/değişmiş native kayıtları iptal et. İptal başarısızsa aynı
    // kimliği yeniden kurup iki alarm üretme; sonraki sync retry eder.
    for (const [nativeId, request] of ownedActual) {
      const desired = desiredByNativeId.get(nativeId);
      if (desired && nativeFutureRequestMatches(request, desired)) continue;
      try {
        await Notifications.cancelScheduledNotificationAsync(nativeId);
        try {
          await Notifications.dismissNotificationAsync(nativeId);
          dismissedNativeIds.add(nativeId);
        } catch {
          // Alarm iptal edildi; daha önce yarışla görünmüş tray kopyası ayrı
          // best-effort yüzeydir ve sonraki feed cleanup'ında tekrar denenir.
        }
        ownedActual.delete(nativeId);
        result.canceledIds.push(nativeId.slice(FUTURE_REMINDER_PREFIX.length));
      } catch {
        blockedNativeIds.add(nativeId);
        result.failedCancelIds.push(nativeId.slice(FUTURE_REMINDER_PREFIX.length));
      }
    }

    const attemptedScheduleNativeIds = new Set<string>();
    const newlyScheduledNativeIds = new Set<string>();
    const recordFailedCancel = (nativeId: string): void => {
      const scheduleId = nativeId.slice(FUTURE_REMINDER_PREFIX.length);
      if (!result.failedCancelIds.includes(scheduleId)) {
        result.failedCancelIds.push(scheduleId);
      }
    };
    const rollbackAttemptedSchedules = async (): Promise<void> => {
      for (const nativeId of attemptedScheduleNativeIds) {
        try {
          await Notifications.cancelScheduledNotificationAsync(nativeId);
        } catch {
          // Envanter doğrulaması veya ledger commit'i başarısızken native
          // yan etkinin kaldığı kesin değildir. Deterministik kimliği hata
          // listesinde koru; sonraki actual-vs-desired sync yeniden uzlaştırır.
          recordFailedCancel(nativeId);
        }
      }
    };
    const failUnverifiedReconciliation = async (): Promise<AndroidReminderScheduleResult> => {
      await rollbackAttemptedSchedules();
      result.status = 'error';
      result.verifiedCount = 0;
      result.scheduledIds = [];
      result.failedScheduleIds = [...new Set(
        [...validDesiredByNativeId.values()].map((item) => item.scheduleId),
      )];
      return result;
    };
    let ownedFutureCount = ownedActual.size;
    for (const [nativeId, desired] of desiredByNativeId) {
      if (blockedNativeIds.has(nativeId)) continue;
      const actual = ownedActual.get(nativeId);
      if (!actual) {
        if (ownedFutureCount >= MAX_OWNED_FUTURE_REMINDERS) continue;
        attemptedScheduleNativeIds.add(nativeId);
        try {
          await scheduleAndroidFutureReminder(Notifications, nativeId, desired);
          newlyScheduledNativeIds.add(nativeId);
          ownedFutureCount += 1;
        } catch {
          // Tek seferlik doğrulama turu eksik isteği aynı deterministik kimlikle
          // yeniden deneyecek. İlk native exception kalıcı kabul edilmez.
        }
      }
    }

    // `scheduleNotificationAsync` resolve olması, bazı OEM/native store hata
    // koşullarında alarmın gerçekten envantere girdiğini kanıtlamaz. Yazımdan
    // sonra Expo'nun kalıcı native listesini oku; eksikleri aynı kimlikle bir kez
    // daha kur ve tekrar doğrula. Deterministik identifier retry'ı çoğaltmaz.
    const readOwnedInventory = async (): Promise<
      Map<string, import('expo-notifications').NotificationRequest> | null
    > => {
      try {
        const requests = await Notifications.getAllScheduledNotificationsAsync();
        return new Map(
          requests
            .filter(ownedFutureReminderRequest)
            .map((request) => [request.identifier, request]),
        );
      } catch {
        return null;
      }
    };

    let verifiedActual = await readOwnedInventory();
    if (!verifiedActual) {
      return failUnverifiedReconciliation();
    }

    const missingAfterFirstPass = [...desiredByNativeId.entries()].filter(
      ([nativeId, desired]) => {
        const request = verifiedActual?.get(nativeId);
        return !request || !nativeFutureRequestMatches(request, desired);
      },
    );
    if (missingAfterFirstPass.length > 0) {
      let verifiedOwnedCount = verifiedActual.size;
      for (const [nativeId, desired] of missingAfterFirstPass) {
        if (blockedNativeIds.has(nativeId)
          || verifiedOwnedCount >= MAX_OWNED_FUTURE_REMINDERS) continue;
        attemptedScheduleNativeIds.add(nativeId);
        try {
          await scheduleAndroidFutureReminder(Notifications, nativeId, desired);
          newlyScheduledNativeIds.add(nativeId);
          verifiedOwnedCount += 1;
        } catch {
          // İkinci deneme de başarısızsa final doğrulama failedScheduleIds'e yazar.
        }
      }
      const afterRetry = await readOwnedInventory();
      if (!afterRetry) {
        return failUnverifiedReconciliation();
      }
      verifiedActual = afterRetry;
    }

    // Cleanup kararları da ilk snapshot yerine son doğrulanmış native listeyi
    // kullanır. Böylece schedule çağrısından sonra kaybolan kayıt ledger'da
    // başarılı/baseline edilmiş görünmez.
    ownedActual.clear();
    for (const [nativeId, request] of verifiedActual) ownedActual.set(nativeId, request);

    for (const [nativeId, desired] of desiredByNativeId) {
      const actual = verifiedActual.get(nativeId);
      if (!actual || !nativeFutureRequestMatches(actual, desired)) {
        result.failedScheduleIds.push(desired.scheduleId);
        continue;
      }
      result.verifiedCount += 1;
      if (newlyScheduledNativeIds.has(nativeId)) result.scheduledIds.push(desired.scheduleId);
      const previous = previousState?.records[desired.scheduleId];
      finalRecords[desired.scheduleId] = {
        nativeIdentifier: nativeId,
        notificationId: desired.notificationId,
        revision: desired.revision,
        feedRevision: desired.feedRevision,
        triggerAt: desired.triggerAt,
        scheduledAt: previous?.revision === desired.revision
          && previous.triggerAt === desired.triggerAt
          ? previous.scheduledAt
          : now,
      };
    }

    // İptali başarısız stale istekleri ledger'da kaybetme. Bir sonraki actual-vs-
    // desired pass aynı native kaydı yeniden görüp iptali tekrar dener.
    for (const nativeId of blockedNativeIds) {
      const scheduleId = nativeId.slice(FUTURE_REMINDER_PREFIX.length);
      const previous = previousState?.records[scheduleId];
      if (previous) finalRecords[scheduleId] = previous;
    }

    // DATE alarmı tetiklenince Expo scheduled envanterinden çıkar ama Android
    // tray kopyası yaşayabilir. Feed oluşmadan borç kapanır veya plan pause/delete
    // edilirse retiredId üretilemez; önceki içeriksiz ledger bu kopyayı bulup
    // yalnız artık etkin olmayan domain varlıkları için best-effort temizler.
    for (const [scheduleId, previous] of Object.entries(previousState?.records ?? {})) {
      if (finalRecords[scheduleId]
        || ownedActual.has(previous.nativeIdentifier)
        || dismissedNativeIds.has(previous.nativeIdentifier)) continue;
      const activeFeedRevision = activeReminderPresentations.get(previous.notificationId);
      if (activeFeedRevision && previous.feedRevision === activeFeedRevision) {
        // Alarm scheduled envanterinden düşmüş olsa da görünür tray kopyasının
        // sonraki settle/pause/reschedule işleminde bulunabilmesi için cleanup
        // handle'ını ledger'da koru.
        finalRecords[scheduleId] = previous;
        continue;
      }
      try {
        await Notifications.dismissNotificationAsync(previous.nativeIdentifier);
        dismissedNativeIds.add(previous.nativeIdentifier);
      } catch {
        // Sunulmuş kayıt kullanıcı tarafından kaldırılmış olabilir. Yeni schedule
        // kurulmadığından sonraki sync aynı stale ledger cleanup'ını tekrar dener.
        finalRecords[scheduleId] = previous;
      }
    }

    try {
      await saveAndroidReminderScheduleSnapshot(
        { version: 1, updatedAt: now, records: finalRecords },
        Object.values(finalRecords).map((record) => ({
          notificationId: record.notificationId,
          nativeIdentifier: record.nativeIdentifier,
          handledAt: now,
        })),
      );
    } catch {
      // Native schedule başarılı ama iki ledger'ın ortak commit'i başarısızsa
      // yeni OS yan etkisini geri al. Stale iptal edilen kayıtlar sonraki sync'te
      // desired kaynaktan yeniden kurulabilir.
      await rollbackAttemptedSchedules();
      // Hermes ES2025 iterator helper'larını garanti etmez; önce diziye aç.
      result.failedScheduleIds = [...new Set([
        ...result.failedScheduleIds,
        ...[...validDesiredByNativeId.values()].map((item) => item.scheduleId),
      ])];
      result.scheduledIds = [];
      result.verifiedCount = 0;
      result.status = 'error';
    }

    return result;
  });
}

/** Uygulama içinden silinen bildirimin tray kopyasını da kaldırır. */
export async function dismissAndroidSystemNotifications(
  ids: readonly string[],
): Promise<void> {
  const unsupported = canUseAndroidNotifications();
  if (unsupported || ids.length === 0) return;

  const Notifications = await loadNotificationsModule();
  await enqueueNotificationMutation(async () => {
    const state = await loadAndroidDeliveryStateStrict();
    if (!state) return;
    let stateChanged = false;
    for (const id of new Set(ids)) {
      const nativeIdentifier = state.records[id]?.nativeIdentifier;
      if (nativeIdentifier) {
        if (nativeIdentifier.startsWith(FUTURE_REMINDER_PREFIX)) {
          try {
            await Notifications.cancelScheduledNotificationAsync(nativeIdentifier);
          } catch {
            // Gelecekteki alarmın kaldığı belirsizken baseline'ı silmek, aynı
            // occurrence'ın ikinci kez kurulmasına yol açabilir.
            continue;
          }
        }
        try {
          await Notifications.dismissNotificationAsync(nativeIdentifier);
        } catch {
          // Eski panel kopyasının kaldığı belirsizken ledger'ı silip aynı ID'yi
          // yeniden teslim ederek çift bildirim üretme.
          continue;
        }
      }
      if (state.records[id]) {
        delete state.records[id];
        stateChanged = true;
      }
    }
    if (stateChanged) await saveAndroidDeliveryState(state);
  });
}

/**
 * Eski sürümlerin uygulama açılışında yanlışlıkla ürettiği anlık
 * schedule kopyalarını temizler. Aynı feed kimliğine bağlı gerçek future
 * alarm/tray handle'ına dokunmaz; kullanıcının meşru zamanlı uyarısı
 * uygulama açıldı diye panelden kaybolmamalıdır.
 */
export async function dismissAndroidImmediateSystemNotifications(
  ids: readonly string[],
): Promise<void> {
  const unsupported = canUseAndroidNotifications();
  if (unsupported || ids.length === 0) return;

  const Notifications = await loadNotificationsModule();
  await enqueueNotificationMutation(async () => {
    const state = await loadAndroidDeliveryStateStrict();
    if (!state) return;
    let stateChanged = false;
    for (const id of new Set(ids)) {
      const nativeIdentifier = state.records[id]?.nativeIdentifier;
      if (!nativeIdentifier || nativeIdentifier.startsWith(FUTURE_REMINDER_PREFIX)) continue;
      try {
        await Notifications.dismissNotificationAsync(nativeIdentifier);
      } catch {
        // Panel kopyasının kaldığı belirsizse handle'ı koru; bir sonraki
        // startup/resume geçiş temizliğini aynı kimlikle yeniden dener.
        continue;
      }
      delete state.records[id];
      sessionScheduledIds.delete(id);
      stateChanged = true;
    }
    if (stateChanged) await saveAndroidDeliveryState(state);
  });
}

function responseNotificationId(response: import('expo-notifications').NotificationResponse): string | null {
  const value = response.notification.request.content.data?.sparkNotificationId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Warm/cold notification tap'lerini tek route callback'inde birleştirir. */
export async function subscribeAndroidNotificationResponses(
  onOpen: (notificationId: string) => void | Promise<void>,
): Promise<() => void> {
  const unsupported = canUseAndroidNotifications();
  if (unsupported) return () => {};

  const Notifications = await loadNotificationsModule();
  const handledRequests = new Set<string>();
  const inFlightRequests = new Map<string, Promise<boolean>>();

  const handle = (response: import('expo-notifications').NotificationResponse): Promise<boolean> => {
    const notificationId = responseNotificationId(response);
    const requestId = response.notification.request.identifier;
    if (!notificationId) return Promise.resolve(false);
    if (handledRequests.has(requestId)) return Promise.resolve(true);
    const existing = inFlightRequests.get(requestId);
    if (existing) return existing;

    const task = Promise.resolve()
      .then(() => onOpen(notificationId))
      .then(() => {
        handledRequests.add(requestId);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        inFlightRequests.delete(requestId);
      });
    inFlightRequests.set(requestId, task);
    return task;
  };

  const handleAndClearIfStillLatest = async (
    response: import('expo-notifications').NotificationResponse,
  ): Promise<boolean> => {
    if (!await handle(response)) return false;
    const requestId = response.notification.request.identifier;
    try {
      // Slot globaldir: A callback'i sürerken B tap'i geldiyse A'nın clear'i
      // B'nin retry kaydını silmemeli. Yalnız hâlâ işlediğimiz response latest ise
      // tüket; callback başarısızlığında handle false döner ve slot korunur.
      const latest = await Notifications.getLastNotificationResponseAsync();
      if (latest?.notification.request.identifier !== requestId) return true;
      await Notifications.clearLastNotificationResponseAsync();
      return true;
    } catch {
      // Route işlendi; kalıcı slot okunamadı/temizlenemedi. Daha yeni bir tap'i
      // yanlışlıkla silmektense sonraki bootstrap retry'ını koru.
      return false;
    }
  };

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleAndClearIfStillLatest(response);
  });

  try {
    const initial = await Notifications.getLastNotificationResponseAsync();
    if (initial) await handleAndClearIfStillLatest(initial);
  } catch {
    // Warm listener yaşamaya devam eder. Cold response temizlenmez; sonraki
    // açılışta tekrar denenebilir ve kurulmuş subscription sızdırılmaz.
  }

  return () => subscription.remove();
}
