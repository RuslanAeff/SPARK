// S.P.A.R.K. — Ana ekran birikim hedefi kartı (ilerleme + aylık gereklilik)
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { SavingsGoalRow, GoalDao } from '../db/goalDao';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatDateFull } from '../utils/dateUtils';
import { useRefresh } from '../context/RefreshContext';
import { SparkToast } from './SparkToast';
import BottomSheetModal from './BottomSheetModal';
import AnimatedCard from './AnimatedCard';

type Props = {
  goal: SavingsGoalRow;
};

export default function SavingsGoalCard({ goal }: Props) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const router = useRouter();
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { triggerRefresh } = useRefresh();
  const [contribOpen, setContribOpen] = useState(false);
  const [contribAmountStr, setContribAmountStr] = useState('');
  const [contribSign, setContribSign] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);

  // --- Hesaplar ---
  const target = new Date(goal.target_date + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));

  const saved = Math.max(0, Number(goal.current_amount) || 0);
  const targetAmt = Math.max(0, Number(goal.target_amount) || 0);
  const remaining = Math.max(0, targetAmt - saved);
  const progress = targetAmt > 0 ? Math.min(1, saved / targetAmt) : 0;
  const percent = Math.round(progress * 100);
  const monthlyNeeded = remaining / monthsLeft;
  const reached = progress >= 1;

  const dispCurrency = goal.currency || currency;

  async function handleContribute() {
    const raw = parseFloat(contribAmountStr.replace(',', '.'));
    if (!isFinite(raw) || raw <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }
    setSaving(true);
    try {
      await GoalDao.addContribution(raw * contribSign);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(
        contribSign > 0 ? t('goal_contribution_added') : t('goal_contribution_removed'),
        'success'
      );
      setContribOpen(false);
      setContribAmountStr('');
      setContribSign(1);
      triggerRefresh();
    } catch (e) {
      console.warn('contribution', e);
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AnimatedCard delay={80} style={styles.wrap}>
        <View style={styles.inner}>
          {/* Başlık satırı */}
          <View style={styles.topRow}>
            <View style={[styles.iconWrap, reached && styles.iconWrapReached]}>
              <MaterialCommunityIcons
                name={reached ? 'trophy' : 'flag-checkered'}
                size={22}
                color={reached ? Colors.warning : Colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{t('savings_goal_kicker')}</Text>
              <Text style={styles.title} numberOfLines={2}>
                {goal.title || t('savings_goal_untitled')}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/goal-settings')}
              hitSlop={12}
              style={({ pressed }) => [styles.chevronBtn, pressed && { opacity: 0.65 }]}
              accessibilityRole="button"
              accessibilityLabel={t('goal_open_settings')}
            >
              <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>

          {/* İlerleme çubuğu */}
          <View style={styles.progressBlock}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressAmount}>
                {formatCurrency(saved, dispCurrency)}
                <Text style={styles.progressAmountMuted}>
                  {'  /  '}
                  {formatCurrency(targetAmt, dispCurrency)}
                </Text>
              </Text>
              <View style={[styles.percentPill, reached && styles.percentPillReached]}>
                <Text style={[styles.percentText, reached && styles.percentTextReached]}>
                  %{percent}
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(6, percent)}%` },
                  reached && styles.progressFillReached,
                ]}
              />
            </View>
          </View>

          {/* Bilgi satırı — kalan / hedef tarih / aylık gerek */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>
                {reached ? t('savings_goal_surplus') : t('savings_goal_remaining')}
              </Text>
              <Text style={styles.statValue}>
                {formatCurrency(reached ? saved - targetAmt : remaining, dispCurrency)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('savings_goal_target_date')}</Text>
              <Text style={styles.statValueSmall}>{formatDateFull(goal.target_date, t)}</Text>
            </View>
          </View>

          {/* Alt rozet satırı: günler + aylık gerek */}
          <View style={styles.footerRow}>
            <View style={styles.daysPill}>
              <MaterialCommunityIcons name="calendar-clock" size={14} color={Colors.primary} />
              <Text style={styles.daysText}>
                {daysLeft < 0
                  ? t('savings_goal_days_passed', { days: String(Math.abs(daysLeft)) })
                  : daysLeft === 0
                    ? t('savings_goal_deadline_today')
                    : t('savings_goal_days_left', { days: String(daysLeft) })}
              </Text>
            </View>
            {!reached && daysLeft > 0 && targetAmt > 0 && (
              <View style={styles.pacePill}>
                <MaterialCommunityIcons name="trending-up" size={14} color={Colors.info} />
                <Text style={styles.paceText}>
                  {t('savings_goal_monthly_need', {
                    amount: formatCurrency(monthlyNeeded, dispCurrency),
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Hızlı katkı butonu */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setContribOpen(true);
            }}
            style={({ pressed }) => [styles.contribBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel={t('goal_add_contribution')}
          >
            <MaterialCommunityIcons name="plus-circle" size={18} color={Colors.primary} />
            <Text style={styles.contribBtnText}>{t('goal_add_contribution')}</Text>
          </Pressable>
        </View>
      </AnimatedCard>

      {/* Hızlı katkı modal — BottomSheetModal pattern kullanılır */}
      <BottomSheetModal
        visible={contribOpen}
        onClose={() => setContribOpen(false)}
        sheetStyle={styles.contribSheet}
      >
        <View style={styles.contribHandle} />
        <Text style={styles.contribTitle}>{t('goal_add_contribution')}</Text>
        <Text style={styles.contribHint}>{t('goal_contribution_hint')}</Text>

        <View style={styles.contribToggleRow}>
          <Pressable
            onPress={() => setContribSign(1)}
            style={[
              styles.contribToggleBtn,
              contribSign === 1 && styles.contribToggleBtnActive,
            ]}
          >
            <MaterialCommunityIcons
              name="plus"
              size={16}
              color={contribSign === 1 ? '#fff' : Colors.textSecondary}
            />
            <Text
              style={[
                styles.contribToggleText,
                contribSign === 1 && styles.contribToggleTextActive,
              ]}
            >
              {t('goal_contribution_add')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setContribSign(-1)}
            style={[
              styles.contribToggleBtn,
              contribSign === -1 && styles.contribToggleBtnActiveNeg,
            ]}
          >
            <MaterialCommunityIcons
              name="minus"
              size={16}
              color={contribSign === -1 ? '#fff' : Colors.textSecondary}
            />
            <Text
              style={[
                styles.contribToggleText,
                contribSign === -1 && styles.contribToggleTextActive,
              ]}
            >
              {t('goal_contribution_remove')}
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.contribInput}
          value={contribAmountStr}
          onChangeText={setContribAmountStr}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          autoFocus
        />

        <View style={styles.contribActionsRow}>
          <Pressable
            onPress={() => setContribOpen(false)}
            style={({ pressed }) => [styles.contribCancelBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.contribCancelText}>{t('cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={handleContribute}
            disabled={saving}
            style={({ pressed }) => [
              styles.contribSaveBtn,
              pressed && { opacity: 0.9 },
              saving && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.contribSaveText}>{saving ? t('processing') : t('save')}</Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    </>
  );
}

const getStyles = () => StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  inner: {
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapReached: {
    backgroundColor: Colors.warning + '26',
  },
  kicker: {
    ...Typography.labelMedium,
    fontSize: 14,
    color: Colors.primary,
    letterSpacing: 1.85,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: FontFamily.black,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  chevronBtn: {
    padding: Spacing.xs,
    marginRight: -Spacing.xs,
    marginTop: -Spacing.xs,
  },

  // Progress block
  progressBlock: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  progressAmount: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    flexShrink: 1,
  },
  progressAmountMuted: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },
  percentPill: {
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  percentPillReached: {
    backgroundColor: Colors.warning + '22',
    borderColor: Colors.warning + '55',
  },
  percentText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
  },
  percentTextReached: {
    color: Colors.warning,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressFillReached: {
    backgroundColor: Colors.warning,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stat: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },
  statLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  statValueSmall: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },

  // Footer pill row
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  daysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  daysText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
  pacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.info + '1A',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.info + '44',
  },
  paceText: {
    ...Typography.labelSmall,
    color: Colors.info,
    fontFamily: FontFamily.semiBold,
  },

  // Contribute CTA
  contribBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    marginTop: 2,
  },
  contribBtnText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },

  // Sheet
  contribSheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  contribHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  contribTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    marginBottom: 4,
  },
  contribHint: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  contribToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  contribToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contribToggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  contribToggleBtnActiveNeg: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  contribToggleText: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
  },
  contribToggleTextActive: {
    color: '#fff',
  },
  contribInput: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  contribActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  contribCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribCancelText: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  contribSaveBtn: {
    flex: 1.4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribSaveText: {
    ...Typography.labelLarge,
    color: '#fff',
    fontFamily: FontFamily.extraBold,
  },
});
