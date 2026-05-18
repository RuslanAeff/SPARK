// S.P.A.R.K. — Advanced Analytics Screen
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, PanResponder, Animated as RNAnimated, Dimensions, RefreshControl, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useAppTheme } from '../../src/theme/themeStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useFocusEffect, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp, FadeIn, SlideInRight, LinearTransition } from 'react-native-reanimated';

import { Colors, ChartColorArray } from '../../src/theme/colors';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../../src/theme/spacing';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { useCategorySpending, useVendorSpending, useDailySpending, useTopTransactions, useSubcategorySpending, useBehavioralAnalytics } from '../../src/hooks/useExpenses';
import { ExpenseDao } from '../../src/db/expenseDao';
import { SubscriptionDao } from '../../src/db/subscriptionDao';
import { CategoryLimitDao } from '../../src/db/categoryLimitDao';
import { GoalDao, type SavingsGoalRow } from '../../src/db/goalDao';
import type { SubscriptionWithDetails } from '../../src/db/schema';
import { getStartOfMonth, getEndOfMonth, formatMonthYear, getDaysInMonth, getDayOfMonth } from '../../src/utils/dateUtils';

import DonutChart from '../../src/components/DonutChart';
import AnimatedCard from '../../src/components/AnimatedCard';
import BarChart from '../../src/components/BarChart';
import VendorAvatar from '../../src/components/VendorAvatar';
import SpendingHeatmap from '../../src/components/SpendingHeatmap';
import CustomDatePicker from '../../src/components/CustomDatePicker';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { intlLocaleForLanguage } from '../../src/i18n/languageOptions';
import ItemAnalyticsModal from '../../src/components/ItemAnalyticsModal';
import StreakDetailsSheet from '../../src/components/StreakDetailsSheet';
import { useBudget } from '../../src/hooks/useBudget';
import { useRefresh, useExpenseDataRefresh } from '../../src/context/RefreshContext';
import { useCurrency } from '../../src/context/CurrencyContext';

interface PriceChange {
  name: string;
  turkishName: string | null;
  firstPrice: number;
  lastPrice: number;
  changePct: number;
  purchaseCount: number;
}

type Timeframe = 'week' | 'month' | 'year' | 'custom';

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
  { id: 'budget',          icon: 'wallet-outline',     labelKey: 'card_budget' },
  { id: 'goal',            icon: 'flag-checkered',     labelKey: 'card_goal' },
  { id: 'limits_health',   icon: 'gauge',              labelKey: 'card_limits_health' },
  { id: 'subscriptions',   icon: 'sync-circle',        labelKey: 'card_subscriptions' },
  { id: 'silent_spend',    icon: 'water-outline',      labelKey: 'card_silent_spend' },
  { id: 'categories',      icon: 'shape-outline',      labelKey: 'card_categories' },
  { id: 'time_of_day',     icon: 'clock-time-eight-outline', labelKey: 'card_time_of_day' },
  { id: 'streak',          icon: 'fire',               labelKey: 'card_streak' },
  { id: 'donut',           icon: 'chart-donut',        labelKey: 'card_donut' },
  { id: 'heatmap',         icon: 'calendar-month',     labelKey: 'card_heatmap' },
  { id: 'top_tx',          icon: 'podium-gold',        labelKey: 'card_top_tx' },
  { id: 'price_watch',     icon: 'tag-arrow-up',       labelKey: 'card_price_watch' },
  { id: 'vendors',         icon: 'store-outline',      labelKey: 'card_vendors' },
];

const DEFAULT_ACTIVE = ['chart', 'projection', 'monthly_compare', 'budget', 'goal', 'limits_health', 'subscriptions', 'silent_spend', 'time_of_day', 'categories', 'vendors'];

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

function CountUpText({ value, style, prefix = '', suffix = '', duration = 800 }: {
  value: number; style?: any; prefix?: string; suffix?: string; duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    animRef.setValue(0);
    const listener = animRef.addListener(({ value: v }) => setDisplay(Math.round(v)));
    RNAnimated.timing(animRef, { toValue: value, duration, useNativeDriver: false }).start();
    return () => animRef.removeListener(listener);
  }, [value]);
  return <Text style={style}>{prefix}{display}{suffix}</Text>;
}

