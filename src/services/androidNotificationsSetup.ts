import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

import {
  enqueueNotificationMutation,
  loadAndroidDeliveryStateStrict,
  loadFeedStrict,
  saveAndroidDeliveryState,
  type AndroidDeliveryState,
} from '../notifications/storage';
import type { NotificationSeverity } from '../notifications/types';
import { notificationPresentationRevision } from '../notifications/presentation';

type ExpoNotificationsModule = typeof import('expo-notifications');

export const ANDROID_UPDATES_CHANNEL_ID = 'spark-updates-v1';
export const ANDROID_ALERTS_CHANNEL_ID = 'spark-alerts-v1';

const FIRST_ENABLE_FRESHNESS_MS = 2 * 60 * 1000;
const NOTIFICATION_ACCENT = '#00EB64';

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
  options: { newlyCreatedIds?: readonly string[]; now?: number } = {},
): Promise<AndroidDeliveryResult> {
  if (!deliveryActivated) return emptyDeliveryResult('not_ready');
  // Otomatik sync kullanıcıya tekrar tekrar izin penceresi açmaz. İlk açık izin
  // isteği reveal sonrası bootstrap'te yapılır; ret sonrası dönüş OS ayarlarıdır.
  const status = await ensureAndroidNotificationSetup(false);
  if (status !== 'ready') return emptyDeliveryResult(status);

  const Notifications = await loadNotificationsModule();
  const now = options.now ?? Date.now();
  const newlyCreated = new Set(options.newlyCreatedIds ?? []);

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
      const eligibleOnFirstEnable = newlyCreated.has(item.id) || isFresh;

      if (
        !canonical ||
        canonical.read ||
        item.read ||
        !renderable ||
        (firstEnable && !eligibleOnFirstEnable)
      ) {
        // Baseline/read kaydı: daha sonra eski bir feed öğesi yanlışlıkla yeni
        // sistem bildirimi olarak dirilmesin.
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
    for (const id of new Set(ids)) {
      const nativeIdentifier = state.records[id]?.nativeIdentifier;
      if (!nativeIdentifier) continue;
      try {
        await Notifications.dismissNotificationAsync(nativeIdentifier);
      } catch {
        // Android tray öğesi kullanıcı tarafından zaten kaldırılmış olabilir.
      }
    }
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

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void handle(response);
  });

  try {
    const initial = await Notifications.getLastNotificationResponseAsync();
    if (initial && await handle(initial)) {
      await Notifications.clearLastNotificationResponseAsync();
    }
  } catch {
    // Warm listener yaşamaya devam eder. Cold response temizlenmez; sonraki
    // açılışta tekrar denenebilir ve kurulmuş subscription sızdırılmaz.
  }

  return () => subscription.remove();
}
