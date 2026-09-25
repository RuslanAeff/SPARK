// S.P.A.R.K. — Budget History Card (Compact Horizontal Design)
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDayMonth, getToday } from '../utils/dateUtils';
import { BudgetDao } from '../db/budgetDao';
import { ExpenseDao } from '../db/expenseDao';
import { BudgetRolloverDao } from '../db/budgetRolloverDao';
import { DebtDao } from '../db/debtDao';
import { IncomeDao } from '../db/incomeDao';
import { computeDebtAdjustedBudget } from '../utils/debtMath';
import { fromMinorUnits, sumMoney, subtractMoney } from '../utils/moneyMath';
import { Budget } from '../db/schema';
import { getCycleStartDay } from '../services/budgetCycleSettings';
import { findShadowedBudgetIds } from '../utils/budgetPeriodConflicts';
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

export interface BudgetHistorySelection {
  key: string;
  cycle: BudgetCycle;
  budget: Budget | null;
}

interface CycleEntry {
  key: string;        // YYYY-MM (döngünün başladığı ay)
  renderKey: string;  // Aynı ayda birden fazla geçiş olsa da React kimliği benzersizdir.
  cycle: BudgetCycle;
  budget: Budget | null;
  spent: number;
  isCurrent: boolean;
  /** Eski sürümden kalan çakışma nedeniyle hesaplamada yetkili olmayan kayıt. */
  isShadowed: boolean;
  effectiveBudget?: number;
  carryOut?: number;
}

interface BudgetHistoryCardProps {
  selectedBudgetId?: number | null;
  selectedPeriodStart?: string;
  /** Exact row identity survives multiple transitions that start in one month. */
  onSelectPeriod?: (selection: BudgetHistorySelection) => void;
}

