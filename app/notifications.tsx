// S.P.A.R.K. — Bildirimler (tam ekran, tema uyumlu)
import React, { useMemo, useState, useCallback, type ComponentProps } from 'react';
import {
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
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomSheetModal from '../src/components/BottomSheetModal';
import { Colors } from '../src/theme/colors';
import { useAppTheme } from '../src/theme/themeStore';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useNotifications } from '../src/context/NotificationsContext';
import type { InAppNotification, NotificationMuteChannel } from '../src/notifications/types';
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
  const { feed, unreadCount, markRead, markAllRead, dismiss, setMute, mutes, sync, syncing } = useNotifications();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [muteModal, setMuteModal] = useState(false);
  const [detailNotif, setDetailNotif] = useState<InAppNotification | null>(null);

  useFocusEffect(
    useCallback(() => {
      void sync();
    }, [sync])
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return feed;
    return feed.filter((f) => channelFromId(f.id) === filter);
  }, [feed, filter]);

  const sections = useMemo(() => groupFeedByDay(filtered, t), [filtered, t]);
  const isEmpty = sections.length === 0 || filtered.length === 0;
  const hasAnyNotifications = feed.length > 0;
  const isDark = scheme === 'dark';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Üst bar — ek padding: ikonlar çok yukarı yapışmasın */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.circleBtn}
          accessibilityRole="button"
          accessibilityLabel={t('notif_go_back')}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={() => setMuteModal(true)}
          style={styles.circleBtn}
          accessibilityRole="button"
          accessibilityLabel={t('notif_prefs_title')}
        >
          <MaterialCommunityIcons name="tune-variant" size={22} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <View style={[styles.titleRow, hasAnyNotifications ? styles.titleRowWithList : styles.titleRowNoFeed]}>
        <Text style={styles.pageTitle}>{t('notif_center_title')}</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
        {feed.length > 0 && (
          <Pressable
            onPress={() => markAllRead()}
            style={({ pressed }) => [styles.markReadBtn, pressed && styles.markReadBtnPressed]}
          >
            <Text style={[styles.markReadBtnText, isDark && styles.markReadBtnTextDark]}>
              {t('notif_mark_all')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Filtre çipleri — dolu listede üstten kırpılmayı önlemek için dikey dolgu */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        style={styles.chipsScroll}
        contentContainerStyle={[styles.chipsRow, hasAnyNotifications ? styles.chipsRowWithList : styles.chipsRowEmpty]}
      >
        {FILTER_DEF.map(({ key, labelKey }) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.chip, active && styles.chipActive]}
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
        contentContainerStyle={[
          styles.listContent,
          isEmpty ? styles.listContentWhenEmpty : styles.listContentWhenFilled,
          isEmpty && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={sync} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
        renderSectionHeader={({ section }) => {
          const isFirst = sections.length > 0 && section.title === sections[0].title;
          return <Text style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>{section.title}</Text>;
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-off-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t('notif_empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const iconName = notificationIconName(item.id);
          const title = t(item.titleKey, item.params);
          const body = t(item.bodyKey, item.params);
          return (
            <View style={[styles.card, !item.read && styles.cardUnread]}>
              <View style={styles.iconCircle}>
                <View style={styles.iconCircleAlign}>
                  <MaterialCommunityIcons
                    name={iconName}
                    size={20}
                    color={Colors.textInverse}
                    style={styles.iconGlyph}
                  />
                </View>
              </View>
              <Pressable
                style={styles.cardBody}
                onPress={() => {
                  if (!item.read) void markRead(item.id);
                  setDetailNotif(item);
                }}
              >
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={LIST_PREVIEW_LINES} ellipsizeMode="tail">
                    {title}
                  </Text>
                  <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textMuted} />
                </View>
                <Text
                  style={styles.cardBodyText}
                  numberOfLines={LIST_PREVIEW_LINES}
                  ellipsizeMode="tail"
                >
                  {body}
                </Text>
                <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
              </Pressable>
              <Pressable onPress={() => dismiss(item.id)} hitSlop={10} style={styles.archiveBtn}>
                <MaterialCommunityIcons name="archive-outline" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>
          );
        }}
      />

      <BottomSheetModal
        visible={detailNotif !== null}
        onClose={() => setDetailNotif(null)}
        backdropColor={scheme === 'dark' ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)'}
        sheetStyle={[
          styles.detailSheet,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.lg },
        ]}
      >
        {detailNotif && (
          <>
            <View style={styles.detailHandle} />
            <Text style={styles.detailTitle}>
              {t(detailNotif.titleKey, detailNotif.params)}
            </Text>
            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detailScrollContent}
              showsVerticalScrollIndicator
              bounces
            >
              <Text style={styles.detailBody}>
                {t(detailNotif.bodyKey, detailNotif.params)}
              </Text>
            </ScrollView>
            <Text style={styles.detailTime}>{formatTime(detailNotif.createdAt)}</Text>
            <Pressable
              style={({ pressed }) => [styles.detailCloseBtn, pressed && styles.detailCloseBtnPressed]}
              onPress={() => setDetailNotif(null)}
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
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setMuteModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMuteModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('notif_prefs_title')}</Text>
            <Text style={styles.modalHint}>{t('notif_mute_hint')}</Text>
            {MUTE_CHANNELS.map(({ key, labelKey }) => (
              <View key={key} style={styles.muteRow}>
                <Text style={styles.muteLabel}>{t(labelKey)}</Text>
                <Switch
                  value={!!mutes[key]}
                  onValueChange={(v) => setMute(key, v)}
                  trackColor={{
                    false: Colors.surfaceLight,
                    true: isDark ? 'rgba(0, 235, 100, 0.5)' : 'rgba(0, 178, 72, 0.55)',
                  }}
                  thumbColor={mutes[key] ? Colors.primary : Colors.textMuted}
                />
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.modalPrimaryBtnPressed]}
              onPress={() => setMuteModal(false)}
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
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: ScreenPadding.horizontal,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    circleBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: ScreenPadding.horizontal,
      paddingTop: 0,
      paddingBottom: 0,
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    /** Bildirim yokken: başlık «Bildirimler» ↔ seçim kartları — taban ~Spacing.sm, %9 artış ≈ sm×1.09 */
    titleRowNoFeed: {
      marginBottom: Math.round(Spacing.sm * 1.09),
    },
    /** Liste varken başlık satırı ile çipler arasında nefes */
    titleRowWithList: {
      marginBottom: Spacing.xs,
    },
    pageTitle: {
      ...Typography.headlineLarge,
      /** Görsel boşluğu azalt: varsayılan lineHeight (32) çiplerden çok uzak gösteriyordu */
      lineHeight: 26,
      color: Colors.textPrimary,
      fontFamily: FontFamily.extraBold,
      flexShrink: 1,
      ...Platform.select({
        android: { includeFontPadding: false },
      }),
    },
    badge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: Colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: '#fff',
      fontSize: 12,
      fontFamily: FontFamily.bold,
    },
    /** Şüşevar — cam yeşil (solid yerine); susevar.ts ile aynı beyaz kenar + gölge dili */
    markReadBtn: {
      marginLeft: 'auto',
      backgroundColor: glassFill,
      borderRadius: BorderRadius.round,
      paddingVertical: 6,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: glassBorder,
      ...Platform.select({
        ios: {
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.38,
          shadowRadius: 10,
        },
        android: {
          elevation: 8,
          shadowColor: Colors.primary,
        },
      }),
    },
    markReadBtnPressed: {
      opacity: 0.9,
    },
    markReadBtnText: {
      color: '#FFFFFF',
      fontFamily: FontFamily.extraBold,
      fontSize: 12,
      letterSpacing: 0.45,
      textTransform: 'uppercase',
    },
    /** Karanlık mod: Okundu bir tık daha okunaklı */
    markReadBtnTextDark: {
      fontSize: 13,
      letterSpacing: 0.58,
    },
    chipsScroll: {
      flexGrow: 0,
      width: '100%',
    },
    chipsRow: {
      paddingHorizontal: ScreenPadding.horizontal,
      gap: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    chipsRowEmpty: {
      paddingTop: 0,
      paddingBottom: Spacing.xs,
    },
    chipsRowWithList: {
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      minHeight: 40,
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: glassFill,
      borderColor: glassBorder,
      ...Platform.select({
        ios: {
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.28,
          shadowRadius: 8,
        },
        android: {
          elevation: 5,
          shadowColor: Colors.primary,
        },
      }),
    },
    chipText: {
      fontSize: 15,
      color: Colors.textSecondary,
      fontFamily: FontFamily.bold,
      letterSpacing: 0.2,
    },
    chipTextActive: {
      color: '#FFFFFF',
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
      paddingTop: Spacing.md,
    },
    /** Boş liste: içeriği üstte tut (ortaya yığılmasın) */
    listContentEmpty: {
      flexGrow: 1,
      justifyContent: 'flex-start',
    },
    sectionHeader: {
      ...Typography.labelMedium,
      color: Colors.textMuted,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
      textTransform: 'capitalize',
    },
    sectionHeaderFirst: {
      marginTop: 0,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      marginBottom: Spacing.sm,
    },
    cardUnread: {
      borderColor: Colors.primary + '55',
      backgroundColor: Colors.primaryGlow,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    iconCircleAlign: {
      width: 24,
      height: 24,
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
      gap: 4,
      minWidth: 0,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    cardTitle: {
      ...Typography.labelLarge,
      color: Colors.textPrimary,
      fontFamily: FontFamily.bold,
      flex: 1,
    },
    cardBodyText: {
      ...Typography.bodySmall,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    cardTime: {
      ...Typography.labelSmall,
      color: Colors.textMuted,
      marginTop: Spacing.xs,
    },
    archiveBtn: {
      padding: Spacing.xs,
      marginTop: -4,
    },
    empty: {
      alignItems: 'center',
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
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
