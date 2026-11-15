// S.P.A.R.K. — Yerel hata günlüğü (ADR-016)
// Kullanıcı gönderilecek her şeyi önce görür; paylaşım yalnız kendi dokunuşuyla
// işletim sisteminin paylaşma ekranı üzerinden yapılır. Ağ çağrısı yoktur.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { createSusevarStyles, susevarButtonPressed } from '../src/theme/susevar';
import { useThemeRevision } from '../src/theme/themeStore';
import { useLanguage } from '../src/i18n/LanguageContext';
import { SparkToast } from '../src/components/SparkToast';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import {
  buildErrorReport,
  clearErrorJournal,
  readErrorJournal,
  type ErrorJournalEntry,
} from '../src/services/errorJournal';
import ScreenHeader from '../src/components/ScreenHeader';
import { useBottomClearance } from '../src/hooks/useBottomClearance';

function formatEntryTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ErrorJournalScreen() {
  // UX-06: sistem gezinme alanı (jest/üç düğme) kadar ek alt boşluk.
  const bottomClearance = useBottomClearance('screen', Spacing.xl * 2);
  useThemeRevision();
  const styles = getStyles();
  const { t } = useLanguage();
  const [entries, setEntries] = useState<ErrorJournalEntry[]>(() => readErrorJournal());
  const [confirmClear, setConfirmClear] = useState(false);
  const [sharing, setSharing] = useState(false);
  const empty = entries.length === 0;

  const handleShare = useCallback(async () => {
    if (empty || sharing) return;
    setSharing(true);
    try {
      await Share.share({
        title: t('error_journal_entry_title'),
        message: buildErrorReport(entries),
      });
    } catch {
      SparkToast.show(t('operation_failed'), 'error');
    } finally {
      setSharing(false);
    }
  }, [empty, entries, sharing, t]);

  const handleClear = useCallback(() => {
    setConfirmClear(false);
    clearErrorJournal();
    setEntries(readErrorJournal());
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    SparkToast.show(t('error_journal_cleared'), 'success');
  }, [t]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={t('error_journal_entry_title')} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]} showsVerticalScrollIndicator={false}>
        <View style={styles.privacyCard}>
          <MaterialCommunityIcons name="shield-lock-outline" size={22} color={Colors.primary} />
          <Text style={styles.privacyText}>{t('error_journal_privacy')}</Text>
        </View>

        {empty ? (
          <Text style={styles.emptyText}>{t('error_journal_empty')}</Text>
        ) : (
          <>
            <Text style={styles.countText}>
              {t('error_journal_count', { count: entries.length.toString() })}
            </Text>
            <View style={styles.list}>
              {entries.map((entry, index) => (
                <View
                  key={`${entry.at}-${index}`}
                  style={[styles.row, index === entries.length - 1 && styles.rowLast]}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTag} numberOfLines={2}>{entry.tag}</Text>
                    <Text style={styles.rowTime}>{formatEntryTime(entry.at)}</Text>
                  </View>
                  <Text style={styles.rowDetail}>
                    {entry.detail ? `${entry.kind}: ${entry.detail}` : entry.kind}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Pressable
          testID="error-journal-share"
          onPress={() => void handleShare()}
          disabled={empty || sharing}
          accessibilityRole="button"
          accessibilityState={{ disabled: empty || sharing, busy: sharing }}
          style={({ pressed }) => [
            styles.shareButton,
            (empty || sharing) && styles.disabled,
            pressed && susevarButtonPressed,
          ]}
        >
          <MaterialCommunityIcons name="share-variant-outline" size={20} color={Colors.onPrimary} />
          <Text style={styles.shareText}>{t('error_journal_share')}</Text>
        </Pressable>

        <Pressable
          testID="error-journal-clear"
          onPress={() => setConfirmClear(true)}
          disabled={empty}
          accessibilityRole="button"
          accessibilityState={{ disabled: empty }}
          style={({ pressed }) => [styles.clearButton, empty && styles.disabled, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.clearText}>{t('error_journal_clear')}</Text>
        </Pressable>
      </ScrollView>

      <GlassDeleteModal
        visible={confirmClear}
        message={t('error_journal_clear_confirm')}
        onCancel={() => setConfirmClear(false)}
        onDelete={handleClear}
      />
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: Spacing.xl * 2,
    gap: Spacing.md,
  },
  privacyCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  privacyText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  countText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  list: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 2,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  rowTag: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
    flex: 1,
  },
  rowTime: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  rowDetail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  shareButton: {
    ...createSusevarStyles(Colors).button,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  shareText: createSusevarStyles(Colors).text,
  clearButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  clearText: {
    ...Typography.labelLarge,
    color: Colors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
});
