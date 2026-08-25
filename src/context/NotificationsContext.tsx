import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { InAppNotification, NotificationMuteChannel } from '../notifications/types';
import { runNotificationSync } from '../notifications/buildNotifications';
import {
  dismissFeedItems,
  enqueueNotificationMutation,
  loadFeedStrict,
  saveFeed,
  loadMutesStrict,
  saveMutes,
  type DismissNotificationsResult,
} from '../notifications/storage';
import { useRefresh } from './RefreshContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  deliverAndroidSystemNotifications,
  dismissAndroidImmediateSystemNotifications,
  dismissAndroidSystemNotifications,
  isAndroidNotificationDeliveryActivated,
  type AndroidNotificationSetupStatus,
} from '../services/androidNotificationsSetup';
import {
  localizeNotificationParams,
  notificationPresentationRevision,
} from '../notifications/presentation';
import { isNotificationMuted } from '../notifications/channels';
import { RecurringPaymentReminderDao } from '../db/recurringPaymentReminderDao';
import { getToday } from '../utils/dateUtils';
import { syncAndroidReminderSchedules } from '../services/reminderScheduler';
import {
  isScheduledReminderCatchUpNotificationId,
  reminderNotificationFamilyKeyFromId,
} from '../notifications/reminderNotificationFeed';

export interface NativeReminderScheduleHealth {
  status: AndroidNotificationSetupStatus;
  desiredCount: number;
  verifiedCount: number;
  failedScheduleCount: number;
  failedCancelCount: number;
}

interface NotificationsContextValue {
  feed: InAppNotification[];
  unreadCount: number;
  syncing: boolean;
  sync: () => Promise<void>;
  openFromNotification: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<DismissNotificationsResult>;
  dismissMany: (ids: readonly string[]) => Promise<DismissNotificationsResult>;
  setMute: (channel: NotificationMuteChannel, muted: boolean) => Promise<void>;
  mutes: Partial<Record<NotificationMuteChannel, boolean>>;
  nativeScheduleHealth: NativeReminderScheduleHealth | null;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { refreshKey } = useRefresh();
  const { t } = useLanguage();
  const [feed, setFeed] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [mutes, setMutes] = useState<Partial<Record<NotificationMuteChannel, boolean>>>({});
  const [nativeScheduleHealth, setNativeScheduleHealth] =
    useState<NativeReminderScheduleHealth | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncCountRef = useRef(0);
  const syncTailRef = useRef<Promise<void>>(Promise.resolve());

  const loadMutesState = useCallback(async () => {
    try {
      await enqueueNotificationMutation(async () => {
        setMutes(await loadMutesStrict());
      });
    } catch (error) {
      console.warn('[notifications] initial mutes load failed', error);
    }
  }, []);

