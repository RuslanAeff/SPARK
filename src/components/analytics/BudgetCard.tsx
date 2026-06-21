// S.P.A.R.K. — Analiz kartı: Bütçe özeti (harcanan/kalan + günlük tempo)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BudgetInfo } from '../../hooks/useBudget';
import { CountUpText, type BaseCardProps } from './shared';

interface BudgetCardProps extends BaseCardProps {
  budget: BudgetInfo;
}

function BudgetCard({ styles, t, currency, budget }: BudgetCardProps) {
  const pct = budget.percentage;
  const barColor = budget.isOverBudget ? Colors.danger : pct > 80 ? Colors.warning : Colors.primary;

  if (budget.monthlyBudget > 0) {
    return (
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
    );
  }

  return (
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

export default React.memo(BudgetCard);
