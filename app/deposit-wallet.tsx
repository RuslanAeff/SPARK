import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ContainerDepositDao, type ContainerDepositSummary } from '../src/db/containerDepositDao';
import type { ContainerDepositVoucher } from '../src/db/schema';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useCurrency } from '../src/context/CurrencyContext';
import { useRefreshActions } from '../src/context/RefreshContext';
import { useAppTheme, useThemeRevision } from '../src/theme/themeStore';
import { Colors } from '../src/theme/colors';
import { BorderRadius, ScreenPadding, Spacing } from '../src/theme/spacing';
import { FontFamily, Typography } from '../src/theme/typography';
import { formatCurrency } from '../src/utils/formatCurrency';
import { formatDateFull, getToday } from '../src/utils/dateUtils';
import { parseMoneyInput } from '../src/utils/moneyMath';
import CustomDatePicker from '../src/components/CustomDatePicker';
import { SparkToast } from '../src/components/SparkToast';
import { createSusevarStyles, susevarButtonPressed } from '../src/theme/susevar';

const EMPTY_SUMMARY: ContainerDepositSummary = {
  depositPaid: 0,
  recovered: 0,
  availableVoucher: 0,
};

export default function DepositWalletScreen() {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, revision]);
  const router = useRouter();
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { triggerRefresh } = useRefreshActions();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [vouchers, setVouchers] = useState<ContainerDepositVoucher[]>([]);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [issuedDate, setIssuedDate] = useState(getToday());
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [dateTarget, setDateTarget] = useState<'issued' | 'expiry' | null>(null);
  const [saving, setSaving] = useState(false);
  const iconProgress = useSharedValue(0);

  useEffect(() => {
    iconProgress.value = withTiming(adding ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [adding, iconProgress]);

  const plusIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - iconProgress.value,
    transform: [
      { rotate: `${interpolate(iconProgress.value, [0, 1], [0, 45])}deg` },
      { scale: interpolate(iconProgress.value, [0, 1], [1, 0.86]) },
    ],
  }));

  const closeIconStyle = useAnimatedStyle(() => ({
    opacity: iconProgress.value,
    transform: [
      { rotate: `${interpolate(iconProgress.value, [0, 1], [-45, 0])}deg` },
      { scale: interpolate(iconProgress.value, [0, 1], [0.86, 1]) },
    ],
  }));

  const load = useCallback(async () => {
    const nextSummary = await ContainerDepositDao.getSummary(currency);
    const nextVouchers = await ContainerDepositDao.getAll();
    setSummary(nextSummary);
    setVouchers(nextVouchers.filter(voucher => voucher.currency === currency));
  }, [currency]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveVoucher = async () => {
    const parsed = parseMoneyInput(amount);
    if (parsed == null || parsed <= 0) {
      SparkToast.show(t('deposit_amount_invalid'), 'error');
      return;
    }
    setSaving(true);
    try {
      await ContainerDepositDao.createVoucher({
        amount: parsed,
        currency,
        issuedDate,
        expiresOn,
      });
      setAmount('');
      setIssuedDate(getToday());
      setExpiresOn(null);
      setAdding(false);
      await load();
      triggerRefresh();
      SparkToast.show(t('deposit_voucher_saved'), 'success');
    } catch {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const redeem = (voucher: ContainerDepositVoucher) => {
    Alert.alert(
      t('deposit_mark_redeemed'),
      t('deposit_mark_redeemed_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: () => {
            void ContainerDepositDao.markRedeemed(voucher.id).then(async () => {
              await load();
              triggerRefresh();
            }).catch(() => SparkToast.show(t('operation_failed'), 'error'));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-left" size={23} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('deposit_wallet_title')}</Text>
        <Pressable onPress={() => setAdding(value => !value)} style={styles.headerButton} accessibilityRole="button">
          <Animated.View pointerEvents="none" style={[styles.headerIconLayer, plusIconStyle]}>
            <MaterialCommunityIcons name="plus" size={23} color={Colors.primary} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.headerIconLayer, closeIconStyle]}>
            <MaterialCommunityIcons name="close" size={23} color={Colors.primary} />
          </Animated.View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.heroLabel}>{t('deposit_available_vouchers')}</Text>
          <Text style={styles.heroValue}>{formatCurrency(summary.availableVoucher, currency)}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('deposit_paid_total')}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.depositPaid, currency)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('deposit_recovered_total')}</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                {formatCurrency(summary.recovered, currency)}
              </Text>
            </View>
          </View>
        </View>

        {adding ? (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{t('deposit_add_voucher')}</Text>
            <Text style={styles.label}>{t('amount')}</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>{t('deposit_issued_date')}</Text>
            <Pressable onPress={() => setDateTarget('issued')} style={styles.dateButton}>
              <Text style={styles.dateText}>{formatDateFull(issuedDate, t)}</Text>
              <MaterialCommunityIcons name="calendar-outline" size={19} color={Colors.textSecondary} />
            </Pressable>
            <Text style={styles.label}>{t('deposit_expiry_optional')}</Text>
            <Pressable onPress={() => setDateTarget('expiry')} style={styles.dateButton}>
              <Text style={[styles.dateText, !expiresOn && { color: Colors.textMuted }]}>
                {expiresOn ? formatDateFull(expiresOn, t) : t('optional')}
              </Text>
              {expiresOn ? (
                <Pressable onPress={() => setExpiresOn(null)} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={19} color={Colors.textSecondary} />
                </Pressable>
              ) : (
                <MaterialCommunityIcons name="calendar-outline" size={19} color={Colors.textSecondary} />
              )}
            </Pressable>
            <Pressable
              onPress={() => void saveVoucher()}
              disabled={saving}
              style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, saving && { opacity: 0.55 }]}
            >
              <Text style={styles.saveButtonText}>{t('save')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('deposit_vouchers')}</Text>
          <Text style={styles.sectionHint}>{t('deposit_vouchers_hint')}</Text>
        </View>
        {vouchers.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="ticket-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('deposit_no_vouchers')}</Text>
            <Text style={styles.emptyHint}>{t('deposit_no_vouchers_hint')}</Text>
          </View>
        ) : vouchers.map(voucher => (
          <View key={voucher.id} style={[styles.voucherCard, voucher.status !== 'available' && styles.voucherMuted]}>
            <View style={styles.voucherTop}>
              <View style={styles.voucherCopy}>
                <Text style={styles.voucherAmount}>{formatCurrency(voucher.amount, voucher.currency)}</Text>
                <Text style={styles.voucherMeta}>
                  {t(`deposit_status_${voucher.status}`)} · {formatDateFull(voucher.issued_date, t)}
                </Text>
                {voucher.expires_on ? (
                  <Text style={styles.voucherExpiry}>{t('deposit_voucher_expires', { date: formatDateFull(voucher.expires_on, t) })}</Text>
                ) : null}
              </View>
              <View style={[styles.statusDot, voucher.status === 'available' && styles.statusDotAvailable]} />
            </View>
            {voucher.status === 'available' ? (
              <Pressable onPress={() => redeem(voucher)} style={styles.redeemButton}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.redeemText}>{t('deposit_mark_redeemed')}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <CustomDatePicker
        visible={dateTarget != null}
        onClose={() => setDateTarget(null)}
        initialDate={dateTarget === 'expiry' ? (expiresOn ?? issuedDate) : issuedDate}
        onSelectDate={(value) => {
          if (dateTarget === 'expiry') setExpiresOn(value);
          else setIssuedDate(value);
          setDateTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const getStyles = () => {
  const susevar = createSusevarStyles(Colors);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      minHeight: 58, flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: ScreenPadding.horizontal, gap: Spacing.md,
    },
    headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerIconLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    title: { ...Typography.headlineMedium, color: Colors.textPrimary, textAlign: 'center', flex: 1, fontFamily: FontFamily.bold },
    content: { padding: ScreenPadding.horizontal, paddingBottom: Spacing.huge, gap: Spacing.lg },
    heroCard: {
      alignItems: 'center', padding: Spacing.xl, borderRadius: BorderRadius.xl,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    },
    heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary + '18' },
    heroLabel: { ...Typography.labelLarge, color: Colors.textSecondary, marginTop: Spacing.md },
    heroValue: { ...Typography.displaySmall, color: Colors.primary, fontFamily: FontFamily.bold, marginTop: 2 },
    summaryRow: { flexDirection: 'row', alignItems: 'stretch', width: '100%', marginTop: Spacing.xl },
    summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
    summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
    summaryLabel: { ...Typography.labelSmall, color: Colors.textMuted, textAlign: 'center' },
    summaryValue: { ...Typography.bodyMedium, color: Colors.textPrimary, fontFamily: FontFamily.semiBold },
    formCard: { padding: Spacing.lg, borderRadius: BorderRadius.xl, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
    sectionHeader: { gap: 3 },
    sectionTitle: { ...Typography.headlineSmall, color: Colors.textPrimary, fontFamily: FontFamily.semiBold },
    sectionHint: { ...Typography.bodySmall, color: Colors.textSecondary },
    label: { ...Typography.labelMedium, color: Colors.textSecondary, marginTop: Spacing.xs },
    input: { ...Typography.bodyLarge, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md },
    dateButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md },
    dateText: { ...Typography.bodyMedium, color: Colors.textPrimary, flex: 1 },
    saveButton: { ...susevar.button, marginTop: Spacing.md },
    saveButtonPressed: susevarButtonPressed,
    saveButtonText: susevar.text,
    emptyCard: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.xs, backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border },
    emptyTitle: { ...Typography.bodyMedium, color: Colors.textPrimary, fontFamily: FontFamily.semiBold },
    emptyHint: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center' },
    voucherCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
    voucherMuted: { opacity: 0.66 },
    voucherTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    voucherCopy: { flex: 1 },
    voucherAmount: { ...Typography.headlineSmall, color: Colors.textPrimary, fontFamily: FontFamily.bold },
    voucherMeta: { ...Typography.labelMedium, color: Colors.textSecondary, marginTop: 3 },
    voucherExpiry: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: 3 },
    statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.textMuted, marginTop: 7 },
    statusDotAvailable: { backgroundColor: Colors.success },
    redeemButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingTop: Spacing.sm },
    redeemText: { ...Typography.labelLarge, color: Colors.primary, fontFamily: FontFamily.semiBold },
  });
};
