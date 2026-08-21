// S.P.A.R.K. — Borç yönetim alt sayfası (hub)
//
// Tek BottomSheetModal içinde dört görünüm: açık borç LİSTESİ, "Borç Aldım"
// (EKLE), "Borcu Öde" (kısmi destekli) ve vade/hatırlatma ayarları. Fiş/
// harcama bütünlüğü bozulmaz — geri ödeme
// tüketim sayılmaz; nakit-akışı etkisi useBudget/debtMath üzerinden işlenir.
// Tema kalıbı: useAppTheme + useMemo(getStyles) (P12). Birincil CTA = şüşevar.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import BottomSheetModal from './BottomSheetModal';
import CustomDatePicker from './CustomDatePicker';
import DebtReminderFields from './DebtReminderFields';
import GlassDeleteModal from './GlassDeleteModal';
import { SparkToast } from './SparkToast';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../theme/spacing';
import { createSusevarStyles, susevarButtonPressed } from '../theme/susevar';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateFull, formatDayMonth, getToday } from '../utils/dateUtils';
import {
  getDebtDueState,
  isValidDebtReminderTime,
  parseDebtReminderDays,
} from '../utils/debtReminder';
import { DebtDao } from '../db/debtDao';
import { ExpenseDao } from '../db/expenseDao';
import { Debt, DebtPayment, ExpenseWithDetails } from '../db/schema';
import { useLanguage } from '../i18n/LanguageContext';
import { useRefreshActions } from '../context/RefreshContext';

const SCREEN_H = Dimensions.get('window').height;

interface DebtSheetProps {
  visible: boolean;
  onClose: () => void;
  currency: string;
  /** Ekleme/ödeme sonrası dashboard'ı tazelemek için. */
  onChanged?: () => void | Promise<void>;
}

type DebtView = 'list' | 'add' | 'repay' | 'reminder';
type DatePickerTarget = 'debt-date' | 'repay-date' | 'due-date' | null;

function parseAmountInput(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

function playSuccessHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    .catch(() => undefined);
}

