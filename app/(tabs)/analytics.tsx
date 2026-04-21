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
import { getStartOfMonth, getEndOfMonth, formatMonthYear } from '../../src/utils/dateUtils';

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
  { id: 'monthly_compare', icon: 'swap-horizontal',    labelKey: 'card_monthly_compare' },
  { id: 'budget',          icon: 'wallet-outline',     labelKey: 'card_budget' },
  { id: 'categories',      icon: 'shape-outline',      labelKey: 'card_categories' },
  { id: 'streak',          icon: 'fire',               labelKey: 'card_streak' },
  { id: 'donut',           icon: 'chart-donut',        labelKey: 'card_donut' },
  { id: 'heatmap',         icon: 'calendar-month',     labelKey: 'card_heatmap' },
  { id: 'top_tx',          icon: 'podium-gold',        labelKey: 'card_top_tx' },
  { id: 'price_watch',     icon: 'tag-arrow-up',       labelKey: 'card_price_watch' },
  { id: 'vendors',         icon: 'store-outline',      labelKey: 'card_vendors' },
];

const DEFAULT_ACTIVE = ['chart', 'monthly_compare', 'budget', 'categories', 'vendors'];

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
  const [selectedDonutIdx, setSelectedDonutIdx] = useState<number | null>(null);
  const [selectedNWIdx, setSelectedNWIdx] = useState<number | null>(null);
  const [selectedWWIdx, setSelectedWWIdx] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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
      return { zeroSpendDays: 0, currentStreak: 0, underBudgetDays: 0, totalDays: 0 };
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

    const zeroSpendDays = days.reduce((n, d) => n + (d.total === 0 ? 1 : 0), 0);

    // Güncel seri: bugünden geriye, art arda kaç sıfır harcama günü?
    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].date > todayStr) continue;
      if (days[i].total === 0) currentStreak++;
      else break;
    }

    const dailyBudgetTarget = budget.dailyBudget > 0 ? budget.dailyBudget : 0;
    const underBudgetDays =
      dailyBudgetTarget > 0
        ? days.reduce(
            (n, d) => n + (d.total > 0 && d.total <= dailyBudgetTarget ? 1 : 0),
            0
          )
        : 0;

    const totalDays = days.length;

    return { zeroSpendDays, currentStreak, underBudgetDays, totalDays };
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshCats(), refreshVendors(), refreshDaily(),
      refreshTop(), refreshSubcats(), refreshBehavior(),
      refreshBudget(), loadPrevTotal(), loadPriceChanges(),
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
          setCardOrder(parsed.active);
          setHiddenCards(parsed.hidden || []);
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
          <Text style={styles.sectionTitle}>{selectedCategory && subcats.length > 0 ? t('subcategories') : t('vendors_stores')}</Text>
          {/*
            Layout transition süresi, micro-analysis'in çıkış süresi (240ms) ile
            uyumlu tutuluyor — aksi halde panel kaybolurken alttaki satırlar
            kendi yerlerine yavaş oturuyor ve geçiş "bir tık sert" hissettiriyor.
          */}
          <Animated.View layout={LinearTransition.duration(320)}>
          {selectedCategory && subcats.length > 0 ? (
            subcats.length > 4 ? (
              <ScrollView style={styles.vendorsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {subcats.map((sc, i) => (
                  <Animated.View key={sc.category_id} entering={FadeInDown.delay(i * 60).duration(400)}>
                    <View style={[styles.vendorRow, { borderBottomWidth: 0, paddingBottom: Spacing.sm }]}>
                      <View style={[styles.pillIcon, { backgroundColor: sc.category_color, width: 44, height: 44, borderRadius: 22 }]}><MaterialCommunityIcons name={sc.category_icon as any} size={22} color="#FFF" /></View>
                      <View style={styles.vendorInfo}>
                        <Text style={styles.vendorName}>{tc(sc.category_name)}</Text>
                        <View style={styles.vendorBar}><View style={[styles.vendorBarFill, { width: `${Math.max(2, sc.percentage)}%`, backgroundColor: sc.category_color }]} /></View>
                      </View>
                      <View style={styles.vendorAmountCol}>
                        <Text style={styles.vendorAmount}>{formatCurrency(sc.total, currency)}</Text>
                        <Text style={styles.vendorPercent}>{sc.percentage}%</Text>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </ScrollView>
            ) : (
              subcats.map((sc, i) => (
                <Animated.View key={sc.category_id} entering={FadeInDown.delay(i * 60).duration(400)}>
                  <View style={[styles.vendorRow, { borderBottomWidth: 0, paddingBottom: Spacing.sm }]}>
                    <View style={[styles.pillIcon, { backgroundColor: sc.category_color, width: 44, height: 44, borderRadius: 22 }]}><MaterialCommunityIcons name={sc.category_icon as any} size={22} color="#FFF" /></View>
                    <View style={styles.vendorInfo}>
                      <Text style={styles.vendorName}>{tc(sc.category_name)}</Text>
                      <View style={styles.vendorBar}><View style={[styles.vendorBarFill, { width: `${Math.max(2, sc.percentage)}%`, backgroundColor: sc.category_color }]} /></View>
                    </View>
                    <View style={styles.vendorAmountCol}>
                      <Text style={styles.vendorAmount}>{formatCurrency(sc.total, currency)}</Text>
                      <Text style={styles.vendorPercent}>{sc.percentage}%</Text>
                    </View>
                  </View>
                </Animated.View>
              ))
            )
          ) : (
            (() => {
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
                <Pressable onPress={() => handleVendorPress(v.vendor_id)} style={[styles.vendorRow, selectedVendor === v.vendor_id && styles.vendorRowActive]}>
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
            })()
          )}
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
    if (id === 'price_watch') {
      if (priceChanges.length === 0) return null;
      content = (
        <AnimatedCard delay={380} style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
            <MaterialCommunityIcons name="tag-multiple-outline" size={18} color={Colors.warning} />
            <Text style={styles.sectionTitle}>{t('price_watch')}</Text>
          </View>
          {priceChanges.map((pc, i) => {
            const isUp = pc.changePct > 0;
            const displayName = pc.turkishName || pc.name;
            return (
              <Animated.View key={i} entering={FadeInDown.delay(i * 60).duration(300)}>
                <View style={styles.priceRow}>
                  <View style={styles.priceInfo}>
                    <Text style={styles.priceName} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.priceSub}>
                      {formatCurrency(pc.firstPrice, currency, false)} → {formatCurrency(pc.lastPrice, currency, false)}
                    </Text>
                  </View>
                  <View style={[styles.priceBadge, { backgroundColor: isUp ? Colors.danger + '15' : Colors.success + '15' }]}>
                    <MaterialCommunityIcons
                      name={isUp ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={isUp ? Colors.danger : Colors.success}
                    />
                    <Text style={[styles.pricePct, { color: isUp ? Colors.danger : Colors.success }]}>
                      {isUp ? '+' : ''}{pc.changePct}%
                    </Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
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
            <View style={styles.streakCard}>
              <View style={[styles.streakIconBg, { backgroundColor: Colors.success + '18' }]}>
                <MaterialCommunityIcons name="calendar-check" size={22} color={Colors.success} />
              </View>
              <CountUpText value={zeroSpendDays} style={styles.streakNumber} duration={900} />
              <Text style={styles.streakLabel}>{t('zero_spend_days')}</Text>
            </View>
            <View style={styles.streakCard}>
              <View style={[styles.streakIconBg, { backgroundColor: Colors.warning + '18' }]}>
                <MaterialCommunityIcons name="fire" size={22} color={Colors.warning} />
              </View>
              <CountUpText value={currentStreak} style={styles.streakNumber} duration={900} />
              <Text style={styles.streakLabel}>{t('current_streak')}</Text>
            </View>
            {budget.dailyBudget > 0 && (
              <View style={styles.streakCard}>
                <View style={[styles.streakIconBg, { backgroundColor: Colors.primary + '18' }]}>
                  <MaterialCommunityIcons name="shield-check" size={22} color={Colors.primary} />
                </View>
                <CountUpText value={underBudgetDays} style={styles.streakNumber} duration={900} />
                <Text style={styles.streakLabel}>{t('under_budget_days')}</Text>
              </View>
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
                        <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit={true}>
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
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.round,
  },
  tabActive: {
    backgroundColor: Colors.primary + '22', // translucent primary
  },
  tabText: {
    ...Typography.labelMedium,
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
    borderRadius: BorderRadius.md,
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
  // ── A6: Price Watch ──
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  priceInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  priceName: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
  },
  priceSub: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: 2,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  pricePct: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
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
});
