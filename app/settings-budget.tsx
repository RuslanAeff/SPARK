// S.P.A.R.K. — Settings: Budget & goals
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Switch } from 'react-native';
import { useAppTheme, useThemeRevision } from '../src/theme/themeStore';
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
import { useNotifications } from '../src/context/NotificationsContext';
import { useRefresh } from '../src/context/RefreshContext';
import { syncNotificationsBestEffort } from '../src/notifications/syncNotificationsBestEffort';
import { BudgetDao } from '../src/db/budgetDao';
import { formatMonthYear, formatDayMonth } from '../src/utils/dateUtils';
import { getCycleStartDay } from '../src/services/budgetCycleSettings';
import { getToday } from '../src/utils/dateUtils';
import {
  getCurrentCycle,
  getCycleForKey,
  shiftCycleKey,
  MIN_CYCLE_START_DAY,
  MAX_CYCLE_START_DAY,
  budgetCycleFromBounds,
} from '../src/utils/budgetCycle';
import type { Budget } from '../src/db/schema';
import GlassCheckButton from '../src/components/GlassCheckButton';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import BudgetHistoryCard, { type BudgetHistorySelection } from '../src/components/BudgetHistoryCard';
import BudgetRolloverSection from '../src/components/BudgetRolloverSection';
import BudgetPeriodRepairSection from '../src/components/BudgetPeriodRepairSection';
import BudgetHealthSection from '../src/components/BudgetHealthSection';
import ConfirmModal from '../src/components/ConfirmModal';
import { SparkToast } from '../src/components/SparkToast';
import {
  getGoalFeaturePreferences,
  setGoalDashboardFocusEnabled,
  setGoalFeatureEnabled as persistGoalFeatureEnabled,
} from '../src/services/goalFeatureSettings';
import { formatMoneyInput, parseMoneyInput } from '../src/utils/moneyMath';
import { previewBudgetCycleTransition, type BudgetCycleTransitionPreview } from '../src/utils/budgetCycleTransition';
import type { BudgetCycle } from '../src/utils/budgetCycle';
import {
  SettingsInfoHintModal,
  SettingsInfoIconButton,
} from '../src/components/SettingsInfoHint';
import {
  SettingsNavigationRow,
  SettingsSection,
} from '../src/components/SettingsList';

/** Kilitli dönem uyarısı kullanıcıya özel; diğer yazma hataları genel mesajda kalır. */
function budgetWriteErrorKey(error: unknown): string {
  return error instanceof Error && error.message === 'rollover_period_locked'
    ? error.message
    : 'error_saving_data';
}