export default function DebtSheet({ visible, onClose, currency, onChanged }: DebtSheetProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { triggerRefresh } = useRefreshActions();
  const today = getToday();

  const [view, setView] = useState<DebtView>('list');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);

  // Liste sekmesi: açık borçlar vs tüm geçmiş (açık + kapanmış).
  const [listTab, setListTab] = useState<'open' | 'history'>('open');
  const [allDebts, setAllDebts] = useState<Debt[]>([]);
  // Geçmişte bir borca dokununca ödeme dökümü (tarih + tutar) satır içi açılır.
  const [expandedDebtId, setExpandedDebtId] = useState<number | null>(null);
  const [paymentsByDebt, setPaymentsByDebt] = useState<Record<number, DebtPayment[]>>({});

  // Ekle formu
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getToday());
  const [linkExpanded, setLinkExpanded] = useState(false);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseWithDetails[]>([]);
  const [linkedExpenseId, setLinkedExpenseId] = useState<number | null>(null);

  // Ekleme ve mevcut borç düzenleme görünümlerinin paylaştığı vade draft'ı.
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState('3');
  const [reminderTime, setReminderTime] = useState('09:00');

  // Öde formu
  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(getToday());

  // Silme onayı — kazara eklenen/yanlış borcu kaldırmak için (ödemeleri CASCADE).
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    // expo-sqlite tek bağlantıda eşzamanlı prepareAsync çağrılarında kararsız
    // davranabiliyor. Özellikle silme sonrası dashboard bütçesi de yenilenirken
    // Promise.all yarış yaratıp bütçenin eski borç etkisiyle kalmasına yol açıyordu.
    const open = await DebtDao.listOpen('borrowed');
    const all = await DebtDao.listAll('borrowed');
    setDebts(open);
    setAllDebts(all);
    // Veri değişti → ödeme önbelleği ve açık satır bayatlamasın.
    setPaymentsByDebt({});
    setExpandedDebtId(null);
  }, []);

  useEffect(() => {
    if (visible) {
      setView('list');
      setListTab('open');
      setDatePickerTarget(null);
      void reload();
    } else {
      setDatePickerTarget(null);
    }
  }, [visible, reload]);

  // Geçmişte borca dokun → ödeme dökümünü aç/kapat (ilk açılışta tembel yükle).
  const toggleExpand = useCallback(async (debtId: number) => {
    const willExpand = expandedDebtId !== debtId;
    setExpandedDebtId(willExpand ? debtId : null);
    if (willExpand && paymentsByDebt[debtId] === undefined) {
      try {
        const pays = await DebtDao.getPayments(debtId);
        setPaymentsByDebt((m) => ({ ...m, [debtId]: pays }));
      } catch {
        setPaymentsByDebt((m) => ({ ...m, [debtId]: [] }));
      }
    }
  }, [expandedDebtId, paymentsByDebt]);

  const resetReminderDraft = useCallback(() => {
    setDueDate(null);
    setReminderEnabled(false);
    setReminderDaysBefore('3');
    setReminderTime('09:00');
  }, []);

  const resetAddForm = useCallback(() => {
    setAmount('');
    setCounterparty('');
    setNote('');
    setDate(getToday());
    setLinkExpanded(false);
    setLinkedExpenseId(null);
    resetReminderDraft();
  }, [resetReminderDraft]);

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

  const openReminderSettings = useCallback((debt: Debt) => {
    setActiveDebt(debt);
    setDueDate(debt.due_date);
    setReminderEnabled(debt.reminder_enabled === 1 && debt.due_date != null);
    setReminderDaysBefore(String(debt.reminder_days_before));
    setReminderTime(debt.reminder_time);
    setView('reminder');
  }, []);

  const beginSaving = useCallback((): boolean => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    return true;
  }, []);

  const finishSaving = useCallback(() => {
    savingRef.current = false;
    setSaving(false);
  }, []);

  const getReminderDraft = useCallback(() => {
    if (!reminderEnabled) {
      return {
        dueDate,
        reminderEnabled: false,
        reminderDaysBefore: undefined,
        reminderTime: undefined,
      };
    }
    if (!dueDate) {
      SparkToast.show(t('debt_reminder_requires_due_date'), 'error');
      return null;
    }
    const daysBefore = parseDebtReminderDays(reminderDaysBefore);
    if (daysBefore == null) {
      SparkToast.show(t('debt_reminder_invalid_days'), 'error');
      return null;
    }
    if (!isValidDebtReminderTime(reminderTime)) {
      SparkToast.show(t('debt_reminder_invalid_time'), 'error');
      return null;
    }
    return {
      dueDate,
      reminderEnabled: true,
      reminderDaysBefore: daysBefore,
      reminderTime,
    };
  }, [dueDate, reminderDaysBefore, reminderEnabled, reminderTime, t]);

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
    const reminderDraft = getReminderDraft();
    if (!reminderDraft || !beginSaving()) return;
    try {
      await DebtDao.create({
        direction: 'borrowed',
        counterparty: counterparty.trim(),
        amount: parsed,
        currency,
        date,
        dueDate: reminderDraft.dueDate,
        reminderEnabled: reminderDraft.reminderEnabled,
        reminderDaysBefore: reminderDraft.reminderDaysBefore,
        reminderTime: reminderDraft.reminderTime,
        note: note.trim() || null,
        linkedExpenseId,
      });
      playSuccessHaptic();
      SparkToast.show(t('debt_created_toast'), 'success', formatCurrency(parsed, currency, false));
      await reload();
      // Yerel borç sorguları bittikten sonra bütçeyi yenile: aynı SQLite
      // bağlantısında iki bağımsız okuma zinciri üst üste binmesin.
      await onChanged?.();
      triggerRefresh();
      setView('list');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      finishSaving();
    }
  }

  async function handleRepay() {
    if (!activeDebt) return;
    const parsed = parseAmountInput(repayAmount);
    if (parsed <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }
    if (!beginSaving()) return;
    try {
      await DebtDao.repay(activeDebt.id, parsed, repayDate);
      playSuccessHaptic();
      // Ödeme kalanı kapatıyorsa "kapandı", değilse "kaydedildi".
      const settled = parsed >= activeDebt.remaining;
      SparkToast.show(settled ? t('debt_settled_toast') : t('debt_repaid_toast'), 'success');
      await reload();
      await onChanged?.();
      triggerRefresh();
      setActiveDebt(null);
      setView('list');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      finishSaving();
    }
  }

  async function handleReminderSave() {
    if (!activeDebt) return;
    const reminderDraft = getReminderDraft();
    if (!reminderDraft || !beginSaving()) return;
    try {
      const updated = await DebtDao.updateReminderSettings(activeDebt.id, reminderDraft);
      if (!updated) {
        SparkToast.show(t('debt_reminder_unavailable'), 'info');
        await reload();
        setActiveDebt(null);
        setView('list');
        return;
      }
      playSuccessHaptic();
      SparkToast.show(t('debt_reminder_saved_toast'), 'success');
      setActiveDebt({
        ...activeDebt,
        due_date: reminderDraft.dueDate,
        reminder_enabled: reminderDraft.reminderEnabled ? 1 : 0,
        reminder_days_before:
          reminderDraft.reminderDaysBefore ?? activeDebt.reminder_days_before,
        reminder_time: reminderDraft.reminderTime ?? activeDebt.reminder_time,
      });
      await reload();
      triggerRefresh();
      setView('repay');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      finishSaving();
    }
  }

  async function handleDelete() {
    if (deleteId == null) return;
    try {
      await DebtDao.remove(deleteId);
      playSuccessHaptic();
      SparkToast.show(t('debt_deleted_toast'), 'success');
      await reload();
      await onChanged?.();
      triggerRefresh();
      setActiveDebt(null);
      setView('list');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setDeleteId(null);
    }
  }

  // ── Görünümler ────────────────────────────────────────────────
  const renderOpenList = () =>
    debts.length === 0 ? (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="check-circle-outline" size={30} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>{t('debt_empty_title')}</Text>
        <Text style={styles.emptyDesc}>{t('debt_empty_desc')}</Text>
      </View>
    ) : (
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
        {debts.map((d) => {
          const dueState = getDebtDueState(d.due_date, today);
          const dueDateLabel = d.due_date ? formatDateFull(d.due_date, t) : '';
          const dueLabel = dueState === 'today'
            ? t('debt_due_status_today')
            : dueState === 'overdue'
              ? t('debt_due_status_overdue', { date: dueDateLabel })
              : dueState === 'upcoming'
                ? t('debt_due_summary', { date: dueDateLabel })
                : '';
          return (
            <Pressable
              key={d.id}
              testID={`debt-open-row-${d.id}`}
              onPress={() => openRepay(d)}
              style={({ pressed }) => [styles.debtRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={[
                d.counterparty,
                formatCurrency(d.remaining, currency, false),
                dueLabel,
                d.reminder_enabled === 1 ? t('debt_reminder_active_short') : '',
              ].filter(Boolean).join(', ')}
              accessibilityHint={t('debt_open_hint')}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.debtName} numberOfLines={1}>{d.counterparty}</Text>
                <Text style={styles.debtMeta} numberOfLines={1}>
                  {formatDayMonth(d.date, t)}
                  {d.remaining < d.amount
                    ? ` · ${formatCurrency(d.remaining, currency, false)} / ${formatCurrency(d.amount, currency, false)}`
                    : ''}
                </Text>
                {dueState !== 'none' ? (
                  <View style={styles.dueMetaRow}>
                    <MaterialCommunityIcons
                      name={dueState === 'overdue' ? 'calendar-alert' : 'calendar-clock-outline'}
                      size={14}
                      color={dueState === 'overdue' ? Colors.danger : dueState === 'today' ? Colors.warning : Colors.textSecondary}
                      accessible={false}
                    />
                    <Text
                      style={[
                        styles.dueMetaText,
                        dueState === 'overdue' && styles.dueMetaOverdue,
                        dueState === 'today' && styles.dueMetaToday,
                      ]}
                      numberOfLines={2}
                    >
                      {dueLabel}
                      {d.reminder_enabled === 1 ? ` · ${t('debt_reminder_active_short')}` : ''}
                    </Text>
                  </View>
                ) : null}
                {d.note ? (
                  <Text style={styles.debtNote} numberOfLines={1}>{d.note}</Text>
                ) : null}
              </View>
              <View style={styles.debtRight}>
                <Text style={styles.debtRemaining}>{formatCurrency(d.remaining, currency, false)}</Text>
                <View style={styles.payChip}>
                  <Text style={styles.payChipText}>{t('debt_repay_cta')}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    );

  const renderHistoryList = () =>
    allDebts.length === 0 ? (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="history" size={30} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>{t('empty')}</Text>
      </View>
    ) : (
      <ScrollView style={[styles.listScroll, styles.listScrollHistory]} contentContainerStyle={styles.listContent}>
        {allDebts.map((d) => {
          const settled = d.status === 'settled';
          const expanded = expandedDebtId === d.id;
          const pays = paymentsByDebt[d.id];
          return (
            <View key={d.id}>
              <Pressable
                onPress={() => void toggleExpand(d.id)}
                style={({ pressed }) => [styles.debtRow, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.debtName} numberOfLines={1}>{d.counterparty}</Text>
                  <Text style={styles.debtMeta} numberOfLines={1}>
                    {formatDayMonth(d.date, t)} · {formatCurrency(d.amount, currency, false)}
                  </Text>
                </View>
                <View style={styles.debtRight}>
                  {settled ? (
                    <View style={styles.settledBadge}>
                      <MaterialCommunityIcons name="check" size={12} color={Colors.primary} />
                      <Text style={styles.settledBadgeText}>{t('debt_status_settled')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.debtRemaining}>{formatCurrency(d.remaining, currency, false)}</Text>
                  )}
                  <MaterialCommunityIcons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </View>
              </Pressable>
              {expanded ? (
                <View style={styles.paymentsBox}>
                  {d.note ? (
                    <View style={styles.noteRow}>
                      <MaterialCommunityIcons name="note-text-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.noteText}>{d.note}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.paymentsTitle}>{t('debt_payment_history')}</Text>
                  {pays === undefined ? null : pays.length === 0 ? (
                    <Text style={styles.paymentEmpty}>{t('debt_no_payments')}</Text>
                  ) : (
                    pays.map((p) => (
                      <View key={p.id} style={styles.paymentRow}>
                        <Text style={styles.paymentDate}>{formatDayMonth(p.date, t)}</Text>
                        <Text style={styles.paymentAmount}>{formatCurrency(p.amount, currency, false)}</Text>
                      </View>
                    ))
                  )}
                  <Pressable onPress={() => setDeleteId(d.id)} style={styles.histDeleteBtn} hitSlop={8}>
                    <MaterialCommunityIcons name="trash-can-outline" size={15} color={Colors.danger} />
                    <Text style={styles.histDeleteText}>{t('delete')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    );

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

      {/* Açık / Geçmiş segmenti */}
      <View style={styles.segment}>
        {(['open', 'history'] as const).map((tab) => {
          const active = listTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => { setListTab(tab); setExpandedDebtId(null); }}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab === 'open' ? t('debt_tab_open') : t('debt_tab_history')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {listTab === 'open' ? renderOpenList() : renderHistoryList()}

      {/* "Borç Aldım" yalnız Açık sekmesinde — geçmiş salt görüntüleme bağlamı. */}
      {listTab === 'open' ? (
        <Pressable
          testID="debt-open-add"
          onPress={openAdd}
          style={({ pressed }) => [styles.primaryBtn, pressed && susevarButtonPressed]}
        >
          <View style={styles.primaryBtnRow}>
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>{t('debt_add_title')}</Text>
          </View>
        </Pressable>
      ) : null}
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
          testID="debt-add-amount"
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.fieldLabel}>{t('debt_counterparty')}</Text>
        <TextInput
          testID="debt-add-counterparty"
          style={styles.input}
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder={t('debt_counterparty_ph')}
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.fieldLabel}>{t('debt_received_date')}</Text>
        <Pressable
          testID="debt-transaction-date-button"
          style={[styles.input, styles.inputAsButton]}
          onPress={() => setDatePickerTarget('debt-date')}
          accessibilityRole="button"
        >
          <Text style={styles.inputButtonText}>{date || t('select_date')}</Text>
          <MaterialCommunityIcons name="calendar-outline" size={18} color={Colors.textSecondary} />
        </Pressable>

        <DebtReminderFields
          dueDate={dueDate}
          reminderEnabled={reminderEnabled}
          reminderDaysBefore={reminderDaysBefore}
          reminderTime={reminderTime}
          disabled={saving}
          onPressDueDate={() => setDatePickerTarget('due-date')}
          onClearDueDate={() => {
            setDueDate(null);
            setReminderEnabled(false);
          }}
          onReminderEnabledChange={setReminderEnabled}
          onReminderDaysBeforeChange={setReminderDaysBefore}
          onReminderTimeChange={setReminderTime}
        />

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
          testID="debt-add-save"
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
        <Pressable
          onPress={() => activeDebt && setDeleteId(activeDebt.id)}
          hitSlop={10}
          style={styles.headerDeleteBtn}
          accessibilityLabel={t('delete')}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={Colors.danger} />
        </Pressable>
      </View>

      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {activeDebt ? (
          <>
            <View style={styles.repaySummary}>
              <Text style={styles.repayName}>{activeDebt.counterparty}</Text>
              {activeDebt.note ? (
                <Text style={styles.repayNote} numberOfLines={2}>{activeDebt.note}</Text>
              ) : null}
              <Text style={styles.repayRemainingLabel}>{t('debt_remaining')}</Text>
              <Text style={styles.repayRemaining}>{formatCurrency(activeDebt.remaining, currency)}</Text>
            </View>
            <Pressable
              testID="debt-open-reminder-settings"
              accessibilityRole="button"
              accessibilityLabel={t('debt_reminder_edit')}
              accessibilityHint={t('debt_reminder_edit_hint')}
              onPress={() => openReminderSettings(activeDebt)}
              style={({ pressed }) => [styles.reminderSummaryCard, pressed && styles.reminderSummaryPressed]}
            >
              <View style={styles.reminderSummaryIcon}>
                <MaterialCommunityIcons
                  name={activeDebt.reminder_enabled === 1 ? 'bell-outline' : 'calendar-clock-outline'}
                  size={20}
                  color={activeDebt.reminder_enabled === 1 ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <View style={styles.reminderSummaryCopy}>
                <Text style={styles.reminderSummaryTitle}>{t('debt_reminder_title')}</Text>
                <Text style={styles.reminderSummaryText} numberOfLines={2}>
                  {activeDebt.due_date
                    ? t('debt_due_summary', { date: formatDateFull(activeDebt.due_date, t) })
                    : t('debt_due_date_none')}
                  {activeDebt.reminder_enabled === 1
                    ? ` · ${activeDebt.reminder_days_before === 0
                      ? t('debt_reminder_when_due')
                      : t('debt_reminder_days_before_short', { days: activeDebt.reminder_days_before })}, ${activeDebt.reminder_time}`
                    : ''}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>
          </>
        ) : null}

        <Text style={styles.fieldLabel}>{t('amount')}</Text>
        <TextInput
          testID="debt-repay-amount"
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

        <Text style={styles.fieldLabel}>{t('debt_payment_date')}</Text>
        <Pressable
          testID="debt-repayment-date-button"
          style={[styles.input, styles.inputAsButton]}
          onPress={() => setDatePickerTarget('repay-date')}
          accessibilityRole="button"
        >
          <Text style={styles.inputButtonText}>{repayDate || t('select_date')}</Text>
          <MaterialCommunityIcons name="calendar-outline" size={18} color={Colors.textSecondary} />
        </Pressable>

        <Pressable
          testID="debt-repay-save"
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

  const renderReminder = () => (
    <>
      <View style={styles.formHeader}>
        <Pressable
          onPress={() => setView(activeDebt ? 'repay' : 'list')}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('notif_go_back')}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.formTitle}>{t('debt_reminder_edit')}</Text>
      </View>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        {activeDebt ? (
          <View style={styles.reminderDebtContext}>
            <Text style={styles.reminderDebtName}>{activeDebt.counterparty}</Text>
            <Text style={styles.reminderDebtAmount}>
              {formatCurrency(activeDebt.remaining, currency)}
            </Text>
          </View>
        ) : null}

        <DebtReminderFields
          dueDate={dueDate}
          reminderEnabled={reminderEnabled}
          reminderDaysBefore={reminderDaysBefore}
          reminderTime={reminderTime}
          disabled={saving}
          onPressDueDate={() => setDatePickerTarget('due-date')}
          onClearDueDate={() => {
            setDueDate(null);
            setReminderEnabled(false);
          }}
          onReminderEnabledChange={setReminderEnabled}
          onReminderDaysBeforeChange={setReminderDaysBefore}
          onReminderTimeChange={setReminderTime}
        />

        <Pressable
          testID="debt-reminder-save"
          onPress={handleReminderSave}
          disabled={saving || !activeDebt}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !activeDebt }}
          style={({ pressed }) => [
            styles.primaryBtn,
            { marginTop: Spacing.xl },
            (saving || !activeDebt) && { opacity: 0.6 },
            pressed && susevarButtonPressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {saving ? t('processing') : t('debt_reminder_save')}
          </Text>
        </Pressable>
        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </>
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, scheme === 'dark' && styles.sheetDark]}
      backdropColor={scheme === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.55)'}
      showHandle
    >
      {/* Kapat (X) yok — sürükle-kapat kulpu zaten var (gereksiz tekrar). */}
      {view === 'list'
        ? renderList()
        : view === 'add'
          ? renderAdd()
          : view === 'repay'
            ? renderRepay()
            : renderReminder()}

      <CustomDatePicker
        visible={datePickerTarget !== null}
        onClose={() => setDatePickerTarget(null)}
        initialDate={datePickerTarget === 'repay-date'
          ? repayDate
          : datePickerTarget === 'due-date'
            ? dueDate ?? getToday()
            : date}
        onSelectDate={(selectedDate) => {
          if (datePickerTarget === 'repay-date') setRepayDate(selectedDate);
          else if (datePickerTarget === 'due-date') setDueDate(selectedDate);
          else if (datePickerTarget === 'debt-date') setDate(selectedDate);
        }}
      />

      <GlassDeleteModal
        visible={deleteId !== null}
        message={t('debt_delete_msg')}
        onCancel={() => setDeleteId(null)}
        onDelete={handleDelete}
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
  /** Karanlık modda cardBorder (#505060) üstte parlak beyazımsı çizgi yapıyordu;
      koyu sheet zaten dimmed backdrop + kulpla ayrışıyor → üst kenarlığı kaldır. */
  sheetDark: {
    borderTopWidth: 0,
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
  // Açık / Geçmiş segmenti
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.round,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary + '22',
  },
  segmentText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    // Column + alignItems:center'da Text içeriğe göre ölçülüp Android'de son glifi
    // ("Açık"→"Açı") kırpıyordu; tam genişlik + ortala → kırpılma yok.
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  // Geçmiş — "Ödendi" rozeti + ödeme dökümü
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary + '22',
  },
  settledBadgeText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  paymentsBox: {
    marginTop: 4,
    marginBottom: 2,
    marginLeft: Spacing.md,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    gap: 4,
  },
  paymentsTitle: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  /** Geçmiş detayında borç notu (varsa) — ödeme dökümünün üstünde. */
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  noteText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
  paymentEmpty: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDate: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  paymentAmount: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  /** Geçmiş detayında "Sil" — kazara/yanlış borcu kaldır. */
  histDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  histDeleteText: {
    ...Typography.labelSmall,
    color: Colors.danger,
    fontFamily: FontFamily.semiBold,
  },
  // Liste
  listScroll: {
    maxHeight: SCREEN_H * 0.46,
  },
  // Geçmiş sekmesinde "Borç Aldım" butonu olmadığından liste daha uzun olabilir.
  listScrollHistory: {
    maxHeight: SCREEN_H * 0.6,
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
  dueMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 5,
  },
  dueMetaText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  dueMetaOverdue: {
    color: Colors.danger,
    fontFamily: FontFamily.semiBold,
  },
  dueMetaToday: {
    color: Colors.warning,
    fontFamily: FontFamily.semiBold,
  },
  /** Açık satırda borç notu (varsa) — küçük, soluk. */
  debtNote: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontStyle: 'italic',
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
  headerDeleteBtn: {
    marginLeft: 'auto',
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
  repayNote: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: Spacing.lg,
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
  reminderSummaryCard: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reminderSummaryPressed: {
    opacity: 0.8,
    borderColor: Colors.primary,
  },
  reminderSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '14',
  },
  reminderSummaryCopy: { flex: 1, minWidth: 0 },
  reminderSummaryTitle: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  reminderSummaryText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  reminderDebtContext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reminderDebtName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },
  reminderDebtAmount: {
    ...Typography.labelLarge,
    color: Colors.danger,
    fontFamily: FontFamily.bold,
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
    ...createSusevarStyles(Colors).button,
    marginTop: Spacing.lg,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  primaryBtnText: createSusevarStyles(Colors).text,
});
