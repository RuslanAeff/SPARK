import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Budget, BudgetRollover } from '../db/schema';
import { BudgetDao } from '../db/budgetDao';
import { BudgetRolloverDao, previousDay, type RolloverStatus } from '../db/budgetRolloverDao';
import { useLanguage } from '../i18n/LanguageContext';
import { useRefresh } from '../context/RefreshContext';
import { useNotifications } from '../context/NotificationsContext';
import { syncNotificationsBestEffort } from '../notifications/syncNotificationsBestEffort';
import { useAppTheme, useThemePalette } from '../theme/themeStore';
import { createSusevarStyles } from '../theme/susevar';
import { Typography } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { formatMoneyInput, fromMinorUnits, parseMoneyInput } from '../utils/moneyMath';
import { getToday } from '../utils/dateUtils';
import BudgetDisclosure from './BudgetDisclosure';
import ConfirmModal from './ConfirmModal';
import { SparkToast } from './SparkToast';

export default function BudgetRolloverSection({ budget }: { budget: Budget | null }) {
  const { t } = useLanguage();
  useAppTheme();
  const palette = useThemePalette();
  const styles = useMemo(() => StyleSheet.create({
    box: { marginTop: Spacing.lg, borderWidth: 1, borderColor: palette.border, borderRadius: BorderRadius.lg, backgroundColor: palette.surface, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, minHeight: 64 },
    copy: { flex: 1, gap: 4 },
    icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
    panel: { padding: Spacing.md, paddingTop: 0, gap: Spacing.md },
    record: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: Spacing.md, gap: Spacing.sm },
    title: { ...Typography.titleSmall, color: palette.textPrimary },
    text: { ...Typography.bodySmall, color: palette.textSecondary },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
    label: { ...Typography.bodySmall, color: palette.textSecondary, flex: 1 },
    amount: { ...Typography.labelMedium, color: palette.textPrimary },
    input: { ...Typography.titleSmall, color: palette.textPrimary, minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: BorderRadius.md, padding: Spacing.sm, flex: 1 },
    link: { minHeight: 44, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, borderWidth: 1, borderColor: palette.danger, borderRadius: BorderRadius.md },
  }), [palette]);
  const action = useMemo(() => createSusevarStyles(palette), [palette]);
  const { refreshKey, triggerRefresh } = useRefresh();
  const { sync } = useNotifications();
  const [state, setState] = useState<{ budgetId: number; status: RolloverStatus; source: Budget | null; sourceStatus: RolloverStatus | null } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [budget?.id]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reverse, setReverse] = useState<BudgetRollover | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    let alive = true;
    setState(null); setError(false); setReverse(null); setAmount('');
    if (budget?.period_start && budget.period_end) {
      void (async () => {
        try {
          const status = await BudgetRolloverDao.status(budget);
          const source = await BudgetDao.getContainingDate(previousDay(budget.period_start!));
          const sourceStatus = source ? await BudgetRolloverDao.status(source) : null;
          if (!alive) return;
          setState({ budgetId: budget.id, status, source, sourceStatus });
          setAmount(formatMoneyInput(status.incoming || Math.max(0, sourceStatus?.unallocated ?? 0)));
        } catch { if (alive) setError(true); }
      })();
    }
    return () => { alive = false; };
  }, [budget, refreshKey]);
  const loaded = state?.budgetId === budget?.id ? state : null;
  const current = !!budget?.period_start && !!budget.period_end && budget.period_start <= getToday() && budget.period_end >= getToday();
  const eligible = current && loaded?.source?.period_end === previousDay(budget!.period_start!)
    && loaded.source.currency === budget!.currency && loaded.sourceStatus;
  const money = (value: number) => formatCurrency(value, budget?.currency ?? 'PLN');
  async function save(reversal?: BudgetRollover) {
    if (saving.current || !budget) return;
    const value = reversal ? 0 : parseMoneyInput(amount);
    if (value === null || (!reversal && value <= 0)) { SparkToast.show(t('rollover_invalid_amount'), 'error'); return; }
    saving.current = true; setBusy(true);
    try {
      const source = reversal ? await BudgetDao.getContainingDate(reversal.source_start) : loaded?.source;
      const target = reversal ? await BudgetDao.getContainingDate(reversal.target_start) : budget;
      if (!source || !target) throw new Error('rollover_unavailable');
      await BudgetRolloverDao.save(source.id, target.id, value);
      setReverse(null); triggerRefresh();
      await syncNotificationsBestEffort(sync, 'budget-rollover');
      SparkToast.show(t('rollover_saved'), 'success');
    } catch (e) {
      const key = e instanceof Error && e.message.startsWith('rollover_') ? e.message : 'error_saving_data';
      SparkToast.show(t(key), 'error');
    } finally { saving.current = false; setBusy(false); }
  }
  return <View style={styles.box} testID="budget-rollover-section">
    <Pressable testID="rollover-toggle" accessibilityRole="button" accessibilityState={{ expanded: open, disabled: busy }}
      disabled={busy} onPress={() => { Keyboard.dismiss(); setOpen(value => !value); }} style={({ pressed }) => [styles.header, pressed && { opacity: 0.7 }]}>
      <View style={styles.icon}><MaterialCommunityIcons name="bank-transfer" color={palette.primary} size={22} /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('rollover_title')}</Text>
        <Text style={styles.text}>{loaded && loaded.status.incoming > 0
          ? `${t('rollover_in')} · +${money(loaded.status.incoming)}` : t('rollover_compact_hint')}</Text>
        {(loaded?.status.needsReview || loaded?.sourceStatus?.needsReview) &&
          <Text accessibilityRole="alert" style={[styles.text, { color: palette.warning }]}>{t('rollover_review')}</Text>}
        {error && <Text accessibilityRole="alert" style={styles.text}>{t('error_loading_data')}</Text>}
      </View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} color={palette.textSecondary} size={20} />
    </Pressable>
    <BudgetDisclosure open={open}>
    <View style={styles.panel}>
    <Text style={styles.text}>{t('rollover_explanation')}</Text>
    {!budget ? <Text style={styles.text}>{t('rollover_save_budget')}</Text>
      : error ? <Text accessibilityRole="alert" style={styles.text}>{t('error_loading_data')}</Text>
        : !loaded ? <ActivityIndicator color={palette.primary} /> : <>
          {([
            ['rollover_base', budget.monthly_amount], ['rollover_in', loaded.status.incoming],
            ['rollover_period_remaining', loaded.status.periodRemaining], ['rollover_out', loaded.status.outgoing],
            ['rollover_unallocated', loaded.status.unallocated],
          ] as const).map(([key, value]) => <View key={key} style={styles.row}><Text style={styles.label}>{t(key)}</Text><Text style={styles.amount}>{money(value)}</Text></View>)}
          {loaded.status.records.map(r => <View key={r.uid} style={styles.record}>
            <Text style={styles.text}>{`${r.source_start} – ${r.source_end} → ${r.target_start} – ${r.target_end}`}</Text>
            <Pressable testID={`rollover-reverse-${r.uid}`} accessibilityRole="button" disabled={busy} onPress={() => setReverse(r)} accessibilityState={{ disabled: busy }} style={({ pressed }) => [styles.link, (pressed || busy) && { opacity: 0.6 }]}>
              <MaterialCommunityIcons name="undo-variant" size={18} color={palette.danger} />
              <Text style={[styles.text, { color: palette.danger }]}>{t('rollover_reverse')} · {formatCurrency(fromMinorUnits(r.amount_minor), r.currency)}</Text>
            </Pressable>
          </View>)}
          {eligible ? <>
            <Text style={styles.text}>{t('rollover_from', { start: loaded.source!.period_start!, end: loaded.source!.period_end! })}</Text>
            <Text style={styles.text}>{t('rollover_available', { amount: money(Math.max(0, loaded.sourceStatus!.periodRemaining)) })}</Text>
            <View style={styles.row}>
              <TextInput testID="rollover-amount" accessibilityLabel={t('rollover_amount')} editable={!busy} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} />
              <Text style={styles.amount}>{budget.currency}</Text>
            </View>
            <Text style={styles.text}>{t('rollover_double_count_hint')}</Text>
            <Pressable testID="rollover-save" accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void save()} style={({ pressed }) => [action.button, (pressed || busy) && { opacity: 0.6 }]}>
              <Text style={action.text}>{t(loaded.status.incoming > 0 ? 'rollover_update' : 'rollover_transfer')}</Text>
            </Pressable>
          </> : <Text style={styles.text}>{t('rollover_unavailable')}</Text>}
        </>}
    </View>
    </BudgetDisclosure>
    <ConfirmModal visible={reverse !== null} title={t('rollover_reverse')} message={t('rollover_reverse_confirm')}
      confirmLabel={t('rollover_reverse')} cancelLabel={t('cancel')} tone="warning" onCancel={() => !busy && setReverse(null)}
      onConfirm={() => reverse && void save(reverse)} />
  </View>;
}