export default function SettingsBudgetScreen() {
  const colorScheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [colorScheme, themeRevision]);
  const router = useRouter();
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { refreshKey, triggerRefresh } = useRefresh();
  const { sync: syncNotifications } = useNotifications();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });
  const [budgetAmount, setBudgetAmount] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [inheritedBudget, setInheritedBudget] = useState<Budget | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BudgetCycle | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [goalFeatureOn, setGoalFeatureOn] = useState(true);
  const [goalFocusOn, setGoalFocusOn] = useState(false);
  const [cycleDay, setCycleDay] = useState(1);
  const [persistedCycleDay, setPersistedCycleDay] = useState(1);
  const [cyclePreview, setCyclePreview] = useState<BudgetCycleTransitionPreview | null>(null);
  const [cycleChangeOpen, setCycleChangeOpen] = useState(false);
  const [currentPeriodKey, setCurrentPeriodKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [budgetInfoOpen, setBudgetInfoOpen] = useState(false);
  const [calendarInfoOpen, setCalendarInfoOpen] = useState(false);
  const [goalInfoOpen, setGoalInfoOpen] = useState(false);
  const loadSequence = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      // ADR-002: aynı SQLite bağlantısındaki hazırlanan sorguları paralelleştirme.
      const goalPreferences = await getGoalFeaturePreferences();
      const day = await getCycleStartDay();
      if (!alive) return;
      setGoalFeatureOn(goalPreferences.enabled);
      setGoalFocusOn(goalPreferences.dashboardFocusEnabled);
      setCycleDay(day);
      setPersistedCycleDay(day);
      // Aynı başlangıç ayında bir geçiş satırı bulunabilir; güncel satırı ay
      // adıyla değil bugünü gerçekten kapsayan kesin kimliğiyle aç.
      const exact = await BudgetDao.getContainingDate(getToday());
      if (!alive) return;
      if (exact?.period_start) {
        setCurrentPeriodKey(exact.period_start.slice(0, 7));
        void loadBudgetById(exact.id);
      } else {
        const current = getCurrentCycle(day);
        setCurrentPeriodKey(current.key);
        setSelectedMonth(current.key);
        setSelectedCycle(current);
        void loadUnrecordedCycle(current);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const canGoBack = selectedMonth > '2000-01';
  const canGoForward = selectedMonth < currentPeriodKey;

  // Seçili döngünün tarih aralığı (etiket için). anchor=1'de ay adı, aksi halde aralık.
  const cycleLabel = useMemo(() => {
    const c = selectedCycle ?? getCycleForKey(persistedCycleDay, selectedMonth);
    if (c.startDay === 1 && c.start.endsWith('-01')) return formatMonthYear(c.start, t);
    return `${formatDayMonth(c.start, t)} – ${formatDayMonth(c.end, t)}`;
  }, [persistedCycleDay, selectedCycle, selectedMonth, t]);

  async function changeCycleDay(next: number) {
    const clamped = Math.min(MAX_CYCLE_START_DAY, Math.max(MIN_CYCLE_START_DAY, next));
    if (clamped === cycleDay) return;
    setCycleDay(clamped);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  useEffect(() => {
    if (cycleDay === persistedCycleDay) {
      setCyclePreview(null);
      return;
    }
    let alive = true;
    (async () => {
      const exact = await BudgetDao.getContainingDate(getToday());
      const current = exact?.period_start && exact.period_end
        ? { start: exact.period_start, end: exact.period_end }
        : getCurrentCycle(persistedCycleDay);
      if (alive) setCyclePreview(previewBudgetCycleTransition(current.start, current.end, cycleDay));
    })();
    return () => { alive = false; };
  }, [cycleDay, persistedCycleDay]);

  useEffect(() => {
    if (refreshKey === 0) return;
    if (selectedBudget) void loadBudgetById(selectedBudget.id);
    else void loadBudgetForMonth(selectedMonth, persistedCycleDay);
  }, [refreshKey]);

  async function loadBudgetForMonth(monthStr: string, anchorDay: number = persistedCycleDay) {
    const sequence = ++loadSequence.current;
    const budget = await BudgetDao.getForMonth(monthStr);
    if (sequence !== loadSequence.current) return;
    const cycle = budget?.period_start && budget.period_end
      ? budgetCycleFromBounds(budget.period_start, budget.period_end, budget.cycle_start_day ?? anchorDay)
      : getCycleForKey(anchorDay, monthStr);
    setSelectedMonth(monthStr);
    setSelectedBudget(budget);
    const inherited = budget ? null : await BudgetDao.getLatestAtOrBefore(cycle.start);
    if (sequence !== loadSequence.current) return;
    setInheritedBudget(inherited);
    setSelectedCycle(cycle);
    setBudgetAmount(budget ? formatMoneyInput(budget.monthly_amount)
      : inherited ? formatMoneyInput(inherited.monthly_amount) : '');
  }

  async function loadBudgetById(id: number) {
    const sequence = ++loadSequence.current;
    const budget = await BudgetDao.getById(id);
    if (sequence !== loadSequence.current || !budget?.period_start || !budget.period_end) return;
    setSelectedMonth(budget.period_start.slice(0, 7));
    setSelectedBudget(budget);
    setInheritedBudget(null);
    setSelectedCycle(budgetCycleFromBounds(
      budget.period_start,
      budget.period_end,
      budget.cycle_start_day ?? persistedCycleDay,
    ));
    setBudgetAmount(formatMoneyInput(budget.monthly_amount));
  }

  async function loadUnrecordedCycle(cycle: BudgetCycle) {
    const sequence = ++loadSequence.current;
    const inherited = await BudgetDao.getLatestAtOrBefore(cycle.start);
    if (sequence !== loadSequence.current) return;
    setSelectedMonth(cycle.key);
    setSelectedBudget(null);
    setInheritedBudget(inherited);
    setSelectedCycle(cycle);
    setBudgetAmount(inherited ? formatMoneyInput(inherited.monthly_amount) : '');
  }

  function selectHistoryPeriod(selection: BudgetHistorySelection) {
    if (!selection.budget) {
      void loadUnrecordedCycle(selection.cycle);
      return;
    }
    loadSequence.current += 1;
    setSelectedMonth(selection.key);
    setSelectedBudget(selection.budget);
    setInheritedBudget(null);
    setSelectedCycle(selection.cycle);
    setBudgetAmount(selection.budget ? formatMoneyInput(selection.budget.monthly_amount) : '');
  }

  /**
   * Bütçe hedefi kaldırılır; dönemin harcamaları ve tarihsel toplamları korunur.
   * Bütün kayıtlı geçmiş dönemler exact kimliğiyle seçilip buradan silinebilir.
   */
  async function handleDeleteBudget() {
    if (!selectedBudget) return;
    try {
      await BudgetDao.deleteBudget(selectedBudget.id);
      setDeleteOpen(false);
      setSelectedBudget(null);
      setBudgetAmount('');
      triggerRefresh();
      await syncNotificationsBestEffort(syncNotifications, 'budget-delete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('budget_deleted'), 'success');
    } catch (error) {
      if (__DEV__) console.warn('[budget] delete failed', error);
      setDeleteOpen(false);
      SparkToast.show(t(budgetWriteErrorKey(error)), 'error');
    }
  }

  /**
   * Devir kaydı bulunan bir dönemin tarihleri/para birimi kilitlidir (ADR-013).
   * DAO bu ihlali yazmadan önce reddeder; ekran sessiz başarısızlık yerine
   * kullanıcıya ne yapması gerektiğini söyleyen mesajı gösterir.
   */
  async function handleSaveBudget() {
    const amount = parseMoneyInput(budgetAmount);
    if (amount === null || amount <= 0 || !selectedCycle) {
      SparkToast.show(t('enter_valid_budget'), 'error');
      return;
    }
    try {
      if (selectedBudget) {
        await BudgetDao.updateBudgetAmount(selectedBudget.id, amount);
        setSelectedBudget({ ...selectedBudget, monthly_amount: amount });
      } else {
        const targetCurrency = inheritedBudget?.currency ?? currency;
        const id = await BudgetDao.setBudgetForPeriod({
          amount,
          currency: targetCurrency,
          periodStart: selectedCycle.start,
          periodEnd: selectedCycle.end,
          cycleStartDay: selectedCycle.startDay,
        });
        await loadBudgetById(id);
      }
      triggerRefresh();
      await syncNotificationsBestEffort(syncNotifications, 'budget-save');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const savedCurrency = selectedBudget?.currency ?? inheritedBudget?.currency ?? currency;
      const curLabel = savedCurrency === 'TRY' ? 'TL' : savedCurrency;
      SparkToast.show(
        t('budget_saved', { month: cycleLabel }),
        'success',
        t('budget_saved_desc', { amount: amount.toLocaleString(), currency: curLabel }),
      );
    } catch (error) {
      if (__DEV__) console.warn('[budget] save failed', error);
      SparkToast.show(t(budgetWriteErrorKey(error)), 'error');
    }
  }

  async function handleApplyCycleDay() {
    if (cycleDay === persistedCycleDay) return;
    try {
      await BudgetDao.applyCycleStartDayChange(cycleDay, getToday());
      setPersistedCycleDay(cycleDay);
      setCyclePreview(null);
      setCycleChangeOpen(false);
      const exact = await BudgetDao.getContainingDate(getToday());
      if (exact?.period_start) {
        setCurrentPeriodKey(exact.period_start.slice(0, 7));
        await loadBudgetById(exact.id);
      } else {
        const current = getCurrentCycle(cycleDay);
        setCurrentPeriodKey(current.key);
        await loadBudgetForMonth(current.key, cycleDay);
      }
      triggerRefresh();
      await syncNotificationsBestEffort(syncNotifications, 'budget-cycle-change');
      SparkToast.show(t('budget_cycle_change_saved'), 'success');
    } catch (error) {
      if (__DEV__) console.warn('[budget] cycle change failed', error);
      const key = error instanceof Error && [
        'budget_cycle_requires_budget',
        'budget_cycle_future_conflict',
        'rollover_period_locked',
      ].includes(error.message) ? error.message : 'error_saving_data';
      SparkToast.show(t(key), 'error');
      setCycleChangeOpen(false);
    }
  }

  async function handleGoalFeatureToggle(next: boolean) {
    try {
      await persistGoalFeatureEnabled(next);
      setGoalFeatureOn(next);
      triggerRefresh();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      SparkToast.show(t('goal_feature_saved'), 'success');
    } catch (e) {
      console.warn('goal feature', e);
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

  async function handleGoalFocusToggle(next: boolean) {
    try {
      await setGoalDashboardFocusEnabled(next);
      setGoalFocusOn(next);
      triggerRefresh();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      SparkToast.show(t('goal_focus_saved'), 'success');
    } catch (e) {
      console.warn('goal dashboard focus', e);
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

  function changeMonth(delta: number) {
    const next = shiftCycleKey(selectedMonth, delta);
    if (next > currentPeriodKey || next < '2000-01') return;
    void loadBudgetForMonth(next, persistedCycleDay);
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
          <Animated.View entering={FadeInDown.delay(40).duration(400)}>
            <SettingsSection testID="settings-budget-cycle-section">
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: Colors.primaryGlow }]}>
                  <MaterialCommunityIcons name="calendar-sync-outline" size={22} color={Colors.primary} />
                </View>
                <Text style={[styles.sectionTitle, styles.sectionTitleWithInfo]}>
                  {t('budget_calendar_title')}
                </Text>
                <SettingsInfoIconButton
                  onPress={() => setCalendarInfoOpen(true)}
                  accessibilityLabel={t('budget_calendar_info_accessibility')}
                />
              </View>
              <View style={styles.cycleBox}>
                <Text style={styles.cycleDayLabel}>{t('budget_cycle_start_day_label')}</Text>
                <View style={styles.stepper}>
                  <Pressable testID="budget-cycle-minus" onPress={() => changeCycleDay(cycleDay - 1)}
                    style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                    disabled={cycleDay <= MIN_CYCLE_START_DAY} accessibilityRole="button">
                    <MaterialCommunityIcons name="minus" size={20} color={cycleDay <= MIN_CYCLE_START_DAY ? Colors.textMuted : Colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.stepperValue}>{cycleDay === 1
                    ? t('budget_cycle_day_default') : t('budget_cycle_day_value', { day: String(cycleDay) })}</Text>
                  <Pressable testID="budget-cycle-plus" onPress={() => changeCycleDay(cycleDay + 1)}
                    style={({ pressed }) => [styles.stepperBtn, pressed && styles.stepperBtnPressed]}
                    disabled={cycleDay >= MAX_CYCLE_START_DAY} accessibilityRole="button">
                    <MaterialCommunityIcons name="plus" size={20} color={cycleDay >= MAX_CYCLE_START_DAY ? Colors.textMuted : Colors.textPrimary} />
                  </Pressable>
                </View>
                {cycleDay >= 29 && <Text style={styles.cycleClampNote}>{t('budget_cycle_clamp_note')}</Text>}
              </View>
              {cyclePreview && <View testID="budget-cycle-preview" style={styles.cyclePreview}>
                <Text style={styles.cyclePreviewTitle}>{t('budget_cycle_preview_title')}</Text>
                <Text style={styles.cyclePreviewText}>{t('budget_cycle_preview_preserved', cyclePreview.preserved)}</Text>
                {cyclePreview.bridge && <Text style={styles.cyclePreviewText}>{t('budget_cycle_preview_bridge', { start: cyclePreview.bridge.start, end: cyclePreview.bridge.end })}</Text>}
                <Text style={styles.cyclePreviewText}>{t('budget_cycle_preview_regular', { start: cyclePreview.firstRegular.start, end: cyclePreview.firstRegular.end })}</Text>
                <Pressable testID="budget-cycle-apply" accessibilityRole="button" onPress={() => setCycleChangeOpen(true)}
                  style={({ pressed }) => [styles.cycleApply, pressed && styles.stepperBtnPressed]}>
                  <Text style={styles.cycleApplyText}>{t('budget_cycle_apply')}</Text>
                </Pressable>
              </View>}
            </SettingsSection>
          </Animated.View>
          {/* Budget */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <SettingsSection testID="settings-budget-main-section">
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

              <View style={styles.monthSelector}>
                <Pressable
                  testID="budget-period-previous"
                  onPress={() => changeMonth(-1)}
                  disabled={!canGoBack}
                  style={styles.monthArrow}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoBack }}
                  accessibilityLabel={t('budget_period_previous')}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={24}
                    color={canGoBack ? Colors.textPrimary : Colors.textMuted}
                  />
                </Pressable>
                <Text style={styles.monthText}>{cycleLabel}</Text>
                <Pressable
                  testID="budget-period-next"
                  onPress={() => changeMonth(1)}
                  disabled={!canGoForward}
                  style={styles.monthArrow}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canGoForward }}
                  accessibilityLabel={t('budget_period_next')}
                >
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={canGoForward ? Colors.textPrimary : Colors.textMuted}
                  />
                </Pressable>
              </View>
              {!canGoForward && (
                <Text style={styles.periodBoundHint}>{t('budget_future_locked')}</Text>
              )}
              {!selectedBudget && inheritedBudget && (
                <Text testID="budget-inherited-note" style={styles.inheritedNote}>
                  {t('budget_inherited_note', {
                    amount: formatMoneyInput(inheritedBudget.monthly_amount),
                    currency: inheritedBudget.currency,
                  })}
                </Text>
              )}

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={budgetAmount}
                  onChangeText={setBudgetAmount}
                  keyboardType="decimal-pad"
                  placeholder="5000"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.currency}>{(selectedBudget?.currency ?? inheritedBudget?.currency ?? currency) === 'TRY'
                  ? 'TL' : (selectedBudget?.currency ?? inheritedBudget?.currency ?? currency)}</Text>
                <GlassCheckButton onPress={handleSaveBudget} />
              </View>

              {selectedBudget && (
                <Pressable
                  testID="budget-delete-action"
                  onPress={() => setDeleteOpen(true)}
                  style={({ pressed }) => [
                    styles.budgetDeleteBtn,
                    pressed && styles.budgetDeleteBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('budget_delete_action')}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={15}
                    color={Colors.danger}
                  />
                  <Text style={styles.budgetDeleteText}>{t('budget_delete_action')}</Text>
                </Pressable>
              )}

              <BudgetPeriodRepairSection budget={selectedBudget} onRepaired={() => {
                if (selectedBudget) void loadBudgetById(selectedBudget.id);
                triggerRefresh();
              }} />

              <BudgetRolloverSection budget={selectedBudget} />

              <View style={styles.historyDivider}>
                <MaterialCommunityIcons name="history" size={14} color={Colors.textMuted} />
                <Text style={styles.historyDividerText}>{t('past_budgets')}</Text>
              </View>
              <BudgetHistoryCard
                selectedBudgetId={selectedBudget?.id ?? null}
                selectedPeriodStart={selectedCycle?.start}
                onSelectPeriod={selectHistoryPeriod}
              />
              <BudgetHealthSection onSelectBudget={(budget) => void loadBudgetById(budget.id)} />
            </SettingsSection>
          </Animated.View>

          {/* Goal feature toggle */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <SettingsSection testID="settings-budget-goal-section" style={styles.goalSettingsSection}>
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
                  testID="goal-feature-switch"
                  value={goalFeatureOn}
                  onValueChange={handleGoalFeatureToggle}
                  trackColor={{ false: Colors.surfaceLight, true: Colors.primary + '55' }}
                  thumbColor={goalFeatureOn ? Colors.primary : Colors.textMuted}
                />
              </View>
              <View style={styles.goalPreferenceDivider} />
              <View
                style={[
                  styles.goalFeatureRow,
                  !goalFeatureOn && styles.goalFeatureRowDisabled,
                ]}
              >
                <Text style={styles.goalFeatureLabel}>{t('goal_focus_toggle')}</Text>
                <Switch
                  testID="goal-focus-switch"
                  value={goalFocusOn}
                  onValueChange={handleGoalFocusToggle}
                  disabled={!goalFeatureOn}
                  trackColor={{ false: Colors.surfaceLight, true: Colors.primary + '55' }}
                  thumbColor={goalFocusOn && goalFeatureOn ? Colors.primary : Colors.textMuted}
                />
              </View>
              <View style={styles.goalPreferenceDivider} />
              {/* Hedefin asıl düzenlendiği yerin kapısı, anahtarlarıyla aynı bölümde
                  durur: /goal-settings hem birikim hedefini hem kategori limitlerini
                  barındırıyor, eski "kategori limitleri" adı hedefi gizliyordu. */}
              <SettingsNavigationRow
                testID="manage-category-limits"
                title={t('goal_limits_entry')}
                icon="gauge"
                last
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/goal-settings');
                }}
              />
            </SettingsSection>
          </Animated.View>

          {/* Komşu sayfalar: bu ekranın konusu değil, yalnız gidilecek yerler. */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <SettingsNavigationRow
              testID="manage-recurring-payments"
              title={t('subscriptions_title')}
              icon="calendar-sync-outline"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/subscriptions');
              }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <SettingsNavigationRow
              testID="manage-categories"
              title={t('category_management')}
              icon="shape-outline"
              last
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/categories');
              }}
            />
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
        visible={calendarInfoOpen}
        onClose={() => setCalendarInfoOpen(false)}
        title={t('budget_calendar_title')}
        paragraphs={[t('budget_calendar_explanation'), t('budget_cycle_hint')]}
      />
      <SettingsInfoHintModal
        visible={goalInfoOpen}
        onClose={() => setGoalInfoOpen(false)}
        title={t('goal_feature_section_title')}
        paragraphs={[t('goal_feature_section_hint'), t('goal_focus_hint')]}
      />
      <GlassDeleteModal
        visible={deleteOpen}
        title={t('budget_delete_title')}
        message={t('budget_delete_confirm', { period: cycleLabel })}
        onCancel={() => setDeleteOpen(false)}
        onDelete={handleDeleteBudget}
      />
      <ConfirmModal
        visible={cycleChangeOpen}
        title={t('budget_cycle_confirm_title')}
        message={t('budget_cycle_confirm_message')}
        confirmLabel={t('budget_cycle_apply')}
        cancelLabel={t('cancel')}
        icon="calendar-sync-outline"
        onCancel={() => setCycleChangeOpen(false)}
        onConfirm={() => void handleApplyCycleDay()}
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
    paddingVertical: Spacing.sm,
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
  calendarExplanation: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  cyclePreview: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cyclePreviewTitle: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  cyclePreviewText: { ...Typography.bodySmall, color: Colors.textSecondary },
  cycleApply: {
    minHeight: 44,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primaryAction,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  cycleApplyText: { ...Typography.labelLarge, color: Colors.onPrimary, fontFamily: FontFamily.bold },
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
  periodBoundHint: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  inheritedNote: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  // Yıkıcı eylem sessiz durur; onay penceresi olmadan silme yapılmaz.
  budgetDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    marginTop: Spacing.sm,
  },
  budgetDeleteBtnPressed: { opacity: 0.7 },
  budgetDeleteText: {
    ...Typography.labelMedium,
    color: Colors.danger,
    fontFamily: FontFamily.medium,
  },
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
  goalPreferenceDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.xs,
  },
  goalFeatureRowDisabled: {
    opacity: 0.48,
  },
  // The navigation row already provides its own vertical rhythm. Keeping the
  // parent section's bottom padding here would create a visibly larger gap
  // before the adjacent recurring-payments row.
  goalSettingsSection: {
    paddingBottom: 0,
  },
});
