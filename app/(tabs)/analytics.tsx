// S.P.A.R.K. — Advanced Analytics Screen
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, PanResponder, Animated as RNAnimated, Dimensions, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useAppTheme, useThemeRevision } from '../../src/theme/themeStore';
import { useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { useCategorySpending, useVendorSpending, useDailySpending, useTopTransactions, useSubcategorySpending, useBehavioralAnalytics } from '../../src/hooks/useExpenses';
import { ExpenseDao } from '../../src/db/expenseDao';
import { SubscriptionDao } from '../../src/db/subscriptionDao';
import { RecurringPaymentReminderDao } from '../../src/db/recurringPaymentReminderDao';
import { CategoryLimitDao } from '../../src/db/categoryLimitDao';
import { GoalDao, type SavingsGoalRow } from '../../src/db/goalDao';
import type { RecurringPaymentReminder, SubscriptionWithDetails } from '../../src/db/schema';
import { getStartOfMonth, getEndOfMonth, getToday, formatMonthYear, formatDayMonth } from '../../src/utils/dateUtils';
import { getCurrentCycle, getCycleProgress } from '../../src/utils/budgetCycle';
import {
  resolveAnalyticsDateRange,
  resolveComparableAnalyticsRanges,
  resolvePreviousAnalyticsDateRange,
} from '../../src/utils/analyticsPeriod';
import { computeSpendingProjection } from '../../src/utils/spendingProjection';
import { computeSpendingStats } from '../../src/utils/spendingStats';
import { alignPreviousDailySeries } from '../../src/utils/dailySeriesAlignment';
import {
  computePersonalInflation,
  type PersonalInflationResult,
} from '../../src/utils/personalInflation';

import AnimatedCard from '../../src/components/AnimatedCard';
import CustomDatePicker from '../../src/components/CustomDatePicker';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { SparkToast } from '../../src/components/SparkToast';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { intlLocaleForLanguage } from '../../src/i18n/languageOptions';
import ItemAnalyticsModal from '../../src/components/ItemAnalyticsModal';
import StreakDetailsSheet from '../../src/components/StreakDetailsSheet';
import { getAnalyticsStyles } from '../../src/components/analytics/analyticsStyles';
import {
  type Timeframe,
  type PriceChange,
  type SilentSpendItem,
} from '../../src/components/analytics/shared';
import ChartCard from '../../src/components/analytics/ChartCard';
import HeatmapCard from '../../src/components/analytics/HeatmapCard';
import TopTxCard from '../../src/components/analytics/TopTxCard';
import PriceWatchCard from '../../src/components/analytics/PriceWatchCard';
import SubscriptionsCard from '../../src/components/analytics/SubscriptionsCard';
import SilentSpendCard from '../../src/components/analytics/SilentSpendCard';
import MonthlyCompareCard from '../../src/components/analytics/MonthlyCompareCard';
import ProjectionCard from '../../src/components/analytics/ProjectionCard';
import LimitsHealthCard from '../../src/components/analytics/LimitsHealthCard';
import GoalCard from '../../src/components/analytics/GoalCard';
import CategoriesCard from '../../src/components/analytics/CategoriesCard';
import DonutCard from '../../src/components/analytics/DonutCard';
import VendorsCard from '../../src/components/analytics/VendorsCard';
import VendorAnalyticsSheet from '../../src/components/analytics/VendorAnalyticsSheet';
import StreakCard from '../../src/components/analytics/StreakCard';
import PersonalInflationCard from '../../src/components/analytics/PersonalInflationCard';
import { useBudget } from '../../src/hooks/useBudget';
import { useExpenseDataRefresh } from '../../src/context/RefreshContext';
import { useTabSwipe } from '../../src/context/TabSwipeContext';
import { useCurrency } from '../../src/context/CurrencyContext';
import type { MeasurementUnit } from '../../src/utils/measurementUnit';
import { buildPriceChanges } from '../../src/utils/priceWatch';
import { buildSubscriptionAnalyticsInfo } from '../../src/utils/subscriptionAnalytics';
import {
  type AnalyticsCardConfig,
  buildAllCardsHiddenConfig,
  hasActiveAnalyticsCard,
  resolveAnalyticsCardEditExit,
} from '../../src/utils/analyticsCardConfig';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const AUTO_SCROLL_EDGE = 100;
const AUTO_SCROLL_SPEED = 10;
const CARD_GAP = 8;

/** Kart düzenleme modunda sıra tutamacı — kompakt, kart sınırı içinde */
const editDragHandleStyles = StyleSheet.create({
  hitArea: {
    position: 'absolute',
    right: Spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: Spacing.xs,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
    minHeight: 28,
  },
});

const ALL_CARDS: { id: string; icon: string; labelKey: string }[] = [
  { id: 'chart',           icon: 'chart-bar',          labelKey: 'card_chart' },
  { id: 'projection',      icon: 'crystal-ball',       labelKey: 'card_projection' },
  { id: 'monthly_compare', icon: 'swap-horizontal',    labelKey: 'card_monthly_compare' },
  { id: 'goal',            icon: 'flag-checkered',     labelKey: 'card_goal' },
  { id: 'limits_health',   icon: 'gauge',              labelKey: 'card_limits_health' },
  { id: 'subscriptions',   icon: 'sync-circle',        labelKey: 'card_subscriptions' },
  { id: 'silent_spend',    icon: 'water-outline',      labelKey: 'card_silent_spend' },
  { id: 'personal_inflation', icon: 'basket-outline',  labelKey: 'card_personal_inflation' },
  { id: 'categories',      icon: 'shape-outline',      labelKey: 'card_categories' },
  { id: 'streak',          icon: 'fire',               labelKey: 'card_streak' },
  { id: 'donut',           icon: 'chart-donut',        labelKey: 'card_donut' },
  { id: 'heatmap',         icon: 'calendar-month',     labelKey: 'card_heatmap' },
  { id: 'top_tx',          icon: 'podium-gold',        labelKey: 'card_top_tx' },
  { id: 'price_watch',     icon: 'tag-arrow-up',       labelKey: 'card_price_watch' },
  { id: 'vendors',         icon: 'store-outline',      labelKey: 'card_vendors' },
];

const DEFAULT_ACTIVE = ['chart', 'projection', 'monthly_compare', 'personal_inflation', 'goal', 'limits_health', 'subscriptions', 'silent_spend', 'categories', 'vendors', 'top_tx'];
const DEFAULT_HIDDEN = ALL_CARDS.map(card => card.id).filter(id => !DEFAULT_ACTIVE.includes(id));

interface DragInfo {
  id: string;
  originalIdx: number;
  targetIdx: number;
  initialScroll: number;
}

const DraggablePanel = ({
  children, id, isEditing,
  shiftOffset, isDragActive,
  onDragStart, onDragMove, onDragEnd, onLayout,
  scrollRef, scrollOffsetRef,
  reorderAccessibilityLabel,
}: any) => {
  const pan = useRef(new RNAnimated.ValueXY()).current;
  const shiftY = useRef(new RNAnimated.Value(0)).current;
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const propsRef = useRef({ onDragStart, onDragMove, onDragEnd, id, scrollRef, scrollOffsetRef });
  propsRef.current = { onDragStart, onDragMove, onDragEnd, id, scrollRef, scrollOffsetRef };

  useEffect(() => {
    RNAnimated.spring(shiftY, {
      toValue: shiftOffset,
      friction: 8,
      tension: 120,
      useNativeDriver: false,
    }).start();
  }, [shiftOffset, shiftY]);

  const stopAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  };

  useEffect(() => () => stopAutoScroll(), []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        propsRef.current.onDragStart(propsRef.current.id);
      },
      onPanResponderMove: (evt, gesture) => {
        pan.setValue({ x: 0, y: gesture.dy });
        propsRef.current.onDragMove(propsRef.current.id, gesture.dy);

        const touchY = evt.nativeEvent.pageY;
        const { scrollRef: sRef, scrollOffsetRef: soRef } = propsRef.current;
        stopAutoScroll();

        if (touchY < AUTO_SCROLL_EDGE && sRef?.current) {
          autoScrollTimer.current = setInterval(() => {
            const cur = soRef?.current ?? 0;
            sRef.current?.scrollTo({ y: Math.max(0, cur - AUTO_SCROLL_SPEED), animated: false });
          }, 16);
        } else if (touchY > SCREEN_HEIGHT - AUTO_SCROLL_EDGE && sRef?.current) {
          autoScrollTimer.current = setInterval(() => {
            const cur = soRef?.current ?? 0;
            sRef.current?.scrollTo({ y: cur + AUTO_SCROLL_SPEED, animated: false });
          }, 16);
        }
      },
      onPanResponderRelease: () => {
        stopAutoScroll();
        propsRef.current.onDragEnd(propsRef.current.id);
        RNAnimated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 8, useNativeDriver: false }).start();
      },
    })
  ).current;

  return (
    <RNAnimated.View
      onLayout={(e) => onLayout?.(id, e.nativeEvent.layout.height)}
      style={{
        transform: [{ translateY: isDragActive ? pan.y : shiftY }],
        zIndex: isDragActive ? 1000 : 1,
        position: 'relative',
        marginVertical: 4,
        opacity: isDragActive ? 0.88 : 1,
        ...(isDragActive ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 20,
        } : {}),
      }}
    >
      {children}
      {isEditing && (
        <View
          {...panResponder.panHandlers}
          style={editDragHandleStyles.hitArea}
          accessibilityRole="adjustable"
          accessibilityLabel={reorderAccessibilityLabel}
        >
          <View
            style={[
              editDragHandleStyles.pill,
              {
                backgroundColor: isDragActive ? Colors.primaryGlow : 'transparent',
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: isDragActive ? Colors.primary : Colors.border,
                ...(isDragActive
                  ? Platform.select({
                      ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                      },
                      android: { elevation: 3 },
                      default: {},
                    })
                  : {}),
              },
            ]}
          >
            <MaterialCommunityIcons
              name="drag-vertical"
              color={isDragActive ? Colors.primary : Colors.textMuted}
              size={16}
            />
          </View>
        </View>
      )}
    </RNAnimated.View>
  );
};

