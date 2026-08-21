// S.P.A.R.K. — Budget Card Widget
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDayMonth } from '../utils/dateUtils';
import { BudgetInfo } from '../hooks/useBudget';
import AnimatedCard from './AnimatedCard';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';

interface BudgetCardProps {
  budget: BudgetInfo;
}

function BudgetCard({ budget }: BudgetCardProps) {
  // React.memo + üst sekme yeniden çizilmeyince tema takılı kalmasın + Android'de
  // OS ve uygulama içi tema için merkezi store.
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = React.useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const percentage = Math.round(budget.percentage);
  const barWidth = Math.min(percentage, 100);
  const isWarning = percentage > 80 && !budget.isOverBudget;
  
  const barColor = budget.isOverBudget ? Colors.danger : 
    isWarning ? Colors.warning : Colors.primary;

  return (
    <AnimatedCard delay={200} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: barColor + '22' }]}>
            <MaterialCommunityIcons
              name={budget.isOverBudget ? 'alert' : isWarning ? 'alert-circle-outline' : 'wallet-outline'}
              size={20}
              color={barColor}
            />
          </View>
          <View style={styles.titleTextCol}>
            <Text style={styles.title}>{t('budget_monthly')}</Text>
            {budget.cycleStartDay !== 1 && budget.periodStart ? (
              <Text style={styles.cycleRange}>
                {formatDayMonth(budget.periodStart, t)} – {formatDayMonth(budget.periodEnd, t)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.percentageBadge, { backgroundColor: barColor + '22' }]}>
          <Text style={[styles.percentageText, { color: barColor }]}>%{percentage}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View>
          <Text style={styles.label}>{t('spent_label')}</Text>
          <Text style={[styles.value, budget.isOverBudget && { color: Colors.danger }]}>
            {formatCurrency(budget.totalSpent, currency)}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.label}>{t('remaining_label')}</Text>
          <Text style={[styles.value, { color: budget.isOverBudget ? Colors.danger : Colors.textPrimary }]}>
            {formatCurrency(Math.abs(budget.remaining), currency)}
          </Text>
        </View>
      </View>

      {/* Progress bar container */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${barWidth}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      </View>

      {/* Borç etkisi (nakit-akışı) — bu döngüde borç alındıysa +, ödendiyse −.
          effectiveBudget'in plan bütçesinden neden farklı olduğunu açıklar. */}
      {(budget.borrowedIn > 0 || budget.repaidIn > 0) ? (
        <View style={styles.debtImpactRow}>
          <MaterialCommunityIcons name="swap-horizontal" size={14} color={Colors.textSecondary} />
          <Text style={styles.debtImpactLabel}>{t('debt_impact_label')}</Text>
          <View style={styles.debtImpactValues}>
            {budget.borrowedIn > 0 ? (
              <Text style={[styles.debtImpactValue, { color: Colors.danger }]}>
                +{formatCurrency(budget.borrowedIn, currency, false)}
              </Text>
            ) : null}
            {budget.repaidIn > 0 ? (
              <Text style={[styles.debtImpactValue, { color: Colors.success }]}>
                −{formatCurrency(budget.repaidIn, currency, false)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Ek gelir — bütçe planı dışında gelen, harcanabilir tutarı artıran nakit
          (banka bonusu, hediye). Borç değildir: geri ödenmez, açık borç rozetine
          girmez ve yalnız düştüğü döngüde görünür. */}
      {budget.extraIncomeIn > 0 ? (
        <View style={styles.debtImpactRow}>
          <MaterialCommunityIcons name="cash-plus" size={14} color={Colors.textSecondary} />
          <Text style={styles.debtImpactLabel}>{t('income_impact_label')}</Text>
          <View style={styles.debtImpactValues}>
            <Text style={[styles.debtImpactValue, { color: Colors.success }]}>
              +{formatCurrency(budget.extraIncomeIn, currency, false)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.stat}>
          <View style={styles.statIconRow}>
            <MaterialCommunityIcons name="calendar-today" size={14} color={Colors.textSecondary} />
            <Text style={styles.statLabel}>{t('daily_average')}</Text>
          </View>
          <Text style={styles.statValue}>
            {formatCurrency(budget.dailyAverage, currency, false)}
          </Text>
        </View>
        <View style={[styles.stat, styles.right]}>
          <View style={styles.statIconRow}>
            <MaterialCommunityIcons name="target" size={14} color={Colors.textSecondary} />
            <Text style={styles.statLabel}>{t('daily_target')}</Text>
          </View>
          <Text style={[styles.statValue, { color: budget.isOverBudget ? Colors.danger : Colors.textPrimary }]}>
            {formatCurrency(budget.dailyBudget, currency, false)}
          </Text>
        </View>
      </View>
    </AnimatedCard>
  );
}

export default React.memo(BudgetCard);

const getStyles = () => StyleSheet.create({
  card: {
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  titleTextCol: {
    gap: 2,
  },
  cycleRange: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.labelLarge,
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: 1.65,
    textTransform: 'uppercase',
    fontFamily: FontFamily.black,
  },
  percentageBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  percentageText: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  right: {
    alignItems: 'flex-end',
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    ...Typography.amountSmall,
    color: Colors.textPrimary,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  progressContainer: {
    paddingVertical: Spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.round,
  },
  debtImpactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  debtImpactLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  debtImpactValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: 'auto',
  },
  debtImpactValue: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.md,
  },
  stat: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  statValue: {
    ...Typography.labelLarge,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
});
