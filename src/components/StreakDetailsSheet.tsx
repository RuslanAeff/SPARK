// S.P.A.R.K. — Harcama İstatistikleri detay sheet'i
//
// "Harcamasız gün", "Mevcut seri" ve "Bütçe altı gün" kartlarına tıklandığında
// açılan modern ve sade detay paneli. Tarihleri ay bazlı gruplar halinde
// okunaklı chip'ler ile sunar; bütçe altı varyantında günlük tutar / bütçe
// oranını mini bir ilerleme barıyla gösterir.
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BottomSheetModal from './BottomSheetModal';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import type { Language } from '../i18n/translations';
import { intlLocaleForLanguage } from '../i18n/languageOptions';

const SCREEN_H = Dimensions.get('window').height;

export type StreakVariant = 'zero' | 'streak' | 'under';

export interface StreakDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  variant: StreakVariant;
  /** 'zero' ve 'streak' için YYYY-MM-DD tarih dizisi. */
  dates?: string[];
  /** 'under' için günlük tutar + tarih. */
  entries?: { date: string; total: number }[];
  /** 'under' için günlük bütçe hedefi. */
  dailyBudget?: number;
  totalDays: number;
  language: Language;
  currency: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface GroupedMonth {
  key: string; // YYYY-MM
  label: string; // "Nisan 2026"
  items: { date: string; total?: number }[];
}

const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

function groupByMonth(
  items: { date: string; total?: number }[],
  locale: string,
): GroupedMonth[] {
  const map = new Map<string, GroupedMonth>();
  for (const it of items) {
    const monthKey = it.date.slice(0, 7);
    let bucket = map.get(monthKey);
    if (!bucket) {
      const d = parseYmd(it.date);
      const label = new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }).format(d);
      bucket = {
        key: monthKey,
        label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1),
        items: [],
      };
      map.set(monthKey, bucket);
    }
    bucket.items.push(it);
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
}

function variantTheme(variant: StreakVariant) {
  if (variant === 'zero') {
    return { color: Colors.success, icon: 'calendar-check' as const };
  }
  if (variant === 'streak') {
    return { color: Colors.warning, icon: 'fire' as const };
  }
  return { color: Colors.primary, icon: 'shield-check' as const };
}

export default function StreakDetailsSheet({
  visible,
  onClose,
  variant,
  dates,
  entries,
  dailyBudget = 0,
  totalDays,
  language,
  currency,
  t,
}: StreakDetailsSheetProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const locale = intlLocaleForLanguage(language);
  const { color, icon } = variantTheme(variant);

  const raw: { date: string; total?: number }[] = useMemo(() => {
    if (variant === 'under') {
      return (entries ?? []).map((e) => ({ date: e.date, total: e.total }));
    }
    return (dates ?? []).map((d) => ({ date: d }));
  }, [variant, dates, entries]);

  const groups = useMemo(() => groupByMonth(raw, locale), [raw, locale]);
  const count = raw.length;

  const title =
    variant === 'zero'
      ? t('streak_details_zero_title')
      : variant === 'streak'
      ? t('streak_details_streak_title')
      : t('streak_details_under_title');

  const emptyKey =
    variant === 'zero'
      ? 'streak_empty_zero'
      : variant === 'streak'
      ? 'streak_empty_streak'
      : 'streak_empty_under';

  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const dayMonthFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );

  const formatWeekday = (d: Date) => {
    // "Pzt." → "Pzt"
    const s = weekdayFmt.format(d).replace(/\.$/, '');
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.sheet}
      backdropColor={scheme === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.55)'}
    >
      <View style={styles.handleBar} />

      <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
        <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: color + '22' }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            <Text style={[styles.subtitleAccent, { color }]}>{count}</Text>
            <Text style={styles.subtitleMuted}>
              {' / '}
              {totalDays} {t('days_label')}
            </Text>
          </Text>
        </View>
      </View>

      {count === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: color + '18' }]}>
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={28}
              color={color}
            />
          </View>
          <Text style={styles.emptyText}>{t(emptyKey)}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{g.label}</Text>
                <View style={styles.groupLine} />
                <Text style={styles.groupCount}>{g.items.length}</Text>
              </View>

              {variant === 'under' ? (
                <View style={styles.listCol}>
                  {g.items.map((it) => {
                    const d = parseYmd(it.date);
                    const pct =
                      dailyBudget > 0
                        ? Math.min(100, Math.round(((it.total ?? 0) / dailyBudget) * 100))
                        : 0;
                    return (
                      <View key={it.date} style={styles.rowChip}>
                        <View style={styles.rowLeft}>
                          <Text style={styles.weekday}>{formatWeekday(d)}</Text>
                          <Text style={styles.dayLabel}>{dayMonthFmt.format(d)}</Text>
                        </View>
                        <View style={styles.rowRight}>
                          <Text style={styles.amountText} numberOfLines={1}>
                            {formatCurrency(it.total ?? 0, currency, false)}
                            <Text style={styles.amountMuted}>
                              {' / '}
                              {formatCurrency(dailyBudget, currency, false)}
                            </Text>
                          </Text>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                { width: `${pct}%`, backgroundColor: color },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.chipGrid}>
                  {g.items.map((it) => {
                    const d = parseYmd(it.date);
                    return (
                      <View
                        key={it.date}
                        style={[styles.chip, { borderColor: color + '33' }]}
                      >
                        <View
                          style={[styles.chipDot, { backgroundColor: color + '22' }]}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color={color}
                          />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.chipWeekday}>{formatWeekday(d)}</Text>
                          <Text style={styles.chipDate} numberOfLines={1}>
                            {dayMonthFmt.format(d)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

const getStyles = () => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.82,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
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
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.headlineSmall,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  subtitleAccent: {
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
  },
  subtitleMuted: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: Spacing.md,
  },
  group: {
    marginBottom: Spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  groupLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  groupLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  groupCount: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '48.5%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  chipDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWeekday: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  chipDate: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    letterSpacing: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  listCol: {
    gap: Spacing.sm,
  },
  rowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowLeft: {
    minWidth: 64,
  },
  rowRight: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  weekday: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  dayLabel: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  amountText: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  amountMuted: {
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    paddingHorizontal: ScreenPadding.horizontal,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
