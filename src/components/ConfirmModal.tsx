// S.P.A.R.K. — Genel amaçlı Onay Modal'ı
//
// Silme onayı için `GlassDeleteModal` (HUD + kırmızı vurgu) kullanılıyor; ancak
// dışa aktarım, dil değişimi, bildirim toplu silme gibi "nötr/destekleyici"
// aksiyonlar için daha sade ve tema uyumlu bir onay penceresi gerekiyor.
// Bu bileşen:
//   • İki renk varyantı destekler: 'primary' (aktif vurgu) ve 'warning' (amber).
//   • Hem aydınlık hem karanlık temada otomatik görünüm alır.
//   • `BottomSheetModal` yerine ortada (centered dialog) sunar — hızlı kararlar
//     için alt sheet açmak gereğinden fazla ağır hissettiriyordu.
//   • Vurgu rengi kartın üstünde düz bir şerit yerine simgenin arkasından sönen
//     bir hâle (radial gradient) olarak taşınır; şerit kazara çizilmiş gibi
//     duruyordu ve karta karakter katmıyordu.
//   • Onay butonu yalnız metindir: metnin yanındaki tik simgesi hem anlamı
//     tekrarlıyor hem de pill içinde dengesiz duruyordu; anlamı baştaki büyük
//     simge taşıyor.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { SparkToastContainer } from './SparkToast';

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
  onCancel: () => void;
  onConfirm: () => void;
  onDismiss?: () => void;
  /** Mesajın altında, butonların üstünde ek içerik (ör. parola alanları). */
  children?: React.ReactNode;
  /** true iken onay butonu basılamaz ve soluk görünür. */
  confirmDisabled?: boolean;
  confirmTestID?: string;
  cancelTestID?: string;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  icon = 'help-circle-outline',
  onCancel,
  onConfirm,
  onDismiss,
  children,
  confirmDisabled = false,
  confirmTestID,
  cancelTestID,
}: ConfirmModalProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = React.useMemo(() => getStyles(), [scheme, themeRevision]);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(visible);
  const visibleRef = useRef(visible);
  const generationRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useLayoutEffect(() => {
    const generation = ++generationRef.current;
    visibleRef.current = visible;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    animationRef.current?.stop();

    if (visible) {
      if (!mountedRef.current) {
        scaleAnim.setValue(0.9);
        opacityAnim.setValue(0);
        mountedRef.current = true;
        setMounted(true);
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (generationRef.current !== generation || !visibleRef.current) return;
        const entrance = Animated.parallel([
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
        ]);
        animationRef.current = entrance;
        entrance.start();
      });
    } else if (mountedRef.current) {
      const exit = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      animationRef.current = exit;
      exit.start(({ finished }) => {
        if (
          finished &&
          generationRef.current === generation &&
          !visibleRef.current
        ) {
          mountedRef.current = false;
          setMounted(false);
          onDismissRef.current?.();
        }
      });
    }
  }, [visible, scaleAnim, opacityAnim]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      animationRef.current?.stop();
    },
    [],
  );

  if (!mounted) return null;

  const toneColor = tone === 'warning' ? Colors.warning : Colors.primary;
  // DS-03: dolu düğme yüzeyi ve yazısı kontrastı doğrulanmış çiftten gelir.
  // Eski `toneColor` zemin + `background` yazı açık temada 1,4–4,0:1 kalıyordu.
  const confirmColors = getConfirmButtonColors(tone);
  // Aynı anda iki modal mount olabildiği için gradient id'si tona göre ayrışır.
  const auraId = `confirm-aura-${tone}`;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      hardwareAccelerated
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        {/* Ek içerikte (parola alanı) klavye kartı örtmesin. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={children != null}
          style={styles.keyboardFrame}
          pointerEvents="box-none"
        >

        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Simgenin arkasından sönen vurgu hâlesi (düz şerit yerine). */}
          <View pointerEvents="none" style={styles.aura}>
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id={auraId} cx="50%" cy="4%" rx="72%" ry="100%">
                  <Stop offset="0" stopColor={toneColor} stopOpacity={0.26} />
                  <Stop offset="0.55" stopColor={toneColor} stopOpacity={0.07} />
                  <Stop offset="1" stopColor={toneColor} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${auraId})`} />
            </Svg>
          </View>

          <View style={styles.body}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: toneColor + '1F', borderColor: toneColor + '4D' },
              ]}
            >
              <MaterialCommunityIcons name={icon} size={26} color={toneColor} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={[styles.message, children != null && styles.messageWithChildren]}>{message}</Text>
            {children != null && <View style={styles.extra}>{children}</View>}

            <View style={styles.actions}>
              <Pressable
                testID={cancelTestID}
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
                testID={confirmTestID}
                disabled={confirmDisabled}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onConfirm();
                }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnConfirm,
                  { backgroundColor: confirmColors.background },
                  confirmDisabled && styles.btnDisabled,
                  pressed && !confirmDisabled && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: confirmDisabled }}
              >
                <Text style={[styles.btnConfirmText, { color: confirmColors.text }]}>
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
      <SparkToastContainer />
    </Modal>
  );
}

/**
 * Onay düğmesinin dolgu ve yazı rengi. Birincil ton tema sözleşmesindeki
 * `primaryAction`/`onPrimary` çiftini (beş vurguda ≥ 5,4:1) kullanır. Uyarı
 * tonu `warning`/`onWarning` çiftini kullanır (koyu: sarı + koyu yazı, açık:
 * koyu amber + beyaz yazı).
 */
export function getConfirmButtonColors(tone: ConfirmTone): { background: string; text: string } {
  if (tone === 'warning') return { background: Colors.warning, text: Colors.onWarning };
  return { background: Colors.primaryAction, text: Colors.onPrimary };
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
    keyboardFrame: {
      width: '100%',
      alignItems: 'center',
    },
    messageWithChildren: {
      marginBottom: Spacing.md,
    },
    extra: {
      width: '100%',
      marginBottom: Spacing.lg,
    },
    btnDisabled: {
      opacity: 0.45,
    },
    aura: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 168,
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
      borderWidth: 1,
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
      flex: 1,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    btnConfirm: {
      flex: 1.5,
    },
    btnCancelText: {
      ...Typography.labelLarge,
      color: Colors.textSecondary,
      fontFamily: FontFamily.bold,
    },
    btnConfirmText: {
      ...Typography.labelLarge,
      fontFamily: FontFamily.extraBold,
      letterSpacing: 0.2,
    },
  });
