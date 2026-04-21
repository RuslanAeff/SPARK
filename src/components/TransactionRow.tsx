// S.P.A.R.K. — Transaction Row Component
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../theme/themeStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius, ScreenPadding } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { ExpenseWithDetails } from '../db/schema';
import VendorAvatar from './VendorAvatar';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';

interface TransactionRowProps {
  expense: ExpenseWithDetails;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Çoklu seçim modu */
  selectionMode?: boolean;
  selected?: boolean;
}

function TransactionRow({
  expense,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
}: TransactionRowProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t, tc } = useLanguage();
  const { currency } = useCurrency();

  const rowInner = (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => [
        styles.container,
        selectionMode && styles.containerInSelection,
        selectionMode && selected && styles.containerSelected,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {selectionMode && (
        <View style={styles.checkboxWrap} pointerEvents="none">
          <MaterialCommunityIcons
            name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={22}
            color={selected ? Colors.primary : Colors.textMuted}
          />
        </View>
      )}
      <VendorAvatar
        name={expense.vendor_name || t('unknown')}
        logoUri={expense.vendor_logo}
        size={44}
      />

      <View style={styles.details}>
        <Text style={styles.vendorName} numberOfLines={1}>
          {expense.vendor_name || expense.note || t('expense')}
        </Text>
        <View style={styles.categoryRow}>
          {expense.category_icon && (
            <MaterialCommunityIcons
              name={expense.category_icon as any}
              size={14}
              color={expense.category_color || Colors.textSecondary}
            />
          )}
          <Text style={styles.categoryText}>
            {expense.category_name ? tc(expense.category_name) : t('uncategorized')}
          </Text>
        </View>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amount}>
          {formatCurrency(expense.total_amount, currency)}
        </Text>
      </View>
    </Pressable>
  );

  if (selectionMode) {
    return (
      <View style={styles.selectionSlot}>
        {selected ? (
          <View style={styles.selectedCardShell}>
            {rowInner}
          </View>
        ) : (
          rowInner
        )}
      </View>
    );
  }

  return rowInner;
}

export default React.memo(TransactionRow);

const getStyles = () => StyleSheet.create({
  /** Seçim modunda satırlar arası boşluk + yatay hizalama (tarih başlığı ile aynı inset) */
  selectionSlot: {
    marginHorizontal: ScreenPadding.horizontal,
    marginBottom: Spacing.sm,
    overflow: 'visible',
  },
  /** Seçili satırda arka planu ayrı katmanda tut: bitişik satırlar üst üste binince alt köşe “yenmiş” görünmez */
  selectedCardShell: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryGlow,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  containerInSelection: {
    paddingVertical: Spacing.md + 1,
  },
  containerSelected: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
  },
  checkboxWrap: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    gap: Spacing.xxs,
  },
  vendorName: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  categoryText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    ...Typography.amountSmall,
    color: Colors.textPrimary,
    fontSize: 16,
  },
});
