// S.P.A.R.K. — Borç yönetim alt sayfası (hub)
//
// Tek BottomSheetModal içinde üç görünüm: açık borç LİSTESİ, "Borç Aldım" (EKLE)
// ve "Borcu Öde" (kısmi destekli). Fiş/harcama bütünlüğü bozulmaz — geri ödeme
// tüketim sayılmaz; nakit-akışı etkisi useBudget/debtMath üzerinden işlenir.
// Tema kalıbı: useAppTheme + useMemo(getStyles) (P12). Birincil CTA = şüşevar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import BottomSheetModal from './BottomSheetModal';
import CustomDatePicker from './CustomDatePicker';
import { SparkToast } from './SparkToast';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../theme/spacing';
import { susevarButton, susevarButtonPressed, susevarButtonText } from '../theme/susevar';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDayMonth, getToday } from '../utils/dateUtils';
import { DebtDao } from '../db/debtDao';
import { ExpenseDao } from '../db/expenseDao';
import { Debt, ExpenseWithDetails } from '../db/schema';
import { useLanguage } from '../i18n/LanguageContext';

const SCREEN_H = Dimensions.get('window').height;

interface DebtSheetProps {
  visible: boolean;
  onClose: () => void;
  currency: string;
  /** Ekleme/ödeme sonrası dashboard'ı tazelemek için. */
  onChanged?: () => void;
}

type DebtView = 'list' | 'add' | 'repay';