export default function AnalyticsScreen() {
  // BÜTÇE DURUMU vb. kartlar sekme odakta değilken de tema güncellensin.
  // Merkezi React tema store'u tüm analitik kartları aynı karede günceller.
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  // P10: Büyük StyleSheet her render’da yeniden üretilmesin; yalnız tema
  // geçişlerinde yeniden oluştur.
  const styles = useMemo(() => getAnalyticsStyles(), [scheme, themeRevision]);
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const { t, tc, language } = useLanguage();
  const { currency } = useCurrency();
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  // Faz 2: Kartların paylaştığı temel prop demeti — tek yerde memoize (P11).
  const cardBase = useMemo(() => ({ styles, t, tc, currency }), [styles, t, tc, currency]);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const { budget, loading: budgetLoading, refresh: refreshBudget } = useBudget();

  const dateRange = useMemo(() => {
    const resolved = resolveAnalyticsDateRange({
      timeframe,
      customStart,
      customEnd,
      budgetPeriodStart: budget.periodStart,
      budgetPeriodEnd: budget.periodEnd,
    });
    let label = '';

    if (timeframe === 'week') {
      label = t('last_7_days');
    } else if (timeframe === 'month') {
      label = budget.cycleStartDay === 1
        ? formatMonthYear(resolved.start, t)
        : `${formatDayMonth(resolved.start, t)} – ${formatDayMonth(resolved.end, t)}`;
    } else if (timeframe === 'year') {
      label = t('all_time');
    } else if (timeframe === 'custom') {
      const s = customStart.split('-').reverse().slice(0, 2).join('.');
      const e = customEnd.split('-').reverse().slice(0, 2).join('.');
      label = `${s} — ${e}`;
    }
    return { ...resolved, label };
  }, [
    timeframe,
    t,
    customStart,
    customEnd,
    budget.periodStart,
    budget.periodEnd,
    budget.cycleStartDay,
  ]);
  const budgetPeriodReady = Boolean(budget.periodStart && budget.periodEnd);
  // useBudget ilk otomatik DB okumasını bitirmeden hiçbir Analiz sorgusu başlama.
  // Bu, ilk görünür karede yanlış takvim ayı verisini ve SQLite okuma çakışmasını önler.
  const analyticsPeriodReady = budgetPeriodReady;
  const activeAnalyticsKey = `${timeframe}:${dateRange.start}:${dateRange.end}`;
  const analyticsQueryOptions = useMemo(
    () => ({ enabled: analyticsPeriodReady, autoLoad: false }),
    [analyticsPeriodReady],
  );
  const topTransactionsQueryOptions = useMemo(
    () => ({
      ...analyticsQueryOptions,
      selection: timeframe === 'year' ? 'per-vendor' as const : 'overall' as const,
    }),
    [analyticsQueryOptions, timeframe],
  );
  const cycleQueryOptions = useMemo(
    () => ({ enabled: budgetPeriodReady, autoLoad: false }),
    [budgetPeriodReady],
  );

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_ACTIVE);
  const [hiddenCards, setHiddenCards] = useState<string[]>(DEFAULT_HIDDEN);
  const committedCardConfigRef = useRef<AnalyticsCardConfig>({
    active: [...DEFAULT_ACTIVE],
    hidden: [...DEFAULT_HIDDEN],
  });
  const configLoaded = useRef(false);
  const heightsRef = useRef<{ [key: string]: number }>({});
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);

  const [activeDrag, setActiveDrag] = useState<DragInfo | null>(null);
  const dragRef = useRef<DragInfo | null>(null);

  const handleLayout = (id: string, height: number) => {
    heightsRef.current[id] = height;
  };

  function getCardPositions() {
    const positions: { id: string; center: number }[] = [];
    let cumTop = 0;
    for (const cid of cardOrder) {
      const h = heightsRef.current[cid] || 150;
      positions.push({ id: cid, center: cumTop + h / 2 });
      cumTop += h + CARD_GAP;
    }
    return positions;
  }

  function getShiftOffset(cardId: string, cardIndex: number): number {
    if (!activeDrag || activeDrag.id === cardId) return 0;
    const { originalIdx, targetIdx } = activeDrag;
    const draggedH = heightsRef.current[activeDrag.id] || 150;

    if (targetIdx > originalIdx && cardIndex > originalIdx && cardIndex <= targetIdx) {
      return -(draggedH + CARD_GAP);
    }
    if (targetIdx < originalIdx && cardIndex >= targetIdx && cardIndex < originalIdx) {
      return draggedH + CARD_GAP;
    }
    return 0;
  }

  function handleDragStart(id: string) {
    const idx = cardOrder.indexOf(id);
    const info: DragInfo = { id, originalIdx: idx, targetIdx: idx, initialScroll: scrollOffsetRef.current };
    dragRef.current = info;
    setActiveDrag(info);
  }

  function handleDragMove(id: string, dy: number) {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;

    const scrollDelta = scrollOffsetRef.current - drag.initialScroll;
    const adjustedDy = dy + scrollDelta;

    const positions = getCardPositions();
    const virtualCenter = positions[drag.originalIdx].center + adjustedDy;

    let rank = 0;
    for (let i = 0; i < positions.length; i++) {
      if (i === drag.originalIdx) continue;
      if (virtualCenter > positions[i].center) rank++;
    }

    if (rank !== drag.targetIdx) {
      drag.targetIdx = rank;
      setActiveDrag({ ...drag });
    }
  }

  function handleDragEnd(id: string) {
    const drag = dragRef.current;
    if (!drag) { setActiveDrag(null); return; }

    const { originalIdx, targetIdx } = drag;
    if (targetIdx !== originalIdx) {
      setCardOrder(prev => {
        const arr = [...prev];
        const [removed] = arr.splice(originalIdx, 1);
        arr.splice(targetIdx, 0, removed);
        return arr;
      });
    }

    dragRef.current = null;
    setActiveDrag(null);
  }

  function removeCard(id: string) {
    setCardOrder(prev => {
      const next = prev.filter(c => c !== id);
      setHiddenCards(h => {
        return [...h, id];
      });
      return next;
    });
  }

  function addCard(id: string) {
    setHiddenCards(prev => {
      const nh = prev.filter(c => c !== id);
      setCardOrder(co => {
        return [...co, id];
      });
      return nh;
    });
  }

  function removeAllCards() {
    const next = buildAllCardsHiddenConfig(ALL_CARDS.map(card => card.id));
    dragRef.current = null;
    setActiveDrag(null);
    setCardOrder(next.active);
    setHiddenCards(next.hidden);
  }

  async function handleCardEditingToggle() {
    if (!isEditing) {
      const committed = committedCardConfigRef.current;
      setCardOrder([...committed.active]);
      setHiddenCards([...committed.hidden]);
      setIsEditing(true);
      return;
    }
    const confirmed = resolveAnalyticsCardEditExit(
      { active: cardOrder, hidden: hiddenCards },
      committedCardConfigRef.current,
      'confirm',
    );
    if (!confirmed) {
      SparkToast.show(
        t('analytics_card_selection_required_title'),
        'warning',
        t('analytics_card_selection_required_desc'),
      );
      return;
    }
    const saved = await saveCardConfig(confirmed.active, confirmed.hidden);
    if (!saved) {
      SparkToast.show(t('error_saving_data'), 'error');
      return;
    }
    committedCardConfigRef.current = confirmed;
    setCardOrder(confirmed.active);
    setHiddenCards(confirmed.hidden);
    setIsEditing(false);
  }

  const { data: categories, refresh: refreshCats } = useCategorySpending(
    dateRange.start,
    dateRange.end,
    analyticsQueryOptions,
  );
  const { data: vendors, refresh: refreshVendors } = useVendorSpending(
    dateRange.start,
    dateRange.end,
    analyticsQueryOptions,
  );
  const { data: dailyData, refresh: refreshDaily } = useDailySpending(
    dateRange.start,
    dateRange.end,
    analyticsQueryOptions,
  );
  const { data: topTx, refresh: refreshTop } = useTopTransactions(
    dateRange.start,
    dateRange.end,
    10,
    topTransactionsQueryOptions,
  );
  const { data: subcats, refresh: refreshSubcats } = useSubcategorySpending(
    selectedCategory,
    dateRange.start,
    dateRange.end,
    analyticsQueryOptions,
  );
  const { needsWants, weekWeekend, refresh: refreshBehavior } = useBehavioralAnalytics(
    dateRange.start,
    dateRange.end,
    analyticsQueryOptions,
  );
  // Haftalık/özel filtreye geçildiğinde projeksiyonun kısa süreliğine o filtrenin
  // dailyData'sını kullanmaması için bütçe döngüsü datasını bağımsız tut.
  const { data: cycleDailyData, refresh: refreshCycleDaily } = useDailySpending(
    budget.periodStart || undefined,
    budget.periodEnd || undefined,
    cycleQueryOptions,
  );

  const [comparisonTotals, setComparisonTotals] = useState<{
    status: 'ready' | 'unavailable' | 'no_completed_days';
    current: number;
    previous: number;
  }>({ status: 'no_completed_days', current: 0, previous: 0 });
  const [trackingStartDate, setTrackingStartDate] = useState<string | null>(null);
  const [prevDailyData, setPrevDailyData] = useState<{ date: string; total: number }[]>([]);
  const [prevVendorTotals, setPrevVendorTotals] = useState<Map<number, number>>(new Map());
  const [inflationInfo, setInflationInfo] = useState<PersonalInflationResult>(
    () => computePersonalInflation([], []),
  );
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const prevRangeSequence = useRef(0);
  const silentSpendSequence = useRef(0);
  const vendorItemsSequence = useRef(0);
  const refreshQueueRef = useRef<Promise<void>>(Promise.resolve());
  const hasCompletedAnalyticsLoad = useRef(false);
  const [loadedAnalyticsKey, setLoadedAnalyticsKey] = useState('');

  const [yearlyData, setYearlyData] = useState<{ label: string; value: number }[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null);
  const [vendorItems, setVendorItems] = useState<any[]>([]);
  const [vendorItemsLoading, setVendorItemsLoading] = useState(false);
  const [vendorAnalysisVisible, setVendorAnalysisVisible] = useState(false);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [selectedItemUnit, setSelectedItemUnit] = useState<MeasurementUnit | undefined>();
  const [selectedItemCanonicalProductId, setSelectedItemCanonicalProductId] = useState<number | null>(null);
  const [itemAnalysisVisible, setItemAnalysisVisible] = useState(false);
  const [returnToVendorAfterItem, setReturnToVendorAfterItem] = useState(false);
  const [streakDetailVariant, setStreakDetailVariant] = useState<'zero' | 'streak' | 'under' | null>(null);
  const [selectedNWIdx, setSelectedNWIdx] = useState<number | null>(null);
  const [selectedWWIdx, setSelectedWWIdx] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubs, setActiveSubs] = useState<SubscriptionWithDetails[]>([]);
  const [activePaymentPlans, setActivePaymentPlans] = useState<RecurringPaymentReminder[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<{
    category_id: number;
    category_name: string;
    category_icon: string;
    category_color: string;
    limit: number;
    spent: number;
  }[]>([]);
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoalRow | null>(null);
  const [silentSpendData, setSilentSpendData] = useState<{
    items: SilentSpendItem[];
    totalAmount: number;
    totalCount: number;
    distinctItems: number;
  } | null>(null);
  const isFocused = useIsFocused();

  // Düzenleme sürerken yatay hareketin ana uygulama sekmesini değiştirmesine
  // izin verme. Alt sekme düğmesiyle çıkılırsa focus cleanup taslağı geri alır.
  useEffect(() => {
    if (!isFocused || !isEditing) return undefined;
    setNestedHorizontalGestureActive(true);
    return () => setNestedHorizontalGestureActive(false);
  }, [isEditing, isFocused, setNestedHorizontalGestureActive]);

  const prevDateRange = useMemo(() => {
    return resolvePreviousAnalyticsDateRange(timeframe, dateRange, budget.cycleStartDay);
  }, [timeframe, dateRange.start, dateRange.end, budget.cycleStartDay]);

  const comparisonRanges = useMemo(() => resolveComparableAnalyticsRanges(
    timeframe,
    dateRange,
    budget.cycleStartDay,
  ), [timeframe, dateRange.start, dateRange.end, budget.cycleStartDay]);

  async function loadPrevTotal() {
    const sequence = ++prevRangeSequence.current;
    if (!prevDateRange) {
      setComparisonTotals({ status: 'no_completed_days', current: 0, previous: 0 });
      setPrevDailyData([]);
      setPrevVendorTotals(new Map());
      setInflationInfo(computePersonalInflation([], []));
      return;
    }
    try {
      // ADR-002: aynı SQLite bağlantısındaki prepared okumaları seri tut.
      const daily = await ExpenseDao.getSpendingByDays(prevDateRange.start, prevDateRange.end);
      const vSpending = await ExpenseDao.getVendorSpending(
        prevDateRange.start,
        prevDateRange.end,
      ) as any[];
      let nextComparison: {
        status: 'ready' | 'no_completed_days';
        current: number;
        previous: number;
      } = {
        status: 'no_completed_days',
        current: 0,
        previous: 0,
      };
      if (comparisonRanges) {
        const current = await ExpenseDao.getTotalByDateRange(
          comparisonRanges.current.start,
          comparisonRanges.current.end,
        );
        const previous = await ExpenseDao.getTotalByDateRange(
          comparisonRanges.previous.start,
          comparisonRanges.previous.end,
        );
        nextComparison = { status: 'ready', current, previous };
      }
      // Kişisel enflasyon sepeti KARŞILAŞTIRILABİLİR pencerelerden kurulur:
      // yarım bir dönemi tam bir dönemle kıyaslamak sepet etkisini yapay
      // biçimde eksiye çeker. Fiyat etkisi baz miktarlara dayandığı için bu
      // sapmadan etkilenmezdi, ama üç sayının birbirini tutması gerekiyor.
      let nextInflation = computePersonalInflation([], []);
      if (comparisonRanges) {
        const currentBasket = await ExpenseDao.getInflationBasketRows(
          comparisonRanges.current.start,
          comparisonRanges.current.end,
        );
        const previousBasket = await ExpenseDao.getInflationBasketRows(
          comparisonRanges.previous.start,
          comparisonRanges.previous.end,
        );
        nextInflation = computePersonalInflation(currentBasket, previousBasket);
      }
      if (sequence !== prevRangeSequence.current) return;
      setComparisonTotals(nextComparison);
      setInflationInfo(nextInflation);
      setPrevDailyData(daily);
      const vMap = new Map<number, number>();
      vSpending.forEach((v: any) => vMap.set(v.vendor_id, v.total));
      setPrevVendorTotals(vMap);
    } catch {
      if (sequence !== prevRangeSequence.current) return;
      setComparisonTotals({ status: 'unavailable', current: 0, previous: 0 });
      setPrevDailyData([]);
      setPrevVendorTotals(new Map());
      setInflationInfo(computePersonalInflation([], []));
    }
  }

  async function loadTrackingStartDate() {
    try {
      setTrackingStartDate(await ExpenseDao.getFirstExpenseDate());
    } catch {
      setTrackingStartDate(null);
    }
  }

  async function loadPriceChanges() {
    try {
      const raw = await ExpenseDao.getPriceHistory(6);
      setPriceChanges(buildPriceChanges(raw));
    } catch { setPriceChanges([]); }
  }

  async function loadActiveSubscriptions() {
    try {
      // ADR-002: iki tabloyu aynı bağlantıda seri oku. Kullanıcı tarafından
      // onaylanan ödeme planları otomatik tespitlerden ayrı kanonik kaynaktır.
      const rows = await SubscriptionDao.getActive();
      const plans = await RecurringPaymentReminderDao.listActive();
      setActiveSubs(rows);
      setActivePaymentPlans(plans);
    } catch {
      setActiveSubs([]);
      setActivePaymentPlans([]);
    }
  }

  async function loadSavingsGoal() {
    try {
      const row = await GoalDao.get();
      setSavingsGoal(row);
    } catch { setSavingsGoal(null); }
  }

  async function loadSilentSpend() {
    const sequence = ++silentSpendSequence.current;
    try {
      const data = await ExpenseDao.getSilentSpendItems(dateRange.start, dateRange.end, {
        minOccurrences: 3,
        maxAvgPrice: 30,
        limit: 15,
      });
      if (sequence === silentSpendSequence.current) setSilentSpendData(data);
    } catch {
      if (sequence === silentSpendSequence.current) setSilentSpendData(null);
    }
  }

  async function loadCategoryLimits() {
    try {
      const monthKey = getStartOfMonth().substring(0, 7);
      const monthStart = getStartOfMonth();
      const monthEnd = getEndOfMonth();
      // Tek SQL ile limit + kategori meta + aralık harcaması (alt kategoriler dahil)
      const rows = await CategoryLimitDao.getForMonthWithSpending(monthKey, monthStart, monthEnd);
      if (rows.length === 0) {
        setCategoryLimits([]);
        return;
      }
      const enriched = rows.map(r => ({
        category_id: r.category_id,
        category_name: r.category_name,
        category_icon: r.category_icon || 'tag-outline',
        category_color: r.category_color || Colors.primary,
        limit: r.limit_amount,
        spent: r.spent,
      }));
      // Aşılanları en üste, sonra doluluk oranına göre azalan
      enriched.sort((a, b) => {
        const ra = a.limit > 0 ? a.spent / a.limit : 0;
        const rb = b.limit > 0 ? b.spent / b.limit : 0;
        return rb - ra;
      });
      setCategoryLimits(enriched);
    } catch { setCategoryLimits([]); }
  }

  // Harcama İstatistikleri — yalnız tamamlanmış takvim günleri değerlendirilir.
  // Seçili aralığın uygulama kullanılmadan önceki kısmı, DB'deki ilk gerçek
  // işlem tarihiyle kesilir. Bütçe metriği de değişken "kalan / kalan gün"
  // hedefi yerine yalnız aktif bütçe döngüsündeki sabit günlük planı kullanır.
  const streakData = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;

    const cycle = getCurrentCycle(budget.cycleStartDay, today);
    const isCanonicalCurrentCycle =
      timeframe === 'month' &&
      dateRange.start === budget.periodStart &&
      dateRange.end === budget.periodEnd;
    const stableDailyTarget =
      isCanonicalCurrentCycle && budget.effectiveBudget > 0
        ? budget.effectiveBudget / cycle.totalDays
        : null;

    return computeSpendingStats({
      dailyData,
      startDate: dateRange.start,
      endDate: dateRange.end,
      today: todayStr,
      trackingMode: true,
      trackingStartDate,
      dailyTarget: stableDailyTarget,
      targetRange: stableDailyTarget
        ? { start: budget.periodStart, end: budget.periodEnd }
        : null,
    });
  }, [
    dailyData,
    timeframe,
    dateRange.start,
    dateRange.end,
    budget.periodStart,
    budget.periodEnd,
    budget.cycleStartDay,
    budget.effectiveBudget,
    trackingStartDate,
  ]);

  const heatmapInfo = useMemo(() => {
    if (timeframe !== 'month') return null;
    return { start: dateRange.start, end: dateRange.end };
  }, [timeframe, dateRange.start, dateRange.end]);

  const comparisonDelta = useMemo(() => {
    if (comparisonTotals.status !== 'ready' || comparisonTotals.previous === 0) return null;
    const pct = ((comparisonTotals.current - comparisonTotals.previous) / comparisonTotals.previous) * 100;
    return Math.round(pct * 10) / 10;
  }, [comparisonTotals]);

  // ── Dönem sonu projeksiyonu ──────────────────────────────────────
  // Kart "bütçeyi aşacak mısın?" sorusunu yanıtladığı için harcama ve bütçe
  // aynı döngüden gelir. Aylık Analiz filtresi de bu kanonik pencereyi kullanır;
  // ayrı cycleDailyData ise filtre geçişinde projeksiyonu geçici veriden korur.
  // Karşılaştırma tabanı effectiveBudget (plan + borç nakit akışı) — Dashboard
  // "Kalan" değeriyle birebir aynı taban.
  const projectionInfo = useMemo(() => {
    if (timeframe !== 'month') {
      return { available: false as const, reason: 'only_month' as const };
    }
    const cycle = getCurrentCycle(budget.cycleStartDay);
    const { dayOfCycle, daysRemaining } = getCycleProgress(cycle);
    if (dayOfCycle < 2) {
      return { available: false as const, reason: 'too_early' as const };
    }
    const dailyByDate = new Map<string, number>();
    for (const d of cycleDailyData) dailyByDate.set(d.date, d.total);
    const dailyTotals: number[] = [];
    const cycleStart = new Date(cycle.start + 'T12:00:00');
    for (let i = 0; i < dayOfCycle; i++) {
      const d = new Date(cycleStart);
      d.setDate(cycleStart.getDate() + i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyTotals.push(dailyByDate.get(ymd) ?? 0);
    }
    // Harcanan = döngünün DAO toplamı (budget.totalSpent) — kartın "şu ana kadar"
    // değeri Dashboard'daki "Harcanan" ile aynı sayı olmalı.
    const currentSpent = budget.totalSpent;
    const daysLeft = daysRemaining;
    const effectiveBudget = budget.effectiveBudget;
    const calc = computeSpendingProjection({ dailyTotals, currentSpent, daysLeft, effectiveBudget });
    const isCycle = budget.cycleStartDay !== 1;
    return {
      available: true as const,
      projected: calc.projected,
      currentSpent,
      dailyPace: calc.dailyPace,
      naiveDailyPace: calc.naiveDailyPace,
      daysLeft,
      effectiveBudget,
      status: calc.status,
      deltaPct: calc.deltaPct,
      hasOutlier: calc.hasOutlier,
      periodLabel: isCycle ? `${formatDayMonth(cycle.start, t)} – ${formatDayMonth(cycle.end, t)}` : null,
      isCycle,
    };
  }, [timeframe, budget.cycleStartDay, budget.totalSpent, budget.effectiveBudget, cycleDailyData, t]);

  // ── Abonelik özeti ───────────────────────────────────────────────
  // Onaylı ödeme planları + tekrarlama motorunun otomatik tespitleri. Aynı
  // satıcı iki tarafta varsa kullanıcı kararı olan onaylı plan tek kez gösterilir.
  const subscriptionInfo = useMemo(
    () => buildSubscriptionAnalyticsInfo(activeSubs, activePaymentPlans),
    [activePaymentPlans, activeSubs],
  );

  // ── Limit sağlığı özeti ──────────────────────────────────────────
  const limitsHealthInfo = useMemo(() => {
    if (categoryLimits.length === 0) {
      return { count: 0, overCount: 0, warnCount: 0, safeCount: 0, items: [] };
    }
    let overCount = 0, warnCount = 0, safeCount = 0;
    for (const l of categoryLimits) {
      const ratio = l.limit > 0 ? l.spent / l.limit : 0;
      if (ratio >= 1) overCount++;
      else if (ratio >= 0.7) warnCount++;
      else safeCount++;
    }
    return { count: categoryLimits.length, overCount, warnCount, safeCount, items: categoryLimits };
  }, [categoryLimits]);

  // ── Birikim hedefi özeti ─────────────────────────────────────────
  const goalInfo = useMemo(() => {
    if (!savingsGoal || savingsGoal.target_amount <= 0) {
      return { available: false as const };
    }
    const target = savingsGoal.target_amount;
    const current = Math.max(0, savingsGoal.current_amount);
    const remaining = Math.max(0, target - current);
    const ratio = Math.min(1, current / target);
    const pctNum = Math.round(ratio * 100);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(savingsGoal.target_date);
    targetDate.setHours(0, 0, 0, 0);
    const daysToTarget = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
    const monthsToTarget = daysToTarget > 0 ? Math.max(1, daysToTarget / 30) : 0;
    const monthlyNeed = monthsToTarget > 0 ? remaining / monthsToTarget : 0;
    let status: 'complete' | 'overdue' | 'on_track' | 'tight';
    if (current >= target) status = 'complete';
    else if (daysToTarget < 0) status = 'overdue';
    else if (monthlyNeed > 0 && monthlyNeed > target * 0.25) status = 'tight';
    else status = 'on_track';
    return {
      available: true as const,
      title: savingsGoal.title,
      target,
      current,
      remaining,
      ratio,
      pctNum,
      daysToTarget,
      monthlyNeed,
      status,
    };
  }, [savingsGoal]);

  // ── Sessiz harcama özeti ─────────────────────────────────────────
  const silentSpendInfo = useMemo(() => {
    if (!silentSpendData || silentSpendData.items.length === 0) {
      return { available: false as const };
    }
    return {
      available: true as const,
      ...silentSpendData,
    };
  }, [silentSpendData]);

  async function loadCardConfig() {
    if (configLoaded.current) return;
    try {
      const db = await (await import('../../src/db/database')).getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'analytics_card_order'"
      );
      if (row) {
        const parsed = JSON.parse(row.value);
        // Kart düzenleme yalnız onaylandığında kalıcıdır. Eski/bozuk bir sürüm
        // boş aktif liste yazmış olsa bile bu değer geçerli tercih sayılmaz.
        if (Array.isArray(parsed.active)) {
          // Migration: Kayıtlı konfig eski sürümden geliyor olabilir; ALL_CARDS'a
          // sonradan eklenmiş kartlar ne aktif ne de gizli listede görünmüyor.
          // Bilinmeyenleri tara: DEFAULT_ACTIVE'daysa aktife sondan ekle, değilse
          // gizli "kullanılabilir" listesine ekle. Geçerli/güncel kartları DB'ye
          // yaz ki bir sonraki açılışta migration tekrar çalışmasın.
          const validIds = new Set(ALL_CARDS.map(c => c.id));
          const savedActive: string[] = parsed.active.filter((id: string) => validIds.has(id));
          const parsedHidden: unknown[] = Array.isArray(parsed.hidden) ? parsed.hidden : [];
          const savedHidden: string[] = parsedHidden.filter(
            (id): id is string => typeof id === 'string' && validIds.has(id),
          );
          const known = new Set([...savedActive, ...savedHidden]);
          const missing = ALL_CARDS.map(c => c.id).filter(id => !known.has(id));
          const newActive = [...savedActive];
          const newHidden = [...savedHidden];
          for (const id of missing) {
            if (DEFAULT_ACTIVE.includes(id)) newActive.push(id);
            else newHidden.push(id);
          }
          // Eski/yarım bir sürüm boş aktif liste kaydetmişse boş Analiz
          // sayfası yerine en temel kartla güvenli biçimde onar.
          if (newActive.length === 0) {
            const fallbackId = DEFAULT_ACTIVE[0];
            newActive.push(fallbackId);
            const fallbackHiddenIndex = newHidden.indexOf(fallbackId);
            if (fallbackHiddenIndex >= 0) newHidden.splice(fallbackHiddenIndex, 1);
          }
          committedCardConfigRef.current = {
            active: [...newActive],
            hidden: [...newHidden],
          };
          setCardOrder(newActive);
          setHiddenCards(newHidden);
          if (
            missing.length > 0 ||
            newActive.length !== parsed.active.length ||
            newHidden.length !== parsedHidden.length
          ) {
            await saveCardConfig(newActive, newHidden);
          }
        }
      }
      configLoaded.current = true;
    } catch { /* use defaults */ }
  }

  async function saveCardConfig(active: string[], hidden: string[]): Promise<boolean> {
    if (!hasActiveAnalyticsCard(active)) return false;
    try {
      const db = await (await import('../../src/db/database')).getDatabase();
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('analytics_card_order', ?)",
        [JSON.stringify({ active, hidden })]
      );
      return true;
    } catch (e) {
      console.error('Error saving card config:', e);
      return false;
    }
  }

  const runAnalyticsRefresh = useCallback(() => {
    // Aylık görünümün ilk takvim-ay fallback sorgusunu, useBudget gerçek döngüyü
    // çözmeden toplu focus yenilemesine dönüştürme. Hook'ların yeni aralık effect'i
    // period hazır olur olmaz doğru sorguyu başlatır.
    if (!analyticsPeriodReady) return Promise.resolve();

    const targetKey = activeAnalyticsKey;
    // İlk run, useBudget'ın az önce tamamladığı bootstrap sonucunu kullanır.
    // Sonraki focus/pull/global yenilemeler bütçeyi de tekrar okur.
    const shouldRefreshBudget = hasCompletedAnalyticsLoad.current;
    const execute = async () => {
      try {
        // Aynı process-wide SQLite bağlantısında büyük Promise.all dalgası
        // üretme. Focus, global invalidation ve pull-to-refresh çağrıları da bu
        // ekran kuyruğunda birbirini bekler.
        await loadCardConfig();
        if (shouldRefreshBudget) await refreshBudget();
        await refreshCats();
        await refreshVendors();
        await refreshDaily();
        await refreshCycleDaily();
        await refreshTop();
        await refreshSubcats();
        await refreshBehavior();
        await loadTrackingStartDate();
        await loadPrevTotal();
        await loadPriceChanges();
        await loadActiveSubscriptions();
        await loadCategoryLimits();
        await loadSavingsGoal();
        await loadSilentSpend();
        if (timeframe === 'year') await loadYearlyData();
      } finally {
        hasCompletedAnalyticsLoad.current = true;
        setLoadedAnalyticsKey(targetKey);
      }
    };

    const queued = refreshQueueRef.current.then(execute, execute);
    refreshQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, [
    dateRange.start,
    dateRange.end,
    timeframe,
    selectedCategory,
    analyticsPeriodReady,
    activeAnalyticsKey,
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (analyticsPeriodReady) await runAnalyticsRefresh();
      else if (!budgetLoading) await refreshBudget();
    } finally {
      setRefreshing(false);
    }
  };

  const refreshAnalyticsOrBootstrap = useCallback(
    () => {
      if (analyticsPeriodReady) return runAnalyticsRefresh();
      if (budgetLoading) return Promise.resolve();
      return refreshBudget();
    },
    [analyticsPeriodReady, budgetLoading, runAnalyticsRefresh, refreshBudget],
  );

  useFocusEffect(
    useCallback(() => {
      void runAnalyticsRefresh();
    }, [runAnalyticsRefresh])
  );

  // Ana sekmeden ayrılmak onay değildir. Boş veya kısmi düzenleme taslağını
  // atıp son başarıyla kaydedilmiş yapılandırmayı geri yükle; böylece sekme
  // kaydırması Analiz ekranını boş bırakamaz.
  useFocusEffect(
    useCallback(() => () => {
      const restored = resolveAnalyticsCardEditExit(
        { active: [], hidden: [] },
        committedCardConfigRef.current,
        'discard',
      );
      if (restored) {
        setCardOrder(restored.active);
        setHiddenCards(restored.hidden);
      }
      setIsEditing(false);
      setNestedHorizontalGestureActive(false);
    }, [setNestedHorizontalGestureActive])
  );

  useExpenseDataRefresh(refreshAnalyticsOrBootstrap, isFocused);

  async function loadYearlyData() {
    try {
      const raw: any[] = await ExpenseDao.getYearlyTotals() as any[];
      const mapped = raw.map(r => ({ label: r.year ? String(r.year) : t('unknown'), value: r.total }));
      setYearlyData(mapped);
    } catch (e) {
      console.error('Error loading yearly data:', e);
    }
  }

  // useCallback: VendorsCard React.memo'su için referans-kararlı (P11).
  const handleVendorPress = useCallback(async (vendorId: number) => {
    const sequence = ++vendorItemsSequence.current;
    setSelectedVendor(vendorId);
    setVendorAnalysisVisible(true);
    setVendorItems([]);
    setVendorItemsLoading(true);
    try {
      const items = await ExpenseDao.getVendorItems(
        vendorId,
        dateRange.start,
        dateRange.end
      );
      if (sequence === vendorItemsSequence.current) setVendorItems(items as any[]);
    } catch (e) {
      console.error('Error loading vendor items:', e);
    } finally {
      if (sequence === vendorItemsSequence.current) setVendorItemsLoading(false);
    }
  }, [dateRange.start, dateRange.end]);

  const closeVendorAnalysis = useCallback(() => {
    ++vendorItemsSequence.current;
    setVendorItemsLoading(false);
    setVendorAnalysisVisible(false);
    setSelectedVendor(null);
  }, []);

  const openItemAnalysis = useCallback((
    name: string,
    unit?: MeasurementUnit,
    canonicalProductId?: number | null,
  ) => {
    setReturnToVendorAfterItem(false);
    setSelectedItemUnit(unit);
    setSelectedItemCanonicalProductId(canonicalProductId ?? null);
    setSelectedItemName(name);
    setItemAnalysisVisible(true);
  }, []);

  const openVendorItemAnalysis = useCallback((
    name: string,
    unit?: MeasurementUnit,
    canonicalProductId?: number | null,
  ) => {
    setReturnToVendorAfterItem(true);
    setSelectedItemUnit(unit);
    setSelectedItemCanonicalProductId(canonicalProductId ?? null);
    setSelectedItemName(name);
    setItemAnalysisVisible(true);
  }, []);

  const dismissItemAnalysis = useCallback(() => {
    setSelectedItemName(null);
    setSelectedItemUnit(undefined);
    setSelectedItemCanonicalProductId(null);
    if (returnToVendorAfterItem && selectedVendor !== null) {
      setVendorAnalysisVisible(true);
    }
    setReturnToVendorAfterItem(false);
  }, [returnToVendorAfterItem, selectedVendor]);

  const selectedVendorData = useMemo(
    () => vendors.find(vendor => vendor.vendor_id === selectedVendor) ?? null,
    [selectedVendor, vendors],
  );

  const barData = useMemo(() => {
    if (timeframe === 'year') return yearlyData;
    return dailyData.map(d => {
      const date = new Date(d.date);
      const label = timeframe === 'week' 
        ? date.toLocaleDateString(intlLocaleForLanguage(language), { weekday: 'short' })
        : date.getDate().toString();
      return { id: d.date, label, value: d.total };
    });
  }, [timeframe, yearlyData, dailyData, language]);

  // Önceki dönem DAO'dan ham (yalnız harcamalı günler) gelir; grafiğin gün gün
  // karşılaştırma yapabilmesi için geçerli seriyle aynı uzunlukta ve dönem
  // başından hizalı olmalıdır.
  const alignedPrevDaily = useMemo(
    () => alignPreviousDailySeries(dailyData.length, prevDateRange, prevDailyData),
    [dailyData.length, prevDateRange, prevDailyData],
  );

  const prevBarData = useMemo(() => {
    if (timeframe === 'year' || alignedPrevDaily.length === 0) return undefined;
    return alignedPrevDaily.map(d => {
      const date = new Date(d.date);
      const label = timeframe === 'week'
        ? date.toLocaleDateString(intlLocaleForLanguage(language), { weekday: 'short' })
        : date.getDate().toString();
      return { id: d.date, label, value: d.total };
    });
  }, [timeframe, alignedPrevDaily, language]);

  // P11: DonutChart React.memo’lu; her render’da inline `needsWants.map(...)`
  // dizisi yeniden üretilmesi memo karşılaştırmasını (referans eşitliği) kırıyor
  // ve donut’ı baştan çiziyordu. Segment array’lerini memoize ederek yalnız veri
  // değiştiğinde yeniden oluşturuyoruz.
  const nwSegments = useMemo(
    () => needsWants.map(nw => ({ value: nw.total, label: nw.segment, color: nw.color })),
    [needsWants],
  );
  const wwSegments = useMemo(
    () => weekWeekend.map(ww => ({ value: ww.total, label: ww.segment, color: ww.color })),
    [weekWeekend],
  );

  // Donut onSelect callback’leri memoize — segmentlerle birlikte donut’ın
  // gereksiz re-render’ını önler.
  const handleNWSelect = useCallback(
    (idx: number) => setSelectedNWIdx(prev => (idx === prev ? null : idx)),
    [],
  );
  const handleWWSelect = useCallback(
    (idx: number) => setSelectedWWIdx(prev => (idx === prev ? null : idx)),
    [],
  );

  // Küçük donut dilimlerine dokunarak seçim yapmak zor olduğu için ok
  // kontrolleri aynı seçimi dilim boyutundan bağımsız sırayla dolaştırır.
  const handleNWMove = useCallback((direction: -1 | 1) => {
    setSelectedNWIdx(previous => {
      const length = needsWants.length;
      if (length === 0) return null;
      if (previous === null) return direction > 0 ? 0 : length - 1;
      return (previous + direction + length) % length;
    });
  }, [needsWants.length]);
  const handleWWMove = useCallback((direction: -1 | 1) => {
    setSelectedWWIdx(previous => {
      const length = weekWeekend.length;
      if (length === 0) return null;
      if (previous === null) return direction > 0 ? 0 : length - 1;
      return (previous + direction + length) % length;
    });
  }, [weekWeekend.length]);

  const renderCard = (id: string, index: number) => {
    let content = null;
    if (id === 'chart') {
      content = (
        <ChartCard {...cardBase} timeframe={timeframe} barData={barData} prevBarData={prevBarData} />
      );
    } else if (id === 'categories') {
      content = (
        <CategoriesCard
          {...cardBase}
          categories={categories}
          subcats={subcats}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
      );
    } else if (id === 'donut') {
      content = (
        <DonutCard
          {...cardBase}
          needsWants={needsWants}
          weekWeekend={weekWeekend}
          nwSegments={nwSegments}
          wwSegments={wwSegments}
          selectedNWIdx={selectedNWIdx}
          selectedWWIdx={selectedWWIdx}
          handleNWSelect={handleNWSelect}
          handleWWSelect={handleWWSelect}
          handleNWMove={handleNWMove}
          handleWWMove={handleWWMove}
        />
      );
    } else if (id === 'top_tx') {
      content = (
        <TopTxCard
          {...cardBase}
          topTx={topTx}
          selection={topTransactionsQueryOptions.selection}
        />
      );
    } else if (id === 'vendors') {
      content = (
        <VendorsCard
          {...cardBase}
          vendors={vendors}
          prevVendorTotals={prevVendorTotals}
          handleVendorPress={handleVendorPress}
        />
      );
    }

    // ──── A1: Monthly Comparison ────
    if (id === 'monthly_compare') {
      content = (
        <MonthlyCompareCard
          {...cardBase}
          timeframe={timeframe}
          status={comparisonTotals.status}
          currentTotal={comparisonTotals.current}
          prevTotal={comparisonTotals.previous}
          comparisonDelta={comparisonDelta}
          currentRange={comparisonRanges?.current ?? null}
          previousRange={comparisonRanges?.previous ?? null}
        />
      );
    }

    // ──── A3: Spending Heatmap ────
    if (id === 'heatmap') {
      content = (
        <HeatmapCard {...cardBase} heatmapInfo={heatmapInfo} dailyData={dailyData} />
      );
    }

    // ──── A6: Price Watch ────
    // Kompakt 2 sütunlu grid: Her ürün mini bir kart. Ürün sayısı arttıkça
    // dikey uzama yarı yarıya azalır (örn. 6 ürün → 3 satır yerine 3 sütunsal
    // çift); başlıkta toplam ürün sayısı küçük bir rozet gösterir.
    if (id === 'price_watch') {
      content = (
        <PriceWatchCard
          {...cardBase}
          priceChanges={priceChanges}
          onSelectItem={openItemAnalysis}
        />
      );
    }

    // ──── Kişisel enflasyon: harcama değişiminin fiyat/sepet ayrışması ────
    if (id === 'personal_inflation') {
      content = <PersonalInflationCard {...cardBase} inflationInfo={inflationInfo} />;
    }

    // ──── A7: Spending Streak ────
    if (id === 'streak') {
      content = (
        <StreakCard
          {...cardBase}
          streakData={streakData}
          setStreakDetailVariant={setStreakDetailVariant}
        />
      );
    }

    // ──── A8: Month-end Projection ────
    // Cam (primary) kart. Büyük projeksiyon rakamı + bütçeye göre yatay
    // konum izleyici (current → projection işaretleri ile). Bütçesi olmasa
    // bile günlük tempo + kalan gün gösterilir.
    if (id === 'projection') {
      content = (
        <ProjectionCard {...cardBase} timeframe={timeframe} projectionInfo={projectionInfo} />
      );
    }

    // ──── A9: Active Subscriptions ────
    // Aylık yük rakamı + ilk 3 yaklaşan abonelik. Ek bir sayfa açmak yerine
    // kart içinde yoğun bilgi sunuyor — küçük vendor avatarı, gün rozeti, tutar.
    if (id === 'subscriptions') {
      content = (
        <SubscriptionsCard {...cardBase} subscriptionInfo={subscriptionInfo} />
      );
    }

    // ──── A10: Category Limits Health ────
    // Limit konulan her kategori için ince bar + ratio rozeti. Aşılmış olanlar
    // doğal olarak en üste sıralandı (loadCategoryLimits).
    if (id === 'limits_health') {
      content = (
        <LimitsHealthCard
          {...cardBase}
          limitsHealthInfo={limitsHealthInfo}
        />
      );
    }

    // ──── A11: Savings Goal Progress ────
    // Cam (primary) kart. Sol tarafta DonutChart ile progress halkası, sağ
    // tarafta hedef tutarı + monthly need + tarih bilgisi. Hedef yoksa kart
    // analiz akışında hiç yer kaplamaz.
    if (id === 'goal') {
      content = (
        <GoalCard {...cardBase} goalInfo={goalInfo} />
      );
    }

    // ──── A13: Silent Spend ────
    // Küçük tutarlı ama tekrarlayan kalemler — tek tek bakınca masum, toplamı
    // şaşırtıcı. Hero rakamı + en fazla üç adet beşli yatay sayfa.
    if (id === 'silent_spend') {
      content = (
        <SilentSpendCard {...cardBase} silentSpendInfo={silentSpendInfo} onSelectItem={openItemAnalysis} />
      );
    }

    return content;
  };

  return (
    <>
    <ErrorBoundary>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          refreshControl={
            isEditing ? undefined : (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            )
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{isEditing ? t('card_management_hint') : t('analytics_title')}</Text>
              {!isEditing && (
                <Text style={styles.dateRange}>
                  {analyticsPeriodReady ? dateRange.label : ' '}
                </Text>
              )}
            </View>
            <Pressable
              onPress={handleCardEditingToggle}
              style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={isEditing ? t('save') : t('card_management_hint')}
            >
              <MaterialCommunityIcons
                name={isEditing ? "check" : "view-dashboard-edit-outline"}
                size={20}
                color={isEditing ? Colors.onPrimary : Colors.textPrimary}
              />
            </Pressable>
          </View>

          {/* Timeframe Tabs — hidden in edit mode */}
          {!isEditing && (
            <>
              <Animated.View entering={FadeInDown.duration(300)} style={styles.tabContainer}>
                {[
                  { id: 'week', label: t('tab_weekly') },
                  { id: 'month', label: t('tab_monthly') },
                  { id: 'year', label: t('tab_yearly') },
                  { id: 'custom', label: t('tab_custom'), icon: 'calendar-range' as const },
                ].map(tab => {
                  const isActive = timeframe === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => setTimeframe(tab.id as Timeframe)}
                      style={[styles.tab, isActive && styles.tabActive]}
                    >
                      {tab.icon ? (
                        <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? Colors.primary : Colors.textSecondary} />
                      ) : (
                        <Text
                          style={[styles.tabText, isActive && styles.tabTextActive]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.72}
                          allowFontScaling
                        >
                          {tab.label}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </Animated.View>

              {timeframe === 'custom' && (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.customDateRow}>
                  <Pressable style={styles.customDateBtn} onPress={() => setShowStartPicker(true)}>
                    <MaterialCommunityIcons name="calendar" size={16} color={Colors.primary} />
                    <Text style={styles.customDateText}>{customStart.split('-').reverse().join('.')}</Text>
                  </Pressable>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={Colors.textMuted} />
                  <Pressable style={styles.customDateBtn} onPress={() => setShowEndPicker(true)}>
                    <MaterialCommunityIcons name="calendar" size={16} color={Colors.primary} />
                    <Text style={styles.customDateText}>{customEnd.split('-').reverse().join('.')}</Text>
                  </Pressable>
                </Animated.View>
              )}
            </>
          )}

          {isEditing ? (
            <>
              {/* Editing mode header */}
              <Animated.View entering={FadeInDown.duration(300)} style={styles.editSectionHeader}>
                <View style={styles.editSectionDot} />
                <Text style={styles.editSectionTitle}>{t('active_cards')}</Text>
                <Text style={styles.editSectionCount}>{cardOrder.length}</Text>
                {cardOrder.length > 0 && (
                  <Pressable
                    onPress={removeAllCards}
                    style={({ pressed }) => [
                      styles.editRemoveAllButton,
                      pressed && { opacity: 0.72 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('remove_all_cards')}
                  >
                    <MaterialCommunityIcons
                      name="minus-circle-multiple-outline"
                      size={15}
                      color={Colors.danger}
                    />
                    <Text style={styles.editRemoveAllText} numberOfLines={1}>
                      {t('remove_all_cards')}
                    </Text>
                  </Pressable>
                )}
              </Animated.View>

              {/* Active cards - draggable */}
              {cardOrder.map((id, index) => {
                const meta = ALL_CARDS.find(c => c.id === id);
                return (
                  <DraggablePanel
                    key={id}
                    id={id}
                    isEditing={true}
                    shiftOffset={getShiftOffset(id, index)}
                    isDragActive={activeDrag?.id === id}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onLayout={handleLayout}
                    scrollRef={scrollRef}
                    scrollOffsetRef={scrollOffsetRef}
                    reorderAccessibilityLabel={t('a11y_reorder_card')}
                  >
                    <Animated.View entering={FadeIn.duration(200)} style={styles.editCardChip}>
                      <Pressable onPress={() => removeCard(id)} style={styles.editRemoveBtn} hitSlop={8}>
                        <MaterialCommunityIcons name="minus-circle" size={22} color={Colors.danger} />
                      </Pressable>
                      <MaterialCommunityIcons name={(meta?.icon || 'card-outline') as any} size={20} color={Colors.primary} />
                      <Text style={styles.editCardLabel} numberOfLines={1}>{t(meta?.labelKey || id)}</Text>
                    </Animated.View>
                  </DraggablePanel>
                );
              })}

              {/* Available cards section */}
              {hiddenCards.length > 0 && (
                <>
                  <Animated.View entering={FadeInDown.delay(100).duration(300)} style={[styles.editSectionHeader, { marginTop: Spacing.xl }]}>
                    <View style={[styles.editSectionDot, { backgroundColor: Colors.textMuted }]} />
                    <Text style={styles.editSectionTitle}>{t('available_cards')}</Text>
                    <Text style={styles.editSectionCount}>{hiddenCards.length}</Text>
                  </Animated.View>

                  <View style={styles.availableGrid}>
                    {hiddenCards.map((id, i) => {
                      const meta = ALL_CARDS.find(c => c.id === id);
                      return (
                        <Animated.View key={id} entering={FadeInDown.delay(i * 50).duration(300)}>
                          <Pressable style={styles.availableChip} onPress={() => addCard(id)}>
                            <MaterialCommunityIcons name="plus-circle-outline" size={18} color={Colors.primary} />
                            <MaterialCommunityIcons name={(meta?.icon || 'card-outline') as any} size={16} color={Colors.textSecondary} />
                            <Text style={styles.availableChipLabel} numberOfLines={1}>{t(meta?.labelKey || id)}</Text>
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.editHint}>{t('card_management_hint')}</Text>
            </>
          ) : !analyticsPeriodReady || loadedAnalyticsKey !== activeAnalyticsKey ? (
            <View style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center' }}>
              {budgetLoading || analyticsPeriodReady ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Pressable
                  onPress={() => { void refreshBudget(); }}
                  style={{ alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg }}
                  accessibilityRole="button"
                  accessibilityLabel={t('analytics_retry')}
                >
                  <MaterialCommunityIcons name="refresh" size={24} color={Colors.primary} />
                  <Text style={{ color: Colors.primary }}>{t('analytics_retry')}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              {cardOrder.map((id, index) => (
                <View key={id}>
                  {renderCard(id, index)}
                </View>
              ))}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
    <ItemAnalyticsModal
      visible={itemAnalysisVisible}
      itemName={selectedItemName || ''}
      measurementUnit={selectedItemUnit}
      canonicalProductId={selectedItemCanonicalProductId}
      onClose={() => setItemAnalysisVisible(false)}
      onDismiss={dismissItemAnalysis}
    />
    <VendorAnalyticsSheet
      {...cardBase}
      visible={vendorAnalysisVisible}
      vendor={selectedVendorData}
      items={vendorItems}
      loading={vendorItemsLoading}
      onClose={closeVendorAnalysis}
      onSuspendForItem={() => setVendorAnalysisVisible(false)}
      onSelectItem={openVendorItemAnalysis}
    />
    <StreakDetailsSheet
      visible={streakDetailVariant !== null}
      onClose={() => setStreakDetailVariant(null)}
      variant={streakDetailVariant ?? 'zero'}
      dates={
        streakDetailVariant === 'streak'
          ? streakData.currentStreakDates
          : streakData.zeroSpendDates
      }
      entries={streakData.underBudgetEntries}
      dailyBudget={streakData.dailyTarget ?? 0}
      totalDays={streakData.totalDays}
      streakMode={streakData.streakMode}
      language={language}
      currency={currency}
      t={t}
    />
    <CustomDatePicker
      visible={showStartPicker}
      onClose={() => setShowStartPicker(false)}
      initialDate={customStart}
      maximumDate={getToday()}
      onSelectDate={(d) => { setCustomStart(d); if (d > customEnd) setCustomEnd(d); }}
    />
    <CustomDatePicker
      visible={showEndPicker}
      onClose={() => setShowEndPicker(false)}
      initialDate={customEnd}
      maximumDate={getToday()}
      onSelectDate={(d) => { setCustomEnd(d); if (d < customStart) setCustomStart(d); }}
    />
    </>
  );
}
