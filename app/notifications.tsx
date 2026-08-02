// S.P.A.R.K. — Bildirimler (tam ekran, tema uyumlu)
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
} from 'react';
import {
  BackHandler,
  View,
  Text,
  StyleSheet,
  Pressable,
  SectionList,
  Switch,
  ScrollView,
  RefreshControl,
  Modal,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';

import BottomSheetModal from '../src/components/BottomSheetModal';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import NotificationSwipeCard from '../src/components/NotificationSwipeCard';
import { SparkToast } from '../src/components/SparkToast';
import { Colors } from '../src/theme/colors';
import { useAppTheme } from '../src/theme/themeStore';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useNotifications } from '../src/context/NotificationsContext';
import type {
  InAppNotification,
  NotificationMuteChannel,
  NotificationSeverity,
} from '../src/notifications/types';
import { localizeNotificationParams } from '../src/notifications/presentation';
import {
  ensureAndroidNotificationSetup,
  type AndroidNotificationSetupStatus,
} from '../src/services/androidNotificationsSetup';
import { formatDate } from '../src/utils/dateUtils';
const MUTE_CHANNELS: { key: NotificationMuteChannel; labelKey: string }[] = [
  { key: 'budget', labelKey: 'notif_mute_budget' },
  { key: 'category_limit', labelKey: 'notif_mute_category' },
  { key: 'goal', labelKey: 'notif_mute_goal' },
  { key: 'receipt', labelKey: 'notif_mute_receipt' },
  { key: 'subscription', labelKey: 'notif_mute_subscription' },
  { key: 'backup', labelKey: 'notif_mute_backup' },
  { key: 'system', labelKey: 'notif_mute_system' },
];

type FilterKey =
  | 'all'
  | 'budget'
  | 'category'
  | 'goal'
  | 'receipt'
  | 'subscription'
  | 'backup'
  | 'system';

const FILTER_DEF: { key: FilterKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'notif_filter_all' },
  { key: 'budget', labelKey: 'notif_filter_budget' },
  { key: 'category', labelKey: 'notif_filter_category' },
  { key: 'goal', labelKey: 'notif_filter_goal' },
  { key: 'receipt', labelKey: 'notif_filter_receipt' },
  { key: 'subscription', labelKey: 'notif_filter_subscription' },
  { key: 'backup', labelKey: 'notif_filter_backup' },
  { key: 'system', labelKey: 'notif_filter_system' },
];

function channelFromId(id: string): Exclude<FilterKey, 'all'> {
  if (id.startsWith('budget-') || id.startsWith('month-')) return 'budget';
  if (id.startsWith('catlim-')) return 'category';
  if (id.startsWith('goal-')) return 'goal';
  if (id.startsWith('receipt-')) return 'receipt';
  if (id.startsWith('sub-')) return 'subscription';
  if (id.startsWith('backup-')) return 'backup';
  return 'system';
}

type MciName = NonNullable<ComponentProps<typeof MaterialCommunityIcons>['name']>;

/** Bildirim kanalına göre liste ikonu (çiplerle uyumlu: Bütçe, Kategori, …) */
function notificationIconName(id: string): MciName {
  switch (channelFromId(id)) {
    case 'budget':
      return 'wallet-outline';
    case 'category':
      return 'tag-multiple-outline';
    case 'goal':
      return 'flag-checkered';
    case 'receipt':
      return 'receipt-text-outline';
    case 'subscription':
      return 'autorenew';
    case 'backup':
      return 'cloud-upload-outline';
    case 'system':
    default:
      return 'cog-outline';
  }
}

