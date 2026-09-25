import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BudgetDao } from '../db/budgetDao';
import { BudgetRolloverDao } from '../db/budgetRolloverDao';
import type { Budget } from '../db/schema';
import { inspectBudgetPeriodHealth, type BudgetHealthIssue } from '../utils/budgetPeriodHealth';
import { useLanguage } from '../i18n/LanguageContext';
import { useRefresh } from '../context/RefreshContext';
import { useThemePalette } from '../theme/themeStore';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily, Typography } from '../theme/typography';

export default function BudgetHealthSection({ onSelectBudget }: { onSelectBudget: (budget: Budget) => void }) {
  const { t } = useLanguage();
  const { refreshKey } = useRefresh();
  const palette = useThemePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [state, setState] = useState<{ issues: BudgetHealthIssue[]; budgets: Budget[]; error?: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setState(null);
    setOpen(false);
  }, [refreshKey]);

  async function openAudit() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (state || loading) return;
    setLoading(true);
    try {
      const budgets = await BudgetDao.getAllBudgets();
      const rollovers = await BudgetRolloverDao.list();
      setState({ issues: inspectBudgetPeriodHealth(budgets, rollovers), budgets });
    } catch {
      setState({ issues: [], budgets: [], error: true });
    } finally {
      setLoading(false);
    }
  }

  const affectedIds = Array.from(new Set((state?.issues ?? []).flatMap((issue) => issue.budgetIds)));
  return <View style={styles.container} testID="budget-health-section">
    <Pressable testID="budget-health-run" accessibilityRole="button" onPress={() => void openAudit()} style={styles.header}>
      {loading ? <ActivityIndicator color={palette.primary} /> : <MaterialCommunityIcons
        name={!state ? 'shield-outline' : state.issues.length ? 'shield-alert-outline' : 'shield-check-outline'} size={20}
        color={!state ? palette.textSecondary : state.issues.length ? palette.warning : palette.success} />}
      <View style={styles.copy}>
        <Text style={styles.title}>{t('budget_health_title')}</Text>
        <Text style={styles.subtitle}>{t(!state ? 'budget_health_idle' : state.error ? 'budget_health_error'
          : state.issues.length ? 'budget_health_issues' : 'budget_health_ok', {
          count: String(state?.issues.length ?? 0),
        })}</Text>
      </View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSecondary} />
    </Pressable>
    {open && state && !state.error && state.issues.length > 0 && <View style={styles.list}>
      {state.issues.map((issue, index) => <Text key={`${issue.code}:${issue.detail}:${index}`} style={styles.issue}>
        {t(`budget_health_${issue.code}`)} · {issue.detail}
      </Text>)}
      {affectedIds.map((id) => {
        const budget = state.budgets.find((row) => row.id === id);
        return budget ? <Pressable key={id} testID={`budget-health-open-${id}`} onPress={() => onSelectBudget(budget)} style={styles.link}>
          <Text style={styles.linkText}>{t('budget_health_open_period', { start: budget.period_start ?? budget.start_date, end: budget.period_end ?? '' })}</Text>
        </Pressable> : null;
      })}
    </View>}
  </View>;
}

type Palette = ReturnType<typeof useThemePalette>;
const makeStyles = (palette: Palette) => StyleSheet.create({
  container: { marginTop: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, overflow: 'hidden' },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  copy: { flex: 1, gap: 2 },
  title: { ...Typography.labelLarge, color: palette.textPrimary, fontFamily: FontFamily.bold },
  subtitle: { ...Typography.labelSmall, color: palette.textSecondary },
  list: { borderTopWidth: 1, borderTopColor: palette.border, padding: Spacing.md, gap: Spacing.sm },
  issue: { ...Typography.bodySmall, color: palette.warning, lineHeight: 19 },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { ...Typography.labelMedium, color: palette.primary },
});