  const executeSync = useCallback(async (
    options: { suppressImmediateDelivery?: boolean },
    deliveryWasActivatedAtInvocation: boolean,
  ) => {
    try {
      let delivery:
        | {
            feed: InAppNotification[];
            createdIds: string[];
            retiredIds: string[];
            mutes: Partial<Record<NotificationMuteChannel, boolean>>;
          }
        | undefined;
      await enqueueNotificationMutation(async () => {
        const m = await loadMutesStrict();
        setMutes(m);
        const result = await runNotificationSync(m);
        const { feed: next, unreadCount: uc } = result;
        setFeed(next);
        setUnreadCount(uc);
        delivery = {
          feed: next,
          createdIds: result.createdIds ?? [],
          retiredIds: result.retiredIds ?? [],
          mutes: m,
        };
      });

      // Native teslimat finansal/feed transaction'ının parçası değildir. Android
      // izni veya OS scheduling başarısız olsa bile uygulama-içi merkez korunur.
      if (delivery) {
        const deliveryMutes = delivery.mutes;
        if (delivery.retiredIds.length > 0) {
          try {
            await dismissAndroidSystemNotifications(delivery.retiredIds);
          } catch (error) {
            if (__DEV__) console.warn('[notifications] stale tray cleanup failed', error);
          }
        }
        const nativeFeed = delivery.feed.filter(
          (item) => !isNotificationMuted(item.id, deliveryMutes),
        );
        // İlk pre-reveal sync zamanlı aileden bir catch-up kaydı oluşturmuş olabilir; reveal sonrası
        // `createdIds` artık boş olsa da iki dakikalık tazelik köprüsü onu yeniden
        // tray'e taşımamalıdır. Bu yüzden yalnız yeni ID'leri değil kanonik feed'de
        // yaşayan tüm overdue catch-up kayıtlarını baseline et.
        const catchUpIds = delivery.feed
          .filter((item) => isScheduledReminderCatchUpNotificationId(item.id))
          .map((item) => item.id);
        const nativeCreatedIds = delivery.createdIds.filter(
          (id) => !isNotificationMuted(id, deliveryMutes)
            && !isScheduledReminderCatchUpNotificationId(id),
        );
        const suppressedIds = [...new Set(
          delivery.feed
            .filter((item) => isNotificationMuted(item.id, deliveryMutes))
            .map((item) => item.id)
            .concat(catchUpIds),
        )];
        let schedulerReadyForCursorAdvance = false;
        try {
          const schedulerResult = await syncAndroidReminderSchedules(t, deliveryMutes);
          setNativeScheduleHealth({
            status: schedulerResult.status,
            desiredCount: schedulerResult.desiredCount,
            verifiedCount: schedulerResult.verifiedCount,
            failedScheduleCount: schedulerResult.failedScheduleIds.length,
            failedCancelCount: schedulerResult.failedCancelIds.length,
          });
          // Provider ilk kez açılış perdesinin arkasında sync olabilir. Native
          // teslim henüz etkin değilse cursor'ı ilerletmek cold-tap bağlamını
          // normal bootstrap sync'inden önce yok eder. Reveal sonrası bootstrap
          // aynı yolu yeniden çağırıp ancak o zaman cursor'ı ilerletir.
          const fullyVerifiedNativeSchedule = schedulerResult.status === 'ready'
            && schedulerResult.desiredCount === schedulerResult.verifiedCount
            && schedulerResult.failedScheduleIds.length === 0
            && schedulerResult.failedCancelIds.length === 0;
          const feedOnlyDelivery = schedulerResult.status === 'denied'
            || schedulerResult.status === 'unsupported'
            || schedulerResult.status === 'expo_go';
          schedulerReadyForCursorAdvance = deliveryWasActivatedAtInvocation
            && (fullyVerifiedNativeSchedule || feedOnlyDelivery);
        } catch (error) {
          setNativeScheduleHealth({
            status: 'error',
            desiredCount: 0,
            verifiedCount: 0,
            failedScheduleCount: 0,
            failedCancelCount: 0,
          });
          // Native scheduler ikincil yan etkidir; feed ve finansal kayıtlar kanonik
          // kalır, bir sonraki refresh/resume actual-vs-desired retry yapar.
          if (__DEV__) console.warn('[notifications] reminder schedule sync failed', error);
        }

        // Future actual-vs-desired uzlaştırması anlık köprüden önce çalışır.
        // Native planlı ailelerin uygulama açılışında hesaplanan karşılıkları
        // yalnız feed catch-up'ıdır. Eski sürümde anlık tray'e sızan kopyayı
        // geçiş sırasında temizle; aşağıdaki baseline tekrar dirilmesini önler.
        if (catchUpIds.length > 0) {
          try {
            await dismissAndroidImmediateSystemNotifications(catchUpIds);
          } catch (error) {
            if (__DEV__) console.warn('[notifications] catch-up tray cleanup failed', error);
          }
        }
        if (!options.suppressImmediateDelivery) {
          try {
            await deliverAndroidSystemNotifications(
              nativeFeed.map((item) => ({
                id: item.id,
                title: t(item.titleKey, localizeNotificationParams(item.params, t)),
                body: item.id === 'sys-scan-err'
                  ? t('notif_scan_err_native_b')
                  : t(item.bodyKey, localizeNotificationParams(item.params, t)),
                severity: item.severity,
                createdAt: item.createdAt,
                read: item.read,
                revision: notificationPresentationRevision(item),
              })),
              { newlyCreatedIds: nativeCreatedIds, suppressedIds },
            );
          } catch (error) {
            if (__DEV__) console.warn('[notifications] immediate Android delivery failed', error);
          }
        }

        // Cursor ödeme kanıtı değildir. Önce eski oluşumdan `date_passed`
        // feed/tap bağlamını ve yeni rolling horizon'ı üret, ancak bundan sonra
        // kalıcı ekranda bugünkü/sonraki gerçek oluşuma ilerlet. Böylece Doze ile
        // ertesi güne geciken alarm uygulama açılışında sessizce kaybolmaz.
        if (schedulerReadyForCursorAdvance) {
          try {
            await RecurringPaymentReminderDao.advancePastDue(getToday());
          } catch (error) {
            if (__DEV__) console.warn('[notifications] reminder cursor advance failed', error);
          }
        }
      }
    } catch (error) {
      console.warn('[notifications] sync failed', error);
    } finally {
      pendingSyncCountRef.current = Math.max(0, pendingSyncCountRef.current - 1);
      if (pendingSyncCountRef.current === 0) setSyncing(false);
    }
  }, [t]);

