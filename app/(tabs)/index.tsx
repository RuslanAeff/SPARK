// S.P.A.R.K. — Dashboard Screen (Home)
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useAppTheme, useThemeRevision } from '../../src/theme/themeStore';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/theme/colors';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../../src/theme/spacing';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDayMonth, formatMonthYear } from '../../src/utils/dateUtils';
import { getCurrentCycle, shiftCycleKey } from '../../src/utils/budgetCycle';
import { getCycleStartDay } from '../../src/services/budgetCycleSettings';
import { useBudget } from '../../src/hooks/useBudget';
import { useCategorySpending, useVendorSpending, useMonthlyTotal } from '../../src/hooks/useExpenses';
import { useSavingsGoal, useCategoryLimitsProgress, useGoalFeatureEnabled } from '../../src/hooks/useSavingsGoalData';

import DonutChart from '../../src/components/DonutChart';
import SavingsGoalCard from '../../src/components/SavingsGoalCard';
import SavingsGoalPulseCard from '../../src/components/SavingsGoalPulseCard';
import SavingsGoalContributionSheet from '../../src/components/SavingsGoalContributionSheet';
import CategoryLimitsSection from '../../src/components/CategoryLimitsSection';
import BudgetCard from '../../src/components/BudgetCard';
import DebtSheet from '../../src/components/DebtSheet';
import IncomeSheet from '../../src/components/IncomeSheet';
import AnimatedCard from '../../src/components/AnimatedCard';
import CategoryPill from '../../src/components/CategoryPill';
import VendorAvatar from '../../src/components/VendorAvatar';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { useExpenseDataRefresh } from '../../src/context/RefreshContext';
import { useCurrency } from '../../src/context/CurrencyContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { getDashboardGoalPresentation } from '../../src/utils/dashboardGoalPresentation';

