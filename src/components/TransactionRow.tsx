// S.P.A.R.K. — Transaction Row Component
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, FontFamily, FontSize } from '../theme/typography';
import { Spacing, BorderRadius, ScreenPadding } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { ExpenseWithDetails } from '../db/schema';
import { subtractMoney } from '../utils/moneyMath';
import VendorAvatar from './VendorAvatar';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { toIconName } from '../utils/iconName';
import { useThemedStyles } from '../theme/useThemedStyles';

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
  const styles = useThemedStyles(getStyles);
  const { t, tc } = useLanguage();
  const { currency } = useCurrency();
  const paymentCurrency = expense.currency || currency;
  const hasVoucher = (expense.container_voucher_used ?? 0) > 0;
  const cashPaid = Math.max(0, subtractMoney(expense.total_amount, expense.container_voucher_used ?? 0));

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
              name={toIconName(expense.category_icon)}
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
          {formatCurrency(cashPaid, paymentCurrency)}
        </Text>
        {hasVoucher ? (
          <Text style={styles.receiptTotal}>
            {t('total')} {formatCurrency(expense.total_amount, paymentCurrency)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  // Ağaç yapısı modlar arasında AYNI kalır, yalnız stiller değişir. Eskiden
  // seçim modunda satır ek kaplara sarılıyordu: uzun basma seçim modunu açınca
  // parmağın altındaki Pressable yeniden oluşturuluyor, dokunma hedefi
  // kayboluyor ve "basılı tutup sürükleyerek çoklu seçim" hiç başlamıyordu
  // (ürün sahibi bildirimi, 18 Kasım 2026). `collapsable={false}`: Android
  // görünüm düzleştirmesi de yerel hiyerarşiyi modlar arasında değiştirmesin.
  return (
    <View collapsable={false} style={selectionMode ? styles.selectionSlot : undefined}>
      <View
        collapsable={false}
        style={selectionMode ? (selected ? styles.selectedCardShell : styles.cardShellIdle) : undefined}
      >
        {rowInner}
      </View>
    </View>
  );
}

export default React.memo(TransactionRow);

const getStyles = () => StyleSheet.create({
  /** Seçim modunda satırlar arası boşluk + yatay hizalama (tarih başlığı ile aynı inset) */
  selectionSlot: {
    marginHorizontal: ScreenPadding.horizontal,
    marginBottom: Spacing.sm,
    overflow: 'visible',
  },
  /** Seçili olmayan satırda kabuk görünmez; seçili kabukla aynı kenarlık kalınlığı
   * ayrılır ki seçim sırasında satır yüksekliği ve sürükleme hit-test'i kaymasın. */
  cardShellIdle: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'transparent',
    overflow: 'hidden',
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
    minWidth: 0,
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
    maxWidth: '52%',
    gap: Spacing.xxs,
  },
  receiptTotal: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  amount: {
    ...Typography.amountSmall,
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    textAlign: 'right',
  },
});
