// S.P.A.R.K. — Ek Gelir alt sayfası
//
// Bütçe planının DIŞINDA gelen nakit (banka promosyonu, hediye, tek seferlik ek
// iş) buradan girilir. Borç sayfasının (DebtSheet) sadeleştirilmiş kardeşi:
// geri ödeme yükümlülüğü olmadığı için "öde" görünümü ve kısmi ödeme YOKTUR —
// yalnız LİSTE ve EKLE. Kayıt, `date`'in düştüğü döngünün harcanabilir tutarını
// artırır (useBudget → debtMath.extraIncomeIn); sonraki döngüye sarkmaz.
// Harcama/fiş tablolarına dokunulmaz → tüketim analizi gelirden etkilenmez.
// Tema kalıbı: useAppTheme + useMemo(getStyles) (P12). Birincil CTA = şüşevar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import BottomSheetModal from './BottomSheetModal';
import CustomDatePicker from './CustomDatePicker';
import GlassDeleteModal from './GlassDeleteModal';
import { SparkToast } from './SparkToast';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../theme/spacing';
import { createSusevarStyles, susevarButtonPressed } from '../theme/susevar';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDayMonth, getToday } from '../utils/dateUtils';
import { IncomeDao } from '../db/incomeDao';
import { ExtraIncome } from '../db/schema';
import { useLanguage } from '../i18n/LanguageContext';

const SCREEN_H = Dimensions.get('window').height;

interface IncomeSheetProps {
  visible: boolean;
  onClose: () => void;
  currency: string;
  /** Aktif bütçe döngüsü (budget.periodStart/periodEnd) — "Bu dönem" sekmesi için. */
  cycleStart: string;
  cycleEnd: string;
  /** Ekleme/silme sonrası dashboard'ı tazelemek için. */
  onChanged?: () => void | Promise<void>;
}

type IncomeView = 'list' | 'add';