function parseAmountInput(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

export default function DebtSheet({ visible, onClose, currency, onChanged }: DebtSheetProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t } = useLanguage();

  const [view, setView] = useState<DebtView>('list');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Ekle formu
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getToday());
  const [linkExpanded, setLinkExpanded] = useState(false);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseWithDetails[]>([]);
  const [linkedExpenseId, setLinkedExpenseId] = useState<number | null>(null);

  // Öde formu
  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(getToday());

  const reload = useCallback(async () => {
    const open = await DebtDao.listOpen('borrowed');
    setDebts(open);
  }, []);

  useEffect(() => {
    if (visible) {
      setView('list');
      void reload();
    }
  }, [visible, reload]);

  const resetAddForm = useCallback(() => {
    setAmount('');
    setCounterparty('');
    setNote('');
    setDate(getToday());
    setLinkExpanded(false);
    setLinkedExpenseId(null);
  }, []);

  const openAdd = useCallback(async () => {
    resetAddForm();
    setView('add');
    // Fiş bağlama için son harcamaları arkada yükle.
    try {
      setRecentExpenses(await ExpenseDao.getAll(15, 0));
    } catch {
      setRecentExpenses([]);
    }
  }, [resetAddForm]);

  const openRepay = useCallback((debt: Debt) => {
    setActiveDebt(debt);
    setRepayAmount(String(debt.remaining));
    setRepayDate(getToday());
    setView('repay');
  }, []);

  async function handleAdd() {
    const parsed = parseAmountInput(amount);
    if (parsed <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }
    if (!counterparty.trim()) {
      SparkToast.show(t('debt_counterparty_required'), 'error');
      return;
    }
    setSaving(true);
    try {
      await DebtDao.create({
        direction: 'borrowed',
        counterparty: counterparty.trim(),
        amount: parsed,
        currency,
        date,
        note: note.trim() || null,
        linkedExpenseId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('debt_created_toast'), 'success', formatCurrency(parsed, currency, false));
      onChanged?.();
      await reload();
      setView('list');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRepay() {
    if (!activeDebt) return;
    const parsed = parseAmountInput(repayAmount);
    if (parsed <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }
    setSaving(true);
    try {
      await DebtDao.repay(activeDebt.id, parsed, repayDate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Ödeme kalanı kapatıyorsa "kapandı", değilse "kaydedildi".
      const settled = parsed >= activeDebt.remaining;
      SparkToast.show(settled ? t('debt_settled_toast') : t('debt_repaid_toast'), 'success');
      onChanged?.();
      await reload();
      setActiveDebt(null);
      setView('list');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Görünümler ────────────────────────────────────────────────
  const renderList = () => (
    <>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: Colors.danger + '22' }]}>
          <MaterialCommunityIcons name="hand-coin-outline" size={24} color={Colors.danger} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{t('debt_sheet_title')}</Text>
          {debts.length > 0 ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {formatCurrency(debts.reduce((s, d) => s + d.remaining, 0), currency)}
            </Text>
          ) : null}
        </View>
      </View>

      {debts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="check-circle-outline" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('debt_empty_title')}</Text>
          <Text style={styles.emptyDesc}>{t('debt_empty_desc')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          {debts.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => openRepay(d)}
              style={({ pressed }) => [styles.debtRow, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.debtName} numberOfLines={1}>{d.counterparty}</Text>
                <Text style={styles.debtMeta} numberOfLines={1}>
                  {formatDayMonth(d.date, t)}
                  {d.remaining < d.amount
                    ? ` · ${formatCurrency(d.remaining, currency, false)} / ${formatCurrency(d.amount, currency, false)}`
                    : ''}
                </Text>
              </View>
              <View style={styles.debtRight}>
                <Text style={styles.debtRemaining}>{formatCurrency(d.remaining, currency, false)}</Text>
                <View style={styles.payChip}>
                  <Text style={styles.payChipText}>{t('debt_repay_cta')}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={openAdd}
        style={({ pressed }) => [styles.primaryBtn, pressed && susevarButtonPressed]}
      >
        <View style={styles.primaryBtnRow}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{t('debt_add_title')}</Text>
        </View>
      </Pressable>
    </>
  );

  const renderAdd = () => (
    <>
      <View style={styles.formHeader}>
        <Pressable onPress={() => setView('list')} hitSlop={10} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.formTitle}>{t('debt_add_title')}</Text>
      </View>

      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>{t('amount')}</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.fieldLabel}>{t('debt_counterparty')}</Text>
        <TextInput
          style={styles.input}
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder={t('debt_counterparty_ph')}
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.fieldLabel}>{t('date')}</Text>
        <Pressable style={[styles.input, styles.inputAsButton]} onPress={() => setDatePickerVisible(true)}>
          <Text style={styles.inputButtonText}>{date || t('select_date')}</Text>
          <MaterialCommunityIcons name="calendar-outline" size={18} color={Colors.textSecondary} />
        </Pressable>

        <Text style={styles.fieldLabel}>{t('note')}</Text>
        <TextInput
          style={[styles.input, { minHeight: 52 }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('note_placeholder')}
          placeholderTextColor={Colors.textMuted}
          multiline
        />

        {/* Opsiyonel: borcu bir fişe (harcamaya) bağla */}
        <Pressable style={styles.linkToggle} onPress={() => setLinkExpanded((v) => !v)}>
          <MaterialCommunityIcons name="link-variant" size={16} color={Colors.textSecondary} />
          <Text style={styles.linkToggleText}>{t('debt_link_receipt')}</Text>
          <MaterialCommunityIcons
            name={linkExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textSecondary}
            style={{ marginLeft: 'auto' }}
          />
        </Pressable>
        {linkExpanded ? (
          <View style={styles.linkList}>
            {recentExpenses.length === 0 ? (
              <Text style={styles.linkEmpty}>{t('empty')}</Text>
            ) : (
              recentExpenses.map((e) => {
                const selected = linkedExpenseId === e.id;
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => setLinkedExpenseId(selected ? null : e.id)}
                    style={[styles.linkRow, selected && styles.linkRowSelected]}
                  >
                    <MaterialCommunityIcons
                      name={selected ? 'check-circle' : 'circle-outline'}
                      size={18}
                      color={selected ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={styles.linkRowText} numberOfLines={1}>
                      {(e.vendor_name || t('note')) + ' · ' + formatDayMonth(e.date, t)}
                    </Text>
                    <Text style={styles.linkRowAmount}>{formatCurrency(e.total_amount, currency, false)}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        <Pressable
          onPress={handleAdd}
          disabled={saving}
          style={({ pressed }) => [styles.primaryBtn, { marginTop: Spacing.xl }, saving && { opacity: 0.6 }, pressed && susevarButtonPressed]}
        >
          <Text style={styles.primaryBtnText}>{saving ? t('processing') : t('save')}</Text>
        </Pressable>
        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </>
  );

  const renderRepay = () => (
    <>
      <View style={styles.formHeader}>
        <Pressable onPress={() => setView('list')} hitSlop={10} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.formTitle}>{t('debt_repay_title')}</Text>
      </View>

      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {activeDebt ? (
          <View style={styles.repaySummary}>
            <Text style={styles.repayName}>{activeDebt.counterparty}</Text>
            <Text style={styles.repayRemainingLabel}>{t('debt_remaining')}</Text>
            <Text style={styles.repayRemaining}>{formatCurrency(activeDebt.remaining, currency)}</Text>
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>{t('amount')}</Text>
        <TextInput
          style={styles.input}
          value={repayAmount}
          onChangeText={setRepayAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={Colors.textMuted}
        />
        {activeDebt ? (
          <Pressable style={styles.fullChip} onPress={() => setRepayAmount(String(activeDebt.remaining))}>
            <Text style={styles.fullChipText}>{t('debt_repay_full')}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.fieldLabel}>{t('date')}</Text>
        <Pressable style={[styles.input, styles.inputAsButton]} onPress={() => setDatePickerVisible(true)}>
          <Text style={styles.inputButtonText}>{repayDate || t('select_date')}</Text>
          <MaterialCommunityIcons name="calendar-outline" size={18} color={Colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={handleRepay}
          disabled={saving}
          style={({ pressed }) => [styles.primaryBtn, { marginTop: Spacing.xl }, saving && { opacity: 0.6 }, pressed && susevarButtonPressed]}
        >
          <Text style={styles.primaryBtnText}>{saving ? t('processing') : t('debt_repay_cta')}</Text>
        </Pressable>
        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </>
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.sheet}
      backdropColor={scheme === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.55)'}
      showHandle
    >
      <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
        <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
      </Pressable>

      {view === 'list' ? renderList() : view === 'add' ? renderAdd() : renderRepay()}

      <CustomDatePicker
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        initialDate={view === 'repay' ? repayDate : date}
        onSelectDate={(d) => (view === 'repay' ? setRepayDate(d) : setDate(d))}
      />
    </BottomSheetModal>
  );
}

const getStyles = () => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.85,
    paddingTop: Spacing.sm,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    zIndex: 10,
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.danger,
    fontFamily: FontFamily.semiBold,
    marginTop: 2,
  },
  // Liste
  listScroll: {
    maxHeight: SCREEN_H * 0.46,
  },
  listContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  debtName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  debtMeta: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  debtRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  debtRemaining: {
    ...Typography.bodyLarge,
    color: Colors.danger,
    fontFamily: FontFamily.bold,
  },
  payChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary + '22',
  },
  payChipText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  // Boş durum
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
  },
  emptyDesc: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Form ortak
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  formTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  formScroll: {
    maxHeight: SCREEN_H * 0.66,
  },
  formContent: {
    paddingBottom: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputAsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputButtonText: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  linkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  linkToggleText: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
  },
  linkList: {
    gap: 6,
    marginTop: 4,
  },
  linkEmpty: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    paddingVertical: Spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '14',
  },
  linkRowText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    flex: 1,
  },
  linkRowAmount: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
  },
  // Öde özeti
  repaySummary: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  repayName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  repayRemainingLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  repayRemaining: {
    ...Typography.headlineMedium,
    color: Colors.danger,
    fontFamily: FontFamily.bold,
    marginTop: 2,
  },
  fullChip: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary + '22',
  },
  fullChipText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  // Şüşevar birincil CTA
  primaryBtn: {
    ...susevarButton,
    marginTop: Spacing.lg,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  primaryBtnText: susevarButtonText,
});
