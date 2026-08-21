// S.P.A.R.K. — Analytics paylaşımlı tipler ve küçük yardımcılar
// Faz 0: analytics.tsx'ten çıkarıldı; kart bileşenleri buradan import eder.
import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated as RNAnimated } from 'react-native';
import type { AnalyticsStyles } from './analyticsStyles';
import type { DisplayCurrency } from '../../context/CurrencyContext';
import type { SubscriptionAnalyticsInfo } from '../../utils/subscriptionAnalytics';
import type { SpendingStatsResult } from '../../utils/spendingStats';

export type Timeframe = 'week' | 'month' | 'year' | 'custom';

/** Abonelik kartı özeti (parent `subscriptionInfo` memo'sundan gelir). */
export type SubscriptionInfo = SubscriptionAnalyticsInfo;

/** Gün/zaman dilimi ısı haritası özeti (ayrımcı union — veri yoksa available:false). */
export type TimeOfDayInfo =
  | { available: false }
  | {
      available: true;
      matrix: number[][];
      peakDow: number;
      peakSlot: number;
      peakValue: number;
      total: number;
    };

export interface SilentSpendItem {
  name: string;
  turkish_name: string | null;
  purchase_count: number;
  total_spent: number;
  avg_price: number;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  normalized_key: string;
}

/** Sessiz harcama özeti (ayrımcı union — veri yoksa available:false). */
export type SilentSpendInfo =
  | { available: false }
  | {
      available: true;
      items: SilentSpendItem[];
      totalAmount: number;
      totalCount: number;
      distinctItems: number;
    };

/** Ay sonu projeksiyonu özeti (ayrımcı union). */
export type ProjectionInfo =
  | { available: false; reason: 'only_month' | 'too_early' }
  | {
      available: true;
      projected: number;
      currentSpent: number;
      dailyPace: number;
      naiveDailyPace: number;
      daysLeft: number;
      /** Borç nakit akışıyla düzeltilmiş döngü bütçesi (Dashboard ile aynı taban). */
      effectiveBudget: number;
      status: 'safe' | 'warn' | 'over' | 'no_budget';
      deltaPct: number | null;
      hasOutlier: boolean;
      /** Döngü aralığı etiketi ("23 Haz – 22 Tem"); anchor=1 ise null. */
      periodLabel: string | null;
      /** anchor≠1 → metinler "ay sonu" yerine "dönem sonu" der. */
      isCycle: boolean;
    };

export interface CategoryLimitItem {
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  limit: number;
  spent: number;
}

/** Kategori limit sağlığı özeti. */
export interface LimitsHealthInfo {
  count: number;
  overCount: number;
  warnCount: number;
  safeCount: number;
  items: CategoryLimitItem[];
}

/** Birikim hedefi özeti (ayrımcı union). */
export type GoalInfo =
  | { available: false }
  | {
      available: true;
      title: string;
      target: number;
      current: number;
      remaining: number;
      ratio: number;
      pctNum: number;
      daysToTarget: number;
      monthlyNeed: number;
      status: 'complete' | 'overdue' | 'on_track' | 'tight';
    };

/** DonutChart segmenti ({value,label,color}) — nwSegments/wwSegments için. */
export interface DonutSegment {
  value: number;
  label: string;
  color: string;
}

/** Davranışsal analiz segmenti (needs/wants, week/weekend donut'ları). */
export interface BehaviorSegment {
  segment: string;
  total: number;
  percentage: number;
  color: string;
}

export type StreakVariant = 'zero' | 'streak' | 'under';

/** Harcama serisi özeti (saf ve doğrudan test edilen domain sonucu). */
export type StreakData = SpendingStatsResult;

/**
 * Tüm analiz kartlarının paylaştığı temel prop'lar. Parent bunları tek seferde
 * memoize edip her karta geçer (P11: styles/t/tc/currency referansları stabil
 * olduğundan React.memo gerçekten devreye girer). Kartlar bu arayüzü `extends`
 * eder ve yalnızca kullandıkları alanları destructure eder.
 */
export interface BaseCardProps {
  styles: AnalyticsStyles;
  t: (key: string, params?: Record<string, string | number>) => string;
  tc: (categoryName: string) => string;
  currency: DisplayCurrency;
}

export interface PriceChange {
  name: string;
  turkishName: string | null;
  firstPrice: number;
  lastPrice: number;
  changePct: number;
  purchaseCount: number;
  measurementUnit: import('../../utils/measurementUnit').MeasurementUnit;
}

/** Sayıyı 0'dan hedefe animasyonlu çıkaran küçük metin bileşeni (JS thread timing). */
export function CountUpText({ value, style, prefix = '', suffix = '', duration = 800 }: {
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