export default function DashboardScreen() {
  // İlk açılışta DB teması gelince tüm kartlar aynı React store'undan senkronlensin.
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = React.useMemo(() => getStyles(), [scheme, themeRevision]);
  const router = useRouter();
  const { t, tc } = useLanguage();

  // Ay navigasyonu: 0 = güncel döngü; negatif = geçmiş döngüler (varsayılan güncel ay).
  // Seçilen döngü useBudget'a key olarak geçer; budget.periodStart/End değişince
  // donut/kategoriler/satıcılar/limitler hepsi otomatik o döngüye döner ([start,end] deps).
  const [cycleOffset, setCycleOffset] = React.useState(0);
  const [cycleAnchor, setCycleAnchor] = React.useState(1);
  React.useEffect(() => {
    getCycleStartDay().then(setCycleAnchor).catch(() => {});
  }, []);
  const currentCycleKey = React.useMemo(() => getCurrentCycle(cycleAnchor).key, [cycleAnchor]);
  const selectedMonthKey = cycleOffset === 0 ? undefined : shiftCycleKey(currentCycleKey, cycleOffset);

  const { budget, loading: budgetLoading, refresh: refreshBudget } = useBudget(selectedMonthKey);

  // Bütçe döngüsü tarihlerini tüm Dashboard hook'larına geçir.
  // budget.periodStart/End yüklenmeden (ilk render) hook'lar
  // undefined alır → kendi içinde takvim ayı fallback'ine düşer (güvenli).
  const cycleStart = budget.periodStart || undefined;
  const cycleEnd = budget.periodEnd || undefined;

  const { data: categories, refresh: refreshCats } = useCategorySpending(cycleStart, cycleEnd);
  const { data: vendors, refresh: refreshVendors } = useVendorSpending(cycleStart, cycleEnd);
  const { total: monthlyTotal, refresh: refreshTotal } = useMonthlyTotal(cycleStart, cycleEnd);
  const { goal, loading: goalLoading, refresh: refreshGoal } = useSavingsGoal();
  const { rows: limitRows, refresh: refreshLimits } = useCategoryLimitsProgress(cycleStart, cycleEnd);
  const {
    enabled: goalFeatureEnabled,
    dashboardFocusEnabled,
    loading: goalPreferencesLoading,
    refresh: refreshGoalFeature,
  } = useGoalFeatureEnabled();
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  // Borç yönetim alt sayfası (açık borç rozetine dokununca açılır — Faz 4a).
  const [debtSheetVisible, setDebtSheetVisible] = React.useState(false);
  const [incomeSheetVisible, setIncomeSheetVisible] = React.useState(false);
  const [goalContributionVisible, setGoalContributionVisible] = React.useState(false);
  const isFocused = useIsFocused();
  const { currency } = useCurrency();
  const { unreadCount, sync } = useNotifications();

  const refreshAll = useCallback(() => {
    refreshBudget();
    refreshCats();
    refreshVendors();
    refreshTotal();
    refreshGoal();
    refreshLimits();
    refreshGoalFeature();
  }, [refreshBudget, refreshCats, refreshVendors, refreshTotal, refreshGoal, refreshLimits, refreshGoalFeature]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
      return () => {
        setSelectedIndex(null);
      };
    }, [refreshAll])
  );

  // Ay seçimini YALNIZCA ekrandan ayrılınca sıfırla. (refreshAll'a bağlı effect'e
  // koyarsak: ay değişince useBudget yeni refresh döndürür → refreshAll kimliği
  // değişir → o effect'in cleanup'ı tetiklenip offset'i sıfırlar → güncel aya zıplar.
  // Sabit [] deps'li ayrı effect yalnızca gerçek blur'da çalışır.)
  useFocusEffect(
    useCallback(() => {
      return () => setCycleOffset(0);
    }, [])
  );

  useExpenseDataRefresh(refreshAll, isFocused);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshBudget(),
      refreshCats(),
      refreshVendors(),
      refreshTotal(),
      refreshGoal(),
      refreshLimits(),
      refreshGoalFeature(),
    ]);
    setRefreshing(false);
  };

  const donutSegments = React.useMemo(() => {
    if (categories.length === 0) {
      return [{ value: 1, color: Colors.surfaceLight, label: t('empty') }];
    }
    return categories.map(c => ({
      value: c.total,
      color: c.category_color,
      label: tc(c.category_name),
    }));
  }, [categories, t, tc]);

  // Güvenli seçim indeksi ve seçili kategori
  const selectedCat = selectedIndex !== null && selectedIndex >= 0 && selectedIndex < categories.length
    ? categories[selectedIndex] 
    : null;

  // Döngü bilgisi: anchor ≠ 1 ise tarih aralığını göster
  const showCycleRange = budget.cycleStartDay !== 1 && budget.periodStart && budget.periodEnd;
  const goalSurfacesReady = !goalLoading && !goalPreferencesLoading;
  const goalPresentation = getDashboardGoalPresentation({
    goal,
    featureEnabled: goalFeatureEnabled,
    focusEnabled: dashboardFocusEnabled,
    ready: goalSurfacesReady,
  });
  const showGoalLowerSection = goalPresentation.showFull
    || goalPresentation.showPlaceholder
    || (goalSurfacesReady && goalFeatureEnabled && limitRows.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={styles.appName}>S.P.A.R.K</Text>
            <Text style={styles.subtitle}>{t('app_subtitle')}</Text>
          </View>
          <Pressable
            onPress={() => {
              void sync();
              router.push('/notifications');
            }}
            style={styles.bellWrap}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('notif_center_title')}
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={24}
              color={Colors.textSecondary}
            />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Açık borç göstergesi (global, kırmızı) — borç "kötü" hissettirilir;
            kapatılana (settled) kadar durur. Dokununca borç yönetim sheet'i açılır. */}
        {budget.outstandingDebt > 0 && (
          <Animated.View entering={FadeInDown.delay(60).duration(400)} layout={LinearTransition.duration(750)}>
            <Pressable
              onPress={() => setDebtSheetVisible(true)}
              style={({ pressed }) => [styles.debtBanner, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={t('debt_outstanding_label')}
            >
              <View style={styles.debtBannerIcon}>
                <MaterialCommunityIcons name="alert-circle" size={22} color={Colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.debtBannerLabel}>{t('debt_outstanding_label')}</Text>
                <Text style={styles.debtBannerAmount}>
                  {formatCurrency(budget.outstandingDebt, currency)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.danger} />
            </Pressable>
          </Animated.View>
        )}

        {/* Kullanıcının tercihi açıksa aktif hedef, borç uyarısından sonra sakin
            bir özet olarak öne çıkar. Tam kart aşağıda ikinci kez gösterilmez. */}
        {goalPresentation.showPulse && goal && (
          <SavingsGoalPulseCard
            goal={goal}
            onOpen={() => router.push('/goal-settings')}
            onContribute={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setGoalContributionVisible(true);
            }}
          />
        )}

        {/* Main Amount & Donut */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} layout={LinearTransition.duration(750)} style={styles.chartSection}>
          {/* Ay navigasyonu — seçilen döngü tüm dashboard'ı (donut + bütçe + kategoriler) yansıtır */}
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => setCycleOffset((o) => o - 1)}
              hitSlop={10}
              style={({ pressed }) => [styles.monthNavBtn, pressed && styles.monthNavBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard_prev_cycle')}
            >
              <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textSecondary} />
            </Pressable>
            <Text style={styles.monthNavLabel}>
              {budget.periodStart ? formatMonthYear(budget.periodStart, t) : ''}
            </Text>
            <Pressable
              onPress={() => setCycleOffset((o) => Math.min(0, o + 1))}
              disabled={cycleOffset === 0}
              hitSlop={10}
              style={({ pressed }) => [styles.monthNavBtn, pressed && styles.monthNavBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard_next_cycle')}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={26}
                color={cycleOffset === 0 ? Colors.textMuted : Colors.textSecondary}
              />
            </Pressable>
          </View>
          {cycleOffset === 0 && <Text style={styles.totalLabel}>{t('this_month_spent')}</Text>}
          {showCycleRange && (
            <Text style={styles.cycleDateRange}>
              {formatDayMonth(budget.periodStart, t)} – {formatDayMonth(budget.periodEnd, t)}
            </Text>
          )}
          <Text style={styles.totalAmount}>
            {formatCurrency(monthlyTotal, currency)}
          </Text>

          <DonutChart
            segments={donutSegments}
            size={220}
            strokeWidth={26}
            selectedIndex={selectedIndex}
            onSelect={(idx) => {
              setSelectedIndex(prev => (prev === idx ? null : idx));
            }}
            innerContent={
              <Pressable
                onPress={() => setSelectedIndex(null)}
                style={({ pressed }) => [
                  styles.donutCenter,
                  selectedIndex !== null && pressed && styles.donutCenterPressed,
                ]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t('donut_center_clear')}
              >
                <MaterialCommunityIcons
                  name={selectedIndex !== null ? 'close' : 'arrow-right'}
                  size={selectedIndex !== null ? 26 : 32}
                  color={Colors.primary}
                />
              </Pressable>
            }
          />

          {/* Selected category info */}
          {categories.length > 0 && selectedCat && (
            <Animated.View
              entering={FadeIn.duration(320)}
              exiting={FadeOut.duration(220)}
              style={styles.selectedCategory}
            >
              <Text style={[styles.categoryHighlight, { color: selectedCat.category_color }]}>
                {tc(selectedCat.category_name)} {selectedCat.percentage}%
              </Text>
              <Text style={styles.categoryAmount}>
                {formatCurrency(selectedCat.total, currency)}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Budget Card — layout değişince yumuşak kayma */}
        {budget.monthlyBudget > 0 && (
          <Animated.View layout={LinearTransition.duration(750)}>
            <BudgetCard budget={budget} />
          </Animated.View>
        )}

        {/* Borç + Ek gelir girişleri — YAN YANA (dikey yer kazanmak için; ikisi
            alt alta pill iken kart yığınını gereksiz uzatıyordu). Her ikisi de
            bütçenin harcanabilir tutarını etkileyen nakit kaynakları olduğundan
            aynı satırda durmaları anlamsal olarak da doğru.
            Metin iki satıra bölünür (ikon solda): yarım genişlikte Rusça
            "Операции с долгами" / AZ "Əlavə gəlir" tek satıra sığmıyor. */}
        {budget.monthlyBudget > 0 && (
          <Animated.View layout={LinearTransition.duration(750)} style={styles.cashEntryRow}>
            <Pressable
              onPress={() => setDebtSheetVisible(true)}
              style={({ pressed }) => [styles.cashEntryTile, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel={t('debt_manage_cta')}
            >
              <View style={[styles.cashEntryIcon, { backgroundColor: Colors.danger + '1A' }]}>
                <MaterialCommunityIcons name="hand-coin-outline" size={17} color={Colors.danger} />
              </View>
              <View style={styles.cashEntryTextWrap}>
                <Text style={styles.cashEntryLabel} numberOfLines={1}>{t('debt_tile_label')}</Text>
                {budget.outstandingDebt > 0 ? (
                  <Text style={[styles.cashEntryValue, { color: Colors.danger }]} numberOfLines={1}>
                    {formatCurrency(budget.outstandingDebt, currency, false)}
                  </Text>
                ) : (
                  <Text style={styles.cashEntryValueEmpty}>—</Text>
                )}
              </View>
            </Pressable>

            <Pressable
              onPress={() => setIncomeSheetVisible(true)}
              style={({ pressed }) => [styles.cashEntryTile, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel={t('income_manage_cta')}
            >
              <View style={[styles.cashEntryIcon, { backgroundColor: Colors.success + '1A' }]}>
                <MaterialCommunityIcons name="cash-plus" size={17} color={Colors.success} />
              </View>
              <View style={styles.cashEntryTextWrap}>
                <Text style={styles.cashEntryLabel} numberOfLines={1}>{t('income_tile_label')}</Text>
                {budget.extraIncomeIn > 0 ? (
                  <Text style={[styles.cashEntryValue, { color: Colors.success }]} numberOfLines={1}>
                    +{formatCurrency(budget.extraIncomeIn, currency, false)}
                  </Text>
                ) : (
                  <Text style={styles.cashEntryValueEmpty}>—</Text>
                )}
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Standart hedef kartı + kategori limitleri — limitler hedeften bağımsızdır. */}
        {showGoalLowerSection && (
          <View style={budget.monthlyBudget > 0 ? styles.goalBlockSpacing : undefined}>
            {goalPresentation.showFull && goal && (
              <Animated.View entering={FadeInDown.delay(50).duration(400)} layout={LinearTransition.duration(750)}>
                <SavingsGoalCard goal={goal} />
              </Animated.View>
            )}

            {goalPresentation.showPlaceholder && (
              <Animated.View entering={FadeInDown.delay(50).duration(400)} layout={LinearTransition.duration(750)}>
                <Pressable
                  onPress={() => router.push('/goal-settings')}
                  style={({ pressed }) => [styles.goalPlaceholder, pressed && { opacity: 0.9 }]}
                >
                  <View style={styles.goalPlaceholderIcon}>
                    <MaterialCommunityIcons name="flag-outline" size={26} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalPlaceholderTitle}>{t('goal_placeholder_title')}</Text>
                    <Text style={styles.goalPlaceholderSub}>{t('goal_placeholder_sub')}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
                </Pressable>
              </Animated.View>
            )}

            {goalSurfacesReady && goalFeatureEnabled && limitRows.length > 0 && (
              <Animated.View layout={LinearTransition.duration(750)}>
                <CategoryLimitsSection rows={limitRows} />
              </Animated.View>
            )}
          </View>
        )}

        {/* Categories */}
        <Animated.View layout={LinearTransition.duration(750)}>
          {categories.length > 0 ? (
            <AnimatedCard delay={300} style={styles.categoriesCard}>
              <Text
                style={[styles.sectionTitle, styles.sectionTitleCategories]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {t('top_categories')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryPills}
              >
                {categories.slice(0, 6).map(c => (
                  <CategoryPill
                    key={c.category_id}
                    name={c.category_name}
                    icon={c.category_icon}
                    color={c.category_color}
                    percentage={c.percentage}
                  />
                ))}
              </ScrollView>
            </AnimatedCard>
          ) : (
            <AnimatedCard delay={300} style={styles.categoriesCard}>
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <MaterialCommunityIcons name="chart-donut" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>{t('empty_dashboard_title')}</Text>
                <Text style={styles.emptyDesc}>{t('empty_dashboard_desc')}</Text>
                <View style={styles.emptyCTARow}>
                  <Pressable
                    style={styles.emptyCTAPrimary}
                    onPress={() => router.push('/(tabs)/scanner')}
                  >
                    <MaterialCommunityIcons name="camera" size={18} color={Colors.textInverse} />
                    <Text style={styles.emptyCTAPrimaryText}>{t('empty_dashboard_scan')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.emptyCTASecondary}
                    onPress={() => router.push('/add-expense')}
                  >
                    <MaterialCommunityIcons name="pencil-plus" size={18} color={Colors.primary} />
                    <Text style={styles.emptyCTASecondaryText}>{t('empty_dashboard_manual')}</Text>
                  </Pressable>
                </View>
              </View>
            </AnimatedCard>
          )}
        </Animated.View>

        {/* Top Vendors */}
        {vendors.length > 0 && (
          <Animated.View layout={LinearTransition.duration(750)}>
            <AnimatedCard delay={400} style={styles.vendorsCard}>
              <Text style={styles.sectionTitle}>{t('top_vendors')}</Text>
              <View style={styles.vendorGrid}>
                {vendors.slice(0, 4).map(v => (
                  <View key={v.vendor_id} style={styles.vendorItem}>
                    <VendorAvatar
                      name={v.vendor_name}
                      logoUri={v.vendor_logo}
                      size={40}
                    />
                    <Text style={styles.vendorName} numberOfLines={1}>{v.vendor_name}</Text>
                    <Text style={styles.vendorPercent}>{v.percentage}%</Text>
                  </View>
                ))}
              </View>
            </AnimatedCard>
          </Animated.View>
        )}

        {/* Quick Stats — Modern Icons */}
        <Animated.View layout={LinearTransition.duration(750)}>
          <AnimatedCard delay={500} style={styles.statsCard}>
            <View style={styles.statRow}>
              {/* Aylık Bütçe */}
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: Colors.primary + '22' }]}>
                  <MaterialCommunityIcons name="wallet-outline" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.statValue}>
                  {formatCurrency(budget.monthlyBudget, currency, false)}
                </Text>
                <Text style={styles.statLabel}>{t('budget_monthly')}</Text>
              </View>

              <View style={styles.statDivider} />

              {/* Kullanılan */}
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: Colors.chartOrange + '22' }]}>
                  <MaterialCommunityIcons name="chart-donut" size={22} color={Colors.chartOrange} />
                </View>
                <Text style={styles.statValue}>{budget.percentage}%</Text>
                <Text style={styles.statLabel}>{t('budget_used')}</Text>
              </View>

              <View style={styles.statDivider} />

              {/* Kalan Gün */}
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: Colors.chartBlue + '22' }]}>
                  <MaterialCommunityIcons name="calendar-clock" size={22} color={Colors.chartBlue} />
                </View>
                <Text style={styles.statValue}>{budget.daysRemaining}</Text>
                <Text style={styles.statLabel}>{t('budget_days_left')}</Text>
              </View>
            </View>

            {/* Budget micro-bar */}
            {budget.monthlyBudget > 0 && (
              <View style={styles.microBar}>
                <View style={[
                  styles.microBarFill,
                  {
                    width: `${Math.min(budget.percentage, 100)}%`,
                    backgroundColor: budget.isOverBudget ? Colors.danger
                      : budget.percentage > 80 ? Colors.warning
                      : Colors.primary,
                  },
                ]} />
              </View>
            )}
          </AnimatedCard>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <DebtSheet
        visible={debtSheetVisible}
        onClose={() => setDebtSheetVisible(false)}
        currency={currency}
        // Borç mutasyonu yalnız bütçe/borç özetini değiştirir. Tüm dashboard
        // sorgularını paralel başlatmak yerine hedefli ve await edilebilir yenile.
        onChanged={refreshBudget}
      />

      <IncomeSheet
        visible={incomeSheetVisible}
        onClose={() => setIncomeSheetVisible(false)}
        currency={currency}
        cycleStart={budget.periodStart}
        cycleEnd={budget.periodEnd}
        onChanged={refreshBudget}
      />

      <SavingsGoalContributionSheet
        visible={goalContributionVisible}
        onClose={() => setGoalContributionVisible(false)}
      />
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  bellWrap: {
    position: 'relative',
    padding: Spacing.xs,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: FontFamily.bold,
  },
  appName: {
    ...Typography.headlineLarge,
    color: Colors.primary,
    fontFamily: FontFamily.extraBold,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  /** Açık borç göstergesi (kırmızı cam) */
  debtBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.danger + '14',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    marginTop: Spacing.sm,
  },
  debtBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.danger + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtBannerLabel: {
    ...Typography.labelMedium,
    color: Colors.danger,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  debtBannerAmount: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    marginTop: 2,
  },
  /** Borç + Ek gelir giriş kutuları — yan yana, eşit genişlikte. */
  cashEntryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cashEntryTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cashEntryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashEntryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  cashEntryLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
  },
  /** Kutunun ikinci satırı: açık borç / dönemin ek geliri. */
  cashEntryValue: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
    marginTop: 1,
  },
  /** Değer yokken em-dash — iki kutu eşit yükseklikte kalsın (i18n gerektirmez). */
  cashEntryValueEmpty: {
    ...Typography.labelMedium,
    color: Colors.textMuted,
    fontFamily: FontFamily.bold,
    marginTop: 1,
  },
  /** Aylık bütçe kartı ile birikim kartı arasında nefes payı */
  goalBlockSpacing: {
    marginTop: Spacing.lg,
  },
  goalPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  goalPlaceholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPlaceholderTitle: {
    ...Typography.labelLarge,
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: FontFamily.black,
    letterSpacing: 1.65,
    textTransform: 'uppercase',
  },
  goalPlaceholderSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  chartSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  monthNavBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  monthNavLabel: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    minWidth: 150,
    textAlign: 'center',
  },
  totalLabel: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  cycleDateRange: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  totalAmount: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.xxl,
  },
  donutCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }],
  },
  selectedCategory: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  categoryHighlight: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.medium,
  },
  categoryAmount: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginTop: Spacing.xxs,
  },
  sectionTitle: {
    ...Typography.labelLarge,
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 1.75,
    textTransform: 'uppercase',
    fontFamily: FontFamily.black,
    marginBottom: Spacing.md,
  },
  /** Uzun başlıklar tek satırda kalsın (kategori kartı) */
  sectionTitleCategories: {
    letterSpacing: 1.25,
    marginBottom: Spacing.sm,
  },
  categoriesCard: {
    marginTop: Spacing.lg,
  },
  categoryPills: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  vendorsCard: {
    marginTop: Spacing.lg,
  },
  vendorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  vendorItem: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  vendorName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  vendorPercent: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  statsCard: {
    marginTop: Spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  statLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: Colors.divider,
  },
  microBar: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: Spacing.lg,
  },
  microBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
  },
  emptyDesc: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyCTARow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  emptyCTAPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryAction,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
  },
  emptyCTAPrimaryText: {
    ...Typography.labelMedium,
    color: Colors.onPrimary,
    fontFamily: FontFamily.semiBold,
  },
  emptyCTASecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyCTASecondaryText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
});
