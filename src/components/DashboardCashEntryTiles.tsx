import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useLanguage } from '../i18n/LanguageContext';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily, Typography } from '../theme/typography';
import { formatCurrency } from '../utils/formatCurrency';

interface DashboardCashEntryTilesProps {
  outstandingDebt: number;
  extraIncomeIn: number;
  currency: string;
  onDebtPress: () => void;
  onIncomePress: () => void;
}

/**
 * Dashboard bütçe kartının altındaki iki nakit-akışı girişi.
 * Borç global açık bakiyedir; ek gelir yalnız seçili bütçe döneminin toplamıdır.
 */
function DashboardCashEntryTiles({
  outstandingDebt,
  extraIncomeIn,
  currency,
  onDebtPress,
  onIncomePress,
}: DashboardCashEntryTilesProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const debtAmount = outstandingDebt > 0
    ? formatCurrency(outstandingDebt, currency, false)
    : null;
  const incomeAmount = extraIncomeIn > 0
    ? `+${formatCurrency(extraIncomeIn, currency, false)}`
    : null;
  const debtSummary = debtAmount
    ? `${debtAmount}. ${t('debt_tile_balance_hint')}`
    : t('debt_tile_empty');
  const incomeSummary = incomeAmount
    ? `${incomeAmount}. ${t('income_tile_applied_hint')}`
    : t('income_tile_empty');

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onDebtPress}
        style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('debt_manage_cta')}. ${debtSummary}`}
      >
        <View style={[styles.icon, { backgroundColor: Colors.danger + '1A' }]}>
          <MaterialCommunityIcons name="hand-coin-outline" size={17} color={Colors.danger} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label}>{t('debt_tile_label')}</Text>
          {outstandingDebt > 0 ? (
            <>
              <Text style={[styles.value, { color: Colors.danger }]}>
                {debtAmount}
              </Text>
              <Text style={styles.context}>{t('debt_tile_balance_hint')}</Text>
            </>
          ) : (
            <Text style={styles.empty}>{t('debt_tile_empty')}</Text>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={onIncomePress}
        style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('income_manage_cta')}. ${incomeSummary}`}
      >
        <View style={[styles.icon, { backgroundColor: Colors.success + '1A' }]}>
          <MaterialCommunityIcons name="cash-plus" size={17} color={Colors.success} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label}>{t('income_tile_label')}</Text>
          {extraIncomeIn > 0 ? (
            <>
              <Text style={[styles.value, { color: Colors.success }]}>
                {incomeAmount}
              </Text>
              <Text style={styles.context}>{t('income_tile_applied_hint')}</Text>
            </>
          ) : (
            <Text style={styles.empty}>{t('income_tile_empty')}</Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

export default React.memo(DashboardCashEntryTiles);

const getStyles = () => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tilePressed: {
    opacity: 0.88,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    letterSpacing: 0,
  },
  value: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: FontFamily.semiBold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
    marginTop: 5,
  },
  context: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    letterSpacing: 0,
    marginTop: 2,
  },
  empty: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.regular,
    letterSpacing: 0,
    marginTop: 5,
  },
});
