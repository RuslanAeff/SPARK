// S.P.A.R.K. — Settings: Budget & goals
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Switch } from 'react-native';
import { useAppTheme } from '../src/theme/themeStore';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useCurrency } from '../src/context/CurrencyContext';
import { useRefresh } from '../src/context/RefreshContext';
import { BudgetDao } from '../src/db/budgetDao';
import { formatMonthYear, formatDayMonth } from '../src/utils/dateUtils';
import { getCycleStartDay, setCycleStartDay } from '../src/services/budgetCycleSettings';
import {
  getCurrentCycle,
  getCycleForKey,
  MIN_CYCLE_START_DAY,
  MAX_CYCLE_START_DAY,
} from '../src/utils/budgetCycle';
import GlassCheckButton from '../src/components/GlassCheckButton';
import BudgetHistoryCard from '../src/components/BudgetHistoryCard';
import { SparkToast } from '../src/components/SparkToast';
import {
  getGoalFeatureEnabled,
  setGoalFeatureEnabled as persistGoalFeatureEnabled,
} from '../src/services/goalFeatureSettings';
import {
  SettingsInfoHintModal,
  SettingsInfoIconButton,
} from '../src/components/SettingsInfoHint';

export default function SettingsBudgetScreen() {
  const colorScheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [colorScheme]);
  const router = useRouter();
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { refreshKey, triggerRefresh } = useRefresh();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });
  const [budgetAmount, setBudgetAmount] = useState('');
  const [goalFeatureOn, setGoalFeatureOn] = useState(true);
  const [cycleDay, setCycleDay] = useState(1);
  const [budgetInfoOpen, setBudgetInfoOpen] = useState(false);
  const [goalInfoOpen, setGoalInfoOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [on, day] = await Promise.all([getGoalFeatureEnabled(), getCycleStartDay()]);
      if (!alive) return;
      setGoalFeatureOn(on);
      setCycleDay(day);
      // Açılışta güncel döngüyü göster (anchor=1'de bu zaten takvim ayıdır).
      setSelectedMonth(getCurrentCycle(day).key);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Seçili döngünün tarih aralığı (etiket için). anchor=1'de ay adı, aksi halde aralık.
  const cycleLabel = useMemo(() => {
    if (cycleDay === 1) return formatMonthYear(`${selectedMonth}-01`, t);
    const c = getCycleForKey(cycleDay, selectedMonth);
    return `${formatDayMonth(c.start, t)} – ${formatDayMonth(c.end, t)}`;
  }, [cycleDay, selectedMonth, t]);

  async function changeCycleDay(next: number) {
    const clamped = Math.min(MAX_CYCLE_START_DAY, Math.max(MIN_CYCLE_START_DAY, next));
    if (clamped === cycleDay) return;
    setCycleDay(clamped);
    try {
      await setCycleStartDay(clamped);
      setSelectedMonth(getCurrentCycle(clamped).key);
      triggerRefresh();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn('cycle day', e);
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

  useEffect(() => {
    loadBudgetForMonth(selectedMonth);
  }, [selectedMonth, refreshKey]);

  async function loadBudgetForMonth(monthStr: string) {
    const budget = await BudgetDao.getForMonth(monthStr);
    setBudgetAmount(budget ? budget.monthly_amount.toString() : '');
  }

  async function handleSaveBudget() {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      SparkToast.show(t('enter_valid_budget'), 'error');
      return;
    }
    await BudgetDao.setMonthlyBudget(amount, selectedMonth, currency);
    triggerRefresh();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const curLabel = currency === 'TRY' ? 'TL' : currency;
    SparkToast.show(
      t('budget_saved', { month: cycleLabel }),
      'success',
      t('budget_saved_desc', { amount: amount.toLocaleString(), currency: curLabel }),
    );
  }

  async function handleGoalFeatureToggle(next: boolean) {
    try {
      await persistGoalFeatureEnabled(next);
      setGoalFeatureOn(next);
      triggerRefresh();
      queueMicrotask(() => triggerRefresh());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      SparkToast.show(t('goal_feature_saved'), 'success');
    } catch (e) {
      console.warn('goal feature', e);
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

  function changeMonth(delta: number) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('settings_back')}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.subHeaderTitle} numberOfLines={1}>
            {t('settings_group_budget')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Budget */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: Colors.primaryGlow }]}>
                  <MaterialCommunityIcons name="wallet-outline" size={22} color={Colors.primary} />
                </View>
                <Text
                  style={[styles.sectionTitle, styles.sectionTitleWithInfo]}
                  numberOfLines={2}
                >
                  {t('budget_system')}
                </Text>
                <SettingsInfoIconButton
                  onPress={() => setBudgetInfoOpen(true)}
                  accessibilityLabel={t('settings_info_accessibility')}
                />
              </View>

              {/* Döngü başlangıç günü — bütçe takvim ayına değil bu güne göre işler */}
              <View style={styles.cycleBox}>
                <View style={styles.cycleBoxHeader}>
                  <MaterialCommunityIcons
                    name="calendar-sync-outline"
                    size={18}
                    color={Colors.primary}
                  />
                  <Text style={styles.cycleDayLabel}>{t('budget_cycle_start_day_label')}</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => changeCycleDay(cycleDay - 1)}
                    style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                    disabled={cycleDay <= MIN_CYCLE_START_DAY}
                    hitSlop={6}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      size={20}
                      color={cycleDay <= MIN_CYCLE_START_DAY ? Colors.textMuted : Colors.textPrimary}
                    />
                  </Pressable>
                  <Text style={styles.stepperValue}>
                    {cycleDay === 1
                      ? t('budget_cycle_day_default')
                      : t('budget_cycle_day_value', { day: String(cycleDay) })}
                  </Text>
                  <Pressable
                    onPress={() => changeCycleDay(cycleDay + 1)}
                    style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                    disabled={cycleDay >= MAX_CYCLE_START_DAY}
                    hitSlop={6}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={20}
                      color={cycleDay >= MAX_CYCLE_START_DAY ? Colors.textMuted : Colors.textPrimary}
                    />
                  </Pressable>
                </View>
                {cycleDay >= 29 && (
                  <Text style={styles.cycleClampNote}>{t('budget_cycle_clamp_note')}</Text>
                )}
              </View>

              <View style={styles.monthSelector}>
                <Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={24}
                    color={Colors.textPrimary}
                  />
                </Pressable>
                <Text style={styles.monthText}>{cycleLabel}</Text>
                <Pressable onPress={() => changeMonth(1)} style={styles.monthArrow}>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={Colors.textPrimary}
                  />
                </Pressable>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={budgetAmount}
                  onChangeText={setBudgetAmount}
                  keyboardType="decimal-pad"
                  placeholder="5000"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.currency}>{currency === 'TRY' ? 'TL' : currency}</Text>
                <GlassCheckButton onPress={handleSaveBudget} />
              </View>

              <View style={styles.historyDivider}>
                <MaterialCommunityIcons name="history" size={14} color={Colors.textMuted} />
                <Text style={styles.historyDividerText}>{t('past_budgets')}</Text>
              </View>
              <BudgetHistoryCard />
            </View>
          </Animated.View>

          {/* Goal feature toggle */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: Colors.primary + '22' }]}>
                  <MaterialCommunityIcons
                    name="flag-outline"
                    size={22}
                    color={Colors.primary}
                  />
                </View>
                <Text
                  style={[styles.sectionTitle, styles.sectionTitleWithInfo]}
                  numberOfLines={2}
                >
                  {t('goal_feature_section_title')}
                </Text>
                <SettingsInfoIconButton
                  onPress={() => setGoalInfoOpen(true)}
                  accessibilityLabel={t('settings_info_accessibility')}
                />
              </View>
              <View style={styles.goalFeatureRow}>
                <Text style={styles.goalFeatureLabel}>{t('goal_feature_toggle')}</Text>
                <Switch
                  value={goalFeatureOn}
                  onValueChange={handleGoalFeatureToggle}
                  trackColor={{ false: Colors.surfaceLight, true: Colors.primary + '55' }}
                  thumbColor={goalFeatureOn ? Colors.primary : Colors.textMuted}
                />
              </View>
            </View>
          </Animated.View>

          {/* Categories link */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/categories');
              }}
              style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
            >
              <View style={[styles.sectionIcon, { backgroundColor: Colors.chartPurple + '22' }]}>
                <MaterialCommunityIcons
                  name="shape-outline"
                  size={22}
                  color={Colors.chartPurple}
                />
              </View>
              <Text style={styles.linkText}>{t('category_management')}</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.textSecondary}
              />
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <SettingsInfoHintModal
        visible={budgetInfoOpen}
        onClose={() => setBudgetInfoOpen(false)}
        title={t('budget_system')}
        paragraphs={[t('budget_hint'), t('budget_cycle_hint')]}
      />
      <SettingsInfoHintModal
        visible={goalInfoOpen}
        onClose={() => setGoalInfoOpen(false)}
        title={t('goal_feature_section_title')}
        paragraphs={[t('goal_feature_section_hint')]}
      />
    </>
  );
}

const getStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  backBtnPressed: { opacity: 0.7 },
  subHeaderTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    flex: 1,
  },
  headerSpacer: { width: 40 },
  content: { paddingHorizontal: ScreenPadding.horizontal, paddingBottom: 40 },
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
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  sectionTitleWithInfo: { flex: 1, flexShrink: 1, minWidth: 0 },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  monthArrow: { padding: Spacing.xs },
  monthText: { ...Typography.labelLarge, color: Colors.textPrimary },
  cycleBox: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  cycleBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cycleDayLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stepperBtnPressed: { opacity: 0.7 },
  stepperValue: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  cycleClampNote: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
  },
  currency: { ...Typography.labelLarge, color: Colors.textSecondary },
  historyDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  historyDividerText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  goalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  goalFeatureLabel: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: Spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  linkRowPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  linkText: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
    flex: 1,
  },
});
