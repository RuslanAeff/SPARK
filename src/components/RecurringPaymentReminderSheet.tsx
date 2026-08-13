// S.P.A.R.K. — Kullanıcı tarafından onaylanan düzenli ödeme planı formu
// Bu yüzey yalnız tercihi kalıcılaştırır; işletim sistemi zamanlayıcısı Faz 5'tedir.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BottomSheetModal from './BottomSheetModal';
import CustomDatePicker from './CustomDatePicker';
import { SparkToast } from './SparkToast';
import { RecurringPaymentReminderDao } from '../db/recurringPaymentReminderDao';
import type {
  RecurringPaymentReminderSource,
  RecurringPaymentReminderStatus,
  ReminderRecurrenceUnit,
} from '../db/schema';
import { useLanguage } from '../i18n/LanguageContext';
import { BorderRadius, Spacing } from '../theme/spacing';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { FontFamily, Typography } from '../theme/typography';
import { susevarButton, susevarButtonPressed, susevarButtonText } from '../theme/susevar';
import { formatDateFull, getToday } from '../utils/dateUtils';

export interface RecurringPaymentReminderFormValue {
  id?: number;
  title: string;
  vendorId: number | null;
  expectedAmount: number | null;
  currency: string;
  anchorDate: string;
  nextDueDate: string;
  recurrenceUnit: ReminderRecurrenceUnit;
  recurrenceInterval: number;
  reminderDaysBefore: number;
  reminderTime: string;
  status: RecurringPaymentReminderStatus;
  source: RecurringPaymentReminderSource;
  note: string | null;
}