export default function BudgetHistoryCard({
  selectedBudgetId,
  selectedPeriodStart,
  onSelectPeriod,
}: BudgetHistoryCardProps = {}) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { refreshKey } = useRefresh();
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const { fontScale } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(280);
  const cardWidth = Math.max(180, Math.min(260 * Math.max(1, fontScale), containerWidth * 0.9));
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function load() {
    setLoading(true);
    try {
      const anchorDay = await getCycleStartDay();
      const spendingMonths = await ExpenseDao.getMonthsWithSpending();
      const budgets = await BudgetDao.getAllBudgets();
      const rollovers = await BudgetRolloverDao.list();

      const current = getCurrentCycle(anchorDay);
      const today = getToday();
      // Android / expo-sqlite: aynı DB üzerinde çok sayıda eşzamanlı sorgu prepareAsync
      // hatasına (NativeStatement / released object) yol açabiliyor — sırayla yükle.
      const withData: CycleEntry[] = [];
      const representedPeriods = new Set<string>();
      // Eski sürümlerden çakışan aktif dönem kalmış olabilir. Veri silinmez;
      // yalnız hesaplamada yetkili olmayan kayıt işaretlenir ve kullanıcı
      // dokunup düzeltebilir (ADR-008 onarım yolu).
      const shadowedIds = findShadowedBudgetIds(budgets);
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
        const shadowed = shadowedIds.has(budget.id);
        const carryIn = sumMoney(rollovers.filter(r => r.target_start === cycle.start && r.target_end === cycle.end && r.currency === budget.currency).map(r => fromMinorUnits(r.amount_minor)));
        const carryOut = sumMoney(rollovers.filter(r => r.source_start === cycle.start && r.source_end === cycle.end && r.currency === budget.currency).map(r => fromMinorUnits(r.amount_minor)));
        const borrowedIn = await DebtDao.getBorrowedTotalByDateRange(cycle.start, cycle.end);
        const repaidIn = await DebtDao.getRepaidTotalByDateRange(cycle.start, cycle.end);
        const extraIncomeIn = await IncomeDao.getTotalByDateRange(cycle.start, cycle.end);
        const { effectiveBudget } = computeDebtAdjustedBudget({ monthlyBudget: budget.monthly_amount, totalSpent: spent, borrowedIn, repaidIn, extraIncomeIn, carryIn });
        withData.push({
          key,
          renderKey: `budget:${periodKey}:${budget.id}`,
          cycle,
          budget,
          spent,
          effectiveBudget,
          carryOut,
          // Gölgelenen kayıt "MEVCUT" sayılmaz; aksi halde aynı gün için iki
          // mevcut rozeti çıkar ve ekranlar birbiriyle çelişir.
          isCurrent: !shadowed && cycle.start <= today && cycle.end >= today,
          isShadowed: shadowed,
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
          isShadowed: false,
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
          isShadowed: false,
        });
      }
      withData.sort((a, b) => b.cycle.start.localeCompare(a.cycle.start));

      if (mountedRef.current) {
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
    <View onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={cardWidth + Spacing.sm} decelerationRate="fast">
        {entries.map((entry) => {
          const { key, renderKey, cycle, budget, spent, isCurrent, isShadowed } = entry;
          const selectable = Boolean(onSelectPeriod);
          const isSelected = budget ? selectedBudgetId === budget.id
            : selectedBudgetId == null && selectedPeriodStart === cycle.start;
          const availableBudget = entry.effectiveBudget ?? budget?.monthly_amount ?? 0;
          const pct = budget && availableBudget > 0 ? Math.max(0, Math.min((spent / availableBudget) * 100, 100)) : 0;
          const remaining = subtractMoney(availableBudget, spent);
          const overBudget = !!budget && remaining < 0;
          const barColor = overBudget ? Colors.danger : Colors.primary;
          const periodCurrency = budget?.currency ?? currency;
          // Always show exact bounds, including shortened transition periods and years.
          const label = `${formatDayMonth(cycle.start, t)} ${cycle.start.slice(0, 4)} – ${formatDayMonth(cycle.end, t)} ${cycle.end.slice(0, 4)}`;
          return (
            <Pressable key={renderKey} testID={`budget-history-card-${budget ? budget.id : cycle.start}`}
              onPress={selectable ? () => onSelectPeriod?.({ key, cycle, budget }) : undefined}
              disabled={!selectable} accessibilityRole={selectable ? 'button' : 'text'}
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={selectable ? t('budget_history_select', { period: label }) : label}
              style={({ pressed }) => [styles.card, { width: cardWidth },
                isShadowed && styles.cardShadowed, isSelected && styles.cardSelected,
                pressed && selectable && styles.cardPressed]}>
              <View style={styles.header}>
                <MaterialCommunityIcons name="calendar-range" size={18} color={isSelected ? Colors.primary : Colors.textSecondary} />
                <Text style={styles.period}>{label}</Text>
                {isSelected && <MaterialCommunityIcons name="check-circle" size={18} color={Colors.primary} />}
              </View>
              {(isCurrent || isShadowed) && <View style={styles.badge}>
                <Text style={[styles.badgeText, isShadowed && { color: Colors.warning }]}>
                  {t(isShadowed ? 'budget_conflict_badge' : 'current_month')}
                </Text>
              </View>}
              <View style={styles.summary}>
                <Text style={styles.label}>{t(budget ? overBudget ? 'over_budget_exceeded' : 'remaining_label' : 'spent_label')}</Text>
                <Text style={[styles.amount, overBudget && { color: Colors.danger }]}>
                  {formatCurrency(budget ? Math.abs(remaining) : spent, periodCurrency)}
                </Text>
              </View>
              <View style={styles.details}>
                {budget ? <>
                  <View style={styles.row}><Text style={styles.label}>{t('rollover_base')}</Text>
                    <Text style={styles.value}>{formatCurrency(budget.monthly_amount, periodCurrency)}</Text></View>
                  <View style={styles.row}><Text style={styles.label}>{t('spent_label')}</Text>
                    <Text style={styles.value}>{formatCurrency(spent, periodCurrency)}</Text></View>
                  <View style={styles.track}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} /></View>
                  {(entry.carryOut ?? 0) > 0 && <View style={styles.row}>
                    <Text style={styles.label}>{t('rollover_out')}</Text>
                    <Text style={styles.value}>{formatCurrency(entry.carryOut!, periodCurrency)}</Text>
                  </View>}
                </> : <Text style={styles.label}>{t('no_budget_set')}</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
  emptyContainer: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  emptyText: { ...Typography.bodySmall, color: Colors.textSecondary },
  scrollContent: { gap: Spacing.sm, paddingVertical: Spacing.xs, alignItems: 'stretch' },
  card: { padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight,
    borderRadius: BorderRadius.lg, backgroundColor: Colors.surface },
  cardShadowed: { borderColor: Colors.warning },
  cardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  cardPressed: { opacity: 0.75 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  period: { ...Typography.labelMedium, color: Colors.textPrimary, fontFamily: FontFamily.semiBold, flex: 1 },
  badge: { alignSelf: 'flex-start', marginTop: Spacing.sm, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.surfaceLight },
  badgeText: { ...Typography.labelSmall, color: Colors.textSecondary },
  summary: { paddingVertical: Spacing.md, gap: 4 },
  label: { ...Typography.labelSmall, color: Colors.textSecondary, flexShrink: 1 },
  amount: { ...Typography.amountSmall, fontSize: 24, color: Colors.textPrimary },
  details: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 },
  value: { ...Typography.labelMedium, color: Colors.textPrimary, fontFamily: FontFamily.medium },
  track: { height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});
