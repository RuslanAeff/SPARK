// S.P.A.R.K. — Ek Gelir alt sayfası
//
// Bütçe planının DIŞINDA gelen nakit (banka promosyonu, hediye, tek seferlik ek
// iş) buradan girilir. Borç sayfasının (DebtSheet) sadeleştirilmiş kardeşi:
// geri ödeme yükümlülüğü olmadığı için "öde" görünümü ve kısmi ödeme YOKTUR —
// yalnız LİSTE ve EKLE. Kayıt, `date`'in düştüğü döngünün harcanabilir tutarını
// artırır (useBudget → debtMath.extraIncomeIn); sonraki döngüye sarkmaz.
// Harcama/fiş tablolarına dokunulmaz → tüketim analizi gelirden etkilenmez.
// Tema kalıbı: useAppTheme + useMemo(getStyles) (P12). Birincil CTA = şüşevar.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, FlatList, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import BottomSheetModal from './BottomSheetModal';
import { getFinanceSheetBaseStyles } from './financeSheetStyles';
import CustomDatePicker from './CustomDatePicker';
import GlassDeleteModal from './GlassDeleteModal';
import { SparkToast } from './SparkToast';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { createSusevarStyles, susevarButtonPressed } from '../theme/susevar';
import { formatCurrency } from '../utils/formatCurrency';
import { parseAmountInputOrZero as parseAmountInput } from '../utils/moneyMath';
import { formatDayMonth, getToday } from '../utils/dateUtils';
import { IncomeDao } from '../db/incomeDao';
import { ExtraIncome } from '../db/schema';
import { useLanguage } from '../i18n/LanguageContext';
import { useKeepFocusedInputVisible } from '../hooks/useKeyboard';
import { SegmentedContent, SegmentedTabs } from './SegmentedTabs';
import { FINANCE_LIST_VIRTUALIZATION, FinanceListGap } from './financeSheetList';
import { useThemedStyles } from '../theme/useThemedStyles';


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

const INCOME_TABS = ['cycle', 'all'] as const;

export default function IncomeSheet({
  visible, onClose, currency, cycleStart, cycleEnd, onChanged,
}: IncomeSheetProps) {
  // UX-04: klavye açılınca odaklı alan formun içinde klavyenin üstüne kayar.
  const formScrollRef = useRef<ScrollView | null>(null);
  useKeepFocusedInputVisible(formScrollRef);
  const scheme = useAppTheme();
  // UX-07: pencere boyu modül yüklenirken bir kez değil, her boyut değişiminde okunur.
  const { height: windowHeight } = useWindowDimensions();
  const styles = useThemedStyles(getStyles, windowHeight);
  const { t } = useLanguage();

  const [view, setView] = useState<IncomeView>('list');
  const [listTab, setListTab] = useState<'cycle' | 'all'>('cycle');
  const [cycleIncomes, setCycleIncomes] = useState<ExtraIncome[]>([]);
  const [allIncomes, setAllIncomes] = useState<ExtraIncome[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // DebtSheet ile aynı desen: ref aynı karedeki ikinci dokunuşu da durdurur (BUG-30).
  const savingRef = useRef(false);
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
    if (savingRef.current) return;
    savingRef.current = true;
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
      savingRef.current = false;
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
      // UX-12: yalnız görünen satırlar çizilir.
      <FlatList
        data={rows}
        keyExtractor={inc => String(inc.id)}
        extraData={expandedId}
        style={[styles.listScroll, scrollStyle]}
        contentContainerStyle={styles.listContentVirtual}
        ItemSeparatorComponent={FinanceListGap}
        {...FINANCE_LIST_VIRTUALIZATION}
        renderItem={({ item: inc }) => {
          const expanded = expandedId === inc.id;
          return (
            <View key={inc.id}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
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
                  <Pressable accessibilityRole="button" style={styles.histDeleteBtn} onPress={() => setDeleteId(inc.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={14} color={Colors.danger} />
                    <Text style={styles.histDeleteText}>{t('delete')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />
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

      {/* Bu dönem / Tümü: kayan cam vurgu ve yönlü içerik geçişi. */}
      <SegmentedTabs
        options={INCOME_TABS.map(key => ({
          key,
          label: key === 'cycle' ? t('income_tab_cycle') : t('income_tab_all'),
          testID: `income-tab-${key}`,
        }))}
        value={listTab}
        onChange={(tab) => { setListTab(tab); setExpandedId(null); }}
      />

      <SegmentedContent order={INCOME_TABS} value={listTab}>
        {listTab === 'cycle'
          ? renderRows(cycleIncomes)
          : renderRows(allIncomes, styles.listScrollAll)}
      </SegmentedContent>

      {/* Ekleme CTA'sı yalnız "Bu dönem"de — "Tümü" salt görüntüleme bağlamı. */}
      {listTab === 'cycle' ? (
        <Pressable accessibilityRole="button"
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('settings_back')} onPress={() => setView('list')} hitSlop={10} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.formTitle}>{t('income_add_title')}</Text>
      </View>

      <ScrollView ref={formScrollRef} style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
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
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('date')}: ${date || t('select_date')}`} style={[styles.input, styles.inputAsButton]} onPress={() => setDatePickerVisible(true)}>
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

        <Pressable accessibilityRole="button"
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

const getStyles = (windowHeight: number) => StyleSheet.create({
  ...getFinanceSheetBaseStyles(windowHeight),
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.success,
    fontFamily: FontFamily.semiBold,
    marginTop: 2,
  },
  // "Tümü" sekmesinde ekleme butonu olmadığından liste daha uzun olabilir.
  listScrollAll: {
    maxHeight: windowHeight * 0.6,
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
  histDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
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
  primaryBtnText: createSusevarStyles(Colors).text,
});
