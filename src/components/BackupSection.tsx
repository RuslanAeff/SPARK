// S.P.A.R.K. — Yedek al / geri yükle bölümü (Ayarlar)
// Tarih aralığı seçimi + preset kısayollar + onay modali.
import React, { useMemo, useState } from 'react';
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
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import { useRefresh } from '../context/RefreshContext';
import { SparkToast } from './SparkToast';
import GlassDeleteModal from './GlassDeleteModal';
import CustomDatePicker from './CustomDatePicker';
import { SettingsInfoHintModal, SettingsInfoIconButton } from './SettingsInfoHint';
import {
  exportBackupToFile,
  pickAndImportBackup,
  type ImportSummary,
} from '../services/backupService';

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
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { triggerRefresh } = useRefresh();

  const [startDate, setStartDate] = useState<string>(startOfMonth(0));
  const [endDate, setEndDate] = useState<string>(ymd(new Date()));
  const [preset, setPreset] = useState<PresetId>('this_month');
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importConfirm, setImportConfirm] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  function applyPreset(p: PresetId) {
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
      case 'custom':
        break;
    }
  }

  async function handleExport() {
    if (exporting || importing) return;
    if (startDate > endDate) {
      SparkToast.show(t('backup_range_invalid'), 'error');
      return;
    }
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await exportBackupToFile({ start: startDate, end: endDate });
      if (res.expenseCount === 0) {
        SparkToast.show(t('backup_export_empty_title'), 'warning', t('backup_export_empty_desc'));
      } else {
        SparkToast.show(
          t('backup_export_success_title'),
          'success',
          t('backup_export_success_desc', {
            count: res.expenseCount.toString(),
            items: res.itemCount.toString(),
          })
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerRefresh();
      queueMicrotask(() => triggerRefresh());
      SparkToast.show(
        t('backup_import_success_title'),
        'success',
        t('backup_import_success_desc', {
          added: s.expensesAdded.toString(),
          skipped: s.expensesSkipped.toString(),
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

  const presets: { id: PresetId; label: string; icon: string }[] = [
    { id: 'this_month', label: t('backup_preset_this_month'), icon: 'calendar-month' },
    { id: 'last_month', label: t('backup_preset_last_month'), icon: 'calendar-arrow-left' },
    { id: 'last_3_months', label: t('backup_preset_last_3'), icon: 'calendar-range' },
    { id: 'this_year', label: t('backup_preset_this_year'), icon: 'calendar-star' },
    { id: 'custom', label: t('backup_preset_custom'), icon: 'calendar-edit' },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="database-export-outline" size={22} color={Colors.chartBlue} />
        <Text style={styles.sectionTitle} numberOfLines={2}>
          {t('backup_title')}
        </Text>
        <SettingsInfoIconButton
          onPress={() => setInfoOpen(true)}
          accessibilityLabel={t('settings_info_accessibility')}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsRow}
      >
        {presets.map(p => {
          const active = preset === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => applyPreset(p.id)}
              style={[styles.presetChip, active && styles.presetChipActive]}
            >
              <MaterialCommunityIcons
                name={p.icon as any}
                size={14}
                color={active ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.rangeRow}>
        <Pressable
          onPress={() => { setPreset('custom'); setStartPickerOpen(true); }}
          style={styles.dateBtn}
        >
          <MaterialCommunityIcons name="calendar-start" size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>{t('backup_start_date')}</Text>
            <Text style={styles.dateValue}>{startDate}</Text>
          </View>
        </Pressable>
        <MaterialCommunityIcons name="arrow-right" size={18} color={Colors.textMuted} />
        <Pressable
          onPress={() => { setPreset('custom'); setEndPickerOpen(true); }}
          style={styles.dateBtn}
        >
          <MaterialCommunityIcons name="calendar-end" size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>{t('backup_end_date')}</Text>
            <Text style={styles.dateValue}>{endDate}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleExport}
          disabled={exporting || importing}
          style={[styles.actionBtn, styles.exportBtn, (exporting || importing) && styles.btnDisabled]}
        >
          {exporting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <>
              <MaterialCommunityIcons name="tray-arrow-up" size={18} color={Colors.background} />
              <Text style={[styles.actionText, { color: Colors.background }]}>
                {t('backup_export_btn')}
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => setImportConfirm(true)}
          disabled={exporting || importing}
          style={[styles.actionBtn, styles.importBtn, (exporting || importing) && styles.btnDisabled]}
        >
          {importing ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <MaterialCommunityIcons name="tray-arrow-down" size={18} color={Colors.primary} />
              <Text style={[styles.actionText, { color: Colors.primary }]}>
                {t('backup_import_btn')}
              </Text>
            </>
          )}
        </Pressable>
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
        onSelectDate={(d) => setStartDate(d)}
      />
      <CustomDatePicker
        visible={endPickerOpen}
        onClose={() => setEndPickerOpen(false)}
        initialDate={endDate}
        onSelectDate={(d) => setEndDate(d)}
      />

      <GlassDeleteModal
        visible={importConfirm}
        title={t('backup_import_confirm_title')}
        message={t('backup_import_confirm_desc')}
        onCancel={() => setImportConfirm(false)}
        onDelete={handleImport}
      />
    </View>
  );
}

const getStyles = () =>
  StyleSheet.create({
    section: {
      backgroundColor: Colors.cardSurface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.headlineSmall,
      color: Colors.textPrimary,
      fontSize: 16,
      flex: 1,
      flexShrink: 1,
    },
    presetsRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      paddingVertical: Spacing.xs,
      paddingRight: Spacing.md,
    },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surfaceLight,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    presetChipActive: {
      backgroundColor: Colors.primary + '1C',
      borderColor: Colors.primary,
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
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    dateBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.surfaceLight,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    dateLabel: {
      ...Typography.labelSmall,
      color: Colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    exportBtn: {
      backgroundColor: Colors.primary,
    },
    importBtn: {
      backgroundColor: Colors.primary + '18',
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    actionText: {
      ...Typography.labelLarge,
      fontFamily: FontFamily.bold,
    },
    btnDisabled: {
      opacity: 0.55,
    },
  });
