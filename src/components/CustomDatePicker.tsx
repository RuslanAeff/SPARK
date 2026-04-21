// S.P.A.R.K. — Custom Modern Date Picker
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useAppTheme } from '../theme/themeStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';

interface CustomDatePickerProps {
  visible: boolean;
  onClose: () => void;
  initialDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

export default function CustomDatePicker({
  visible,
  onClose,
  initialDate,
  onSelectDate
}: CustomDatePickerProps) {
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const isDark = scheme === 'dark';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    if (visible && initialDate) {
      setCurrentDate(new Date(initialDate));
    }
  }, [visible, initialDate]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const selectDay = (day: number) => {
    const y = currentDate.getFullYear();
    const m = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    onSelectDate(`${y}-${m}-${d}`);
    onClose();
  };

  const setToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    onSelectDate(`${y}-${m}-${d}`);
    onClose();
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    return dayNum > 0 && dayNum <= daysInMonth ? dayNum : null;
  });

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    t(`month_${String(i + 1).padStart(2, '0')}`)
  );

  const weekDays = [
    t('weekday_mon'), t('weekday_tue'), t('weekday_wed'),
    t('weekday_thu'), t('weekday_fri'), t('weekday_sat'), t('weekday_sun'),
  ];

  const [initY, initM, initD] = initialDate.split('-').map(Number);
  const isSelectedDate = (day: number) =>
    day === initD && month === initM - 1 && year === initY;

  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  const modalBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const dayHoverBg = isDark ? '#2C2C2E' : '#F2F2F7';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.xxl,
        },
        modal: {
          width: '100%',
          borderRadius: BorderRadius.xxl,
          padding: Spacing.xl,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24 },
            android: { elevation: 12 },
          }),
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: Spacing.lg,
        },
        monthBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        monthText: {
          ...Typography.headlineSmall,
          color: Colors.textPrimary,
        },
        arrowBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        weekRow: {
          flexDirection: 'row',
          marginBottom: Spacing.sm,
          paddingBottom: Spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: Colors.divider,
        },
        weekDayText: {
          flex: 1,
          textAlign: 'center',
          ...Typography.labelSmall,
          color: Colors.textMuted,
          fontFamily: FontFamily.medium,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        daysGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingTop: Spacing.xs,
        },
        dayBox: {
          width: '14.28%',
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        /** Seçim / bugün vurgusu — sabit daire, rakam tam ortada */
        dayMark: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dayMarkSelected: {
          backgroundColor: Colors.primary,
        },
        dayMarkToday: {
          borderWidth: 2,
          borderColor: Colors.primary,
          backgroundColor: 'transparent',
        },
        dayText: {
          fontSize: 15,
          lineHeight: Platform.OS === 'android' ? 18 : 17,
          fontFamily: FontFamily.semiBold,
          textAlign: 'center',
          color: Colors.textPrimary,
          ...Platform.select({
            android: { includeFontPadding: false, textAlignVertical: 'center' as const },
            ios: {},
          }),
        },
        dayTextSelected: {
          color: Colors.textInverse,
          fontFamily: FontFamily.bold,
        },
        dayTextToday: {
          color: Colors.primary,
          fontFamily: FontFamily.bold,
        },
        footer: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: Spacing.lg,
          paddingTop: Spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.divider,
        },
        todayBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          backgroundColor: Colors.primary + '12',
          borderRadius: BorderRadius.lg,
        },
        todayText: {
          ...Typography.labelMedium,
          color: Colors.primary,
          fontFamily: FontFamily.medium,
        },
        closeBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          minWidth: 120,
          backgroundColor: Colors.surfaceLight,
          borderRadius: BorderRadius.xl,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        closeText: {
          ...Typography.labelMedium,
          color: Colors.textPrimary,
          fontFamily: FontFamily.semiBold,
        },
        yearContainer: {
          height: 260,
        },
        yearItem: {
          paddingVertical: Spacing.md,
          alignItems: 'center',
          borderRadius: BorderRadius.md,
          marginVertical: 1,
        },
        yearText: {
          ...Typography.bodyLarge,
          color: Colors.textPrimary,
        },
      }),
    [scheme]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.modal, { backgroundColor: modalBg }]} onPress={() => {}}>

          {/* Header with month navigation */}
          <View style={styles.header}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.arrowBtn} hitSlop={12}>
              <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => setShowYearPicker(!showYearPicker)} style={styles.monthBtn}>
              <Text style={styles.monthText}>{monthNames[month]} {year}</Text>
              <MaterialCommunityIcons name={showYearPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
            </Pressable>
            <Pressable onPress={() => changeMonth(1)} style={styles.arrowBtn} hitSlop={12}>
              <MaterialCommunityIcons name="chevron-right" size={26} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {showYearPicker ? (
            <View style={styles.yearContainer}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - 20 + i).map(y => (
                  <Pressable 
                    key={y} 
                    style={[styles.yearItem, y === year && { backgroundColor: Colors.primary + '18' }]}
                    onPress={() => {
                      const newDate = new Date(currentDate);
                      newDate.setFullYear(y);
                      setCurrentDate(newDate);
                      setShowYearPicker(false);
                    }}
                  >
                    <Text style={[styles.yearText, y === year && { color: Colors.primary, fontFamily: FontFamily.bold }]}>{y}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <>
              <View style={styles.weekRow}>
                {weekDays.map(wd => (
                  <Text key={wd} style={styles.weekDayText}>{wd}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                 {days.map((day, i) => {
                   if (!day) return <View key={`empty-${i}`} style={styles.dayBox} />;
                   
                   const selected = isSelectedDate(day);
                   const today = isToday(day);
                   return (
                     <Pressable
                       key={day}
                       onPress={() => selectDay(day)}
                       style={styles.dayBox}
                     >
                       {({ pressed }) => (
                         <View
                           style={[
                             styles.dayMark,
                             selected && styles.dayMarkSelected,
                             today && !selected && styles.dayMarkToday,
                             pressed && !selected && !today && { backgroundColor: dayHoverBg },
                             pressed && !selected && { opacity: 0.92 },
                           ]}
                         >
                           <Text
                             style={[
                               styles.dayText,
                               selected && styles.dayTextSelected,
                               today && !selected && styles.dayTextToday,
                             ]}
                           >
                             {day}
                           </Text>
                         </View>
                       )}
                     </Pressable>
                   );
                 })}
              </View>
            </>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={setToday} style={styles.todayBtn}>
              <MaterialCommunityIcons name="calendar-today" size={18} color={Colors.primary} />
              <Text style={styles.todayText}>{t('today')}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}>
               <Text style={styles.closeText}>{t('close')}</Text>
            </Pressable>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}
