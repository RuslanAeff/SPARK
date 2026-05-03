// S.P.A.R.K. — Genel amaçlı Onay Modal'ı
//
// Silme onayı için `GlassDeleteModal` (HUD + kırmızı vurgu) kullanılıyor; ancak
// dışa aktarım, dil değişimi, bildirim toplu silme gibi "nötr/destekleyici"
// aksiyonlar için daha sade ve tema uyumlu bir onay penceresi gerekiyor.
// Bu bileşen:
//   • İki renk varyantı destekler: 'primary' (yeşil) ve 'warning' (amber).
//   • Hem aydınlık hem karanlık temada otomatik görünüm alır.
//   • `BottomSheetModal` yerine ortada (centered dialog) sunar — hızlı kararlar
//     için alt sheet açmak gereğinden fazla ağır hissettiriyordu.
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

export type ConfirmTone = 'primary' | 'warning';

export interface ConfirmModalProps {
  visible: boolean;
  /** Başlık — kısa ve bold. */
  title: string;
  /** Açıklama — 1-3 satır. */
  message: string;
  /** Onay butonunun metni. */
  confirmLabel: string;
  /** Vazgeç butonunun metni. */
  cancelLabel: string;
  /** Simge rengi / onay butonu rengi. */
  tone?: ConfirmTone;
  /** Başlık üstünde gösterilecek MaterialCommunityIcons adı. */
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Onay butonunda gösterilecek opsiyonel simge. */
  confirmIcon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  icon = 'help-circle-outline',
  confirmIcon,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const scheme = useAppTheme();
  const styles = React.useMemo(() => getStyles(), [scheme]);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 9,
          tension: 110,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const toneColor = tone === 'warning' ? Colors.warning : Colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Accent strip */}
          <View style={[styles.accent, { backgroundColor: toneColor }]} />

          <View style={styles.body}>
            <View style={[styles.iconWrap, { backgroundColor: toneColor + '1F' }]}>
              <MaterialCommunityIcons name={icon} size={28} color={toneColor} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnCancel,
                  pressed && styles.btnPressed,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.btnCancelText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onConfirm();
                }}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: toneColor },
                  pressed && styles.btnPressed,
                ]}
                accessibilityRole="button"
              >
                {confirmIcon ? (
                  <MaterialCommunityIcons
                    name={confirmIcon}
                    size={18}
                    color={Colors.background}
                  />
                ) : null}
                <Text style={[styles.btnConfirmText, { color: Colors.background }]}>
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const getStyles = () =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: Colors.cardSurface,
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 24,
    },
    accent: {
      height: 3,
      width: '100%',
    },
    body: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.xxl,
      alignItems: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
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
      marginBottom: Spacing.xl,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      width: '100%',
    },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.round,
    },
    btnPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    btnCancel: {
      backgroundColor: Colors.surfaceLight,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    btnCancelText: {
      ...Typography.labelLarge,
      color: Colors.textSecondary,
      fontFamily: FontFamily.bold,
    },
    btnConfirmText: {
      ...Typography.labelLarge,
      fontFamily: FontFamily.extraBold,
      letterSpacing: 0.3,
    },
  });
