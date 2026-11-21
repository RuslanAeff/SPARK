// S.P.A.R.K. — Bildirim tercihleri penceresi (UI denetimi CQ-02)
//
// Bildirimler ekranından davranış değiştirmeden ayrıldı. Bildirim türü
// anahtarları (UX-10: açık = bildirim gelir) ve Android'de sistem izni, kanal
// ve zamanlanmış bildirim tanısını gösterir. Uzun içerik pencere içinde kayar;
// başlık ve "Tamam" sabit kalır.
//
// UX-08: Ortada açılan kendi `Modal`'ı yerine uygulamanın diğer pencereleri gibi
// ortak `BottomSheetModal` (alttan açılır, tutamaktan çekip kapatılır, güvenli
// alan ve karartı ortak).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BottomSheetModal from '../BottomSheetModal';
import PrimaryButton from '../PrimaryButton';
import { SparkToast } from '../SparkToast';
import { Colors } from '../../theme/colors';
import { useAppTheme } from '../../theme/themeStore';
import { Typography, FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { switchColors } from '../../theme/switchColors';
import { useLanguage } from '../../i18n/LanguageContext';
import { useNotifications } from '../../context/NotificationsContext';
import type { NotificationMuteChannel } from '../../notifications/types';
import {
  getAndroidFutureScheduleSummary,
  type AndroidNotificationSetupStatus,
} from '../../services/androidNotificationsSetup';
import { formatDate } from '../../utils/dateUtils';
import { logError } from '../../utils/logError';
import { useThemedStyles } from '../../theme/useThemedStyles';

const MUTE_CHANNELS: { key: NotificationMuteChannel; labelKey: string }[] = [
  { key: 'budget', labelKey: 'notif_mute_budget' },
  { key: 'category_limit', labelKey: 'notif_mute_category' },
  { key: 'goal', labelKey: 'notif_mute_goal' },
  { key: 'receipt', labelKey: 'notif_mute_receipt' },
  { key: 'debt', labelKey: 'notif_mute_debt' },
  { key: 'payment_plan', labelKey: 'notif_mute_payment_plan' },
  { key: 'subscription', labelKey: 'notif_mute_subscription' },
  { key: 'backup', labelKey: 'notif_mute_backup' },
  { key: 'system', labelKey: 'notif_mute_system' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationPreferencesModal({ visible, onClose }: Props) {
  const scheme = useAppTheme();
  const styles = useThemedStyles(getStyles);
  const { t } = useLanguage();
  const { setMute, mutes, sync, syncing, nativeScheduleHealth } = useNotifications();
  const muteModal = visible;
  const systemStatusRequestRef = useRef(0);
  // Tercih listesi pencereye sığmadığında kaydırılabilir olduğunu belli et.
  const [prefsViewportH, setPrefsViewportH] = useState(0);
  const [prefsContentH, setPrefsContentH] = useState(0);
  const prefsOverflow = prefsViewportH > 0 && prefsContentH > prefsViewportH + 1;
  const [systemNotificationStatus, setSystemNotificationStatus] =
    useState<AndroidNotificationSetupStatus | null>(null);
  const [futureScheduleCount, setFutureScheduleCount] = useState(0);
  const [futureNextTriggerAt, setFutureNextTriggerAt] = useState<number | null>(null);
  const [alertChannelStatus, setAlertChannelStatus] =
    useState<'ready' | 'degraded' | 'blocked' | 'unknown'>('unknown');

  const refreshSystemNotificationStatus = useCallback(async () => {
    const requestId = systemStatusRequestRef.current + 1;
    systemStatusRequestRef.current = requestId;
    // Önce desired-state'i yenile; ardından sayı SQLite ledger tahmini değil
    // Expo'nun Android'de kalıcı tuttuğu scheduled-request envanteri olsun.
    try {
      await sync();
      const summary = await getAndroidFutureScheduleSummary();
      if (requestId !== systemStatusRequestRef.current) return;
      setSystemNotificationStatus(summary.status);
      setFutureScheduleCount(summary.count);
      setFutureNextTriggerAt(summary.nextTriggerAt);
      setAlertChannelStatus(summary.alertChannelStatus);
    } catch (error) {
      if (requestId !== systemStatusRequestRef.current) return;
      setSystemNotificationStatus('error');
      throw error;
    }
  }, [sync]);

  const closeMuteModal = useCallback(() => {
    // Kapanan modalın gecikmiş native sorgusu sonraki açılışın tanısını ezmesin.
    systemStatusRequestRef.current += 1;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!muteModal || Platform.OS !== 'android') return;
    void refreshSystemNotificationStatus().catch(() => undefined);
    return () => {
      systemStatusRequestRef.current += 1;
    };
  }, [muteModal, refreshSystemNotificationStatus]);

  const nextScheduleLabel = useMemo(() => {
    if (futureNextTriggerAt == null) return '';
    const date = new Date(futureNextTriggerAt);
    if (Number.isNaN(date.getTime())) return '';
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return t('notif_system_schedule_next', { date: formatDate(ymd, t), time });
  }, [futureNextTriggerAt, t]);

  const scheduleFailureCount = (nativeScheduleHealth?.failedScheduleCount ?? 0)
    + (nativeScheduleHealth?.failedCancelCount ?? 0);
  const nativeScheduleError = nativeScheduleHealth?.status === 'error';
  const scheduleCoverageMissing = nativeScheduleHealth?.status === 'ready'
    && nativeScheduleHealth.desiredCount > nativeScheduleHealth.verifiedCount;
  const channelNeedsAttention = alertChannelStatus !== 'ready';
  const canRepairSchedules = (systemNotificationStatus === 'ready'
      || systemNotificationStatus === 'error')
    && (systemNotificationStatus === 'error'
      || nativeScheduleError
      || scheduleFailureCount > 0
      || scheduleCoverageMissing);
  const systemNotificationHealthy = systemNotificationStatus === 'ready'
    && !nativeScheduleError
    && !channelNeedsAttention
    && !canRepairSchedules;
  const systemNotificationDescription = useMemo(() => {
    if (systemNotificationStatus === 'expo_go') {
      return t('notif_system_schedule_expo_go');
    }
    if (systemNotificationStatus === 'error') {
      return t('notif_system_schedule_error');
    }

    const permissionLine = t(
      systemNotificationStatus === 'ready'
        ? 'notif_system_permission_ready'
        : 'notif_system_permission_disabled',
    );
    if (systemNotificationStatus !== 'ready') return permissionLine;

    return [
      permissionLine,
      nativeScheduleError
        ? t('notif_system_schedule_error')
        : t(
            futureScheduleCount > 0
              ? 'notif_system_schedule_ready'
              : 'notif_system_schedule_none',
            { count: String(futureScheduleCount) },
          ),
      nextScheduleLabel,
      alertChannelStatus === 'blocked'
        ? t('notif_system_alert_channel_blocked')
        : alertChannelStatus === 'degraded'
          ? t('notif_system_alert_channel_degraded')
          : alertChannelStatus === 'unknown'
            ? t('notif_system_alert_channel_unknown')
            : '',
      (scheduleFailureCount > 0 || scheduleCoverageMissing)
        ? t('notif_system_schedule_incomplete', {
            count: String(Math.max(
              scheduleFailureCount,
              (nativeScheduleHealth?.desiredCount ?? 0)
                - (nativeScheduleHealth?.verifiedCount ?? 0),
            )),
          })
        : '',
    ].filter(Boolean).join('\n');
  }, [
    alertChannelStatus,
    futureScheduleCount,
    nativeScheduleError,
    nativeScheduleHealth?.desiredCount,
    nativeScheduleHealth?.verifiedCount,
    nextScheduleLabel,
    scheduleCoverageMissing,
    scheduleFailureCount,
    systemNotificationStatus,
    t,
  ]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={closeMuteModal}
      showHandle
      sheetStyle={styles.modalSheet}
      backdropColor={scheme === 'dark' ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)'}
      backdropAccessibilityLabel={t('close')}
      backdropTestID="notifications-preferences-backdrop"
    >
      <Text style={styles.modalTitle} accessibilityRole="header">
        {t('notif_prefs_title')}
      </Text>
      {/* Başlık ve "Tamam" sabit; uzun içerik (sistem durumu + kanallar) ekrana
          sığmadığında pencere taşmak yerine yalnızca bu bölüm kaydırılır. */}
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.modalScrollContent}
        showsVerticalScrollIndicator={prefsOverflow}
        persistentScrollbar={prefsOverflow}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => setPrefsViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setPrefsContentH(h)}
        testID="notifications-preferences-scroll"
      >
      <Text style={styles.modalHint}>{t('notif_mute_hint')}</Text>
      {Platform.OS === 'android' &&
        (systemNotificationStatus === 'ready' ||
          systemNotificationStatus === 'denied' ||
          systemNotificationStatus === 'expo_go' ||
          systemNotificationStatus === 'error') && (
          <View
            style={styles.systemNotificationRow}
            testID="notifications-system-status"
          >
            <View
              style={[
                styles.systemNotificationIcon,
                systemNotificationHealthy
                  ? styles.systemNotificationIconReady
                  : styles.systemNotificationIconDisabled,
              ]}
            >
              <MaterialCommunityIcons
                name={systemNotificationHealthy
                  ? 'bell-check-outline'
                  : 'bell-alert-outline'}
                size={18}
                color={systemNotificationHealthy
                  ? Colors.primary
                  : Colors.warning}
              />
            </View>
            <View style={styles.systemNotificationContent}>
              <Text style={styles.systemNotificationText}>
                {systemNotificationDescription}
              </Text>
              <View style={styles.systemNotificationActions}>
              {(systemNotificationStatus !== 'ready'
                || channelNeedsAttention)
                && systemNotificationStatus !== 'expo_go' && (
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
              {canRepairSchedules && (
                <Pressable
                  disabled={syncing}
                  onPress={() => {
                    void refreshSystemNotificationStatus().catch(() => {
                      SparkToast.show(t('operation_failed'), 'error');
                    });
                  }}
                  style={({ pressed }) => [
                    styles.systemNotificationSettingsBtn,
                    pressed && styles.systemNotificationSettingsBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('notif_system_schedule_repair')}
                  testID="notifications-repair-schedules"
                >
                  <Text style={styles.systemNotificationSettingsText}>
                    {t('notif_system_schedule_repair')}
                  </Text>
                </Pressable>
              )}
              </View>
            </View>
          </View>
        )}
      {MUTE_CHANNELS.map(({ key, labelKey }) => (
        <View key={key} style={styles.muteRow}>
          <Text style={styles.muteLabel}>{t(labelKey)}</Text>
          {/* UX-10: anahtar olumlu anlamdadır (açık = bildirim gelir). Saklanan
              değer hâlâ "sessize alındı" bayrağıdır; yalnız gösterim tersine döner. */}
          <Switch
            value={!mutes[key]}
            onValueChange={(receive) => {
              void setMute(key, !receive).catch((error) => {
                logError('notifications mute update failed', error);
                SparkToast.show(t('operation_failed'), 'error');
              });
            }}
            {...switchColors(!mutes[key])}
            accessibilityLabel={t(labelKey)}
          />
        </View>
      ))}
      </ScrollView>
      {prefsOverflow && (
        <View style={styles.modalScrollDivider} testID="notifications-preferences-divider" />
      )}
      <PrimaryButton label={t('ok')} onPress={closeMuteModal} style={styles.modalPrimaryBtn} />
    </BottomSheetModal>
  );
}

const getStyles = () => StyleSheet.create({
  // Yükseklik sınırı (pencerenin %90'ı, durum çubuğunun altı) ortak sayfadan
  // gelir; içerik sığmazsa yalnız orta bölüm kayar.
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
    // Kaydırma çubuğu içeriğin hemen yanında değil, pencere kenarına yakın dursun:
    // alan sağ iç boşluğa uzatılır, içerik aynı miktarda geri itilir (hizalama değişmez).
    marginRight: -(Spacing.xl - Spacing.sm),
  },
  modalScrollContent: {
    paddingBottom: Spacing.xs,
    paddingRight: Spacing.xl - Spacing.sm,
  },
  // Liste taşınca kaydırılan alan ile sabit "Tamam" butonunu ayırır; satırın butonun
  // altına sıkışmış gibi görünmesini önler.
  modalScrollDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: -Spacing.xl,
  },
  modalTitle: {
    fontSize: FontSize.h1,
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
    // Switch kendi 48dp dokunma alanını taşır; ek dikey boşluk listeyi gereksiz uzatıyordu.
    paddingVertical: Spacing.xs,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  muteLabel: {
    fontSize: FontSize.xl,
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
  systemNotificationContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
  systemNotificationText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: 17,
  },
  systemNotificationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
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
    fontSize: FontSize.xs,
  },
  modalPrimaryBtn: { marginTop: Spacing.lg, width: '100%' },
});
