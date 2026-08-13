// S.P.A.R.K. — Borç vadesi ve hatırlatma form yüzeyi
//
// Yeni borç ve mevcut borç düzenleme akışları aynı sunum sözleşmesini kullanır.
// Kalıcılık/validasyon DebtSheet + DebtDao sınırındadır; bu bileşen yalnız
// kontrollü alanları ve erişilebilir etkileşimleri sunar.
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily, Typography } from '../theme/typography';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDateFull } from '../utils/dateUtils';
import { DEBT_REMINDER_PRESET_DAYS } from '../utils/debtReminder';

interface DebtReminderFieldsProps {
  dueDate: string | null;
  reminderEnabled: boolean;
  reminderDaysBefore: string;
  reminderTime: string;
  disabled?: boolean;
  onPressDueDate: () => void;
  onClearDueDate: () => void;
  onReminderEnabledChange: (enabled: boolean) => void;
  onReminderDaysBeforeChange: (value: string) => void;
  onReminderTimeChange: (value: string) => void;
}

function leadPresetLabel(days: number, t: (key: string) => string): string {
  if (days === 0) return t('debt_reminder_when_due');
  if (days === 1) return t('debt_reminder_one_day_before');
  if (days === 3) return t('debt_reminder_three_days_before');
  return t('debt_reminder_seven_days_before');
}