export default function AnalyticsScreen() {
  // BÜTÇE DURUMU vb. kartlar sekme odakta değilken de tema güncellensin.
  // Merkezi store Android'deki Appearance.setColorScheme() event kayıplarını da yakalar.
  const scheme = useAppTheme();
  // P10: Büyük StyleSheet her render’da yeniden üretilmesin; yalnız tema
  // geçişlerinde yeniden oluştur.
  const styles = useMemo(() => getStyles(), [scheme]);
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const { t, tc, language } = useLanguage();
  const { currency } = useCurrency();
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const dateRange = useMemo(() => {
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];
    let label = '';

    if (timeframe === 'week') {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 6);
      start = lastWeek.toISOString().split('T')[0];
      label = t('last_7_days');
    } else if (timeframe === 'month') {
      start = getStartOfMonth();
      end = getEndOfMonth();
      label = formatMonthYear(start, t);
    } else if (timeframe === 'year') {
      start = '2000-01-01';
      end = '2099-12-31';
      label = t('all_time');
    } else if (timeframe === 'custom') {
      start = customStart;
      end = customEnd;
      const s = customStart.split('-').reverse().slice(0, 2).join('.');
      const e = customEnd.split('-').reverse().slice(0, 2).join('.');
      label = `${s} — ${e}`;
    }
    return { start, end, label };
  }, [timeframe, t, customStart, customEnd]);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_ACTIVE);
  const [hiddenCards, setHiddenCards] = useState<string[]>(() =>
    ALL_CARDS.map(c => c.id).filter(id => !DEFAULT_ACTIVE.includes(id))
  );
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
        saveCardConfig(arr, hiddenCards);
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
        const nh = [...h, id];
        saveCardConfig(next, nh);
        return nh;
      });
      return next;
    });
  }

  function addCard(id: string) {
    setHiddenCards(prev => {
      const nh = prev.filter(c => c !== id);
      setCardOrder(co => {
        const next = [...co, id];
        saveCardConfig(next, nh);
        return next;
      });
      return nh;
    });
  }

  const { data: categories, refresh: refreshCats } = useCategorySpending(dateRange.start, dateRange.end);
  const { data: vendors, refresh: refreshVendors } = useVendorSpending(dateRange.start, dateRange.end);
  const { data: dailyData, refresh: refreshDaily } = useDailySpending(dateRange.start, dateRange.end);
  const { data: topTx, refresh: refreshTop } = useTopTransactions(dateRange.start, dateRange.end, 8);
  const { data: subcats, refresh: refreshSubcats } = useSubcategorySpending(selectedCategory, dateRange.start, dateRange.end);
  const { needsWants, weekWeekend, refresh: refreshBehavior } = useBehavioralAnalytics(dateRange.start, dateRange.end);
  
  const { budget, refresh: refreshBudget } = useBudget();
  const [prevTotal, setPrevTotal] = useState(0);
  const [prevDailyData, setPrevDailyData] = useState<{ date: string; total: number }[]>([]);
  const [prevVendorTotals, setPrevVendorTotals] = useState<Map<number, number>>(new Map());
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);

  const [yearlyData, setYearlyData] = useState<{ label: string; value: number }[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null);
  const [vendorItems, setVendorItems] = useState<any[]>([]);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [streakDetailVariant, setStreakDetailVariant] = useState<'zero' | 'streak' | 'under' | null>(null);
  const [selectedDonutIdx, setSelectedDonutIdx] = useState<number | null>(null);
  const [selectedNWIdx, setSelectedNWIdx] = useState<number | null>(null);
  const [selectedWWIdx, setSelectedWWIdx] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubs, setActiveSubs] = useState<SubscriptionWithDetails[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<{
    category_id: number;
    category_name: string;
    category_icon: string;
    category_color: string;
    limit: number;
    spent: number;
  }[]>([]);
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoalRow | null>(null);
  const [timeOfDayData, setTimeOfDayData] = useState<{
    matrix: number[][];
    total: number;
    peakValue: number;
    peakDow: number;
    peakSlot: number;
  } | null>(null);
  const [silentSpendData, setSilentSpendData] = useState<{
    items: {
      name: string;
      turkish_name: string | null;
      purchase_count: number;
      total_spent: number;
      avg_price: number;
      category_name: string | null;
      category_icon: string | null;
      category_color: string | null;
      normalized_key: string;
    }[];
    totalAmount: number;
    totalCount: number;
    distinctItems: number;
  } | null>(null);
  const { refreshKey } = useRefresh();

  const currentTotal = useMemo(() => dailyData.reduce((s, d) => s + d.total, 0), [dailyData]);

  const prevDateRange = useMemo(() => {
    const today = new Date();
    if (timeframe === 'week') {
      const prevEnd = new Date(today); prevEnd.setDate(today.getDate() - 7);
      const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - 6);
      return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
    } else if (timeframe === 'month') {
      const y = today.getFullYear(), m = today.getMonth();
      const prevStart = new Date(y, m - 1, 1);
      const prevEnd = new Date(y, m, 0);
      return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
    } else if (timeframe === 'custom') {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      const span = e.getTime() - s.getTime();
      const prevEnd = new Date(s.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - span);
      return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
    }
    return null;
  }, [timeframe, customStart, customEnd]);

  async function loadPrevTotal() {
    if (!prevDateRange) { setPrevTotal(0); setPrevDailyData([]); setPrevVendorTotals(new Map()); return; }
    try {
      const [total, daily, vSpending] = await Promise.all([
        ExpenseDao.getTotalByDateRange(prevDateRange.start, prevDateRange.end),
        ExpenseDao.getSpendingByDays(prevDateRange.start, prevDateRange.end),
        ExpenseDao.getVendorSpending(prevDateRange.start, prevDateRange.end) as Promise<any[]>,
      ]);
      setPrevTotal(total);
      setPrevDailyData(daily);
      const vMap = new Map<number, number>();
      vSpending.forEach((v: any) => vMap.set(v.vendor_id, v.total));
      setPrevVendorTotals(vMap);
    } catch { setPrevTotal(0); setPrevDailyData([]); setPrevVendorTotals(new Map()); }
  }

  async function loadPriceChanges() {
    try {
      const raw = await ExpenseDao.getPriceHistory(6);
      const grouped = new Map<string, typeof raw>();
      raw.forEach(r => {
        const key = r.name.trim();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(r);
      });

      const changes: PriceChange[] = [];
      grouped.forEach((entries) => {
        if (entries.length < 2) return;
        const first = entries[0];
        const last = entries[entries.length - 1];
        if (first.unit_price === last.unit_price || first.unit_price === 0) return;
        const pct = ((last.unit_price - first.unit_price) / first.unit_price) * 100;
        changes.push({
          name: first.name,
          turkishName: first.turkish_name,
          firstPrice: first.unit_price,
          lastPrice: last.unit_price,
          changePct: Math.round(pct * 10) / 10,
          purchaseCount: entries.length,
        });
      });
      changes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
      setPriceChanges(changes.slice(0, 6));
    } catch { setPriceChanges([]); }
  }

  async function loadActiveSubscriptions() {
    try {
      const rows = await SubscriptionDao.getActive();
      setActiveSubs(rows);
    } catch { setActiveSubs([]); }
  }

  async function loadSavingsGoal() {
    try {
      const row = await GoalDao.get();
      setSavingsGoal(row);
    } catch { setSavingsGoal(null); }
  }

  async function loadTimeOfDay() {
    try {
      const data = await ExpenseDao.getTimeOfDayMatrix(dateRange.start, dateRange.end);
      setTimeOfDayData(data);
    } catch { setTimeOfDayData(null); }
  }

  async function loadSilentSpend() {
    try {
      const data = await ExpenseDao.getSilentSpendItems(dateRange.start, dateRange.end, {
        minOccurrences: 3,
        maxAvgPrice: 30,
        limit: 5,
      });
      setSilentSpendData(data);
    } catch { setSilentSpendData(null); }
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

  // Harcama İstatistikleri (streak) — dailyData yalnızca harcaması olan
  // günleri içerdiğinden (SQL GROUP BY date), "sıfır harcama" günlerini
  // direkt dailyData üzerinde sayamayız. Takvimsel aralığı yoğun bir diziye
  // genişletip eksik günlere 0 dolduruyoruz. Çok uzun aralıklarda (ör. "Tüm
  // zamanlar") istatistikleri anlamlı tutmak için son 365 güne kırpıyoruz.
  const streakData = useMemo(() => {
    // Yerel gün (timezone güvenli YYYY-MM-DD)
    const toLocalYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    const addDays = (d: Date, n: number) => {
      const r = new Date(d);
      r.setDate(d.getDate() + n);
      return r;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toLocalYmd(today);

    const parseYmd = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };

    const rawStart = parseYmd(dateRange.start);
    const rawEnd = parseYmd(dateRange.end);
    // Bitiş ≤ bugün (geleceği saymayız)
    const rangeEnd = rawEnd > today ? today : rawEnd;
    if (rangeEnd < rawStart) {
      return {
        zeroSpendDays: 0,
        currentStreak: 0,
        underBudgetDays: 0,
        totalDays: 0,
        zeroSpendDates: [] as string[],
        currentStreakDates: [] as string[],
        underBudgetEntries: [] as { date: string; total: number }[],
      };
    }

    // Maks 365 güne kırp — "Tüm zamanlar" senaryosu için makul değerler.
    const MAX_WINDOW_DAYS = 365;
    const spanDays = Math.floor((rangeEnd.getTime() - rawStart.getTime()) / 86400000) + 1;
    const rangeStart =
      spanDays > MAX_WINDOW_DAYS ? addDays(rangeEnd, -(MAX_WINDOW_DAYS - 1)) : rawStart;

    // sparse → lookup
    const totalsMap = new Map<string, number>();
    for (const d of dailyData) totalsMap.set(d.date, d.total);

    const days: { date: string; total: number }[] = [];
    for (let cur = new Date(rangeStart); cur <= rangeEnd; cur = addDays(cur, 1)) {
      const key = toLocalYmd(cur);
      days.push({ date: key, total: totalsMap.get(key) ?? 0 });
    }

    const zeroSpendDates: string[] = [];
    for (const d of days) if (d.total === 0) zeroSpendDates.push(d.date);
    const zeroSpendDays = zeroSpendDates.length;

    // Güncel seri: bugünden geriye, art arda kaç sıfır harcama günü?
    const currentStreakDates: string[] = [];
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].date > todayStr) continue;
      if (days[i].total === 0) currentStreakDates.push(days[i].date);
      else break;
    }
    // En eski → en yeni sırayla göstermek için tersine çevir
    currentStreakDates.reverse();
    const currentStreak = currentStreakDates.length;

    const dailyBudgetTarget = budget.dailyBudget > 0 ? budget.dailyBudget : 0;
    const underBudgetEntries: { date: string; total: number }[] = [];
    if (dailyBudgetTarget > 0) {
      for (const d of days) {
        if (d.total > 0 && d.total <= dailyBudgetTarget) {
          underBudgetEntries.push({ date: d.date, total: d.total });
        }
      }
    }
    const underBudgetDays = underBudgetEntries.length;

    const totalDays = days.length;

    return {
      zeroSpendDays,
      currentStreak,
      underBudgetDays,
      totalDays,
      zeroSpendDates,
      currentStreakDates,
      underBudgetEntries,
    };
  }, [dailyData, budget.dailyBudget, dateRange.start, dateRange.end]);

  const heatmapInfo = useMemo(() => {
    if (timeframe !== 'month') return null;
    const d = new Date(dateRange.start + 'T12:00:00Z');
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [timeframe, dateRange.start]);

  const comparisonDelta = useMemo(() => {
    if (prevTotal === 0) return null;
    const pct = ((currentTotal - prevTotal) / prevTotal) * 100;
    return Math.round(pct * 10) / 10;
  }, [currentTotal, prevTotal]);

  // ── Ay sonu projeksiyonu ─────────────────────────────────────────
  // currentTotal aktif dönemde harcanmışı verir; `month` modunda bu = ay başından
  // bugüne kadar harcanan. Günlük ortalama × ayın toplam günü = projeksiyon.
  // Yeterli geçmiş yoksa (ayın 1. günü vs.) 'too_early' duruma düşeriz.
  const projectionInfo = useMemo(() => {
    if (timeframe !== 'month') {
      return { available: false as const, reason: 'only_month' as const };
    }
    const dayOfMonth = getDayOfMonth();
    const totalDaysInMonth = getDaysInMonth();
    if (dayOfMonth < 2) {
      return { available: false as const, reason: 'too_early' as const };
    }
    // Outlier'a dirençli günlük tempo hesabı:
    // Naive `currentTotal / dayOfMonth` tek seferlik büyük harcamalardan
    // (kira, fatura, elektronik) çok etkilenir → projeksiyon abartılı çıkar.
    // Çözüm: bu ay'a kadar olan günlük dizide üst %20'lik dilimi (en yüksek
    // değerleri) kırp, kalan günlerin ortalamasını "kalan gün için tempo"
    // olarak kullan. `currentSpent` (gerçek harcanan) değişmez; sadece **gelecek**
    // tahmini gürültüden arındırılır. Projected = currentSpent + daysLeft × trimmedPace.
    const dailyByDate = new Map<string, number>();
    for (const d of dailyData) dailyByDate.set(d.date, d.total);
    const dailyTotals: number[] = [];
    const monthStart = new Date(dateRange.start);
    for (let i = 0; i < dayOfMonth; i++) {
      const d = new Date(monthStart);
      d.setDate(monthStart.getDate() + i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyTotals.push(dailyByDate.get(ymd) ?? 0);
    }
    const sorted = [...dailyTotals].sort((a, b) => a - b);
    const trimCount = Math.floor(sorted.length * 0.2);
    const trimmed = trimCount > 0 ? sorted.slice(0, sorted.length - trimCount) : sorted;
    const trimmedSum = trimmed.reduce((s, v) => s + v, 0);
    const trimmedPace = trimmed.length > 0 ? trimmedSum / trimmed.length : 0;
    const naivePace = currentTotal / dayOfMonth;
    const daysLeft = Math.max(0, totalDaysInMonth - dayOfMonth);
    // Projection: gerçek harcanan + outlier'sız tempo × kalan gün.
    const projected = currentTotal + daysLeft * trimmedPace;
    // Görsellerde kullanıcıya "günlük ortalama" satırında trimmed pace gösterilir
    // (hedef: gerçekçi olmak). Naive değer şimdilik gizli — ileride bir tooltip için.
    const monthlyBudget = budget.monthlyBudget;
    let status: 'safe' | 'warn' | 'over' | 'no_budget' = 'no_budget';
    let deltaPct: number | null = null;
    if (monthlyBudget > 0) {
      const pct = ((projected - monthlyBudget) / monthlyBudget) * 100;
      deltaPct = Math.round(pct * 10) / 10;
      if (projected > monthlyBudget * 1.02) status = 'over';
      else if (projected < monthlyBudget * 0.98) status = 'safe';
      else status = 'warn';
    }
    return {
      available: true as const,
      projected,
      currentSpent: currentTotal,
      dailyPace: trimmedPace,
      naiveDailyPace: naivePace,
      daysLeft,
      monthlyBudget,
      status,
      deltaPct,
      hasOutlier: trimmedPace > 0 && naivePace > trimmedPace * 1.5,
    };
  }, [timeframe, currentTotal, budget.monthlyBudget, dailyData, dateRange.start]);

  // ── Abonelik özeti ───────────────────────────────────────────────
  // Her abonelik period_days'a göre 30 günlük döneme normalize edilir.
  const subscriptionInfo = useMemo(() => {
    if (activeSubs.length === 0) {
      return { count: 0, monthlyTotal: 0, upcoming: [] as (SubscriptionWithDetails & { daysUntil: number })[] };
    }
    const monthlyTotal = activeSubs.reduce((sum, s) => {
      const period = s.period_days || 30;
      return sum + s.amount * (30 / period);
    }, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const withDays = activeSubs.map(s => {
      const next = new Date(s.next_expected_date);
      next.setHours(0, 0, 0, 0);
      const diffMs = next.getTime() - today.getTime();
      const daysUntil = Math.round(diffMs / 86400000);
      return { ...s, daysUntil };
    });
    withDays.sort((a, b) => a.daysUntil - b.daysUntil);
    return {
      count: activeSubs.length,
      monthlyTotal,
      upcoming: withDays.slice(0, 3),
    };
  }, [activeSubs]);

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

  // ── Time-of-day özeti ────────────────────────────────────────────
  // 7×4 matristen: peak gün/dilim, toplam, hücre normalize değerleri
  const timeOfDayInfo = useMemo(() => {
    if (!timeOfDayData || timeOfDayData.total === 0) {
      return { available: false as const };
    }
    const { matrix, peakDow, peakSlot, peakValue, total } = timeOfDayData;
    return {
      available: true as const,
      matrix,
      peakDow,
      peakSlot,
      peakValue,
      total,
    };
  }, [timeOfDayData]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshCats(), refreshVendors(), refreshDaily(),
      refreshTop(), refreshSubcats(), refreshBehavior(),
      refreshBudget(), loadPrevTotal(), loadPriceChanges(),
      loadActiveSubscriptions(), loadCategoryLimits(),
      loadSavingsGoal(), loadTimeOfDay(), loadSilentSpend(),
      timeframe === 'year' ? loadYearlyData() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  async function loadCardConfig() {
    if (configLoaded.current) return;
    try {
      const db = await (await import('../../src/db/database')).getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'analytics_card_order'"
      );
      if (row) {
        const parsed = JSON.parse(row.value);
        if (parsed.active?.length) {
          // Migration: Kayıtlı konfig eski sürümden geliyor olabilir; ALL_CARDS'a
          // sonradan eklenmiş kartlar ne aktif ne de gizli listede görünmüyor.
          // Bilinmeyenleri tara: DEFAULT_ACTIVE'daysa aktife sondan ekle, değilse
          // gizli "kullanılabilir" listesine ekle. Geçerli/güncel kartları DB'ye
          // yaz ki bir sonraki açılışta migration tekrar çalışmasın.
          const validIds = new Set(ALL_CARDS.map(c => c.id));
          const savedActive: string[] = parsed.active.filter((id: string) => validIds.has(id));
          const savedHidden: string[] = (parsed.hidden || []).filter((id: string) => validIds.has(id));
          const known = new Set([...savedActive, ...savedHidden]);
          const missing = ALL_CARDS.map(c => c.id).filter(id => !known.has(id));
          const newActive = [...savedActive];
          const newHidden = [...savedHidden];
          for (const id of missing) {
            if (DEFAULT_ACTIVE.includes(id)) newActive.push(id);
            else newHidden.push(id);
          }
          setCardOrder(newActive);
          setHiddenCards(newHidden);
          if (
            missing.length > 0 ||
            newActive.length !== parsed.active.length ||
            newHidden.length !== (parsed.hidden?.length ?? 0)
          ) {
            saveCardConfig(newActive, newHidden);
          }
        }
      }
      configLoaded.current = true;
    } catch { /* use defaults */ }
  }

  async function saveCardConfig(active: string[], hidden: string[]) {
    try {
      const db = await (await import('../../src/db/database')).getDatabase();
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('analytics_card_order', ?)",
        [JSON.stringify({ active, hidden })]
      );
    } catch (e) { console.error('Error saving card config:', e); }
  }

  const runAnalyticsRefresh = useCallback(() => {
    loadCardConfig();
    refreshCats();
    refreshVendors();
    refreshDaily();
    refreshTop();
    refreshSubcats();
    refreshBehavior();
    refreshBudget();
    loadPrevTotal();
    loadPriceChanges();
    loadActiveSubscriptions();
    loadCategoryLimits();
    loadSavingsGoal();
    loadTimeOfDay();
    loadSilentSpend();
    if (timeframe === 'year') loadYearlyData();
  }, [dateRange.start, dateRange.end, timeframe, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      runAnalyticsRefresh();
      return () => setIsEditing(false);
    }, [runAnalyticsRefresh])
  );

  useExpenseDataRefresh(runAnalyticsRefresh);

  useEffect(() => {
    if (refreshKey > 0) runAnalyticsRefresh();
  }, [refreshKey, runAnalyticsRefresh]);

  async function loadYearlyData() {
    try {
      const raw: any[] = await ExpenseDao.getYearlyTotals() as any[];
      const mapped = raw.map(r => ({ label: r.year ? String(r.year) : t('unknown'), value: r.total }));
      setYearlyData(mapped);
    } catch (e) {
      console.error('Error loading yearly data:', e);
    }
  }

  async function handleVendorPress(vendorId: number) {
    if (selectedVendor === vendorId) {
      setSelectedVendor(null);
      setVendorItems([]);
      setSelectedDonutIdx(null);
      return;
    }
    setSelectedVendor(vendorId);
    setSelectedDonutIdx(null);
    try {
      const items = await ExpenseDao.getVendorItems(
        vendorId,
        dateRange.start,
        dateRange.end
      );
      setVendorItems(items as any[]);
    } catch (e) {
      console.error('Error loading vendor items:', e);
    }
  }

  const barData = useMemo(() => {
    if (timeframe === 'year') return yearlyData;
    return dailyData.map(d => {
      const date = new Date(d.date);
      const label = timeframe === 'week' 
        ? date.toLocaleDateString(intlLocaleForLanguage(language), { weekday: 'short' })
        : date.getDate().toString();
      return { label, value: d.total };
    });
  }, [timeframe, yearlyData, dailyData, language]);

  const prevBarData = useMemo(() => {
    if (timeframe === 'year' || prevDailyData.length === 0) return undefined;
    return prevDailyData.map(d => {
      const date = new Date(d.date);
      const label = timeframe === 'week'
        ? date.toLocaleDateString(intlLocaleForLanguage(language), { weekday: 'short' })
        : date.getDate().toString();
      return { label, value: d.total };
    });
  }, [timeframe, prevDailyData, language]);

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

  const renderCard = (id: string, index: number) => {
    let content = null;
    if (id === 'chart') {
      content = (
        <AnimatedCard delay={100} style={{ ...styles.section, ...styles.primaryCard }}>
          <Text style={styles.trendTitle}>
            {timeframe === 'year' ? t('annual_distribution') : t('daily_fluctuation')}
          </Text>
          <BarChart data={barData} prevData={prevBarData} height={160} currency={currency} />
        </AnimatedCard>
      );
    } else if (id === 'categories') {
      content = (
        <AnimatedCard delay={200} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('main_categories')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.map((c, ci) => {
              const isSelected = selectedCategory === c.category_id;
              const isFaded = selectedCategory !== null && !isSelected;
              return (
                <Animated.View key={c.category_id} entering={SlideInRight.delay(ci * 70).duration(350).springify()}>
                  <Pressable
                    onPress={() => setSelectedCategory(isSelected ? null : c.category_id)}
                    style={[ styles.categoryPill, isSelected ? { backgroundColor: c.category_color + '33', borderColor: c.category_color } : {}, isFaded ? { opacity: 0.5 } : { opacity: 1 } ]}
                  >
                    <View style={[styles.pillIcon, { backgroundColor: c.category_color }]}>
                      <MaterialCommunityIcons name={c.category_icon as any} size={16} color="#FFF" />
                    </View>
                    <View style={styles.pillInfo}>
                      <Text style={styles.pillName}>{tc(c.category_name)}</Text>
                      <Text style={styles.pillAmount}>{formatCurrency(c.total, currency, false)}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
          {selectedCategory !== null && (
            <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOutUp.duration(200)}>
              <View style={{ height: 1, backgroundColor: Colors.border, marginTop: Spacing.md, marginBottom: Spacing.md }} />
              <Text style={styles.sectionTitle}>{t('subcategories')}</Text>
              {subcats.length > 0 ? subcats.map((sc, i) => (
                <Animated.View key={sc.category_id} entering={FadeInDown.delay(i * 50).duration(280)}>
                  <View style={[styles.vendorRow, { borderBottomWidth: 0, paddingBottom: Spacing.sm }]}>
                    <View style={[styles.pillIcon, { backgroundColor: sc.category_color, width: 44, height: 44, borderRadius: 22 }]}>
                      <MaterialCommunityIcons name={sc.category_icon as any} size={22} color="#FFF" />
                    </View>
                    <View style={styles.vendorInfo}>
                      <Text style={styles.vendorName}>{tc(sc.category_name)}</Text>
                      <View style={styles.vendorBar}>
                        <View style={[styles.vendorBarFill, { width: `${Math.max(2, sc.percentage)}%`, backgroundColor: sc.category_color }]} />
                      </View>
                    </View>
                    <View style={styles.vendorAmountCol}>
                      <Text style={styles.vendorAmount}>{formatCurrency(sc.total, currency)}</Text>
                      <Text style={styles.vendorPercent}>{sc.percentage}%</Text>
                    </View>
                  </View>
                </Animated.View>
              )) : (
                <Text style={{ ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg }}>
                  {t('no_sub_categories')}
                </Text>
              )}
            </Animated.View>
          )}
        </AnimatedCard>
      );
    } else if (id === 'donut') {
      if (needsWants.length === 0 && weekWeekend.length === 0) return null;
      
      const nwItem = selectedNWIdx !== null ? needsWants[selectedNWIdx] : null;
      const wwItem = selectedWWIdx !== null ? weekWeekend[selectedWWIdx] : null;

      const screenWidth = Dimensions.get('window').width;
      const cardInnerWidth = screenWidth - (ScreenPadding.horizontal * 2);

      content = (
        <AnimatedCard delay={300} style={{ ...styles.section, ...styles.primaryCard, paddingHorizontal: 0 }}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.lg }]}>{t('behavioral_analysis')}</Text>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={cardInnerWidth} decelerationRate="fast">
            
            {/* Donut 1: Needs vs Wants */}
            <View style={[styles.donutCard, { width: cardInnerWidth }]}>
              <Text style={styles.trendTitle}>{t('budget_philosophy')}</Text>
              <DonutChart
                segments={nwSegments}
                size={220}
                strokeWidth={32}
                selectedIndex={selectedNWIdx}
                onSelect={handleNWSelect}
                innerContent={
                  <View style={styles.donutCenter}>
                    {nwItem ? (
                      <>
                        <Text style={[styles.donutTotal, { color: nwItem.color }]}>{nwItem.percentage}%</Text>
                        <Text style={styles.donutLabel}>{nwItem.segment}</Text>
                        <Text style={styles.donutSub}>{formatCurrency(nwItem.total, currency, false)}</Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="brain" size={32} color={Colors.primary} />
                        <Text style={styles.donutLabel}>{t('spending_type')}</Text>
                      </>
                    )}
                  </View>
                }
              />
              <View style={styles.donutAnalysisContainer}>
                {nwItem ? (
                  <Text style={styles.donutAnalysisText}>
                    {nwItem.segment === t('needs')
                       ? t('needs_analysis', { percentage: nwItem.percentage.toString() })
                       : nwItem.segment === t('wants')
                       ? t('wants_analysis', { percentage: nwItem.percentage.toString() })
                       : t('savings_other_analysis', { percentage: nwItem.percentage.toString() })}
                  </Text>
                ) : (
                  <Text style={styles.donutAnalysisHint}>{t('donut_hint_swipe_right')}</Text>
                )}
              </View>
            </View>

            {/* Donut 2: Weekday vs Weekend */}
            <View style={[styles.donutCard, { width: cardInnerWidth }]}>
               <Text style={styles.trendTitle}>{t('spending_time')}</Text>
               <DonutChart
                segments={wwSegments}
                size={220}
                strokeWidth={32}
                selectedIndex={selectedWWIdx}
                onSelect={handleWWSelect}
                innerContent={
                  <View style={styles.donutCenter}>
                    {wwItem ? (
                      <>
                        <Text style={[styles.donutTotal, { color: wwItem.color }]}>{wwItem.percentage}%</Text>
                        <Text style={styles.donutLabel}>{wwItem.segment}</Text>
                        <Text style={styles.donutSub}>{formatCurrency(wwItem.total, currency, false)}</Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="calendar-clock" size={32} color={Colors.primary} />
                        <Text style={styles.donutLabel}>{t('time_segment')}</Text>
                      </>
                    )}
                  </View>
                }
              />
              <View style={styles.donutAnalysisContainer}>
                {wwItem ? (
                  <Text style={styles.donutAnalysisText}>
                    {t('time_analysis', { percentage: wwItem.percentage.toString(), segment: wwItem.segment.toLowerCase() })}
                  </Text>
                ) : (
                  <Text style={styles.donutAnalysisHint}>{t('donut_hint_swipe_left')}</Text>
                )}
              </View>
            </View>

          </ScrollView>
        </AnimatedCard>
      );
    } else if (id === 'top_tx') {
      if (topTx.length === 0) return null;
      const TOP_TX_VISIBLE = 3;
      const needsScroll = topTx.length > TOP_TX_VISIBLE;
      const txList = (
        <>
          {topTx.map((tx, i) => (
            <View key={tx.id} style={styles.topTxRow}>
              <View style={[styles.topTxRank, { backgroundColor: i === 0 ? Colors.warning : Colors.surfaceLight }]}>
                <Text style={[styles.topTxRankText, i === 0 && { color: Colors.background }]}>{i + 1}</Text>
              </View>
              {tx.category_icon ? (
                <View style={[styles.topTxCatIcon, { backgroundColor: (tx.category_color || Colors.primary) + '22' }]}>
                  <MaterialCommunityIcons name={tx.category_icon as any} size={16} color={tx.category_color || Colors.primary} />
                </View>
              ) : null}
              <View style={styles.topTxContent}>
                <Text style={styles.topTxVendor}>{tx.vendor_name || t('unknown')}</Text>
                <Text style={styles.topTxDate}>{tx.date.split('-').reverse().slice(0, 2).join('-')} • {tc(tx.category_name ?? '')}</Text>
              </View>
              <Text style={[styles.topTxAmount, { color: Colors.danger }]}>-{formatCurrency(tx.total_amount, currency)}</Text>
            </View>
          ))}
        </>
      );
      content = (
        <AnimatedCard delay={350} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('top_transactions')}</Text>
          {needsScroll ? (
            <ScrollView style={styles.topTxScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {txList}
            </ScrollView>
          ) : (
            txList
          )}
        </AnimatedCard>
      );
    } else if (id === 'vendors') {
      content = (
        <AnimatedCard delay={400} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('vendors_stores')}</Text>
          <Animated.View layout={LinearTransition.duration(320)}>
          {(() => {
              const VENDORS_VISIBLE = 4;
              const needsVendorScroll = vendors.length > VENDORS_VISIBLE;
              const vendorsContent = (
            <>
            {vendors.map((v, i) => {
              const prevVTotal = prevVendorTotals.get(v.vendor_id);
              const isNewVendor = prevVTotal === undefined && prevVendorTotals.size > 0;
              const vendorDelta = prevVTotal && prevVTotal > 0
                ? Math.round(((v.total - prevVTotal) / prevVTotal) * 100)
                : null;
              return (
              <Animated.View key={v.vendor_id} entering={FadeInDown.delay(i * 60).duration(400)}>
                <Pressable
                  onPress={() => handleVendorPress(v.vendor_id)}
                  style={[
                    styles.vendorRow,
                    selectedVendor === v.vendor_id && styles.vendorRowActive,
                    selectedVendor === v.vendor_id && styles.vendorRowActiveNoDivider,
                  ]}
                >
                  <View>
                    <VendorAvatar name={v.vendor_name} logoUri={v.vendor_logo} size={44} />
                    {isNewVendor && (
                      <View style={styles.newBadge}><Text style={styles.newBadgeText}>{t('badge_new')}</Text></View>
                    )}
                  </View>
                  <View style={styles.vendorInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.vendorName}>{v.vendor_name}</Text>
                      {vendorDelta !== null && vendorDelta !== 0 && (
                        <MaterialCommunityIcons
                          name={vendorDelta > 0 ? 'arrow-up' : 'arrow-down'}
                          size={14}
                          color={vendorDelta > 0 ? Colors.danger : Colors.success}
                        />
                      )}
                    </View>
                    <View style={styles.vendorBar}><View style={[styles.vendorBarFill, { width: `${Math.max(2, v.percentage)}%`, backgroundColor: Colors.primary }]} /></View>
                  </View>
                  <View style={styles.vendorAmountCol}>
                    <Text style={styles.vendorAmount}>{formatCurrency(v.total, currency)}</Text>
                    <CountUpText value={v.percentage} suffix="%" style={styles.vendorPercent} />
                  </View>
                </Pressable>
                {selectedVendor === v.vendor_id && vendorItems.length > 0 && (
                  <Animated.View
                    /*
                      Satıcının detay paneli: donut + lejant + "En çok alınan
                      ürünler". Girişte aşağıdan fade-in, kapanışta yukarı fade-out
                      ile yumuşak bir geçiş sağlıyoruz. Bu olmadan React direkt
                      unmount ettiği için panel birden "pat" diye yok oluyordu.
                    */
                    entering={FadeInDown.duration(260)}
                    exiting={FadeOutUp.duration(240)}
                    style={styles.microAnalysis}
                  >
                    {/* Donut chart - full-width, interactive */}
                    {vendorItems.length >= 2 && (() => {
                      const totalSpent = vendorItems.reduce((s: number, i: any) => s + i.total_spent, 0);
                      const selItem = selectedDonutIdx !== null ? vendorItems[selectedDonutIdx] : null;
                      const layoutSoftLegend = () => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.create(
                            220,
                            LayoutAnimation.Types.easeInEaseOut,
                            LayoutAnimation.Properties.opacity
                          )
                        );
                      };
                      return (
                        <View style={styles.vendorDonutSection}>
                          <DonutChart
                            segments={vendorItems.slice(0, 8).map((item: any, idx: number) => ({
                              label: item.turkish_name || item.name,
                              value: item.total_spent,
                              color: ChartColorArray[idx % ChartColorArray.length],
                            }))}
                            size={180}
                            strokeWidth={26}
                            selectedIndex={selectedDonutIdx}
                            onSelect={(idx) => {
                              layoutSoftLegend();
                              setSelectedDonutIdx((prev) => (prev === idx ? null : idx));
                            }}
                            innerContent={
                              <Pressable
                                onPress={() => {
                                  layoutSoftLegend();
                                  setSelectedDonutIdx(null);
                                }}
                                style={({ pressed }) => [
                                  styles.vendorDonutCenter,
                                  selectedDonutIdx !== null && pressed && styles.vendorDonutCenterPressed,
                                ]}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                accessibilityRole="button"
                                accessibilityLabel={t('donut_center_clear')}
                              >
                                {selItem ? (
                                  <>
                                    <Text style={[styles.vendorDonutPct, { color: ChartColorArray[selectedDonutIdx! % ChartColorArray.length] }]}>
                                      {Math.round((selItem.total_spent / totalSpent) * 100)}%
                                    </Text>
                                    <Text style={styles.vendorDonutLabel} numberOfLines={2}>
                                      {selItem.turkish_name || selItem.name}
                                    </Text>
                                    <Text style={styles.vendorDonutSub}>
                                      {formatCurrency(selItem.total_spent, currency, false)}
                                    </Text>
                                  </>
                                ) : (
                                  <>
                                    <Text style={styles.vendorDonutTotal}>{vendorItems.length}</Text>
                                    <Text style={styles.vendorDonutLabel}>{t('product_variety')}</Text>
                                  </>
                                )}
                              </Pressable>
                            }
                          />
                          {/* 2-column legend grid */}
                          <View style={styles.legendGrid}>
                            {vendorItems.slice(0, 8).map((item: any, idx: number) => {
                              const pct = Math.round((item.total_spent / totalSpent) * 100);
                              const isSelected = selectedDonutIdx === idx;
                              return (
                                <Pressable
                                  key={idx}
                                  onPress={() => {
                                    layoutSoftLegend();
                                    setSelectedDonutIdx(idx === selectedDonutIdx ? null : idx);
                                  }}
                                  style={[styles.legendItem, isSelected && { borderColor: ChartColorArray[idx % ChartColorArray.length], backgroundColor: ChartColorArray[idx % ChartColorArray.length] + '18' }]}
                                >
                                  <View style={[styles.legendDot, { backgroundColor: ChartColorArray[idx % ChartColorArray.length] }]} />
                                  <Text style={styles.legendText} numberOfLines={1}>
                                    {item.turkish_name || item.name}
                                  </Text>
                                  <Text style={[styles.legendPct, isSelected && { color: ChartColorArray[idx % ChartColorArray.length] }]}>{pct}%</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })()}
                    <Text style={[styles.microTitle, { marginTop: vendorItems.length >= 2 ? Spacing.lg : 0 }]}>
                      {selectedDonutIdx !== null
                        ? `🔍 ${vendorItems[selectedDonutIdx]?.turkish_name || vendorItems[selectedDonutIdx]?.name || t('product_details')}`
                        : t('top_bought_products')}
                    </Text>

                    {/* Rendering the items list - scroll when > 3 */}
                    {(() => {
                        const itemsToRender = selectedDonutIdx !== null ? [vendorItems[selectedDonutIdx]] : vendorItems;
                        const needsItemScroll = itemsToRender.length > 3;
                        const filteredItems = itemsToRender.filter(Boolean);
                        const itemsList = filteredItems.map((item: any, j: number) => {
                          const primaryName = item.turkish_name || item.name;
                          const secondaryName = item.turkish_name ? item.name : '';
                          const isExpense = item.total_spent >= 0;
                          return (
                            <Pressable key={j} style={styles.microItem} onPress={() => setSelectedItemName(item.name)}>
                              <View style={styles.microItemContent}>
                                <View style={styles.microItemMain}>
                                  <Text style={styles.microItemPrimary} numberOfLines={1}>{primaryName}</Text>
                                  <Text style={styles.microItemSecondary} numberOfLines={1}>
                                    {secondaryName ? `${secondaryName}  •  ` : ''}{t('pieces', { count: item.purchase_count.toString() })}
                                  </Text>
                                </View>
                                <View style={styles.microItemPriceCol}>
                                  <Text style={[styles.microItemAmount, !isExpense && { color: Colors.success }]}>
                                    {formatCurrency(item.total_spent, currency, false)}
                                  </Text>
                                  <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.borderLight} />
                                </View>
                              </View>
                              {j < filteredItems.length - 1 && <View style={styles.microItemDivider} />}
                            </Pressable>
                          );
                        });

                        return needsItemScroll ? (
                          <ScrollView style={styles.vendorItemsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                            {itemsList}
                          </ScrollView>
                        ) : (
                          <>{itemsList}</>
                        );
                    })()}
                  </Animated.View>
                )}
              </Animated.View>
            ); })}
            </>
              );
              return needsVendorScroll ? (
                <ScrollView style={styles.vendorsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {vendorsContent}
                </ScrollView>
              ) : vendorsContent;
            })()}
          </Animated.View>
        </AnimatedCard>
      );
    }

    // ──── A1: Monthly Comparison ────
    if (id === 'monthly_compare') {
      if (timeframe === 'year') return null;
      content = (
        <AnimatedCard delay={150} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('monthly_comparison')}</Text>
          <View style={styles.compareRow}>
            <View style={styles.compareBlock}>
              <Text style={styles.compareLabel}>{t('this_period')}</Text>
              <Text style={styles.compareValue}>{formatCurrency(currentTotal, currency)}</Text>
            </View>
            <View style={styles.compareDivider} />
            <View style={styles.compareBlock}>
              <Text style={styles.compareLabel}>{t('last_period')}</Text>
              <Text style={[styles.compareValue, { color: Colors.textSecondary }]}>
                {prevTotal > 0 ? formatCurrency(prevTotal, currency) : '—'}
              </Text>
            </View>
          </View>
          {comparisonDelta !== null ? (
            <View style={[styles.deltaBadge, { backgroundColor: comparisonDelta <= 0 ? Colors.success + '18' : Colors.danger + '18' }]}>
              <MaterialCommunityIcons
                name={comparisonDelta <= 0 ? 'trending-down' : 'trending-up'}
                size={18}
                color={comparisonDelta <= 0 ? Colors.success : Colors.danger}
              />
              <Text style={[styles.deltaText, { color: comparisonDelta <= 0 ? Colors.success : Colors.danger }]}>
                {comparisonDelta <= 0
                  ? t('decreased_pct', { pct: Math.abs(comparisonDelta).toString() })
                  : t('increased_pct', { pct: comparisonDelta.toString() })}
              </Text>
              <Text style={styles.deltaHint}>{t('vs_previous')}</Text>
            </View>
          ) : (
            <View style={styles.deltaBadge}>
              <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textMuted} />
              <Text style={[styles.deltaText, { color: Colors.textMuted }]}>{t('no_previous_data')}</Text>
            </View>
          )}
          {/* Mini comparison bars */}
          {prevTotal > 0 && (
            <View style={styles.compareBars}>
              <View style={styles.compareBarRow}>
                <Text style={styles.compareBarLabel}>{t('this_period')}</Text>
                <View style={styles.compareBarTrack}>
                  <View style={[styles.compareBarFill, { width: `${Math.min(100, (currentTotal / Math.max(currentTotal, prevTotal)) * 100)}%`, backgroundColor: Colors.primary }]} />
                </View>
              </View>
              <View style={styles.compareBarRow}>
                <Text style={styles.compareBarLabel}>{t('last_period')}</Text>
                <View style={styles.compareBarTrack}>
                  <View style={[styles.compareBarFill, { width: `${Math.min(100, (prevTotal / Math.max(currentTotal, prevTotal)) * 100)}%`, backgroundColor: Colors.textMuted }]} />
                </View>
              </View>
            </View>
          )}
        </AnimatedCard>
      );
    }

    // ──── A2: Budget Summary ────
    if (id === 'budget') {
      const pct = budget.percentage;
      const barColor = budget.isOverBudget ? Colors.danger : pct > 80 ? Colors.warning : Colors.primary;

      content = budget.monthlyBudget > 0 ? (
        <AnimatedCard delay={180} style={{ ...styles.section, ...styles.primaryCard }}>
          <View style={styles.budgetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={[styles.budgetIcon, { backgroundColor: barColor + '22' }]}>
                <MaterialCommunityIcons name={budget.isOverBudget ? 'alert' : 'wallet-outline'} size={18} color={barColor} />
              </View>
              <Text style={styles.sectionTitle}>{t('budget_overview')}</Text>
            </View>
            <View style={[styles.budgetPctBadge, { backgroundColor: barColor + '22' }]}>
              <CountUpText value={pct} prefix="%" style={[styles.budgetPctText, { color: barColor }]} />
            </View>
          </View>

          <View style={styles.budgetAmounts}>
            <View>
              <Text style={styles.budgetSmLabel}>{t('spent_label')}</Text>
              <Text style={[styles.budgetAmountVal, budget.isOverBudget && { color: Colors.danger }]}>
                {formatCurrency(budget.totalSpent, currency)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.budgetSmLabel}>{t('remaining_label')}</Text>
              <Text style={[styles.budgetAmountVal, { color: budget.isOverBudget ? Colors.danger : Colors.textPrimary }]}>
                {formatCurrency(Math.abs(budget.remaining), currency)}
              </Text>
            </View>
          </View>

          <View style={styles.budgetBarTrack}>
            <View style={[styles.budgetBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
          </View>

          <View style={styles.budgetFooter}>
            <View style={styles.budgetStat}>
              <MaterialCommunityIcons name="calendar-today" size={13} color={Colors.textSecondary} />
              <Text style={styles.budgetStatLabel}>{t('daily_average')}</Text>
              <Text style={styles.budgetStatVal}>{formatCurrency(budget.dailyAverage, currency, false)}</Text>
            </View>
            <View style={styles.budgetStat}>
              <MaterialCommunityIcons name="target" size={13} color={Colors.textSecondary} />
              <Text style={styles.budgetStatLabel}>{t('daily_target')}</Text>
              <Text style={[styles.budgetStatVal, { color: budget.isOverBudget ? Colors.danger : Colors.textPrimary }]}>
                {formatCurrency(budget.dailyBudget, currency, false)}
              </Text>
            </View>
          </View>
        </AnimatedCard>
      ) : (
        <AnimatedCard delay={180} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('budget_overview')}</Text>
          <View style={styles.emptyBudget}>
            <MaterialCommunityIcons name="wallet-plus-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyBudgetTitle}>{t('no_budget_set')}</Text>
            <Text style={styles.emptyBudgetHint}>{t('set_budget_hint')}</Text>
          </View>
        </AnimatedCard>
      );
    }

    // ──── A3: Spending Heatmap ────
    if (id === 'heatmap') {
      if (!heatmapInfo) return null;
      content = (
        <AnimatedCard delay={350} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('spending_calendar')}</Text>
          <SpendingHeatmap data={dailyData} year={heatmapInfo.year} month={heatmapInfo.month} />
        </AnimatedCard>
      );
    }

    // ──── A6: Price Watch ────
    // Kompakt 2 sütunlu grid: Her ürün mini bir kart. Ürün sayısı arttıkça
    // dikey uzama yarı yarıya azalır (örn. 6 ürün → 3 satır yerine 3 sütunsal
    // çift); başlıkta toplam ürün sayısı küçük bir rozet gösterir.
    if (id === 'price_watch') {
      if (priceChanges.length === 0) return null;
      const upCount = priceChanges.filter(p => p.changePct > 0).length;
      const downCount = priceChanges.length - upCount;
      content = (
        <AnimatedCard delay={380} style={styles.section}>
          <View style={styles.priceHeader}>
            <View style={styles.priceHeaderLeft}>
              <MaterialCommunityIcons name="tag-multiple-outline" size={18} color={Colors.warning} />
              <Text style={styles.sectionTitle}>{t('price_watch')}</Text>
            </View>
            <View style={styles.priceHeaderStats}>
              {upCount > 0 && (
                <View style={styles.priceStatChip}>
                  <MaterialCommunityIcons name="arrow-up" size={12} color={Colors.danger} />
                  <Text style={[styles.priceStatChipText, { color: Colors.danger }]}>{upCount}</Text>
                </View>
              )}
              {downCount > 0 && (
                <View style={styles.priceStatChip}>
                  <MaterialCommunityIcons name="arrow-down" size={12} color={Colors.success} />
                  <Text style={[styles.priceStatChipText, { color: Colors.success }]}>{downCount}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.priceGrid}>
            {priceChanges.map((pc, i) => {
              const isUp = pc.changePct > 0;
              const displayName = pc.turkishName || pc.name;
              return (
                <Animated.View
                  key={i}
                  entering={FadeInDown.delay(i * 40).duration(260)}
                  style={styles.priceTile}
                >
                  <Pressable
                    onPress={() => setSelectedItemName(pc.name)}
                    style={({ pressed }) => [styles.priceTileInner, pressed && { opacity: 0.88 }]}
                  >
                    <View
                      style={[
                        styles.priceTileBadge,
                        { backgroundColor: isUp ? Colors.danger + '18' : Colors.success + '18' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isUp ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={isUp ? Colors.danger : Colors.success}
                      />
                      <Text
                        style={[
                          styles.priceTilePct,
                          { color: isUp ? Colors.danger : Colors.success },
                        ]}
                      >
                        {isUp ? '+' : ''}
                        {pc.changePct}%
                      </Text>
                    </View>
                    <Text style={styles.priceTileName} numberOfLines={2}>
                      {displayName}
                    </Text>
                    <Text style={styles.priceTileSub} numberOfLines={1}>
                      {formatCurrency(pc.firstPrice, currency, false)}
                      <Text style={styles.priceTileArrow}> → </Text>
                      {formatCurrency(pc.lastPrice, currency, false)}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
          <Text style={styles.priceHint}>{t('since_first')}</Text>
        </AnimatedCard>
      );
    }

    // ──── A7: Spending Streak ────
    if (id === 'streak') {
      const { zeroSpendDays, currentStreak, underBudgetDays, totalDays } = streakData;
      const streakType = currentStreak >= 3 ? 'great' : currentStreak >= 1 ? 'good' : 'start';
      const streakMsg = streakType === 'great' ? t('streak_great') : streakType === 'good' ? t('streak_good') : t('streak_start');
      const StreakIcon = streakType === 'great' ? 'fire' : streakType === 'good' ? 'thumb-up' : 'target';

      content = (
        <AnimatedCard delay={250} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('spending_streak')}</Text>
          <View style={styles.streakGrid}>
            <Pressable
              style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
              onPress={() => setStreakDetailVariant('zero')}
              accessibilityRole="button"
              accessibilityLabel={t('zero_spend_days')}
            >
              <View style={[styles.streakIconBg, { backgroundColor: Colors.success + '18' }]}>
                <MaterialCommunityIcons name="calendar-check" size={22} color={Colors.success} />
              </View>
              <CountUpText value={zeroSpendDays} style={styles.streakNumber} duration={900} />
              <Text style={styles.streakLabel}>{t('zero_spend_days')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
              onPress={() => setStreakDetailVariant('streak')}
              accessibilityRole="button"
              accessibilityLabel={t('current_streak')}
            >
              <View style={[styles.streakIconBg, { backgroundColor: Colors.warning + '18' }]}>
                <MaterialCommunityIcons name="fire" size={22} color={Colors.warning} />
              </View>
              <CountUpText value={currentStreak} style={styles.streakNumber} duration={900} />
              <Text style={styles.streakLabel}>{t('current_streak')}</Text>
            </Pressable>
            {budget.dailyBudget > 0 && (
              <Pressable
                style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
                onPress={() => setStreakDetailVariant('under')}
                accessibilityRole="button"
                accessibilityLabel={t('under_budget_days')}
              >
                <View style={[styles.streakIconBg, { backgroundColor: Colors.primary + '18' }]}>
                  <MaterialCommunityIcons name="shield-check" size={22} color={Colors.primary} />
                </View>
                <CountUpText value={underBudgetDays} style={styles.streakNumber} duration={900} />
                <Text style={styles.streakLabel}>{t('under_budget_days')}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.streakMsg}>
            <View style={styles.streakMsgRow}>
              <View style={[styles.streakMsgIconWrap, { backgroundColor: (streakType === 'great' ? Colors.warning : streakType === 'good' ? Colors.primary : Colors.info) + '22' }]}>
                <MaterialCommunityIcons
                  name={StreakIcon as any}
                  size={20}
                  color={streakType === 'great' ? Colors.warning : streakType === 'good' ? Colors.primary : Colors.info}
                />
              </View>
              <Text style={styles.streakMsgText} numberOfLines={1} ellipsizeMode="tail">{streakMsg}</Text>
            </View>
            {totalDays > 0 && (
              <View style={styles.streakMsgSubWrap}>
                <Text style={styles.streakMsgSub}>
                  {zeroSpendDays}/{totalDays} {t('days_label')}
                </Text>
              </View>
            )}
          </View>
        </AnimatedCard>
      );
    }

    // ──── A8: Month-end Projection ────
    // Cam (primary) kart. Büyük projeksiyon rakamı + bütçeye göre yatay
    // konum izleyici (current → projection işaretleri ile). Bütçesi olmasa
    // bile günlük tempo + kalan gün gösterilir.
    if (id === 'projection') {
      if (!projectionInfo.available) {
        const reasonKey = projectionInfo.reason === 'only_month' ? 'projection_only_month' : 'projection_too_early';
        const icon = projectionInfo.reason === 'only_month' ? 'calendar-month-outline' : 'progress-clock';
        content = (
          <AnimatedCard delay={120} style={styles.section}>
            <View style={styles.projHeader}>
              <View style={styles.projHeaderLeft}>
                <MaterialCommunityIcons name="crystal-ball" size={18} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>{t('projection_title')}</Text>
              </View>
            </View>
            <View style={styles.projEmptyWrap}>
              <MaterialCommunityIcons name={icon} size={36} color={Colors.textMuted} />
              <Text style={styles.projEmptyText}>{t(reasonKey)}</Text>
            </View>
          </AnimatedCard>
        );
      } else {
        const { projected, currentSpent, dailyPace, daysLeft, monthlyBudget, status } = projectionInfo;
        const accent =
          status === 'over' ? Colors.danger :
          status === 'warn' ? Colors.warning :
          status === 'safe' ? Colors.success :
          Colors.primary;

        // Pist üzerinde işaretler — bütçe varsa bütçe = %100 gibi normalize edilir.
        const refValue = Math.max(monthlyBudget, projected, currentSpent, 1);
        const currentPct = Math.min(100, (currentSpent / refValue) * 100);
        const projectedPct = Math.min(100, (projected / refValue) * 100);
        const budgetPct = monthlyBudget > 0 ? Math.min(100, (monthlyBudget / refValue) * 100) : null;

        // Outcome metni: yüzde yerine somut TL — kullanıcı için çok daha net.
        const outcomeIcon =
          status === 'over' ? 'alert-circle-outline' :
          status === 'safe' ? 'shield-check-outline' :
          status === 'warn' ? 'target' :
          'wallet-plus-outline';
        let outcomeTitle: string;
        let outcomeSub: string;
        if (status === 'safe') {
          const remaining = monthlyBudget - projected;
          outcomeTitle = t('projection_outcome_save_title');
          outcomeSub = t('projection_outcome_save_sub', { amount: formatCurrency(remaining, currency, false) });
        } else if (status === 'over') {
          const overBy = projected - monthlyBudget;
          outcomeTitle = t('projection_outcome_over_title');
          outcomeSub = t('projection_outcome_over_sub', { amount: formatCurrency(overBy, currency, false) });
        } else if (status === 'warn') {
          outcomeTitle = t('projection_outcome_warn_title');
          outcomeSub = t('projection_outcome_warn_sub');
        } else {
          outcomeTitle = t('projection_outcome_nobudget_title');
          outcomeSub = t('projection_outcome_nobudget_sub');
        }

        content = (
          <AnimatedCard delay={120} style={{ ...styles.section, ...styles.primaryCard }}>
            <View style={styles.projHeader}>
              <View style={styles.projHeaderLeft}>
                <View style={[styles.projHeaderIcon, { backgroundColor: accent + '1F' }]}>
                  <MaterialCommunityIcons name="crystal-ball" size={16} color={accent} />
                </View>
                <Text style={styles.sectionTitle}>{t('projection_title')}</Text>
              </View>
              <View style={[styles.projDaysChip, { backgroundColor: Colors.surfaceLight }]}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.projDaysChipText}>{t('projection_days_left', { days: daysLeft.toString() })}</Text>
              </View>
            </View>

            {/* Hero: tahmini ay sonu */}
            <Text style={styles.projHeroLabel}>{t('projection_estimated')}</Text>
            <Text style={[styles.projHeroValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCurrency(projected, currency)}
            </Text>
            <Text style={styles.projPaceHint}>{t('projection_pace_hint')}</Text>

            {/* Track — current ↔ projected ↔ budget */}
            <View style={styles.projTrackWrap}>
              <View style={styles.projTrack}>
                {/* Current spent fill (solid, accent) */}
                <View style={[styles.projTrackCurrent, { width: `${currentPct}%`, backgroundColor: accent }]} />
                {/* Projected fill (translucent extension) */}
                <View
                  style={[
                    styles.projTrackProjected,
                    {
                      left: `${currentPct}%`,
                      width: `${Math.max(0, projectedPct - currentPct)}%`,
                      backgroundColor: accent + '4D',
                    },
                  ]}
                />
                {/* Budget marker */}
                {budgetPct !== null && (
                  <View style={[styles.projTrackBudgetMarker, { left: `${budgetPct}%` }]} />
                )}
              </View>
              <View style={styles.projTrackLegend}>
                <View style={styles.projLegendItem}>
                  <View style={[styles.projLegendDot, { backgroundColor: accent }]} />
                  <Text style={styles.projLegendText}>{t('projection_so_far')}</Text>
                </View>
                <View style={styles.projLegendItem}>
                  <View style={[styles.projLegendDot, { backgroundColor: accent + '4D' }]} />
                  <Text style={styles.projLegendText}>{t('projection_estimated')}</Text>
                </View>
                {budgetPct !== null && (
                  <View style={styles.projLegendItem}>
                    <View style={[styles.projLegendDot, styles.projLegendDotBudget]} />
                    <Text style={styles.projLegendText}>{t('budget_overview').toLowerCase()}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Outcome panel — tam genişlik, 2 satır, somut tutar */}
            <View style={[styles.projOutcomePanel, { backgroundColor: accent + '14', borderColor: accent + '33' }]}>
              <View style={[styles.projOutcomeIconWrap, { backgroundColor: accent + '22' }]}>
                <MaterialCommunityIcons name={outcomeIcon as any} size={18} color={accent} />
              </View>
              <View style={styles.projOutcomeTextWrap}>
                <Text style={[styles.projOutcomeTitle, { color: accent }]} numberOfLines={1}>
                  {outcomeTitle}
                </Text>
                <Text style={styles.projOutcomeSub} numberOfLines={2}>
                  {outcomeSub}
                </Text>
              </View>
            </View>

            {/* Pace satırı */}
            <View style={styles.projPaceRow}>
              <View style={styles.projPaceRowLeft}>
                <MaterialCommunityIcons name="speedometer" size={13} color={Colors.textSecondary} />
                <Text style={styles.projPaceLabel}>{t('projection_daily_pace')}</Text>
              </View>
              <Text style={styles.projPaceValue}>{formatCurrency(dailyPace, currency, false)}</Text>
            </View>
          </AnimatedCard>
        );
      }
    }

    // ──── A9: Active Subscriptions ────
    // Aylık yük rakamı + ilk 3 yaklaşan abonelik. Ek bir sayfa açmak yerine
    // kart içinde yoğun bilgi sunuyor — küçük vendor avatarı, gün rozeti, tutar.
    if (id === 'subscriptions') {
      const { count, monthlyTotal, upcoming } = subscriptionInfo;

      if (count === 0) {
        content = (
          <AnimatedCard delay={160} style={styles.section}>
            <View style={styles.subsHeader}>
              <View style={styles.subsHeaderLeft}>
                <MaterialCommunityIcons name="sync-circle" size={18} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>{t('subs_card_title')}</Text>
              </View>
            </View>
            <View style={styles.subsEmptyWrap}>
              <MaterialCommunityIcons name="autorenew-off" size={36} color={Colors.textMuted} />
              <Text style={styles.subsEmptyTitle}>{t('subs_card_empty_title')}</Text>
              <Text style={styles.subsEmptyHint}>{t('subs_card_empty_hint')}</Text>
            </View>
          </AnimatedCard>
        );
      } else {
        content = (
          <AnimatedCard delay={160} style={styles.section}>
            <View style={styles.subsHeader}>
              <View style={styles.subsHeaderLeft}>
                <View style={[styles.subsHeaderIcon, { backgroundColor: Colors.info + '1F' }]}>
                  <MaterialCommunityIcons name="sync-circle" size={16} color={Colors.info} />
                </View>
                <Text style={styles.sectionTitle}>{t('subs_card_title')}</Text>
              </View>
              <View style={[styles.subsCountBadge, { backgroundColor: Colors.surfaceLight }]}>
                <Text style={styles.subsCountText}>{count}</Text>
              </View>
            </View>

            {/* Hero: aylık toplam yük */}
            <View style={styles.subsHeroBlock}>
              <Text style={styles.subsHeroLabel}>{t('subs_card_monthly_load')}</Text>
              <Text style={styles.subsHeroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {formatCurrency(monthlyTotal, currency)}
              </Text>
            </View>

            {/* Yaklaşanlar */}
            <View style={styles.subsUpcomingHeader}>
              <Text style={styles.subsUpcomingLabel}>{t('subs_card_upcoming')}</Text>
              <View style={styles.subsDividerLine} />
            </View>
            <View style={styles.subsList}>
              {upcoming.map((s, i) => {
                const dayLabel =
                  s.daysUntil < 0 ? t('subs_card_overdue') :
                  s.daysUntil === 0 ? t('subs_card_today') :
                  s.daysUntil === 1 ? t('subs_card_tomorrow') :
                  t('subs_card_in_days', { days: s.daysUntil.toString() });
                const dayAccent = s.daysUntil < 0 ? Colors.danger : s.daysUntil <= 3 ? Colors.warning : Colors.textSecondary;
                const catColor = s.category_color || Colors.primary;
                return (
                  <Animated.View key={s.id} entering={FadeInDown.delay(i * 60).duration(280)} style={styles.subsRow}>
                    <View style={[styles.subsAvatar, { backgroundColor: catColor + '22' }]}>
                      <MaterialCommunityIcons
                        name={(s.category_icon as any) || 'tag-outline'}
                        size={18}
                        color={catColor}
                      />
                    </View>
                    <View style={styles.subsRowMain}>
                      <Text style={styles.subsRowName} numberOfLines={1}>{s.vendor_name}</Text>
                      <View style={styles.subsRowMeta}>
                        <MaterialCommunityIcons name="clock-outline" size={11} color={dayAccent} />
                        <Text style={[styles.subsRowDays, { color: dayAccent }]} numberOfLines={1}>{dayLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.subsRowAmount}>{formatCurrency(s.amount, currency)}</Text>
                  </Animated.View>
                );
              })}
            </View>
          </AnimatedCard>
        );
      }
    }

    // ──── A10: Category Limits Health ────
    // Limit konulan her kategori için ince bar + ratio rozeti. Aşılmış olanlar
    // doğal olarak en üste sıralandı (loadCategoryLimits).
    if (id === 'limits_health') {
      const { count, overCount, warnCount, items } = limitsHealthInfo;

      if (count === 0) {
        content = (
          <AnimatedCard delay={200} style={styles.section}>
            <View style={styles.limitsHeader}>
              <View style={styles.limitsHeaderLeft}>
                <MaterialCommunityIcons name="gauge" size={18} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>{t('limits_health_title')}</Text>
              </View>
            </View>
            <View style={styles.limitsEmptyWrap}>
              <MaterialCommunityIcons name="gauge-empty" size={36} color={Colors.textMuted} />
              <Text style={styles.limitsEmptyTitle}>{t('limits_health_empty_title')}</Text>
              <Text style={styles.limitsEmptyHint}>{t('limits_health_empty_hint')}</Text>
            </View>
          </AnimatedCard>
        );
      } else {
        content = (
          <AnimatedCard delay={200} style={styles.section}>
            <View style={styles.limitsHeader}>
              <View style={styles.limitsHeaderLeft}>
                <View style={[styles.limitsHeaderIcon, { backgroundColor: Colors.primary + '1F' }]}>
                  <MaterialCommunityIcons name="gauge" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>{t('limits_health_title')}</Text>
              </View>
              <View style={styles.limitsHeaderStats}>
                {overCount > 0 && (
                  <View style={[styles.limitsStatChip, { backgroundColor: Colors.danger + '1F' }]}>
                    <Text style={[styles.limitsStatChipText, { color: Colors.danger }]}>{overCount}</Text>
                    <MaterialCommunityIcons name="alert-circle" size={11} color={Colors.danger} />
                  </View>
                )}
                {warnCount > 0 && (
                  <View style={[styles.limitsStatChip, { backgroundColor: Colors.warning + '1F' }]}>
                    <Text style={[styles.limitsStatChipText, { color: Colors.warning }]}>{warnCount}</Text>
                    <MaterialCommunityIcons name="alert" size={11} color={Colors.warning} />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.limitsList}>
              {items.map((l, i) => {
                const ratio = l.limit > 0 ? l.spent / l.limit : 0;
                const pctNum = Math.round(ratio * 100);
                const accent =
                  ratio >= 1 ? Colors.danger :
                  ratio >= 0.7 ? Colors.warning :
                  Colors.success;
                const fillPct = Math.min(100, ratio * 100);
                const remaining = l.limit - l.spent;
                const overBy = l.spent - l.limit;
                return (
                  <Animated.View key={l.category_id} entering={FadeInDown.delay(i * 50).duration(280)} style={styles.limitRow}>
                    <View style={styles.limitRowTop}>
                      <View style={[styles.limitIcon, { backgroundColor: l.category_color + '22' }]}>
                        <MaterialCommunityIcons
                          name={(l.category_icon as any) || 'tag-outline'}
                          size={16}
                          color={l.category_color}
                        />
                      </View>
                      <Text style={styles.limitName} numberOfLines={1}>{tc(l.category_name)}</Text>
                      <Text style={[styles.limitPct, { color: accent }]}>{pctNum}%</Text>
                    </View>
                    <View style={styles.limitTrack}>
                      <View style={[styles.limitTrackFill, { width: `${fillPct}%`, backgroundColor: accent }]} />
                    </View>
                    <View style={styles.limitRowBottom}>
                      <Text style={styles.limitAmounts}>
                        <Text style={styles.limitSpent}>{formatCurrency(l.spent, currency, false)}</Text>
                        <Text style={styles.limitDiv}> / </Text>
                        <Text style={styles.limitMax}>{formatCurrency(l.limit, currency, false)}</Text>
                      </Text>
                      {ratio >= 1 ? (
                        <Text style={[styles.limitRemaining, { color: Colors.danger }]}>
                          +{formatCurrency(overBy, currency, false)} {t('limits_health_over_by')}
                        </Text>
                      ) : (
                        <Text style={styles.limitRemaining}>
                          {formatCurrency(remaining, currency, false)} {t('limits_health_remaining')}
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </AnimatedCard>
        );
      }
    }

    // ──── A11: Savings Goal Progress ────
    // Cam (primary) kart. Sol tarafta DonutChart ile progress halkası, sağ
    // tarafta hedef tutarı + monthly need + tarih bilgisi. Hedef yoksa boş
    // durum gösterilir (kullanıcıyı ayarlara yönlendirir).
    if (id === 'goal') {
      if (!goalInfo.available) {
        content = (
          <AnimatedCard delay={140} style={styles.section}>
            <View style={styles.goalHeader}>
              <View style={styles.goalHeaderLeft}>
                <MaterialCommunityIcons name="flag-checkered" size={18} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>{t('goal_card_title')}</Text>
              </View>
            </View>
            <View style={styles.goalEmptyWrap}>
              <MaterialCommunityIcons name="flag-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.goalEmptyTitle}>{t('goal_card_empty_title')}</Text>
              <Text style={styles.goalEmptyHint}>{t('goal_card_empty_hint')}</Text>
            </View>
          </AnimatedCard>
        );
      } else {
        const { title, target, current, remaining, ratio, pctNum, daysToTarget, monthlyNeed, status } = goalInfo;
        const accent =
          status === 'complete' ? Colors.success :
          status === 'overdue' ? Colors.danger :
          status === 'tight' ? Colors.warning :
          Colors.primary;
        const goalSegments = [
          { value: ratio, label: 'progress', color: accent },
          { value: 1 - ratio, label: 'remaining', color: Colors.surfaceLight },
        ];
        const dateText =
          status === 'complete' ? '' :
          daysToTarget < 0 ? t('goal_card_days_overdue', { days: Math.abs(daysToTarget).toString() }) :
          daysToTarget === 0 ? t('goal_card_due_today') :
          t('goal_card_days_left', { days: daysToTarget.toString() });
        const subText =
          status === 'complete'
            ? t('goal_card_complete_sub', { amount: formatCurrency(current, currency, false) })
            : status === 'overdue'
            ? t('goal_card_overdue_sub', { amount: formatCurrency(remaining, currency, false) })
            : status === 'tight'
            ? t('goal_card_monthly_need', { amount: formatCurrency(monthlyNeed, currency, false) })
            : t('goal_card_monthly_safe', { amount: formatCurrency(monthlyNeed, currency, false) });
        const subIcon =
          status === 'complete' ? 'trophy-outline' :
          status === 'overdue' ? 'alert-circle-outline' :
          status === 'tight' ? 'rocket-launch-outline' :
          'piggy-bank-outline';

        content = (
          <AnimatedCard delay={140} style={{ ...styles.section, ...styles.primaryCard }}>
            <View style={styles.goalHeader}>
              <View style={styles.goalHeaderLeft}>
                <View style={[styles.goalHeaderIcon, { backgroundColor: accent + '1F' }]}>
                  <MaterialCommunityIcons name="flag-checkered" size={16} color={accent} />
                </View>
                <Text style={styles.sectionTitle}>{t('goal_card_title')}</Text>
              </View>
              {!!dateText && (
                <View style={[styles.goalDateChip, { backgroundColor: Colors.surfaceLight }]}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.goalDateChipText}>{dateText}</Text>
                </View>
              )}
            </View>

            {!!title && <Text style={styles.goalTitle} numberOfLines={1}>{title}</Text>}

            <View style={styles.goalBody}>
              <View style={styles.goalDonutWrap}>
                <DonutChart
                  segments={goalSegments}
                  size={140}
                  strokeWidth={14}
                  innerContent={
                    <View style={styles.goalDonutCenter}>
                      <Text style={[styles.goalDonutPct, { color: accent }]}>{pctNum}%</Text>
                      <Text style={styles.goalDonutLabel}>{t('goal_card_saved_label').toLowerCase()}</Text>
                    </View>
                  }
                />
              </View>
              <View style={styles.goalStats}>
                <View style={styles.goalStatRow}>
                  <View style={[styles.goalStatDot, { backgroundColor: accent }]} />
                  <Text style={styles.goalStatLabel}>{t('goal_card_saved_label')}</Text>
                  <Text style={styles.goalStatValue}>{formatCurrency(current, currency, false)}</Text>
                </View>
                <View style={styles.goalStatRow}>
                  <View style={[styles.goalStatDot, { backgroundColor: Colors.surfaceLight, borderColor: Colors.border, borderWidth: 1 }]} />
                  <Text style={styles.goalStatLabel}>{t('goal_card_remaining_label')}</Text>
                  <Text style={styles.goalStatValue}>{formatCurrency(remaining, currency, false)}</Text>
                </View>
                <View style={styles.goalStatRow}>
                  <MaterialCommunityIcons name="target" size={10} color={Colors.textMuted} style={{ marginHorizontal: 1 }} />
                  <Text style={styles.goalStatLabel}>{t('goal_card_target_label')}</Text>
                  <Text style={styles.goalStatValue}>{formatCurrency(target, currency, false)}</Text>
                </View>
              </View>
            </View>

            {/* Outcome panel */}
            <View style={[styles.goalOutcome, { backgroundColor: accent + '14', borderColor: accent + '33' }]}>
              <View style={[styles.goalOutcomeIcon, { backgroundColor: accent + '22' }]}>
                <MaterialCommunityIcons name={subIcon as any} size={16} color={accent} />
              </View>
              <Text style={[styles.goalOutcomeText, { color: status === 'complete' || status === 'overdue' ? accent : Colors.textPrimary }]} numberOfLines={2}>
                {status === 'complete' ? t('goal_card_complete_title') + ' — ' : ''}{subText}
              </Text>
            </View>
          </AnimatedCard>
        );
      }
    }

    // ──── A12: Time-of-day Heatmap ────
    // 7 gün × 4 zaman dilimi grid; her hücre o slot'taki harcama yoğunluğuna
    // göre opaklık alır. Peak hücre vurgulanır. Veriler `created_at` (yerel)
    // üzerinden gelir → footer'da "kayıt anına göre" disclaimer gösterilir.
    if (id === 'time_of_day') {
      if (!timeOfDayInfo.available) {
        content = (
          <AnimatedCard delay={170} style={styles.section}>
            <View style={styles.todHeader}>
              <View style={styles.todHeaderLeft}>
                <MaterialCommunityIcons name="clock-time-eight-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>{t('timeofday_title')}</Text>
              </View>
            </View>
            <View style={styles.todEmptyWrap}>
              <MaterialCommunityIcons name="clock-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.todEmptyTitle}>{t('timeofday_empty_title')}</Text>
              <Text style={styles.todEmptyHint}>{t('timeofday_empty_hint')}</Text>
            </View>
          </AnimatedCard>
        );
      } else {
        const { matrix, peakDow, peakSlot, peakValue } = timeOfDayInfo;
        // Pazartesi başlat: schema'da 0=Pazar; biz UI'da Pazartesi'den başlatıyoruz.
        const dowOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
        const dowLabelKeys = ['weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu', 'weekday_fri', 'weekday_sat', 'weekday_sun'];
        const slotKeys = ['timeofday_morning_short', 'timeofday_noon_short', 'timeofday_evening_short', 'timeofday_night_short'];
        const slotFullKeys = ['timeofday_morning', 'timeofday_noon', 'timeofday_evening', 'timeofday_night'];
        const peakDayLabel = t(dowLabelKeys[dowOrder.indexOf(peakDow)]);
        const peakSlotLabel = t(slotFullKeys[peakSlot]);

        content = (
          <AnimatedCard delay={170} style={styles.section}>
            <View style={styles.todHeader}>
              <View style={styles.todHeaderLeft}>
                <View style={[styles.todHeaderIcon, { backgroundColor: Colors.primary + '1F' }]}>
                  <MaterialCommunityIcons name="clock-time-eight-outline" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>{t('timeofday_title')}</Text>
              </View>
              {peakValue > 0 && (
                <View style={[styles.todPeakChip, { backgroundColor: Colors.primary + '14' }]}>
                  <MaterialCommunityIcons name="fire" size={11} color={Colors.primary} />
                  <Text style={styles.todPeakChipText}>{t('timeofday_peak_value', { day: peakDayLabel, slot: peakSlotLabel.toLowerCase() })}</Text>
                </View>
              )}
            </View>

            {/* Grid: ilk satır slot başlıkları, sonra her satır = bir gün */}
            <View style={styles.todGridWrap}>
              {/* Üst etiket satırı (slot'lar) */}
              <View style={styles.todGridHeader}>
                <View style={styles.todDayLabelCell} />
                {slotKeys.map((sk, i) => (
                  <View key={i} style={styles.todSlotHeaderCell}>
                    <Text style={styles.todSlotHeaderText}>{t(sk)}</Text>
                  </View>
                ))}
              </View>

              {/* Her gün için bir satır */}
              {dowOrder.map((dow, rowIdx) => (
                <View key={dow} style={styles.todGridRow}>
                  <View style={styles.todDayLabelCell}>
                    <Text style={styles.todDayLabelText}>{t(dowLabelKeys[rowIdx])}</Text>
                  </View>
                  {[0, 1, 2, 3].map((slot) => {
                    const value = matrix[dow][slot];
                    // Opaklık: ilgili hücrenin peak'a göre oranı (min 0.06 zemin)
                    const intensity = peakValue > 0 ? value / peakValue : 0;
                    const isPeak = dow === peakDow && slot === peakSlot && value > 0;
                    const opacity = value === 0 ? 0 : Math.max(0.18, intensity);
                    // Hex alfa: 0..255 → 2 hane. Peak'i her zaman tam opak ve border'lı çizeriz.
                    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
                    const bg = value === 0 ? Colors.surfaceLight : Colors.primary + alphaHex;
                    return (
                      <View
                        key={slot}
                        style={[
                          styles.todCell,
                          { backgroundColor: bg },
                          isPeak && styles.todCellPeak,
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>

            <Text style={styles.todDisclaimer}>{t('timeofday_disclaimer')}</Text>
          </AnimatedCard>
        );
      }
    }

    // ──── A13: Silent Spend ────
    // Küçük tutarlı ama tekrarlayan kalemler — tek tek bakınca masum, toplamı
    // şaşırtıcı. Hero rakamı + 5 kalem listesi (kategori avatarı, sayı, ortalama).
    if (id === 'silent_spend') {
      if (!silentSpendInfo.available) {
        content = (
          <AnimatedCard delay={220} style={styles.section}>
            <View style={styles.silentHeader}>
              <View style={styles.silentHeaderLeft}>
                <MaterialCommunityIcons name="water-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>{t('silent_card_title')}</Text>
              </View>
            </View>
            <View style={styles.silentEmptyWrap}>
              <MaterialCommunityIcons name="water-off-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.silentEmptyTitle}>{t('silent_card_empty_title')}</Text>
              <Text style={styles.silentEmptyHint}>{t('silent_card_empty_hint')}</Text>
            </View>
          </AnimatedCard>
        );
      } else {
        const { items, totalAmount, totalCount, distinctItems } = silentSpendInfo;
        content = (
          <AnimatedCard delay={220} style={styles.section}>
            <View style={styles.silentHeader}>
              <View style={styles.silentHeaderLeft}>
                <View style={[styles.silentHeaderIcon, { backgroundColor: Colors.warning + '1F' }]}>
                  <MaterialCommunityIcons name="water-outline" size={16} color={Colors.warning} />
                </View>
                <Text style={styles.sectionTitle}>{t('silent_card_title')}</Text>
              </View>
            </View>

            {/* Hero block */}
            <View style={styles.silentHeroBlock}>
              <Text style={styles.silentHeroLabel}>{t('silent_card_total_label')}</Text>
              <Text style={styles.silentHeroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {formatCurrency(totalAmount, currency)}
              </Text>
              <View style={styles.silentHeroMeta}>
                <Text style={styles.silentHeroMetaText}>{t('silent_card_count_label', { count: totalCount.toString() })}</Text>
                <View style={styles.silentHeroMetaDot} />
                <Text style={styles.silentHeroMetaText}>{t('silent_card_distinct', { count: distinctItems.toString() })}</Text>
              </View>
            </View>

            <Text style={styles.silentHint}>{t('silent_card_hint')}</Text>

            {/* Item list */}
            <View style={styles.silentList}>
              {items.map((it, i) => {
                const displayName = it.turkish_name || it.name;
                const catColor = it.category_color || Colors.warning;
                const icon = (it.category_icon as any) || 'water-outline';
                return (
                  <Animated.View key={it.normalized_key} entering={FadeInDown.delay(i * 50).duration(280)}>
                    <Pressable
                      onPress={() => setSelectedItemName(it.name)}
                      style={({ pressed }) => [styles.silentRow, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                    >
                      <View style={[styles.silentAvatar, { backgroundColor: catColor + '22' }]}>
                        <MaterialCommunityIcons name={icon} size={16} color={catColor} />
                      </View>
                      <View style={styles.silentRowMain}>
                        <Text style={styles.silentRowName} numberOfLines={1}>{displayName}</Text>
                        <View style={styles.silentRowMeta}>
                          <Text style={styles.silentRowTimes}>{t('silent_card_times', { count: it.purchase_count.toString() })}</Text>
                          <View style={styles.silentRowMetaDot} />
                          <Text style={styles.silentRowAvg}>{t('silent_card_avg', { amount: formatCurrency(it.avg_price, currency, false) })}</Text>
                        </View>
                      </View>
                      <Text style={styles.silentRowTotal}>{formatCurrency(it.total_spent, currency, false)}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </AnimatedCard>
        );
      }
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
              {!isEditing && <Text style={styles.dateRange}>{dateRange.label}</Text>}
            </View>
            <Pressable
              onPress={() => {
                if (isEditing) {
                  saveCardConfig(cardOrder, hiddenCards);
                }
                setIsEditing(!isEditing);
              }}
              style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]}
            >
              <MaterialCommunityIcons
                name={isEditing ? "check" : "view-dashboard-edit-outline"}
                size={20}
                color={isEditing ? Colors.background : Colors.textPrimary}
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
      visible={!!selectedItemName}
      itemName={selectedItemName || ''}
      onClose={() => setSelectedItemName(null)}
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
      dailyBudget={budget.dailyBudget}
      totalDays={streakData.totalDays}
      language={language}
      currency={currency}
      t={t}
    />
    <CustomDatePicker
      visible={showStartPicker}
      onClose={() => setShowStartPicker(false)}
      initialDate={customStart}
      onSelectDate={(d) => { setCustomStart(d); if (d > customEnd) setCustomEnd(d); }}
    />
    <CustomDatePicker
      visible={showEndPicker}
      onClose={() => setShowEndPicker(false)}
      initialDate={customEnd}
      onSelectDate={(d) => { setCustomEnd(d); if (d < customStart) setCustomStart(d); }}
    />
    </>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    ...Typography.headlineLarge,
    color: Colors.textPrimary,
  },
  dateRange: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.round,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.round,
  },
  tabActive: {
    backgroundColor: Colors.primary + '22', // translucent primary
  },
  tabText: {
    ...Typography.labelMedium,
    letterSpacing: 0,
    textAlign: 'center',
    width: '100%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  customDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  customDateText: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  editToggleBtn: {
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editToggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.cardBorder,
  },
  editSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  editSectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  editSectionTitle: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  editSectionCount: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  editCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xxxl + Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editRemoveBtn: {
    marginRight: -Spacing.xs,
  },
  editCardLabel: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  availableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  availableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  availableChipLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },
  editHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  trendTitle: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    paddingRight: Spacing.lg,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillInfo: {
    justifyContent: 'center',
  },
  pillName: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  pillAmount: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  donutCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  donutCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotal: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  donutLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  donutSub: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  donutAnalysisContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutAnalysisText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    lineHeight: 22,
  },
  donutAnalysisHint: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // Top Transactions
  topTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  topTxRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTxRankText: {
    ...Typography.labelSmall,
    fontFamily: FontFamily.bold,
    color: Colors.textSecondary,
  },
  topTxCatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTxContent: {
    flex: 1,
  },
  topTxVendor: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  topTxDate: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  topTxAmount: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.bold,
  },
  topTxScroll: {
    maxHeight: 180,
  },
  // Vendor rows
  vendorsScroll: {
    maxHeight: 420,
  },
  vendorItemsScroll: {
    maxHeight: 220,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.success,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 2,
  },
  newBadgeText: {
    fontSize: 8,
    fontFamily: FontFamily.bold,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  vendorRowActive: {
    backgroundColor: Colors.surfaceLight,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    // Pressable + Android: borderRadius tek başına bazen kare zemin çizer;
    // overflow: 'hidden' ile arka plan köşeleri kart estetiğiyle uyumlu kırpılır.
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  vendorRowActiveNoDivider: {
    borderBottomWidth: 0,
  },
  vendorInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  vendorName: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
  },
  vendorBar: {
    height: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  vendorBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  vendorAmountCol: {
    alignItems: 'flex-end',
  },
  vendorAmount: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  vendorPercent: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  // Micro-analysis — no left margin so donut/legend fills full width
  microAnalysis: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight + '40',
  },
  microTitle: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  microItem: {
    paddingVertical: Spacing.sm,
  },
  microItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  microItemMain: {
    flex: 1,
    gap: 4,
  },
  microItemPrimary: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  microItemSecondary: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  microItemPriceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  microItemAmount: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  microItemDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    opacity: 0.5,
    marginTop: Spacing.sm,
    marginLeft: 2,
  },
  // Vendor Donut Chart — full-width redesign
  vendorDonutSection: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  vendorDonutCenter: {
    alignItems: 'center',
    gap: 2,
    maxWidth: 120,
  },
  vendorDonutCenterPressed: {
    opacity: 0.88,
  },
  vendorDonutTotal: {
    ...Typography.headlineMedium,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  vendorDonutPct: {
    fontSize: 22,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  vendorDonutLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  vendorDonutSub: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  // 2-column legend grid
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.md,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '47%',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: Colors.surfaceLight,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  legendPct: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.semiBold,
    flexShrink: 0,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  expandButtonText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.medium,
  },
  primaryCard: {
    borderColor: Colors.cardBorder,
    borderWidth: 1,
  },
  // ── A1: Monthly Comparison ──
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  compareBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  compareDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },
  compareLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  compareValue: {
    ...Typography.headlineSmall,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    fontSize: 18,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
  },
  deltaText: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.semiBold,
  },
  deltaHint: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  compareBars: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  compareBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compareBarLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    width: 70,
  },
  compareBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compareBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // ── A2: Budget Summary ──
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  budgetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetPctBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  budgetPctText: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
  },
  budgetAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  budgetSmLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  budgetAmountVal: {
    ...Typography.headlineSmall,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    fontSize: 18,
  },
  budgetBarTrack: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  budgetBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  budgetStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  budgetStatLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  budgetStatVal: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  emptyBudget: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyBudgetTitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },
  emptyBudgetHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  // ── A6: Price Watch (kompakt grid) ──
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  priceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  priceHeaderStats: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  priceStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surfaceLight,
  },
  priceStatChipText: {
    ...Typography.labelSmall,
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  priceTile: {
    // 2 sütun (gap: Spacing.sm) — küçük ekranlarda % hesabı kırpılmaz.
    width: '48.5%',
  },
  priceTileInner: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    minHeight: 88,
  },
  priceTileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    alignSelf: 'flex-start',
  },
  priceTilePct: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
  },
  priceTileName: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  priceTileSub: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
  },
  priceTileArrow: {
    color: Colors.textMuted,
  },
  priceHint: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  // ── A7: Streak ──
  streakGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  streakCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakCardPressed: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.cardBorder,
    transform: [{ scale: 0.98 }],
  },
  streakIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNumber: {
    ...Typography.headlineMedium,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    fontSize: 24,
  },
  streakLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  streakMsg: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    gap: Spacing.xxl,
  },
  streakMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
    minWidth: 0,
  },
  streakMsgIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakMsgText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
    letterSpacing: 0.5,
    color: Colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  streakMsgSubWrap: {
    flexShrink: 0,
    paddingLeft: Spacing.md,
  },
  streakMsgSub: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },

  // ── A8: Month-end Projection ──
  projHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  projHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  projHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projDaysChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  projDaysChipText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
  },
  projHeroLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  projHeroValue: {
    fontSize: 36,
    lineHeight: 42,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  projPaceHint: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  projTrackWrap: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  projTrack: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  projTrackCurrent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  projTrackProjected: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  projTrackBudgetMarker: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
  },
  projTrackLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  projLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  projLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  projLegendDotBudget: {
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: Colors.textPrimary,
  },
  projLegendText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 11,
  },
  projOutcomePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  projOutcomeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projOutcomeTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  projOutcomeTitle: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
  projOutcomeSub: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
  projPaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  projPaceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projPaceLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },
  projPaceValue: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  projEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  projEmptyText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // ── A9: Active Subscriptions ──
  subsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  subsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  subsHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subsCountBadge: {
    minWidth: 26,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
  },
  subsCountText: {
    ...Typography.labelSmall,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    fontSize: 11,
  },
  subsHeroBlock: {
    marginBottom: Spacing.lg,
  },
  subsHeroLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  subsHeroValue: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subsUpcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  subsUpcomingLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 10,
  },
  subsDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  subsList: {
    gap: 4,
  },
  subsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  subsAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subsRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  subsRowName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  subsRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  subsRowDays: {
    ...Typography.labelSmall,
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
  subsRowAmount: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  subsEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  subsEmptyTitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  subsEmptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  // ── A10: Category Limits Health ──
  limitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  limitsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  limitsHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitsHeaderStats: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  limitsStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  limitsStatChipText: {
    ...Typography.labelSmall,
    fontFamily: FontFamily.extraBold,
    fontSize: 11,
  },
  limitsList: {
    gap: Spacing.md,
  },
  limitRow: {
    gap: 6,
  },
  limitRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  limitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    flex: 1,
    minWidth: 0,
  },
  limitPct: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
    fontSize: 13,
  },
  limitTrack: {
    height: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  limitTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  limitRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitAmounts: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  limitSpent: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  limitDiv: {
    color: Colors.textMuted,
  },
  limitMax: {
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
  },
  limitRemaining: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
  limitsEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  limitsEmptyTitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  limitsEmptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  // ── A11: Savings Goal ──
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  goalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  goalHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  goalDateChipText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
  },
  goalTitle: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
    marginBottom: Spacing.md,
  },
  goalBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  goalDonutWrap: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalDonutCenter: {
    alignItems: 'center',
    gap: 2,
  },
  goalDonutPct: {
    fontSize: 26,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  goalDonutLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  goalStats: {
    flex: 1,
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  goalStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  goalStatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  goalStatLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  goalStatValue: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  goalOutcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  goalOutcomeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalOutcomeText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    flex: 1,
    lineHeight: 18,
  },
  goalEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  goalEmptyTitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  goalEmptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  // ── A12: Time-of-day Heatmap ──
  todHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  todHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  todHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todPeakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  todPeakChipText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
  },
  todGridWrap: {
    gap: 4,
    marginBottom: Spacing.md,
  },
  todGridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todDayLabelCell: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  todDayLabelText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
  todSlotHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  todSlotHeaderText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
    fontSize: 10,
  },
  todCell: {
    flex: 1,
    height: 26,
    borderRadius: 6,
  },
  todCellPeak: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  todDisclaimer: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
  },
  todEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  todEmptyTitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  todEmptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  // ── A13: Silent Spend ──
  silentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  silentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  silentHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silentHeroBlock: {
    marginBottom: Spacing.sm,
  },
  silentHeroLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  silentHeroValue: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  silentHeroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  silentHeroMetaText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },
  silentHeroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  silentHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    lineHeight: 18,
  },
  silentList: {
    gap: 2,
  },
  silentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  silentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silentRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  silentRowName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  silentRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  silentRowTimes: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
  silentRowMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  silentRowAvg: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 11,
  },
  silentRowTotal: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  silentEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  silentEmptyTitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.xs,
  },
  silentEmptyHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});
