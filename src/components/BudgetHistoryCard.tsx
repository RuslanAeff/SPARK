// S.P.A.R.K. — Budget History Card (Compact Horizontal Design)
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDayMonth, getToday } from '../utils/dateUtils';
import { BudgetDao } from '../db/budgetDao';
import { ExpenseDao } from '../db/expenseDao';
import { Budget } from '../db/schema';
import { getCycleStartDay } from '../services/budgetCycleSettings';
import {
  getCurrentCycle,
  getCycleForKey,
  getCycleForYmd,
  budgetCycleFromBounds,
  BudgetCycle,
} from '../utils/budgetCycle';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useRefresh } from '../context/RefreshContext';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';

interface CycleEntry {
  key: string;        // YYYY-MM (döngünün başladığı ay)
  renderKey: string;  // Aynı ayda birden fazla geçiş olsa da React kimliği benzersizdir.
  cycle: BudgetCycle;
  budget: Budget | null;
  spent: number;
  isCurrent: boolean;
}

export default function BudgetHistoryCard() {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { refreshKey } = useRefresh();
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [anchor, setAnchor] = useState(1);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const formatMonth = useCallback((month: string): string => {
    const [y, m] = month.split('-');
    const padded = m.padStart(2, '0');
    return `${t(`month_short_${padded}`)} ${y}`;
  }, [t]);

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function load() {
    setLoading(true);
    try {
      const anchorDay = await getCycleStartDay();
      const spendingMonths = await ExpenseDao.getMonthsWithSpending();
      const budgets = await BudgetDao.getAllBudgets();

      const current = getCurrentCycle(anchorDay);
      const today = getToday();
      // Android / expo-sqlite: aynı DB üzerinde çok sayıda eşzamanlı sorgu prepareAsync
      // hatasına (NativeStatement / released object) yol açabiliyor — sırayla yükle.
      const withData: CycleEntry[] = [];
      const representedPeriods = new Set<string>();
      for (const budget of budgets) {
        const key = budget.period_start ?? budget.start_date.slice(0, 7);
        const cycle = budget?.period_start && budget.period_end
          ? budgetCycleFromBounds(
              budget.period_start,
              budget.period_end,
              budget.cycle_start_day ?? anchorDay,
            )
          : getCycleForKey(anchorDay, key);
        const spent = await ExpenseDao.getTotalByDateRange(cycle.start, cycle.end);
        const periodKey = `${cycle.start}:${cycle.end}`;
        // Eski sürümlerde aynı ay için birden fazla active bütçe kalmış olabilir.
        // En yeni DAO satırını göster, aynı fiziksel dönemi ikinci kez üretme.
        if (representedPeriods.has(periodKey)) continue;
        representedPeriods.add(periodKey);
        withData.push({
          key,
          renderKey: `budget:${periodKey}:${budget.id}`,
          cycle,
          budget,
          spent,
          isCurrent: cycle.start <= today && cycle.end >= today,
        });
      }

      // Bütçesiz harcama aylarını yalnız mevcut dondurulmuş dönemlerden hiçbirine
      // düşmüyorsa ekle; aynı ay içinde yapılan bir kural değişimi iki kaydı ezmez.
      for (const ym of spendingMonths) {
        const [y, m] = ym.split('-').map(Number);
        const cycle = getCycleForYmd(anchorDay, y, m - 1, 15);
        if (withData.some((entry) => entry.cycle.start <= cycle.start && entry.cycle.end >= cycle.start)) {
          continue;
        }
        const spent = await ExpenseDao.getTotalByDateRange(cycle.start, cycle.end);
        withData.push({
          key: cycle.key,
          renderKey: `spending:${cycle.start}:${cycle.end}`,
          cycle,
          budget: null,
          spent,
          isCurrent: cycle.start <= today && cycle.end >= today,
        });
      }
      if (!withData.some((entry) => entry.isCurrent)) {
        const spent = await ExpenseDao.getTotalByDateRange(current.start, current.end);
        withData.push({
          key: current.key,
          renderKey: `current:${current.start}:${current.end}`,
          cycle: current,
          budget: null,
          spent,
          isCurrent: true,
        });
      }
      withData.sort((a, b) => b.cycle.start.localeCompare(a.cycle.start));

      if (mountedRef.current) {
        setAnchor(anchorDay);
        setEntries(withData);
      }
    } catch (e) {
      console.error('BudgetHistory load error:', e);
    }
    if (mountedRef.current) setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="calendar-blank" size={28} color={Colors.textMuted} />
        <Text style={styles.emptyText}>{t('no_records_yet')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={150}
        decelerationRate="fast"
      >
        {entries.map((entry) => {
          const { key, renderKey, cycle, budget, spent, isCurrent } = entry;
          const hasBudget = budget !== null;
          const pct = hasBudget && budget!.monthly_amount > 0
            ? Math.min((spent / budget!.monthly_amount) * 100, 100)
            : 0;
          const overBudget = hasBudget && spent > budget!.monthly_amount;
          const remaining = hasBudget ? budget!.monthly_amount - spent : null;
          const barColor = overBudget ? Colors.danger : pct > 80 ? Colors.warning : Colors.primary;
          // anchor=1 → ay adı; aksi halde döngü tarih aralığı.
          const label = cycle.startDay === 1
            ? formatMonth(key)
            : `${formatDayMonth(cycle.start, t)}–${formatDayMonth(cycle.end, t)}`;

          return (
            <View key={renderKey} style={[styles.card, isCurrent && styles.cardCurrent]}>
              {/* Header */}
              <View style={styles.cardHeader}>
                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <View style={styles.currentDot} />
                    <Text style={styles.currentText}>{t('current_month')}</Text>
                  </View>
                ) : (
                  <Text style={styles.monthLabel}>{label}</Text>
                )}
                <MaterialCommunityIcons 
                  name={overBudget ? "alert-circle" : (pct > 80 ? "alert" : "check-circle")} 
                  size={14} 
                  color={barColor} 
                />
              </View>

              {/* Amounts */}
              <View style={styles.amountArea}>
                <Text style={styles.spentLabel}>{t('spent_label')}</Text>
                <Text style={styles.spentAmount}>{formatCurrency(spent, currency, false)}</Text>
                {hasBudget && (
                  <Text style={styles.budgetAmount}>/ {formatCurrency(budget!.monthly_amount, currency, false)}</Text>
                )}
              </View>

              {/* Progress & Remaining */}
              {hasBudget ? (
                <View style={styles.footerArea}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.remainingText, { color: barColor }]}>
                    {overBudget 
                      ? `+${formatCurrency(Math.abs(remaining!), currency, false)} ${t('over_budget_exceeded')}`
                      : `${formatCurrency(remaining!, currency, false)} ${t('budget_left')}`}
                  </Text>
                </View>
              ) : (
                <View style={styles.noBudgetArea}>
                  <View style={styles.noBudgetTrack} />
                  <Text style={styles.noBudgetNote}>{t('no_budget_set')}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  container: {},
  scrollContent: {
    paddingBottom: Spacing.xs,
  },
  card: {
    width: 150,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.divider,
  },
  cardCurrent: {
    borderTopColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  monthLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  currentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  currentText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  amountArea: {
    gap: 2,
    marginBottom: Spacing.md,
  },
  spentLabel: {
    ...Typography.labelSmall,
    fontSize: 9,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  spentAmount: {
    ...Typography.headlineMedium,
    fontSize: 18,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  budgetAmount: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
  },
  footerArea: {
    gap: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  remainingText: {
    ...Typography.labelSmall,
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
  },
  noBudgetArea: {
    gap: 6,
  },
  noBudgetTrack: {
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
  },
  noBudgetNote: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});