export default function DebtReminderFields({
  dueDate,
  reminderEnabled,
  reminderDaysBefore,
  reminderTime,
  disabled = false,
  onPressDueDate,
  onClearDueDate,
  onReminderEnabledChange,
  onReminderDaysBeforeChange,
  onReminderTimeChange,
}: DebtReminderFieldsProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t } = useLanguage();
  const numericDays = /^\d+$/.test(reminderDaysBefore) ? Number(reminderDaysBefore) : null;
  const isPreset = numericDays != null
    && DEBT_REMINDER_PRESET_DAYS.includes(numericDays as (typeof DEBT_REMINDER_PRESET_DAYS)[number]);
  const customSelected = !isPreset;
  const [hour = '', minute = ''] = reminderTime.split(':');
  const reminderDisabled = disabled || dueDate == null;

  const updateHour = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    onReminderTimeChange(`${digits}:${minute}`);
  };
  const updateMinute = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    onReminderTimeChange(`${hour}:${digits}`);
  };

  return (
    <View style={styles.section} testID="debt-reminder-fields">
      <View style={styles.sectionHeader}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={19} color={Colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.sectionTitle}>{t('debt_reminder_title')}</Text>
          <Text style={styles.sectionSubtitle}>{t('debt_reminder_hint')}</Text>
        </View>
      </View>

      <View style={styles.dueRow}>
        <Pressable
          testID="debt-due-date-button"
          accessibilityRole="button"
          accessibilityLabel={t('debt_due_date')}
          accessibilityHint={t('debt_due_date_optional')}
          disabled={disabled}
          onPress={onPressDueDate}
          style={({ pressed }) => [
            styles.dueMain,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <MaterialCommunityIcons name="calendar-outline" size={20} color={Colors.textSecondary} />
          <View style={styles.dueCopy}>
            <Text style={styles.rowLabel}>{t('debt_due_date')}</Text>
            <Text style={[styles.rowValue, !dueDate && styles.placeholderValue]}>
              {dueDate ? formatDateFull(dueDate, t) : t('debt_due_date_none')}
            </Text>
          </View>
          {!dueDate ? (
            <Text style={styles.addText}>{t('add')}</Text>
          ) : null}
        </Pressable>
        {dueDate ? (
          <Pressable
            testID="debt-due-date-clear"
            accessibilityRole="button"
            accessibilityLabel={t('debt_due_date_clear')}
            disabled={disabled}
            onPress={onClearDueDate}
            hitSlop={6}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <MaterialCommunityIcons name="close" size={19} color={Colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={[styles.switchRow, reminderDisabled && styles.disabled]}>
        <View style={styles.switchCopy}>
          <Text style={styles.rowLabel}>{t('debt_reminder_toggle')}</Text>
          <Text style={styles.switchHint}>
            {dueDate ? t('debt_reminder_toggle_hint') : t('debt_reminder_requires_due_date')}
          </Text>
        </View>
        <Switch
          testID="debt-reminder-switch"
          accessibilityRole="switch"
          accessibilityLabel={t('debt_reminder_toggle')}
          accessibilityHint={dueDate
            ? t('debt_reminder_toggle_hint')
            : t('debt_reminder_requires_due_date')}
          accessibilityState={{ checked: reminderEnabled, disabled: reminderDisabled }}
          value={reminderEnabled}
          disabled={reminderDisabled}
          onValueChange={onReminderEnabledChange}
          trackColor={{ false: Colors.borderLight, true: Colors.primary + '88' }}
          thumbColor={reminderEnabled ? Colors.primary : Colors.textMuted}
          ios_backgroundColor={Colors.borderLight}
        />
      </View>

      {reminderEnabled && dueDate ? (
        <View style={styles.reminderOptions}>
          <Text style={styles.optionLabel}>{t('debt_reminder_days_before')}</Text>
          <View style={styles.chipRow}>
            {DEBT_REMINDER_PRESET_DAYS.map((days) => {
              const selected = numericDays === days;
              return (
                <Pressable
                  key={days}
                  testID={`debt-reminder-days-${days}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => onReminderDaysBeforeChange(String(days))}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && !disabled && styles.pressed,
                    disabled && styles.disabled,
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {leadPresetLabel(days, t)}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              testID="debt-reminder-days-custom"
              accessibilityRole="radio"
              accessibilityState={{ selected: customSelected, disabled }}
              disabled={disabled}
              onPress={() => {
                if (!customSelected) onReminderDaysBeforeChange('');
              }}
              style={({ pressed }) => [
                styles.chip,
                customSelected && styles.chipSelected,
                pressed && !disabled && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.chipText, customSelected && styles.chipTextSelected]}>
                {t('debt_reminder_custom')}
              </Text>
            </Pressable>
          </View>

          {customSelected ? (
            <View style={styles.customDaysRow}>
              <TextInput
                testID="debt-reminder-days-input"
                accessibilityLabel={t('debt_reminder_days_before')}
                style={styles.numberInput}
                value={reminderDaysBefore}
                onChangeText={(value) => onReminderDaysBeforeChange(value.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                editable={!disabled}
              />
              <Text style={styles.inputSuffix}>{t('debt_reminder_days_suffix')}</Text>
            </View>
          ) : null}

          <Text style={styles.optionLabel}>{t('debt_reminder_time')}</Text>
          <View
            style={styles.timeRow}
            accessibilityRole="summary"
            accessibilityLabel={`${t('debt_reminder_time')}: ${reminderTime}`}
          >
            <TextInput
              testID="debt-reminder-hour-input"
              accessibilityLabel={t('debt_reminder_hour')}
              style={styles.timeInput}
              value={hour}
              onChangeText={updateHour}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="09"
              placeholderTextColor={Colors.textMuted}
              editable={!disabled}
              selectTextOnFocus
            />
            <Text style={styles.timeSeparator}>:</Text>
            <TextInput
              testID="debt-reminder-minute-input"
              accessibilityLabel={t('debt_reminder_minute')}
              style={styles.timeInput}
              value={minute}
              onChangeText={updateMinute}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="00"
              placeholderTextColor={Colors.textMuted}
              editable={!disabled}
              selectTextOnFocus
            />
          </View>

          <View style={styles.deliveryNote}>
            <MaterialCommunityIcons name="information-outline" size={17} color={Colors.info} />
            <Text style={styles.deliveryNoteText}>{t('debt_reminder_delivery_pending')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  section: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardSurface,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  sectionTitle: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  sectionSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  dueMain: {
    minHeight: 56,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  dueCopy: { flex: 1, minWidth: 0 },
  rowLabel: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  rowValue: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  placeholderValue: { color: Colors.textMuted },
  addText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  clearButton: {
    width: 48,
    minHeight: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.md,
  },
  switchRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  switchCopy: { flex: 1, minWidth: 0 },
  switchHint: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  reminderOptions: { marginTop: Spacing.md },
  optionLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  chipText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
  },
  chipTextSelected: { color: Colors.primary },
  customDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  numberInput: {
    width: 76,
    minHeight: 46,
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: Spacing.sm,
  },
  inputSuffix: { ...Typography.bodySmall, color: Colors.textSecondary },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
  },
  timeInput: {
    width: 64,
    minHeight: 48,
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: Spacing.sm,
  },
  timeSeparator: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  deliveryNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.info + '10',
  },
  deliveryNoteText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
});