  const runSync = useCallback((
    options: { suppressImmediateDelivery?: boolean } = {},
  ): Promise<void> => {
    // Kuyrukta bekleyen pre-reveal bir çağrı, perde bu arada kalktı diye cursor
    // yetkisi kazanamaz; aktivasyon çağrı anında snapshotlanır.
    const deliveryWasActivatedAtInvocation = isAndroidNotificationDeliveryActivated();
    pendingSyncCountRef.current += 1;
    setSyncing(true);
    const task = syncTailRef.current.then(
      () => executeSync(options, deliveryWasActivatedAtInvocation),
      () => executeSync(options, deliveryWasActivatedAtInvocation),
    );
    // Bir sync hatası sonraki refresh/tap işini zincirden düşürmemeli.
    syncTailRef.current = task.catch(() => undefined);
    return task;
  }, [executeSync]);

  const sync = useCallback(() => runSync(), [runSync]);

  useEffect(() => {
    loadMutesState();
  }, [loadMutesState]);

  // P5: Debounce — ardışık triggerRefresh() çağrılarında fazladan sorgu engellenir
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void sync();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshKey, sync]);

  // Tarihe bağlı abonelik/yedek kuralları uygulama arka planda gün değiştirince
  // eski kalmasın. Tam kapalı uygulamada yeni veri hesaplanamaz; yeniden açılışta
  // ilk sync aynı yolu çalıştırır.
  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      const resumed = previous !== 'active' && next === 'active';
      previous = next;
      if (resumed) void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  const markRead = useCallback(async (id: string) => {
    await enqueueNotificationMutation(async () => {
      const cur = await loadFeedStrict();
      const exact = cur.some((item) => item.id === id);
      const reminderFamily = exact ? null : reminderNotificationFamilyKeyFromId(id);
      const next = cur.map((f) => (
        f.id === id
        || (reminderFamily != null
          && reminderNotificationFamilyKeyFromId(f.id) === reminderFamily)
          ? { ...f, read: true }
          : f
      ));
      await saveFeed(next);
      setFeed(next);
      setUnreadCount(next.filter((f) => !f.read).length);
    });
  }, []);

  const openFromNotification = useCallback(async (id: string) => {
    // Kullanıcı zaten OS bildirimine dokundu: sync'in aynı olay için yeni bir
    // anlık tray kopyası üretmesini engelle, ardından aynı reminder ailesinin
    // o anki kanonik feed aşamasını okunmuş say.
    await runSync({ suppressImmediateDelivery: true });
    await markRead(id);
  }, [markRead, runSync]);

  const markAllRead = useCallback(async () => {
    await enqueueNotificationMutation(async () => {
      const cur = await loadFeedStrict();
      const next = cur.map((f) => ({ ...f, read: true }));
      await saveFeed(next);
      setFeed(next);
      setUnreadCount(0);
    });
  }, []);

  const dismissMany = useCallback(async (ids: readonly string[]) => {
    const result = await enqueueNotificationMutation(async () => {
      const result = await dismissFeedItems(ids);
      setFeed(result.feed);
      setUnreadCount(result.unreadCount);
      return result;
    });
    try {
      await dismissAndroidSystemNotifications(result.removedIds);
    } catch (error) {
      // Feed silme kanonik işlemdir. Native tray temizliği best-effort'tur;
      // modül/OS hatası kullanıcıya "silinemedi" diye yanlış geri dönmemelidir.
      if (__DEV__) console.warn('[notifications] tray dismissal failed', error);
    }
    return result;
  }, []);

  const dismiss = useCallback(
    async (id: string) => dismissMany([id]),
    [dismissMany],
  );

  const setMute = useCallback(async (channel: NotificationMuteChannel, muted: boolean) => {
    await enqueueNotificationMutation(async () => {
      const current = await loadMutesStrict();
      const next = { ...current, [channel]: muted };
      await saveMutes(next);
      setMutes(next);
    });
    await sync();
  }, [sync]);

  const value = useMemo(
    () => ({
      feed,
      unreadCount,
      syncing,
      sync,
      openFromNotification,
      markRead,
      markAllRead,
      dismiss,
      dismissMany,
      setMute,
      mutes,
      nativeScheduleHealth,
    }),
    [
      feed,
      unreadCount,
      syncing,
      sync,
      openFromNotification,
      markRead,
      markAllRead,
      dismiss,
      dismissMany,
      setMute,
      mutes,
      nativeScheduleHealth,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
