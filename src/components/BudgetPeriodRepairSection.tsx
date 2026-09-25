import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Budget } from '../db/schema';
import { BudgetDao } from '../db/budgetDao';
import { useLanguage } from '../i18n/LanguageContext';
import { useThemePalette } from '../theme/themeStore';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily, Typography } from '../theme/typography';
import { SparkToast } from './SparkToast';
import BudgetDisclosure from './BudgetDisclosure';
import ConfirmModal from './ConfirmModal';
import CustomDatePicker from './CustomDatePicker';

export default function BudgetPeriodRepairSection({
  budget,
  onRepaired,
}: {
  budget: Budget | null;
  onRepaired: () => void;
}) {
  const { t } = useLanguage();
  const palette = useThemePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [occupiedRanges, setOccupiedRanges] = useState<Array<{ start: string; end: string }>>([]);

  useEffect(() => {
    setOpen(false);
    setConfirm(false);
    setPicker(null);
    setStart(budget?.period_start ?? '');
    setEnd(budget?.period_end ?? '');
    if (budget?.id) {
      void BudgetDao.getAllBudgets().then(rows => {
        setOccupiedRanges(rows
          .filter(row => row.id !== budget.id && row.period_start && row.period_end)
          .map(row => ({ start: row.period_start!, end: row.period_end! })));
      }).catch(() => setOccupiedRanges([]));
    } else {
      setOccupiedRanges([]);
    }
  }, [budget?.id]);

  if (!budget?.period_start || !budget.period_end) return null;

  async function repair() {
    if (busy || !budget) return;
    setBusy(true);
    try {
      await BudgetDao.repairBudgetPeriod(budget.id, start, end);
      setConfirm(false);
      setOpen(false);
      onRepaired();
      SparkToast.show(t('budget_repair_saved'), 'success');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const key = ['budget_repair_invalid_dates', 'budget_repair_overlap', 'rollover_period_locked']
        .includes(code) ? code : 'error_saving_data';
      SparkToast.show(t(key), 'error');
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return <View style={styles.container}>
    <Pressable testID="budget-repair-toggle" accessibilityRole="button" accessibilityState={{ expanded: open, disabled: busy }} disabled={busy} onPress={() => { Keyboard.dismiss(); setOpen((value) => !value); }} style={styles.toggle}>
      <MaterialCommunityIcons name="calendar-edit" size={18} color={palette.textSecondary} />
      <View style={{ flex: 1, gap: 3 }}><Text style={styles.toggleText}>{t('budget_repair_title')}</Text><Text style={styles.label}>{budget.period_start} – {budget.period_end}</Text></View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSecondary} />
    </Pressable>
    <BudgetDisclosure open={open}><View style={styles.panel}>
      <Text style={styles.explanation}>{t('budget_repair_explanation')}</Text>
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('budget_repair_start')}</Text>
          <View style={styles.inputRow}>
            <TextInput testID="budget-repair-start" value={start} onChangeText={setStart} autoCapitalize="none"
              keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={palette.textMuted} style={styles.input} />
            <Pressable testID="budget-repair-start-picker" accessibilityRole="button" accessibilityLabel={t('budget_repair_start_picker')}
              onPress={() => { Keyboard.dismiss(); setPicker('start'); }} style={styles.calendarButton}>
              <MaterialCommunityIcons name="calendar-month-outline" size={19} color={palette.primary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('budget_repair_end')}</Text>
          <View style={styles.inputRow}>
            <TextInput testID="budget-repair-end" value={end} onChangeText={setEnd} autoCapitalize="none"
              keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={palette.textMuted} style={styles.input} />
            <Pressable testID="budget-repair-end-picker" accessibilityRole="button" accessibilityLabel={t('budget_repair_end_picker')}
              onPress={() => { Keyboard.dismiss(); setPicker('end'); }} style={styles.calendarButton}>
              <MaterialCommunityIcons name="calendar-month-outline" size={19} color={palette.primary} />
            </Pressable>
          </View>
        </View>
      </View>
      <Text style={styles.warning}>{t('budget_repair_warning')}</Text>
      <Pressable testID="budget-repair-preview" disabled={busy || (start === budget.period_start && end === budget.period_end)}
        accessibilityRole="button" onPress={() => setConfirm(true)} style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.65 }]}>
        <Text style={styles.buttonText}>{t('budget_repair_review')}</Text>
      </Pressable>
    </View></BudgetDisclosure>
    <CustomDatePicker
      visible={picker !== null}
      onClose={() => setPicker(null)}
      initialDate={picker === 'end' ? end : start}
      onSelectDate={(date) => picker === 'end' ? setEnd(date) : setStart(date)}
      disabledDateRanges={occupiedRanges}
      disabledDateHint={t('budget_repair_blocked_day_hint')}
    />
    <ConfirmModal visible={confirm} title={t('budget_repair_confirm_title')}
      message={t('budget_repair_confirm_message', { oldStart: budget.period_start, oldEnd: budget.period_end, start, end })}
      confirmLabel={t('budget_repair_confirm')} cancelLabel={t('cancel')} tone="warning" icon="calendar-alert"
      onCancel={() => !busy && setConfirm(false)} onConfirm={() => void repair()} />
  </View>;
}

type Palette = ReturnType<typeof useThemePalette>;
const makeStyles = (palette: Palette) => StyleSheet.create({
  container: { marginTop: Spacing.md, borderWidth: 1, borderColor: palette.border, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  toggle: { padding: Spacing.md, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toggleText: { ...Typography.labelMedium, color: palette.textPrimary },
  panel: { backgroundColor: palette.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  explanation: { ...Typography.bodySmall, color: palette.textSecondary, lineHeight: 20 },
  fieldRow: { flexDirection: 'row', gap: Spacing.sm },
  field: { flex: 1, gap: 4 },
  label: { ...Typography.labelSmall, color: palette.textSecondary },
  input: { ...Typography.bodyMedium, color: palette.textPrimary, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.inputBackground, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  calendarButton: { width: 42, height: 42, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.inputBackground, alignItems: 'center', justifyContent: 'center' },
  warning: { ...Typography.labelSmall, color: palette.warning, lineHeight: 18 },
  button: { minHeight: 44, borderRadius: BorderRadius.round, borderWidth: 1, borderColor: palette.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  buttonText: { ...Typography.labelMedium, color: palette.primary, fontFamily: FontFamily.bold },
});