function parseAmountInput(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

export default function IncomeSheet({
  visible, onClose, currency, cycleStart, cycleEnd, onChanged,
}: IncomeSheetProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();

  const [view, setView] = useState<IncomeView>('list');
  const [listTab, setListTab] = useState<'cycle' | 'all'>('cycle');
  const [cycleIncomes, setCycleIncomes] = useState<ExtraIncome[]>([]);
  const [allIncomes, setAllIncomes] = useState<ExtraIncome[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Ekle formu
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getToday());

  const reload = useCallback(async () => {
    // Seri okuma (Promise.all DEĞİL) — expo-sqlite tek bağlantıda eşzamanlı
    // prepareAsync'te "shared object already released" verebiliyor (P28).
    const inCycle = cycleStart && cycleEnd
      ? await IncomeDao.listByDateRange(cycleStart, cycleEnd)
      : [];
    const all = await IncomeDao.listAll(100);
    setCycleIncomes(inCycle);
    setAllIncomes(all);
    setExpandedId(null);
  }, [cycleStart, cycleEnd]);

  useEffect(() => {
    if (visible) {
      setView('list');
      setListTab('cycle');
      void reload();
    }
  }, [visible, reload]);

  const resetAddForm = useCallback(() => {
    setAmount('');
    setSource('');
    setNote('');
    setDate(getToday());
  }, []);

  const openAdd = useCallback(() => {
    resetAddForm();
    setView('add');
  }, [resetAddForm]);

  const cycleTotal = useMemo(
    () => cycleIncomes.reduce((s, i) => s + i.amount, 0),
    [cycleIncomes],
  );

  async function handleAdd() {
    const parsed = parseAmountInput(amount);
    if (parsed <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }
    if (!source.trim()) {
      SparkToast.show(t('income_source_required'), 'error');
      return;
    }
    setSaving(true);
    try {
      await IncomeDao.create({
        source: source.trim(),
        amount: parsed,
        currency,
        date,
        note: note.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('income_created_toast'), 'success', formatCurrency(parsed, currency, false));
      await reload();
      await onChanged?.();
      setView('list');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteId == null) return;
    try {
      await IncomeDao.remove(deleteId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('income_deleted_toast'), 'success');
      await reload();
      await onChanged?.();
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setDeleteId(null);
    }
  }

  // ── Görünümler ────────────────────────────────────────────────
  const renderRows = (rows: ExtraIncome[], scrollStyle?: object) =>
    rows.length === 0 ? (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="cash-plus" size={30} color={Colors.success} />
        </View>
        <Text style={styles.emptyTitle}>{t('income_empty_title')}</Text>
        <Text style={styles.emptyDesc}>{t('income_empty_desc')}</Text>
      </View>
    ) : (
      <ScrollView style={[styles.listScroll, scrollStyle]} contentContainerStyle={styles.listContent}>
        {rows.map((inc) => {
          const expanded = expandedId === inc.id;
          return (
            <View key={inc.id}>
              <Pressable
                onPress={() => setExpandedId(expanded ? null : inc.id)}
                style={({ pressed }) => [styles.incomeRow, pressed && { opacity: 0.85 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.incomeName} numberOfLines={1}>{inc.source}</Text>
                  <Text style={styles.incomeMeta} numberOfLines={1}>{formatDayMonth(inc.date, t)}</Text>
                </View>
                <View style={styles.incomeRight}>
                  <Text style={styles.incomeAmount}>
                    +{formatCurrency(inc.amount, currency, false)}
                  </Text>
                  <MaterialCommunityIcons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </View>
              </Pressable>
              {expanded ? (
                <View style={styles.detailBox}>
                  {inc.note ? (
                    <View style={styles.noteRow}>
                      <MaterialCommunityIcons name="text" size={13} color={Colors.textSecondary} />
                      <Text style={styles.noteText}>{inc.note}</Text>
                    </View>
                  ) : null}
                  <Pressable style={styles.histDeleteBtn} onPress={() => setDeleteId(inc.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={14} color={Colors.danger} />
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
        <View style={[styles.headerIcon, { backgroundColor: Colors.success + '22' }]}>
          <MaterialCommunityIcons name="cash-plus" size={24} color={Colors.success} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{t('income_sheet_title')}</Text>
          {cycleTotal > 0 ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              +{formatCurrency(cycleTotal, currency)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Bu dönem / Tümü segmenti */}
      <View style={styles.segment}>
        {(['cycle', 'all'] as const).map((tab) => {
          const active = listTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => { setListTab(tab); setExpandedId(null); }}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab === 'cycle' ? t('income_tab_cycle') : t('income_tab_all')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {listTab === 'cycle'
        ? renderRows(cycleIncomes)
        : renderRows(allIncomes, styles.listScrollAll)}

      {/* Ekleme CTA'sı yalnız "Bu dönem"de — "Tümü" salt görüntüleme bağlamı. */}
      {listTab === 'cycle' ? (
        <Pressable
          onPress={openAdd}
          style={({ pressed }) => [styles.primaryBtn, pressed && susevarButtonPressed]}
        >
          <View style={styles.primaryBtnRow}>
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>{t('income_add_title')}</Text>
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
        <Text style={styles.formTitle}>{t('income_add_title')}</Text>
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

        <Text style={styles.fieldLabel}>{t('income_source')}</Text>
        <TextInput
          style={styles.input}
          value={source}
          onChangeText={setSource}
          placeholder={t('income_source_ph')}
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

        {/* Gelirin hangi döngüye yazılacağını tarih belirler — kullanıcı bunu bilmeli. */}
        <View style={styles.hintRow}>
          <MaterialCommunityIcons name="information-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.hintText}>{t('income_cycle_hint')}</Text>
        </View>

        <Pressable
          onPress={handleAdd}
          disabled={saving}
          style={({ pressed }) => [styles.primaryBtn, { marginTop: Spacing.lg }, saving && { opacity: 0.6 }, pressed && susevarButtonPressed]}
        >
          <Text style={styles.primaryBtnText}>{saving ? t('processing') : t('save')}</Text>
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
      {view === 'list' ? renderList() : renderAdd()}

      <CustomDatePicker
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        initialDate={date}
        onSelectDate={setDate}
      />

      <GlassDeleteModal
        visible={deleteId !== null}
        message={t('income_delete_msg')}
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
    color: Colors.success,
    fontFamily: FontFamily.semiBold,
    marginTop: 2,
  },
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
    // Android'de içeriğe göre ölçülen Text son glifi kırpıyordu (DebtSheet dersi).
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  listScroll: {
    maxHeight: SCREEN_H * 0.46,
  },
  // "Tümü" sekmesinde ekleme butonu olmadığından liste daha uzun olabilir.
  listScrollAll: {
    maxHeight: SCREEN_H * 0.6,
  },
  listContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  incomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  incomeName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  incomeMeta: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  incomeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  incomeAmount: {
    ...Typography.bodyLarge,
    color: Colors.success,
    fontFamily: FontFamily.bold,
  },
  detailBox: {
    marginTop: 4,
    marginBottom: 2,
    marginLeft: Spacing.md,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    gap: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  noteText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
  histDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  histDeleteText: {
    ...Typography.labelSmall,
    color: Colors.danger,
    fontFamily: FontFamily.semiBold,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success + '15',
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.lg,
  },
  hintText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    flex: 1,
  },
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