/** Büyük dolu renk diskleri yerine önem seviyesini sakin, tonal bir vurguyla gösterir. */
function notificationAccent(severity: NotificationSeverity, isDark: boolean): string {
  switch (severity) {
    case 'critical':
      return isDark ? '#FF6666' : '#D92D20';
    case 'warning':
      return isDark ? '#F6C453' : '#A86400';
    case 'info':
    default:
      return isDark ? Colors.primaryLight : '#007A33';
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function groupFeedByDay(
  items: InAppNotification[],
  t: (key: string, params?: Record<string, string | number>) => string
): { title: string; data: InAppNotification[] }[] {
  const map = new Map<string, InAppNotification[]>();
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  for (const it of sorted) {
    const day = new Date(it.createdAt);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries()).map(([dateStr, data]) => ({
    title: formatDate(dateStr, t as Parameters<typeof formatDate>[1]),
    data,
  }));
}

const LIST_PREVIEW_LINES = 2;
const winH = Dimensions.get('window').height;
const SCREEN = Dimensions.get('screen');

export default function NotificationsScreen() {
  const scheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(scheme === 'dark'), [scheme]);
  const router = useRouter();
  const { t } = useLanguage();
  const {
    feed,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    dismissMany,
    setMute,
    mutes,
    sync,
    syncing,
  } = useNotifications();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [muteModal, setMuteModal] = useState(false);
  const [systemNotificationStatus, setSystemNotificationStatus] =
    useState<AndroidNotificationSetupStatus | null>(null);
  const [detailNotifId, setDetailNotifId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const openSwipeRef = useRef<SwipeableMethods | null>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (!muteModal || Platform.OS !== 'android') return;
    let cancelled = false;
    void ensureAndroidNotificationSetup(false).then((status) => {
      if (!cancelled) setSystemNotificationStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [muteModal]);

  const closeOpenSwipe = useCallback(() => {
    openSwipeRef.current?.close();
    openSwipeRef.current = null;
  }, []);

  const registerOpenSwipe = useCallback((methods: SwipeableMethods) => {
    if (openSwipeRef.current && openSwipeRef.current !== methods) {
      openSwipeRef.current.close();
    }
    openSwipeRef.current = methods;
  }, []);

  const unregisterOpenSwipe = useCallback((methods: SwipeableMethods) => {
    if (openSwipeRef.current === methods) {
      openSwipeRef.current = null;
    }
  }, []);

  const exitSelection = useCallback(() => {
    closeOpenSwipe();
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkDeleteVisible(false);
  }, [closeOpenSwipe]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCardLongPress = useCallback(
    (id: string) => {
      closeOpenSwipe();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (selectionMode) {
        toggleSelection(id);
      } else {
        setSelectionMode(true);
        setSelectedIds(new Set([id]));
      }
    },
    [closeOpenSwipe, selectionMode, toggleSelection],
  );

  const handleCardPress = useCallback(
    (item: InAppNotification) => {
      closeOpenSwipe();

      if (selectionMode) {
        void Haptics.selectionAsync();
        toggleSelection(item.id);
        return;
      }

      if (!item.read) {
        void markRead(item.id).catch((error) => {
          console.warn('[notifications] mark read failed', error);
        });
      }
      setDetailNotifId(item.id);
    },
    [closeOpenSwipe, markRead, selectionMode, toggleSelection],
  );

  const handleSingleDelete = useCallback(
    async (id: string) => {
      try {
        const result = await dismiss(id);
        if (result.removedCount > 0) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.warn('[notifications] swipe dismiss failed', error);
        SparkToast.show(t('delete_failed'), 'error');
        throw error;
      }
    },
    [dismiss, t],
  );

  const openBulkDelete = useCallback(() => {
    if (selectedIds.size > 0 && !deletingRef.current) {
      setBulkDeleteVisible(true);
    }
  }, [selectedIds.size]);

  const runBulkDelete = useCallback(async () => {
    if (deletingRef.current) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setBulkDeleteVisible(false);
      return;
    }

    deletingRef.current = true;
    setDeleting(true);
    try {
      const result = await dismissMany(ids);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      exitSelection();
      SparkToast.show(
        t('notif_deleted_bulk', { count: result.removedCount.toString() }),
        'success',
      );
    } catch (error) {
      console.warn('[notifications] bulk dismiss failed', error);
      SparkToast.show(t('delete_failed'), 'error');
      setBulkDeleteVisible(false);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [dismissMany, exitSelection, selectedIds, t]);

  useFocusEffect(
    useCallback(() => {
      void sync();
    }, [sync])
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openSwipeRef.current) {
        closeOpenSwipe();
        return true;
      }
      if (selectionMode) {
        exitSelection();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [closeOpenSwipe, exitSelection, selectionMode]);

  useEffect(() => {
    closeOpenSwipe();
  }, [closeOpenSwipe, filter, selectionMode]);

  useEffect(() => {
    if (!selectionMode) return;
    const existing = new Set(feed.map((item) => item.id));
    setSelectedIds((previous) => {
      const next = new Set(Array.from(previous).filter((id) => existing.has(id)));
      if (next.size === previous.size) return previous;
      return next;
    });
  }, [feed, selectionMode]);

  const filtered = useMemo(() => {
    if (filter === 'all') return feed;
    return feed.filter((f) => channelFromId(f.id) === filter);
  }, [feed, filter]);

  // Detay yüzeyi feed'deki güncel kaydı gösterir. Satıcı adı bir senkronla
  // yenilenirse açık sheet eski notification snapshot'ında takılı kalmaz.
  const detailNotif = useMemo(
    () => (detailNotifId ? feed.find((item) => item.id === detailNotifId) ?? null : null),
    [detailNotifId, feed],
  );

  useEffect(() => {
    if (detailNotifId && !detailNotif) setDetailNotifId(null);
  }, [detailNotif, detailNotifId]);

  const sections = useMemo(() => groupFeedByDay(filtered, t), [filtered, t]);
  const isEmpty = sections.length === 0 || filtered.length === 0;
  const isDark = scheme === 'dark';
  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={selectionMode ? exitSelection : () => router.back()}
          style={({ pressed }) => [styles.circleBtn, pressed && styles.circleBtnPressed]}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={selectionMode ? t('cancel') : t('notif_go_back')}
          testID={selectionMode ? 'notifications-selection-cancel' : undefined}
        >
          <MaterialCommunityIcons
            name={selectionMode ? 'close' : 'chevron-left'}
            size={selectionMode ? 20 : 23}
            color={Colors.textPrimary}
          />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.pageTitle} numberOfLines={1} accessibilityRole="header">
            {selectionMode
              ? t('notif_selected', { count: selectedCount.toString() })
              : t('notif_center_title')}
          </Text>
          {!selectionMode && unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {selectionMode ? (
            <Pressable
              onPress={openBulkDelete}
              disabled={selectedCount === 0 || deleting}
              style={({ pressed }) => [
                styles.bulkDeleteBtn,
                (selectedCount === 0 || deleting) && styles.headerActionDisabled,
                pressed && selectedCount > 0 && !deleting && styles.bulkDeleteBtnPressed,
              ]}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('notif_delete_selected_title')}
              accessibilityState={{ disabled: selectedCount === 0 || deleting }}
              testID="notifications-selection-delete"
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={19}
                color={Colors.danger}
              />
            </Pressable>
          ) : (
            <>
              {unreadCount > 0 && (
                <Pressable
                  onPress={() => {
                    void markAllRead().catch((error) => {
                      console.warn('[notifications] mark all read failed', error);
                      SparkToast.show(t('operation_failed'), 'error');
                    });
                  }}
                  style={({ pressed }) => [styles.markReadBtn, pressed && styles.markReadBtnPressed]}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={t('notif_mark_all')}
                  testID="notifications-mark-all"
                >
                  <MaterialCommunityIcons
                    name="check-all"
                    size={19}
                    color={isDark ? Colors.primaryLight : '#007A33'}
                  />
                </Pressable>
              )}
              <Pressable
                onPress={() => setMuteModal(true)}
                style={({ pressed }) => [styles.circleBtn, pressed && styles.circleBtnPressed]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={t('notif_prefs_title')}
                testID="notifications-preferences"
              >
                <MaterialCommunityIcons name="tune-variant" size={19} color={Colors.textPrimary} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        scrollEnabled={!selectionMode}
        pointerEvents={selectionMode ? 'none' : 'auto'}
        style={[styles.chipsScroll, selectionMode && styles.chipsScrollDisabled]}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTER_DEF.map(({ key, labelKey }) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              disabled={selectionMode}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(labelKey)}
              hitSlop={{ top: 4, bottom: 4 }}
              testID={`notifications-filter-${key}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(labelKey)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionList
        style={styles.sectionList}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        extraData={{ selectionMode, selectedIds }}
        onScrollBeginDrag={closeOpenSwipe}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, Spacing.xl) + Spacing.lg },
          isEmpty ? styles.listContentWhenEmpty : styles.listContentWhenFilled,
          isEmpty && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={sync}
            enabled={!selectionMode}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        renderSectionHeader={({ section }) => {
          const isFirst = sections.length > 0 && section.title === sections[0].title;
          return (
            <View style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <View style={styles.sectionHeaderRule} />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="bell-off-outline" size={26} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyText}>{t('notif_empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const iconName = notificationIconName(item.id);
          const accent = notificationAccent(item.severity, isDark);
          const p = localizeNotificationParams(item.params, t);
          const title = t(item.titleKey, p);
          const body = t(item.bodyKey, p);
          const time = formatTime(item.createdAt);
          const selected = selectedIds.has(item.id);
          return (
            <NotificationSwipeCard
              enabled={!selectionMode}
              deleteLabel={t('delete')}
              onDelete={() => handleSingleDelete(item.id)}
              onWillOpen={registerOpenSwipe}
              onDidClose={unregisterOpenSwipe}
              testID={`notification-swipe-${item.id}`}
            >
              <View
                style={[
                  styles.card,
                  !selectionMode && !item.read && styles.cardUnread,
                  !selectionMode &&
                    !item.read && {
                      borderColor: `${accent}${isDark ? '4D' : '33'}`,
                      backgroundColor: `${accent}${isDark ? '0D' : '08'}`,
                    },
                  selectionMode && styles.cardSelection,
                  selectionMode && selected && styles.cardSelected,
                ]}
              >
                <Pressable
                  style={({ pressed }) => [styles.cardMain, pressed && styles.cardMainPressed]}
                  onPress={() => handleCardPress(item)}
                  onLongPress={() => handleCardLongPress(item.id)}
                  delayLongPress={380}
                  accessibilityRole={selectionMode ? 'checkbox' : 'button'}
                  accessibilityState={selectionMode ? { checked: selected } : undefined}
                  accessibilityLabel={`${!item.read ? `${t('notif_unread_label')}. ` : ''}${title}. ${body}. ${time}`}
                  accessibilityHint={selectionMode ? undefined : t('notif_select_hint')}
                  testID={`notification-card-${item.id}`}
                >
                  {selectionMode && (
                    <View style={styles.selectionCheck} pointerEvents="none">
                      <MaterialCommunityIcons
                        name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                        size={22}
                        color={selected ? Colors.primary : Colors.textMuted}
                      />
                    </View>
                  )}

                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: `${accent}${isDark ? '26' : '16'}` },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={18}
                      color={accent}
                      style={styles.iconGlyph}
                    />
                  </View>

                  <View style={styles.cardBody}>
                    <Text
                      style={[
                        styles.cardTitle,
                        !selectionMode && !item.read && styles.cardTitleUnread,
                      ]}
                      numberOfLines={LIST_PREVIEW_LINES}
                      ellipsizeMode="tail"
                    >
                      {title}
                    </Text>
                    <Text
                      style={styles.cardBodyText}
                      numberOfLines={LIST_PREVIEW_LINES}
                      ellipsizeMode="tail"
                    >
                      {body}
                    </Text>
                    <View style={styles.cardTimeRow}>
                      {!selectionMode && !item.read && (
                        <View
                          testID={`notification-unread-indicator-${item.id}`}
                          style={[styles.unreadDot, { backgroundColor: accent }]}
                          accessible={false}
                        />
                      )}
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={12}
                        color={isDark ? Colors.textSecondary : Colors.textMuted}
                      />
                      <Text style={styles.cardTime}>{time}</Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </NotificationSwipeCard>
          );
        }}
      />

      <GlassDeleteModal
        visible={bulkDeleteVisible}
        title={t('notif_delete_selected_title')}
        message={t('notif_delete_selected_confirm', {
          count: selectedCount.toString(),
        })}
        onCancel={() => {
          if (!deletingRef.current) setBulkDeleteVisible(false);
        }}
        onDelete={() => void runBulkDelete()}
      />

      <BottomSheetModal
        visible={detailNotif !== null}
        onClose={() => setDetailNotifId(null)}
        backdropColor={scheme === 'dark' ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)'}
        sheetStyle={[
          styles.detailSheet,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.lg },
        ]}
      >
        {detailNotif && (
          <>
            <View style={styles.detailHandle} />
            <Text style={styles.detailTitle} accessibilityRole="header">
              {t(detailNotif.titleKey, localizeNotificationParams(detailNotif.params, t))}
            </Text>
            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detailScrollContent}
              showsVerticalScrollIndicator
              bounces
            >
              <Text style={styles.detailBody}>
                {t(detailNotif.bodyKey, localizeNotificationParams(detailNotif.params, t))}
              </Text>
            </ScrollView>
            <Text style={styles.detailTime}>{formatTime(detailNotif.createdAt)}</Text>
            <Pressable
              style={({ pressed }) => [styles.detailCloseBtn, pressed && styles.detailCloseBtnPressed]}
              onPress={() => setDetailNotifId(null)}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <Text style={styles.detailCloseBtnText}>{t('close')}</Text>
            </Pressable>
          </>
        )}
      </BottomSheetModal>

      <Modal
        visible={muteModal}
        animationType="fade"
        transparent
        hardwareAccelerated
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setMuteModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMuteModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle} accessibilityRole="header">
              {t('notif_prefs_title')}
            </Text>
            <Text style={styles.modalHint}>{t('notif_mute_hint')}</Text>
            {Platform.OS === 'android' &&
              (systemNotificationStatus === 'ready' ||
                systemNotificationStatus === 'denied' ||
                systemNotificationStatus === 'error') && (
                <View
                  style={styles.systemNotificationRow}
                  testID="notifications-system-status"
                >
                  <View
                    style={[
                      styles.systemNotificationIcon,
                      systemNotificationStatus === 'ready'
                        ? styles.systemNotificationIconReady
                        : styles.systemNotificationIconDisabled,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={systemNotificationStatus === 'ready' ? 'bell-check-outline' : 'bell-off-outline'}
                      size={18}
                      color={systemNotificationStatus === 'ready' ? Colors.primary : Colors.warning}
                    />
                  </View>
                  <Text style={styles.systemNotificationText}>
                    {t(
                      systemNotificationStatus === 'ready'
                        ? 'notif_system_permission_ready'
                        : 'notif_system_permission_disabled',
                    )}
                  </Text>
                  {systemNotificationStatus !== 'ready' && (
                    <Pressable
                      onPress={() => {
                        void Linking.openSettings().catch(() => {
                          SparkToast.show(t('operation_failed'), 'error');
                        });
                      }}
                      style={({ pressed }) => [
                        styles.systemNotificationSettingsBtn,
                        pressed && styles.systemNotificationSettingsBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('notif_open_system_settings')}
                      testID="notifications-open-system-settings"
                    >
                      <Text style={styles.systemNotificationSettingsText}>
                        {t('notif_open_system_settings')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            {MUTE_CHANNELS.map(({ key, labelKey }) => (
              <View key={key} style={styles.muteRow}>
                <Text style={styles.muteLabel}>{t(labelKey)}</Text>
                <Switch
                  value={!!mutes[key]}
                  onValueChange={(v) => {
                    void setMute(key, v).catch((error) => {
                      console.warn('[notifications] mute update failed', error);
                      SparkToast.show(t('operation_failed'), 'error');
                    });
                  }}
                  trackColor={{
                    false: Colors.surfaceLight,
                    true: isDark ? 'rgba(0, 235, 100, 0.5)' : 'rgba(0, 178, 72, 0.55)',
                  }}
                  thumbColor={mutes[key] ? Colors.primary : Colors.textMuted}
                  accessibilityLabel={t(labelKey)}
                />
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.modalPrimaryBtnPressed]}
              onPress={() => setMuteModal(false)}
              accessibilityRole="button"
              accessibilityLabel={t('ok')}
            >
              <Text style={styles.modalPrimaryBtnText}>{t('ok')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** Şüşevar — yarı saydam cam yeşil (aydınlıkta daha doygun G + yüksek alfa → beyazımsı solma azalır) */
function susevarGlassFill(isDark: boolean): string {
  return isDark ? 'rgba(0, 235, 100, 0.52)' : 'rgba(0, 178, 72, 0.62)';
}

function susevarGlassBorder(isDark: boolean): string {
  return isDark ? 'rgba(160, 255, 200, 0.55)' : 'rgba(0, 155, 62, 0.38)';
}

const getStyles = (isDark: boolean) => {
  const glassFill = susevarGlassFill(isDark);
  const glassBorder = susevarGlassBorder(isDark);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: ScreenPadding.horizontal,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      minHeight: 56,
      gap: Spacing.md,
    },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleBtnPressed: {
      backgroundColor: Colors.surfaceLight,
      opacity: 0.82,
    },
    headerTitleWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    pageTitle: {
      ...Typography.headlineLarge,
      lineHeight: 30,
      color: Colors.textPrimary,
      fontFamily: FontFamily.extraBold,
      flexShrink: 1,
      letterSpacing: -0.35,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      lineHeight: 13,
      fontFamily: FontFamily.bold,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    markReadBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primaryGlow,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: `${Colors.primary}4D`,
    },
    markReadBtnPressed: {
      backgroundColor: `${Colors.primary}24`,
      opacity: 0.82,
    },
    bulkDeleteBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${Colors.danger}12`,
      borderWidth: 1,
      borderColor: `${Colors.danger}52`,
    },
    bulkDeleteBtnPressed: {
      backgroundColor: `${Colors.danger}24`,
      opacity: 0.82,
    },
    headerActionDisabled: {
      opacity: 0.38,
    },
    chipsScroll: {
      flexGrow: 0,
      width: '100%',
    },
    chipsScrollDisabled: {
      opacity: 0.48,
    },
    chipsRow: {
      paddingHorizontal: ScreenPadding.horizontal,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.md,
      gap: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: Colors.primaryGlow,
      borderColor: `${Colors.primary}66`,
    },
    chipPressed: {
      opacity: 0.76,
    },
    chipText: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
      fontFamily: FontFamily.semiBold,
      letterSpacing: 0.1,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    chipTextActive: {
      color: isDark ? Colors.primaryLight : Colors.primaryDark,
      fontFamily: FontFamily.bold,
    },
    sectionList: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: ScreenPadding.horizontal,
      paddingBottom: Spacing.xxl,
    },
    listContentWhenEmpty: {
      paddingTop: Spacing.xs,
    },
    listContentWhenFilled: {
      paddingTop: Spacing.xs,
    },
    listContentEmpty: {
      flexGrow: 1,
      justifyContent: 'flex-start',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    sectionHeaderFirst: {
      marginTop: Spacing.xs,
    },
    sectionHeaderText: {
      fontSize: 12,
      lineHeight: 17,
      color: isDark ? Colors.textSecondary : Colors.textMuted,
      fontFamily: FontFamily.semiBold,
      letterSpacing: 0.35,
      flexShrink: 0,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    sectionHeaderRule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.divider,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      position: 'relative',
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    cardUnread: {
      borderWidth: 1,
    },
    cardSelection: {
      backgroundColor: Colors.surface,
      borderColor: Colors.border,
    },
    cardSelected: {
      backgroundColor: Colors.primaryGlow,
      borderColor: `${Colors.primary}80`,
    },
    cardMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      paddingLeft: 14,
      paddingVertical: 14,
      paddingRight: 14,
    },
    cardMainPressed: {
      opacity: 0.7,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    selectionCheck: {
      width: 24,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: {
      textAlign: 'center',
      textAlignVertical: 'center',
      ...Platform.select({
        android: { includeFontPadding: false },
        default: {},
      }),
    },
    cardBody: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: 15,
      lineHeight: 20,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
      letterSpacing: 0,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    cardTitleUnread: {
      fontFamily: FontFamily.bold,
    },
    cardBodyText: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 19,
      fontFamily: FontFamily.regular,
      letterSpacing: 0.1,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    cardTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: 5,
    },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    cardTime: {
      fontSize: 11,
      lineHeight: 14,
      color: isDark ? Colors.textSecondary : Colors.textMuted,
      fontFamily: FontFamily.medium,
      letterSpacing: 0.2,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    empty: {
      alignItems: 'center',
      paddingTop: Spacing.xxxl,
      paddingBottom: Spacing.xl,
      gap: Spacing.lg,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    emptyText: {
      ...Typography.bodyMedium,
      color: Colors.textMuted,
      textAlign: 'center',
      fontFamily: FontFamily.semiBold,
    },
    detailRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    detailBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)',
    },
    detailSheet: {
      backgroundColor: Colors.cardSurface,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingHorizontal: ScreenPadding.horizontal,
      paddingTop: Spacing.sm,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: Colors.border,
      maxHeight: winH * 0.88,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
        },
        android: {
          elevation: 16,
        },
      }),
    },
    detailHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    detailTitle: {
      fontSize: 20,
      lineHeight: 26,
      color: Colors.textPrimary,
      fontFamily: FontFamily.extraBold,
      letterSpacing: -0.2,
      marginBottom: Spacing.md,
    },
    detailScroll: {
      maxHeight: winH * 0.46,
    },
    detailScrollContent: {
      paddingBottom: Spacing.sm,
    },
    detailBody: {
      ...Typography.bodyLarge,
      color: Colors.textSecondary,
      fontFamily: FontFamily.regular,
      lineHeight: 24,
    },
    detailTime: {
      ...Typography.labelSmall,
      color: Colors.textMuted,
      marginTop: Spacing.md,
    },
    detailCloseBtn: {
      marginTop: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.round,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surfaceLight,
    },
    detailCloseBtnPressed: {
      opacity: 0.92,
    },
    detailCloseBtnText: {
      ...Typography.labelLarge,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
    },
    modalOverlay: {
      flex: 1,
      minHeight: SCREEN.height,
      backgroundColor: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    modalSheet: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    modalTitle: {
      fontSize: 22,
      lineHeight: 28,
      color: Colors.textPrimary,
      fontFamily: FontFamily.extraBold,
      letterSpacing: -0.3,
      marginBottom: Spacing.sm,
    },
    modalHint: {
      ...Typography.bodyMedium,
      color: Colors.textSecondary,
      fontFamily: FontFamily.medium,
      lineHeight: 22,
      marginBottom: Spacing.lg,
    },
    muteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    muteLabel: {
      fontSize: 16,
      lineHeight: 22,
      color: Colors.textPrimary,
      fontFamily: FontFamily.bold,
      flex: 1,
      paddingRight: Spacing.md,
    },
    systemNotificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surfaceLight,
    },
    systemNotificationIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    systemNotificationIconReady: {
      backgroundColor: Colors.primary + '18',
    },
    systemNotificationIconDisabled: {
      backgroundColor: Colors.warning + '18',
    },
    systemNotificationText: {
      flex: 1,
      minWidth: 0,
      color: Colors.textSecondary,
      fontFamily: FontFamily.medium,
      fontSize: 12,
      lineHeight: 17,
    },
    systemNotificationSettingsBtn: {
      minHeight: 34,
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
      backgroundColor: Colors.primary + '18',
    },
    systemNotificationSettingsBtnPressed: {
      opacity: 0.72,
    },
    systemNotificationSettingsText: {
      color: Colors.primary,
      fontFamily: FontFamily.semiBold,
      fontSize: 11,
    },
    modalPrimaryBtn: {
      marginTop: Spacing.lg,
      width: '100%',
      backgroundColor: glassFill,
      borderRadius: BorderRadius.round,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: glassBorder,
      ...Platform.select({
        ios: {
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
        },
        android: {
          elevation: 10,
          shadowColor: Colors.primary,
        },
      }),
    },
    modalPrimaryBtnPressed: {
      opacity: 0.92,
    },
    modalPrimaryBtnText: {
      color: '#FFFFFF',
      fontFamily: FontFamily.extraBold,
      fontSize: 16,
      letterSpacing: 0.85,
      textTransform: 'uppercase',
    },
  });
};
