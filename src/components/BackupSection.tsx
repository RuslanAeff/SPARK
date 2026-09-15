// S.P.A.R.K. — Yedek al / geri yükle bölümü (Ayarlar)
// Tarih aralığı seçimi + preset kısayollar + onay modali + son yedek bilgisi
// + opsiyonel haftalık/aylık hatırlatıcı.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import { useRefreshActions } from '../context/RefreshContext';
import { SparkToast } from './SparkToast';
import ConfirmModal from './ConfirmModal';
import CustomDatePicker from './CustomDatePicker';
import { SettingsInfoHintModal, SettingsInfoIconButton } from './SettingsInfoHint';
import { SettingsSection } from './SettingsList';
import {
  exportBackupToFile,
  pickAndImportBackup,
  type ImportSummary,
} from '../services/backupService';
import {
  loadBackupMeta,
  recordBackupSuccess,
  setBackupReminderInterval,
  type BackupMeta,
  type BackupReminderInterval,
} from '../services/backupMeta';
import { createSusevarStyles } from '../theme/susevar';
import { intlLocaleForLanguage } from '../i18n/languageOptions';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(offset: number = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return ymd(d);
}

function endOfMonth(offset: number = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  return ymd(d);
}

function startOfYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

type PresetId = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

export default function BackupSection() {
  const { t, language } = useLanguage();
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { triggerRefresh } = useRefreshActions();
  const { sync: syncNotifications } = useNotifications();

  const [startDate, setStartDate] = useState<string>(startOfMonth(0));
  const [endDate, setEndDate] = useState<string>(ymd(new Date()));
  const [preset, setPreset] = useState<PresetId>('this_month');
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportConfirm, setExportConfirm] = useState(false);
  const [importConfirm, setImportConfirm] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [meta, setMeta] = useState<BackupMeta | null>(null);

  useEffect(() => {
    void (async () => setMeta(await loadBackupMeta()))();
  }, []);

  async function refreshNotificationState(source: string) {
    triggerRefresh();
    try {
      await syncNotifications();
    } catch (error) {
      // Yedek tercihi/export/import kanonik olarak tamamlandı. Native/feed
      // senkronu ikincil yan etkidir; başarıyı geri çevirmeden resume'da denenir.
      if (__DEV__) console.warn(`[backup] ${source} notification sync failed`, error);
    }
  }

  async function handleReminderChange(next: BackupReminderInterval) {
    Haptics.selectionAsync();
    await setBackupReminderInterval(next);
    setMeta((prev) => (prev ? { ...prev, reminderInterval: next } : prev));
    await refreshNotificationState('reminder preference');
    SparkToast.show(
      t('backup_reminder_updated'),
      'success',
      t(`backup_reminder_${next}`)
    );
  }

  function formatLastBackup(ts: number): string {
    try {
      return new Intl.DateTimeFormat(intlLocaleForLanguage(language), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ts));
    } catch {
      return new Date(ts).toLocaleString();
    }
  }

  function formatRangeDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat(intlLocaleForLanguage(language), {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  function applyPreset(p: Exclude<PresetId, 'custom'>) {
    setPreset(p);
    Haptics.selectionAsync();
    switch (p) {
      case 'this_month':
        setStartDate(startOfMonth(0));
        setEndDate(ymd(new Date()));
        break;
      case 'last_month':
        setStartDate(startOfMonth(-1));
        setEndDate(endOfMonth(-1));
        break;
      case 'last_3_months':
        setStartDate(startOfMonth(-2));
        setEndDate(ymd(new Date()));
        break;
      case 'this_year':
        setStartDate(startOfYear());
        setEndDate(ymd(new Date()));
        break;
    }
  }

  function requestExport() {
    if (exporting || importing) return;
    if (startDate > endDate) {
      SparkToast.show(t('backup_range_invalid'), 'error');
      return;
    }
    Haptics.selectionAsync();
    setExportConfirm(true);
  }

  async function handleExport() {
    setExportConfirm(false);
    if (exporting || importing) return;
    if (startDate > endDate) {
      SparkToast.show(t('backup_range_invalid'), 'error');
      return;
    }
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await exportBackupToFile({ start: startDate, end: endDate });
      // Boş aralıkta dahi metaveriyi kaydetmiyoruz; "son yedek" gerçek bir
      // finansal kayıt veya kullanıcı hatırlatıcısı içeren ve cihazda kalıcı
      // olan kaydı temsil etmeli.
      if (res.recordCount > 0 && (res.destination === 'saved' || res.destination === 'shared')) {
        await recordBackupSuccess({
          expenseCount: res.recordCount,
          itemCount: res.itemCount,
          rangeStart: startDate,
          rangeEnd: endDate,
        });
        setMeta(await loadBackupMeta());
        // Başarılı yedek, uygulama-içi gecikmiş-yedek uyarısını aynı işlemde
        // emekliye ayırsın; bir sonraki ekran açılışını beklemesin.
        await refreshNotificationState('export');
      }
      if (res.recordCount === 0) {
        SparkToast.show(t('backup_export_empty_title'), 'warning', t('backup_export_empty_desc'));
      } else if (res.destination === 'saved') {
        SparkToast.show(
          t('backup_export_saved_title'),
          'success',
          t('backup_export_saved_desc', {
            count: res.recordCount.toString(),
            items: res.itemCount.toString(),
          })
        );
      } else if (res.destination === 'shared') {
        SparkToast.show(
          t('backup_export_success_title'),
          'success',
          t('backup_export_save_hint', {
            count: res.recordCount.toString(),
            items: res.itemCount.toString(),
          })
        );
      } else {
        SparkToast.show(
          t('backup_export_cancelled_title'),
          'info',
          t('backup_export_cancelled_desc')
        );
      }
    } catch (e: any) {
      if (__DEV__) console.warn('backup export', e);
      SparkToast.show(t('backup_export_failed'), 'error', e?.message ?? '');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (exporting || importing) return;
    try {
      setImporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await pickAndImportBackup();
      if (!res) {
        setImportConfirm(false);
        return;
      }
      const s: ImportSummary = res.summary;
      const added = s.expensesAdded + s.debtsAdded + s.debtPaymentsAdded
        + s.extraIncomesAdded + s.remindersAdded;
      const skipped = s.expensesSkipped + s.debtsSkipped + s.debtPaymentsSkipped
        + s.extraIncomesSkipped + s.remindersSkipped;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Restore aktif borç ve ödeme planları ekleyebilir. Kullanıcı uygulamayı
      // hemen kapatsa bile yeni tarihli alarmlar 300 ms refresh debounce'una
      // bağlı kalmadan Android'e kurulmuş olsun.
      await refreshNotificationState('restore');
      SparkToast.show(
        t('backup_import_success_title'),
        'success',
        t('backup_import_success_desc', {
          added: added.toString(),
          skipped: skipped.toString(),
        })
      );
    } catch (e: any) {
      const code = e?.message ?? '';
      const key =
        code === 'INVALID_JSON' ? 'backup_import_invalid_json'
        : code === 'INVALID_FORMAT' ? 'backup_import_invalid_format'
        : code === 'UNSUPPORTED_VERSION' ? 'backup_import_unsupported_version'
        : 'backup_import_failed';
      if (__DEV__) console.warn('backup import', e);
      SparkToast.show(t('backup_import_failed_title'), 'error', t(key));
    } finally {
      setImporting(false);
      setImportConfirm(false);
    }
  }

  const presets: { id: Exclude<PresetId, 'custom'>; label: string }[] = [
    { id: 'this_month', label: t('backup_preset_this_month') },
    { id: 'last_month', label: t('backup_preset_last_month') },
    { id: 'last_3_months', label: t('backup_preset_last_3') },
    { id: 'this_year', label: t('backup_preset_this_year') },
  ];

  return (
    <SettingsSection testID="settings-data-backup-section">
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: Colors.chartBlue + '22' }]}>
          <MaterialCommunityIcons
            name="database-export-outline"
            size={22}
            color={Colors.chartBlue}
          />
        </View>
        <Text style={styles.sectionTitle} numberOfLines={2}>
          {t('backup_title')}
        </Text>
        <SettingsInfoIconButton
          onPress={() => setInfoOpen(true)}
          accessibilityLabel={t('settings_info_accessibility')}
        />
      </View>

      {meta?.lastAt != null && (
        <View style={styles.lastBackupCard}>
          <View style={styles.lastBackupIcon}>
            <MaterialCommunityIcons
              name="cloud-check-outline"
              size={18}
              color={Colors.success}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.lastBackupTitle}>{t('backup_last_label')}</Text>
            <Text style={styles.lastBackupValue} numberOfLines={1}>
              {formatLastBackup(meta.lastAt)}
            </Text>
            {meta.lastCount != null && (
              <Text style={styles.lastBackupMeta} numberOfLines={1}>
                {t('backup_last_summary', {
                  count: String(meta.lastCount),
                  items: String(meta.lastItemCount ?? 0),
                })}
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.exportCard}>
        <Text style={styles.groupTitle}>{t('backup_range_title')}</Text>
        <ScrollView
          horizontal
          style={styles.presetsViewport}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {presets.map(p => {
            const active = preset === p.id;
            return (
              <Pressable
                key={p.id}
                testID={`backup-preset-${p.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: exporting || importing }}
                disabled={exporting || importing}
                onPress={() => applyPreset(p.id)}
                style={({ pressed }) => [styles.presetChip, active && styles.presetChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.rangeRow}>
          <Pressable
            testID="backup-start-date"
            accessibilityRole="button"
            accessibilityLabel={`${t('backup_start_date')}: ${startDate}`}
            disabled={exporting || importing}
            onPress={() => setStartPickerOpen(true)}
            style={({ pressed }) => [styles.dateBtn, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>{t('backup_start_date')}</Text>
              <Text style={styles.dateValue} numberOfLines={1} adjustsFontSizeToFit>{formatRangeDate(startDate)}</Text>
            </View>
          </Pressable>
          <View style={styles.rangeDivider} />
          <Pressable
            testID="backup-end-date"
            accessibilityRole="button"
            accessibilityLabel={`${t('backup_end_date')}: ${endDate}`}
            disabled={exporting || importing}
            onPress={() => setEndPickerOpen(true)}
            style={({ pressed }) => [styles.dateBtn, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>{t('backup_end_date')}</Text>
              <Text style={styles.dateValue} numberOfLines={1} adjustsFontSizeToFit>{formatRangeDate(endDate)}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            testID="backup-export"
            accessibilityRole="button"
            accessibilityState={{ disabled: exporting || importing, busy: exporting }}
            onPress={requestExport}
            disabled={exporting || importing}
            style={[styles.actionBtn, styles.exportBtn, (exporting || importing) && styles.btnDisabled]}
          >
            {exporting ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons name="tray-arrow-up" size={18} color={Colors.onPrimary} />
                <Text style={[styles.actionText, { color: Colors.onPrimary }]}>
                  {t('backup_export_btn')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
      <Pressable
        testID="backup-import"
        accessibilityRole="button"
        accessibilityState={{ disabled: exporting || importing, busy: importing }}
        onPress={() => setImportConfirm(true)}
        disabled={exporting || importing}
        style={[styles.importBtn, (exporting || importing) && styles.btnDisabled]}
      >
        {importing ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <View style={styles.restoreIcon}>
              <MaterialCommunityIcons name="tray-arrow-down" size={20} color={Colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.restoreTitle}>{t('backup_import_btn')}</Text>
              <Text style={styles.restoreHint}>{t('backup_restore_hint')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
          </>
        )}
      </Pressable>

      {/* Yedek hatırlatıcı seçimi (off / weekly / monthly) */}
      <View style={styles.reminderRow}>
        <View style={styles.reminderHeader}>
          <MaterialCommunityIcons name="bell-ring-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.reminderLabel}>{t('backup_reminder_label')}</Text>
        </View>
        <View style={styles.reminderChips}>
          {(['off', 'weekly', 'monthly'] as BackupReminderInterval[]).map((opt) => {
            const active = (meta?.reminderInterval ?? 'off') === opt;
            return (
              <Pressable
                key={opt}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => handleReminderChange(opt)}
                style={[styles.reminderChip, active && styles.reminderChipActive]}
              >
                <Text
                  style={[
                    styles.reminderChipText,
                    active && styles.reminderChipTextActive,
                  ]}
                >
                  {t(`backup_reminder_${opt}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SettingsInfoHintModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={t('backup_title')}
        paragraphs={[t('backup_hint'), t('backup_footer_note')]}
      />

      <CustomDatePicker
        visible={startPickerOpen}
        onClose={() => setStartPickerOpen(false)}
        initialDate={startDate}
        onSelectDate={(d) => { setStartDate(d); setPreset('custom'); }}
      />
      <CustomDatePicker
        visible={endPickerOpen}
        onClose={() => setEndPickerOpen(false)}
        initialDate={endDate}
        onSelectDate={(d) => { setEndDate(d); setPreset('custom'); }}
      />

      <ConfirmModal
        visible={importConfirm}
        title={t('backup_import_confirm_title')}
        message={t('backup_import_confirm_desc')}
        icon="tray-arrow-down"
        confirmLabel={t('backup_import_confirm_btn')}
        cancelLabel={t('cancel')}
        onCancel={() => setImportConfirm(false)}
        onConfirm={handleImport}
      />

      <ConfirmModal
        visible={exportConfirm}
        title={t('backup_export_confirm_title')}
        message={t('backup_export_confirm_desc', {
          start: startDate,
          end: endDate,
        })}
        icon="tray-arrow-up"
        confirmLabel={t('backup_export_confirm_btn')}
        cancelLabel={t('cancel')}
        onCancel={() => setExportConfirm(false)}
        onConfirm={handleExport}
      />
    </SettingsSection>
  );
}

const getStyles = () => {
  const primary = createSusevarStyles(Colors);
  return StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      ...Typography.headlineSmall,
      color: Colors.textPrimary,
      fontSize: 16,
      flex: 1,
      flexShrink: 1,
    },
    exportCard: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.divider,
    },
    groupTitle: { ...Typography.labelMedium, color: Colors.textSecondary, marginBottom: Spacing.sm },
    presetsViewport: { flexGrow: 0 },
    presetsRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      paddingVertical: Spacing.xs,
      paddingRight: Spacing.xs,
    },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      minHeight: 44,
      borderRadius: BorderRadius.round,
    },
    presetChipActive: {
      backgroundColor: Colors.primary + '1C',
    },
    presetChipText: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
      fontFamily: FontFamily.medium,
    },
    presetChipTextActive: {
      color: Colors.primary,
      fontFamily: FontFamily.bold,
    },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      backgroundColor: Colors.surfaceLight,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    },
    rangeDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: Colors.border },
    dateBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.surfaceLight,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      minHeight: 64,
    },
    dateLabel: {
      ...Typography.labelSmall,
      color: Colors.textMuted,
      marginBottom: Spacing.xs,
    },
    dateValue: {
      ...Typography.bodyMedium,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    exportBtn: primary.button,
    actionText: { ...primary.text, flexShrink: 1, textAlign: 'center' },
    importBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      marginTop: Spacing.md, paddingVertical: Spacing.md,
      minHeight: 64,
    },
    restoreIcon: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center',
    },
    restoreTitle: { ...Typography.bodyMedium, color: Colors.textPrimary, fontFamily: FontFamily.semiBold },
    restoreHint: { ...Typography.labelSmall, color: Colors.textSecondary, marginTop: Spacing.xs },
    pressed: { opacity: 0.75 },
    btnDisabled: {
      opacity: 0.55,
    },
    lastBackupCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingLeft: Spacing.md,
      marginBottom: Spacing.md,
      borderLeftWidth: 2,
      borderLeftColor: Colors.success,
    },
    lastBackupIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.success + '24',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lastBackupTitle: {
      ...Typography.labelSmall,
      color: Colors.success,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: FontFamily.bold,
    },
    lastBackupValue: {
      ...Typography.bodyMedium,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
      marginTop: 1,
    },
    lastBackupMeta: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    reminderRow: {
      marginTop: Spacing.lg,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.divider,
    },
    reminderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: Spacing.sm,
    },
    reminderLabel: {
      ...Typography.labelMedium,
      color: Colors.textSecondary,
      fontFamily: FontFamily.semiBold,
    },
    reminderChips: {
      padding: 3,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surfaceLight,
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    reminderChip: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.round,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    reminderChipActive: {
      backgroundColor: Colors.primary + '1C',
    },
    reminderChipText: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
      fontFamily: FontFamily.medium,
    },
    reminderChipTextActive: {
      color: Colors.primary,
      fontFamily: FontFamily.bold,
    },
  });
};
