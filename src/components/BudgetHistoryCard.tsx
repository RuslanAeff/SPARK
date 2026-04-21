// S.P.A.R.K. — Budget History Card (Compact Horizontal Design)
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { BudgetDao } from '../db/budgetDao';
import { ExpenseDao } from '../db/expenseDao';
import { Budget } from '../db/schema';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useRefresh } from '../context/RefreshContext';
import { useAppTheme } from '../theme/themeStore';

interface MonthEntry {
  month: string;   // YYYY-MM
  budget: Budget | null;
  spent: number;
}

export default function BudgetHistoryCard() {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { refreshKey } = useRefresh();
  const [entries, setEntries] = useState<MonthEntry[]>([]);
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
      const spendingMonths = await ExpenseDao.getMonthsWithSpending();
      const budgets = await BudgetDao.getAllBudgets();
      
      const budgetMap = new Map<string, Budget>();
      budgets.forEach(b => {
        const normalized = b.start_date.substring(0, 7);
        if (!budgetMap.has(normalized) || budgetMap.get(normalized)!.id < b.id) {
          budgetMap.set(normalized, b);
        }
      });

      const allMonths = [...new Set([
        ...spendingMonths,
        ...Array.from(budgetMap.keys()),
      ])].sort((a, b) => b.localeCompare(a));

      // Android / expo-sqlite: aynı DB üzerinde çok sayıda eşzamanlı sorgu prepareAsync
      // hatasına (NativeStatement / released object) yol açabiliyor — sırayla yükle.
      const withData: MonthEntry[] = [];
      for (const month of allMonths) {
        const spent = await ExpenseDao.getSpendingByMonth(month);
        withData.push({
          month,
          budget: budgetMap.get(month) ?? null,
          spent,
        });
      }

      if (mountedRef.current) setEntries(withData);
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
        snapToInterval={150 + Spacing.sm} // card width + gap
        decelerationRate="fast"
      >
        {entries.map((entry) => {
          const { month, budget, spent } = entry;
          const hasBudget = budget !== null;
          const pct = hasBudget && budget!.monthly_amount > 0
            ? Math.min((spent / budget!.monthly_amount) * 100, 100)
            : 0;
          const overBudget = hasBudget && spent > budget!.monthly_amount;
          const remaining = hasBudget ? budget!.monthly_amount - spent : null;
          const barColor = overBudget ? Colors.danger : pct > 80 ? Colors.warning : Colors.primary;
          const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

          return (
            <View key={month} style={[styles.card, isCurrentMonth && styles.cardCurrent]}>
              {/* Header */}
              <View style={styles.cardHeader}>
                {isCurrentMonth ? (
                  <View style={styles.currentBadge}>
                    <View style={styles.currentDot} />
                    <Text style={styles.currentText}>{t('current_month')}</Text>
                  </View>
                ) : (
                  <Text style={styles.monthLabel}>{formatMonth(month)}</Text>
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
  container: { 
    marginHorizontal: -Spacing.md, // Break out of parent padding
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  card: {
    width: 150,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  cardCurrent: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primaryGlow,
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
