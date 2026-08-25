// S.P.A.R.K. — Dashboard Screen (Home)
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useAppTheme, useThemeRevision } from '../../src/theme/themeStore';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/theme/colors';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../../src/theme/spacing';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatPeriodRange } from '../../src/utils/dateUtils';
import { getCurrentCycle, shiftCycleKey } from '../../src/utils/budgetCycle';
import { getCycleStartDay } from '../../src/services/budgetCycleSettings';
import { useBudget } from '../../src/hooks/useBudget';
import { useCategorySpending, useVendorSpending, useMonthlyTotal } from '../../src/hooks/useExpenses';
import { useSavingsGoal, useCategoryLimitsProgress, useGoalFeatureEnabled } from '../../src/hooks/useSavingsGoalData';

import DashboardBudgetDonut from '../../src/components/DashboardBudgetDonut';
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
import MarqueeText from '../../src/components/MarqueeText';
import DashboardCashEntryTiles from '../../src/components/DashboardCashEntryTiles';
import LivingSparkWordmark from '../../src/components/LivingSparkWordmark';
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
            <LivingSparkWordmark
              size="hero"
              active={isFocused}
              accessibilityHint={t('living_wordmark_hint')}
            />
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
          {/* Dönem navigasyonu — ay adı yerine gerçek tarih aralığı kanoniktir. */}
          <View style={styles.periodNav}>
            <Pressable
              onPress={() => setCycleOffset((o) => o - 1)}
              hitSlop={10}
              style={({ pressed }) => [styles.periodNavBtn, pressed && styles.periodNavBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard_prev_cycle')}
            >
              <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textSecondary} />
            </Pressable>
            <View style={styles.periodIdentity}>
              <Text style={styles.periodKicker}>{t('dashboard_budget_period')}</Text>
              <Text
                style={styles.periodRangeLabel}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {budget.periodStart && budget.periodEnd
                  ? formatPeriodRange(budget.periodStart, budget.periodEnd, t)
                  : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => setCycleOffset((o) => Math.min(0, o + 1))}
              disabled={cycleOffset === 0}
              hitSlop={10}
              style={({ pressed }) => [styles.periodNavBtn, pressed && styles.periodNavBtnPressed]}
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

          <DashboardBudgetDonut
            categories={categories}
            totalSpent={monthlyTotal}
            effectiveBudget={budget.effectiveBudget}
            currency={currency}
            periodKey={`${budget.periodStart}:${budget.periodEnd}`}
          />
        </Animated.View>

        {/* Budget Card — layout değişince yumuşak kayma */}
        {budget.monthlyBudget > 0 && (
          <Animated.View layout={LinearTransition.duration(750)}>
            <BudgetCard budget={budget} />
          </Animated.View>
        )}

        {/* Borç + ek gelir girişleri yan yana kalır. Boş durumda açıklayıcı metin;
            veri varsa tutar ile finansal bağlam (açık bakiye / bütçeye eklendi)
            ortak bileşen tarafından gösterilir. */}
        {budget.monthlyBudget > 0 && (
          <Animated.View layout={LinearTransition.duration(750)}>
            <DashboardCashEntryTiles
              outstandingDebt={budget.outstandingDebt}
              extraIncomeIn={budget.extraIncomeIn}
              currency={currency}
              onDebtPress={() => setDebtSheetVisible(true)}
              onIncomePress={() => setIncomeSheetVisible(true)}
            />
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
                    name={tc(c.category_name)}
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
                    <View style={styles.vendorMeta}>
                      <MarqueeText
                        text={v.vendor_name}
                        style={styles.vendorName}
                        containerStyle={styles.vendorNameViewport}
                        speed={28}
                        gap={Spacing.xxl}
                        startDelay={1400}
                      />
                      <Text style={styles.vendorPercent}>{v.percentage}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            </AnimatedCard>
          </Animated.View>
        )}

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
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.sm,
  },
  periodNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  periodNavBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  periodIdentity: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  periodKicker: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xxs,
  },
  periodRangeLabel: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    width: '100%',
    textAlign: 'center',
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
    columnGap: Spacing.sm,
    rowGap: Spacing.lg,
  },
  vendorItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
  },
  vendorMeta: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  vendorNameViewport: {
    width: '100%',
    minWidth: 0,
  },
  vendorName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  vendorPercent: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
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
