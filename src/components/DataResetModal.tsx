// S.P.A.R.K. — Tüm verileri sıfırlama onayı
//
// Bu, uygulamadaki tek geri alınamaz toplu silme. Tek dokunuşla aylarca
// birikmiş defter gidemez; ama kapı da kullanıcıyı sınava sokmamalı. Onay
// kelimesini YAZDIRMAK bunu yapıyordu: klavye açtırıyor, imla istiyor ve
// kullanıcıya güvenilmediğini ima ediyordu. Yerine BASILI TUTMA geldi —
// kazara yapılamaz, sürtünmesi bir buçuk saniyedir ve niyeti bedeniyle
// ifade eder. Kapı bu yüzden üç katmanlıdır:
//   1. NE gideceği sayıyla söylenir (soyut "tüm veriler" değil, "472 işlem").
//   2. NE kalacağı söylenir — korku değil, bilgi verilir.
//   3. Onay basılı tutularak verilir; parmak kalkarsa hiçbir şey olmaz.
//
// Görsel dil `GlassDeleteModal` ile aynıdır (hâle deseni, danger tonu): üstten
// sönen hâle, halkalı simge, yalın metin düğmeler.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import { SparkToastContainer } from './SparkToast';
import type { UserDataSummary } from '../services/dataReset';

interface DataResetModalProps {
  visible: boolean;
  summary: UserDataSummary | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Basılı tutma süresi. Kazara dokunuşu elemeye yeter, kullanıcıyı bekletmeye
 * yetmez; ilerleme dolgusu süreyi görünür kıldığı için bekleyiş belirsiz değil.
 */
export const HOLD_TO_CONFIRM_MS = 1400;

export default function DataResetModal({
  visible,
  summary,
  busy = false,
  onCancel,
  onConfirm,
}: DataResetModalProps) {
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const [holding, setHolding] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  const releaseHold = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    animation.current?.stop();
    animation.current = null;
    progress.setValue(0);
    setHolding(false);
  }, [progress]);

  // Pencere kapanırsa yarım kalan basış bir sonraki açılışa devredilemez.
  useEffect(() => {
    if (!visible) releaseHold();
    return releaseHold;
  }, [visible, releaseHold]);

  const startHold = useCallback(() => {
    if (busy) return;
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const fill = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_TO_CONFIRM_MS,
      easing: Easing.linear,
      // Genişlik animasyonu native driver'a verilemez.
      useNativeDriver: false,
    });
    animation.current = fill;
    fill.start();
    timer.current = setTimeout(() => {
      timer.current = null;
      releaseHold();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onConfirm();
    }, HOLD_TO_CONFIRM_MS);
  }, [busy, onConfirm, progress, releaseHold]);

  const rows = summary
    ? ([
        ['data_reset_row_expenses', summary.expenses],
        ['data_reset_row_items', summary.items],
        ['data_reset_row_vendors', summary.vendors],
        ['data_reset_row_budgets', summary.budgets],
        ['data_reset_row_debts', summary.debts],
        ['data_reset_row_incomes', summary.incomes],
        ['data_reset_row_plans', summary.paymentPlans],
        ['data_reset_row_products', summary.products],
        ['data_reset_row_limits', summary.categoryLimits],
        ['data_reset_row_categories', summary.customCategories],
      ] as const).filter(([, value]) => value > 0)
    : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={busy ? () => {} : onCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onCancel}
          accessibilityLabel={t('cancel')}
        />

        <View style={styles.card} testID="data-reset-modal" accessibilityViewIsModal>
          {/* Simgenin arkasından sönen tehlike hâlesi. */}
          <View pointerEvents="none" style={styles.aura}>
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="data-reset-aura" cx="50%" cy="4%" rx="72%" ry="100%">
                  <Stop offset="0" stopColor={Colors.danger} stopOpacity={0.26} />
                  <Stop offset="0.55" stopColor={Colors.danger} stopOpacity={0.07} />
                  <Stop offset="1" stopColor={Colors.danger} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#data-reset-aura)" />
            </Svg>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name="database-remove-outline"
                size={26}
                color={Colors.danger}
              />
            </View>

            <Text accessibilityRole="header" style={styles.title}>
              {t('data_reset_title')}
            </Text>
            <Text style={styles.message}>{t('data_reset_message')}</Text>

            {rows.length > 0 && (
              <View style={styles.list} testID="data-reset-summary">
                {rows.map(([key, value]) => (
                  <View key={key} style={styles.listRow}>
                    <Text style={styles.listLabel} numberOfLines={1}>
                      {t(key)}
                    </Text>
                    <Text style={styles.listValue}>{value.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.keepRow}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={14}
                color={Colors.success}
              />
              <Text style={styles.keepText}>{t('data_reset_preserved')}</Text>
            </View>

            <View style={styles.backupRow}>
              <MaterialCommunityIcons
                name="alert-outline"
                size={14}
                color={Colors.warning}
              />
              <Text style={styles.backupText}>{t('data_reset_backup_hint')}</Text>
            </View>


            <View style={styles.actions}>
              <Pressable
                testID="data-reset-cancel"
                accessibilityRole="button"
                disabled={busy}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.button,
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                  busy && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                testID="data-reset-confirm"
                accessibilityRole="button"
                accessibilityLabel={t('data_reset_confirm_cta')}
                accessibilityHint={t('data_reset_hold_hint')}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPressIn={startHold}
                onPressOut={releaseHold}
                style={[styles.button, styles.confirmButton, busy && styles.buttonDisabled]}
              >
                {/* Süre görünür: ne kadar tutulacağı belirsiz kalmaz. */}
                <Animated.View
                  pointerEvents="none"
                  testID="data-reset-hold-progress"
                  style={[
                    styles.holdFill,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
                <Text style={styles.confirmText}>
                  {busy
                    ? t('data_reset_in_progress')
                    : holding
                      ? t('data_reset_hold_active')
                      : t('data_reset_confirm_cta')}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.holdHint}>{t('data_reset_hold_hint')}</Text>
          </ScrollView>
        </View>
      </View>
      <SparkToastContainer />
    </Modal>
  );
}

const getStyles = () => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '86%',
    overflow: 'hidden',
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 22,
  },
  aura: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 168,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.danger + '4D',
    backgroundColor: Colors.danger + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  list: {
    alignSelf: 'stretch',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: 5,
  },
  listLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    minWidth: 0,
  },
  listValue: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  keepRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  keepText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 15,
  },
  backupRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  backupText: {
    ...Typography.labelSmall,
    color: Colors.warning,
    flex: 1,
    lineHeight: 15,
  },
  holdFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.danger,
  },
  holdHint: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.round,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cancelText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bold,
  },
  confirmButton: {
    flex: 1.5,
    backgroundColor: Colors.dangerDark,
    overflow: 'hidden',
  },
  confirmText: {
    ...Typography.labelLarge,
    color: '#FFFFFF',
    fontFamily: FontFamily.extraBold,
    letterSpacing: 0.2,
  },
});
