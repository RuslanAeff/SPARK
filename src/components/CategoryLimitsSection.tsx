// S.P.A.R.K. — Seçili kategoriler için aylık limit vs harcama
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { CategoryLimitProgress } from '../hooks/useSavingsGoalData';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import AnimatedCard from './AnimatedCard';

type Props = {
  rows: CategoryLimitProgress[];
};

export default function CategoryLimitsSection({ rows }: Props) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t, tc } = useLanguage();
  const { currency } = useCurrency();

  if (rows.length === 0) return null;

  return (
    <AnimatedCard delay={120} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{t('category_limits_title')}</Text>
      </View>

      {rows.map((r, idx) => {
        const name = tc(r.category_name);
        const over = r.spent > r.limit_amount;
        const delta = r.spent - r.limit_amount;
        return (
          <View key={r.id} style={[styles.row, idx === 0 && { borderTopWidth: 0 }]}>
            <View style={[styles.catIcon, { backgroundColor: r.category_color + '22' }]}>
              <MaterialCommunityIcons name={r.category_icon as any} size={18} color={r.category_color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.catName} numberOfLines={1}>{name}</Text>
              <View style={styles.numsRow}>
                <Text style={styles.numLabel}>{t('limit_label')}</Text>
                <Text style={styles.num}>{formatCurrency(r.limit_amount, currency, false)}</Text>
                <Text style={styles.sep}>·</Text>
                <Text style={styles.numLabel}>{t('spent_label')}</Text>
                <Text style={[styles.num, over && { color: Colors.danger }]}>
                  {formatCurrency(r.spent, currency, false)}
                </Text>
              </View>
              {over && (
                <View style={styles.overBadge}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={14} color={Colors.danger} />
                  <Text style={styles.overText}>
                    {t('category_limit_over', { amount: formatCurrency(delta, currency, false) })}
                  </Text>
                </View>
              )}
              {!over && r.remaining > 0 && (
                <Text style={styles.remainText}>
                  {t('category_limit_remaining', { amount: formatCurrency(r.remaining, currency, false) })}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </AnimatedCard>
  );
}

const getStyles = () => StyleSheet.create({
  card: {
    marginTop: Spacing.lg,
  },
  headerRow: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.labelLarge,
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 1.75,
    textTransform: 'uppercase',
    fontFamily: FontFamily.black,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
    marginBottom: 4,
  },
  numsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  numLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  num: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  sep: {
    color: Colors.textMuted,
    marginHorizontal: 2,
  },
  overBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  overText: {
    ...Typography.labelSmall,
    color: Colors.danger,
    fontFamily: FontFamily.semiBold,
  },
  remainText: {
    ...Typography.labelSmall,
    color: Colors.success,
    marginTop: 4,
    fontFamily: FontFamily.medium,
  },
});