interface Props {
  visible: boolean;
  initialValue: RecurringPaymentReminderFormValue | null;
  defaultCurrency: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const UNITS: ReminderRecurrenceUnit[] = ['day', 'week', 'month', 'year'];
const LEAD_PRESETS = [0, 1, 3, 7] as const;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseDecimal(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export default function RecurringPaymentReminderSheet({
  visible,
  initialValue,
  defaultCurrency,
  onClose,
  onSaved,
}: Props) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t } = useLanguage();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [nextDueDate, setNextDueDate] = useState('');
  const [unit, setUnit] = useState<ReminderRecurrenceUnit>('month');
  const [interval, setInterval] = useState('1');
  const [leadDays, setLeadDays] = useState('3');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    savingRef.current = false;
    setSaving(false);
    setDatePickerVisible(false);
    setTitle(initialValue?.title ?? '');
    setAmount(initialValue?.expectedAmount == null ? '' : String(initialValue.expectedAmount));
    setCurrency(initialValue?.currency ?? defaultCurrency);
    setNextDueDate(initialValue?.nextDueDate ?? '');
    setUnit(initialValue?.recurrenceUnit ?? 'month');
    setInterval(String(initialValue?.recurrenceInterval ?? 1));
    setLeadDays(String(initialValue?.reminderDaysBefore ?? 3));
    setReminderTime(initialValue?.reminderTime ?? '09:00');
    setNote(initialValue?.note ?? '');
  }, [defaultCurrency, initialValue, visible]);

  const customLead = !LEAD_PRESETS.includes(Number(leadDays) as (typeof LEAD_PRESETS)[number]);
  const [hour = '', minute = ''] = reminderTime.split(':');
  const close = () => {
    if (savingRef.current) return;
    setDatePickerVisible(false);
    onClose();
  };

  const save = async () => {
    if (savingRef.current) return;
    const safeTitle = title.trim();
    const safeAmount = parseDecimal(amount);
    const safeCurrency = currency.trim().toUpperCase();
    const safeInterval = Number(interval);
    const safeLeadDays = Number(leadDays);
    if (
      !safeTitle || !nextDueDate || !safeCurrency || Number.isNaN(safeAmount)
      || (safeAmount != null && safeAmount <= 0)
      || !Number.isInteger(safeInterval) || safeInterval < 1 || safeInterval > 999
      || !Number.isInteger(safeLeadDays) || safeLeadDays < 0 || safeLeadDays > 365
      || !TIME_PATTERN.test(reminderTime)
    ) {
      SparkToast.show(t('recurring_plan_validation_error'), 'error');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (initialValue?.id) {
        const scheduleChanged = initialValue.nextDueDate !== nextDueDate
          || initialValue.recurrenceUnit !== unit
          || initialValue.recurrenceInterval !== safeInterval;
        const updated = await RecurringPaymentReminderDao.update(initialValue.id, {
          title: safeTitle,
          expectedAmount: safeAmount,
          currency: safeCurrency,
          anchorDate: scheduleChanged ? nextDueDate : initialValue.anchorDate,
          nextDueDate,
          recurrenceUnit: unit,
          recurrenceInterval: safeInterval,
          reminderDaysBefore: safeLeadDays,
          reminderTime,
          note: note.trim() || null,
        });
        if (!updated) throw new Error('Reminder was not updated');
      } else {
        await RecurringPaymentReminderDao.create({
          title: safeTitle,
          vendorId: initialValue?.vendorId ?? null,
          expectedAmount: safeAmount,
          currency: safeCurrency,
          anchorDate: nextDueDate,
          nextDueDate,
          recurrenceUnit: unit,
          recurrenceInterval: safeInterval,
          reminderDaysBefore: safeLeadDays,
          reminderTime,
          status: initialValue?.status ?? 'active',
          source: initialValue?.source ?? 'manual',
          note: note.trim() || null,
        });
      }
      SparkToast.show(t(initialValue?.id ? 'recurring_plan_updated' : 'recurring_plan_saved'), 'success');
      await onSaved();
      onClose();
    } catch (error) {
      if (__DEV__) console.warn('[recurring-plan] save', error);
      SparkToast.show(t('recurring_plan_save_error'), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={close}
      sheetStyle={styles.sheet}
      backdropColor={scheme === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.55)'}
      showHandle
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="calendar-sync-outline" size={22} color={Colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>
            {t(initialValue?.id ? 'recurring_plan_edit_title' : 'recurring_plan_add_title')}
          </Text>
          <Text style={styles.subtitle}>{t('recurring_plan_form_hint')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>{t('recurring_plan_name')}</Text>
        <TextInput
          testID="recurring-plan-title"
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t('recurring_plan_name_placeholder')}
          placeholderTextColor={Colors.textMuted}
          editable={!saving}
          maxLength={200}
        />

        <View style={styles.row}>
          <View style={styles.amountField}>
            <Text style={styles.label}>{t('recurring_plan_expected_amount')}</Text>
            <TextInput
              testID="recurring-plan-amount"
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder={t('optional')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              editable={!saving}
            />
          </View>
          <View style={styles.currencyField}>
            <Text style={styles.label}>{t('currency')}</Text>
            <TextInput
              testID="recurring-plan-currency"
              style={[styles.input, styles.currencyInput]}
              value={currency}
              onChangeText={(value) => setCurrency(value.replace(/[^A-Za-z]/g, '').slice(0, 10))}
              autoCapitalize="characters"
              maxLength={10}
              editable={!saving}
            />
          </View>
        </View>

        <Text style={styles.label}>{t('recurring_plan_next_due')}</Text>
        <Pressable
          testID="recurring-plan-date"
          accessibilityRole="button"
          accessibilityLabel={t('recurring_plan_next_due')}
          disabled={saving}
          onPress={() => setDatePickerVisible(true)}
          style={({ pressed }) => [styles.input, styles.dateButton, pressed && styles.pressed]}
        >
          <Text style={[styles.dateText, !nextDueDate && styles.placeholder]}>
            {nextDueDate ? formatDateFull(nextDueDate, t) : t('select_date')}
          </Text>
          <MaterialCommunityIcons name="calendar-outline" size={19} color={Colors.textSecondary} />
        </Pressable>

        <Text style={styles.label}>{t('recurring_plan_frequency')}</Text>
        <View style={styles.chips}>
          {UNITS.map((value) => (
            <Pressable
              key={value}
              testID={`recurring-plan-unit-${value}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: unit === value, disabled: saving }}
              disabled={saving}
              onPress={() => setUnit(value)}
              style={[styles.chip, unit === value && styles.chipSelected]}
            >
              <Text style={[styles.chipText, unit === value && styles.chipTextSelected]}>
                {t(`recurring_plan_unit_${value}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.compactField}>
          <Text style={styles.label}>{t('recurring_plan_interval')}</Text>
          <TextInput
            testID="recurring-plan-interval"
            style={[styles.input, styles.numberInput]}
            value={interval}
            onChangeText={(value) => setInterval(value.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            maxLength={3}
            editable={!saving}
          />
        </View>

        <Text style={styles.label}>{t('recurring_plan_remind_before')}</Text>
        <View style={styles.chips}>
          {LEAD_PRESETS.map((days) => (
            <Pressable
              key={days}
              testID={`recurring-plan-lead-${days}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: Number(leadDays) === days, disabled: saving }}
              disabled={saving}
              onPress={() => setLeadDays(String(days))}
              style={[styles.chip, Number(leadDays) === days && styles.chipSelected]}
            >
              <Text style={[styles.chipText, Number(leadDays) === days && styles.chipTextSelected]}>
                {days === 0 ? t('recurring_plan_same_day') : t('recurring_plan_days', { days })}
              </Text>
            </Pressable>
          ))}
          <Pressable
            testID="recurring-plan-lead-custom"
            accessibilityRole="radio"
            accessibilityState={{ selected: customLead, disabled: saving }}
            disabled={saving}
            onPress={() => { if (!customLead) setLeadDays(''); }}
            style={[styles.chip, customLead && styles.chipSelected]}
          >
            <Text style={[styles.chipText, customLead && styles.chipTextSelected]}>
              {t('recurring_plan_custom')}
            </Text>
          </Pressable>
        </View>
        {customLead ? (
          <TextInput
            testID="recurring-plan-lead-input"
            style={[styles.input, styles.numberInput]}
            value={leadDays}
            onChangeText={(value) => setLeadDays(value.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            editable={!saving}
          />
        ) : null}

        <Text style={styles.label}>{t('recurring_plan_time')}</Text>
        <View style={styles.timeRow}>
          <TextInput
            testID="recurring-plan-hour"
            accessibilityLabel={t('debt_reminder_hour')}
            style={styles.timeInput}
            value={hour}
            onChangeText={(value) => setReminderTime(`${value.replace(/\D/g, '').slice(0, 2)}:${minute}`)}
            keyboardType="number-pad"
            maxLength={2}
            editable={!saving}
            selectTextOnFocus
          />
          <Text style={styles.timeSeparator}>:</Text>
          <TextInput
            testID="recurring-plan-minute"
            accessibilityLabel={t('debt_reminder_minute')}
            style={styles.timeInput}
            value={minute}
            onChangeText={(value) => setReminderTime(`${hour}:${value.replace(/\D/g, '').slice(0, 2)}`)}
            keyboardType="number-pad"
            maxLength={2}
            editable={!saving}
            selectTextOnFocus
          />
        </View>

        <Text style={styles.label}>{t('note')}</Text>
        <TextInput
          testID="recurring-plan-note"
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder={t('note_placeholder')}
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={1000}
          editable={!saving}
        />

        <View style={styles.deliveryNote}>
          <MaterialCommunityIcons name="information-outline" size={17} color={Colors.info} />
          <Text style={styles.deliveryNoteText}>{t('recurring_plan_delivery_pending')}</Text>
        </View>

        <Pressable
          testID="recurring-plan-save"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={save}
          style={({ pressed }) => [
            styles.primaryButton,
            saving && styles.disabled,
            pressed && susevarButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? t('processing') : t('save')}
          </Text>
        </Pressable>
        <View style={{ height: Spacing.lg }} />
      </ScrollView>

      <CustomDatePicker
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        initialDate={nextDueDate || getToday()}
        onSelectDate={setNextDueDate}
      />
    </BottomSheetModal>
  );
}

const getStyles = () => StyleSheet.create({
  sheet: {
    maxHeight: '92%',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary + '18',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...Typography.headlineSmall, color: Colors.textPrimary, fontFamily: FontFamily.bold },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flexGrow: 0 },
  content: { paddingBottom: Spacing.md },
  label: {
    ...Typography.labelMedium, color: Colors.textSecondary, fontFamily: FontFamily.semiBold,
    marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  input: {
    minHeight: 52, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.cardSurface, color: Colors.textPrimary, paddingHorizontal: Spacing.md,
    ...Typography.bodyMedium,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  amountField: { flex: 1, minWidth: 0 },
  currencyField: { width: 90 },
  currencyInput: { textAlign: 'center', fontFamily: FontFamily.bold },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { ...Typography.bodyMedium, color: Colors.textPrimary, flex: 1 },
  placeholder: { color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.round, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipText: { ...Typography.labelSmall, color: Colors.textSecondary, fontFamily: FontFamily.semiBold },
  chipTextSelected: { color: Colors.primary },
  compactField: { width: 120 },
  numberInput: { width: 104, textAlign: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  timeInput: {
    width: 64, minHeight: 50, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardSurface, color: Colors.textPrimary,
    textAlign: 'center', ...Typography.headlineSmall,
  },
  timeSeparator: { ...Typography.headlineMedium, color: Colors.textPrimary, marginHorizontal: Spacing.sm },
  noteInput: { minHeight: 76, paddingTop: Spacing.md, textAlignVertical: 'top' },
  deliveryNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.lg,
    padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.info + '12',
  },
  deliveryNoteText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  primaryButton: { ...susevarButton, backgroundColor: Colors.primary, marginTop: Spacing.lg },
  primaryButtonText: susevarButtonText,
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
});
