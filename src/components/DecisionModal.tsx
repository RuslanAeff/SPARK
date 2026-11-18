// S.P.A.R.K. — Ortak karar penceresi (UI denetimi CQ-05, UX-03, A11Y-03)
//
// `ConfirmModal` (nötr/uyarı) ve `GlassDeleteModal` (silme) aynı hâle
// desenini, aynı açılış/kapanış yaşam döngüsünü ve aynı düğme düzenini iki
// ayrı kopyada taşıyordu; kopyalar arasında fark oluşmuştu (simge dairesi 56/52,
// düğme alt sınırı, erişilebilirlik rolleri, açık temada okunmayan onay
// düğmesi). İkisi artık bu bileşenin ince sarmalayıcılarıdır.
//
// Hâle deseni (DESIGN_BRIEF §7): üst kenardan sönen radial gradient, tona bağlı
// simge çapası ve yalnız metinden oluşan eylemler; vazgeç hayalet, asıl eylem
// ~1,5 kat geniş.
//
// UX-03: kart ekran yüksekliğini aşamaz. Uzun mesaj (AZ/RU, büyük yazı ölçeği)
// veya ek içerik (parola alanları) yalnız gövdede kayar; simge, başlık ve
// eylemler hep görünür.
import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { SparkToastContainer } from './SparkToast';
import { useKeyboardHeight } from '../hooks/useKeyboard';

export type DecisionTone = 'primary' | 'warning' | 'danger';

export interface DecisionModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: DecisionTone;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onCancel: () => void;
  onConfirm: () => void;
  onDismiss?: () => void;
  /** Mesajın altında, eylemlerin üstünde ek içerik (ör. parola alanları). */
  children?: React.ReactNode;
  confirmDisabled?: boolean;
  confirmTestID?: string;
  cancelTestID?: string;
  cardTestID?: string;
  /** Karartıya dokunmanın ekran okuyucu etiketi. */
  backdropAccessibilityLabel?: string;
}

/** Tona göre vurgu (hâle, simge) ve dolu onay düğmesinin renk çifti. */
export function getDecisionColors(tone: DecisionTone): {
  accent: string;
  background: string;
  text: string;
} {
  if (tone === 'danger') return { accent: Colors.danger, background: Colors.dangerDark, text: '#FFFFFF' };
  if (tone === 'warning') return { accent: Colors.warning, background: Colors.warning, text: Colors.onWarning };
  return { accent: Colors.primary, background: Colors.primaryAction, text: Colors.onPrimary };
}

const ZERO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

export default function DecisionModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  icon,
  onCancel,
  onConfirm,
  onDismiss,
  children,
  confirmDisabled = false,
  confirmTestID,
  cancelTestID,
  cardTestID,
  backdropAccessibilityLabel,
}: DecisionModalProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Colors proxy tema snapshot'ını okur
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  // Sağlayıcı yoksa (ör. bazı testler) sıfır inset ile güvenle çalışır.
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  // UX-04: Android'de pencere klavyeyle küçülmez; ek içerik (parola alanı)
  // varken kart klavyenin üstünde kalsın diye alt boşluk klavye kadar büyür.
  // iOS'ta aynı işi aşağıdaki KeyboardAvoidingView yapar.
  const keyboardHeight = useKeyboardHeight();
  const androidKeyboardLift = Platform.OS === 'android' && children != null ? keyboardHeight : 0;

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
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
        scaleAnim.setValue(0.92);
        opacityAnim.setValue(0);
        mountedRef.current = true;
        setMounted(true);
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (generationRef.current !== generation || !visibleRef.current) return;
        const entrance = Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, friction: 9, tension: 110, useNativeDriver: true }),
          Animated.timing(opacityAnim, {
            toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
        ]);
        animationRef.current = entrance;
        entrance.start();
      });
    } else if (mountedRef.current) {
      const exit = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.97, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
      ]);
      animationRef.current = exit;
      exit.start(({ finished }) => {
        if (finished && generationRef.current === generation && !visibleRef.current) {
          mountedRef.current = false;
          setMounted(false);
          onDismissRef.current?.();
        }
      });
    }
  }, [visible, opacityAnim, scaleAnim]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      animationRef.current?.stop();
    },
    [],
  );

  if (!mounted) return null;

  const colors = getDecisionColors(tone);
  const resolvedIcon = icon ?? (tone === 'danger' ? 'trash-can-outline' : 'help-circle-outline');
  // Aynı anda iki pencere açık olabildiği için gradient id'si tona göre ayrışır.
  const auraId = `decision-aura-${tone}`;

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
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim,
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: Math.max(insets.bottom, androidKeyboardLift) + Spacing.lg,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel={backdropAccessibilityLabel ?? cancelLabel}
        />
        {/* Ek içerikte (parola alanı) klavye kartı örtmesin. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={children != null}
          style={styles.keyboardFrame}
          pointerEvents="box-none"
        >
          <Animated.View
            testID={cardTestID}
            accessibilityViewIsModal
            accessibilityRole={tone === 'danger' ? 'alert' : undefined}
            style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
          >
            {/* Simgenin arkasından sönen vurgu hâlesi (düz şerit yerine). */}
            <View pointerEvents="none" style={styles.aura}>
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id={auraId} cx="50%" cy="4%" rx="72%" ry="100%">
                    <Stop offset="0" stopColor={colors.accent} stopOpacity={0.26} />
                    <Stop offset="0.55" stopColor={colors.accent} stopOpacity={0.07} />
                    <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${auraId})`} />
              </Svg>
            </View>

            <View style={styles.head}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.accent + '1F', borderColor: colors.accent + '4D' },
                ]}
              >
                <MaterialCommunityIcons name={resolvedIcon} size={26} color={colors.accent} />
              </View>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            </View>

            <ScrollView
              testID="decision-modal-body"
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyContent}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={styles.message}>{message}</Text>
              {children != null && <View style={styles.extra}>{children}</View>}
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                testID={cancelTestID}
                onPress={onCancel}
                style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.btnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.btnCancelText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable
                testID={confirmTestID}
                disabled={confirmDisabled}
                onPress={() => {
                  if (tone === 'danger') {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  } else {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onConfirm();
                }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnConfirm,
                  { backgroundColor: colors.background },
                  confirmDisabled && styles.btnDisabled,
                  pressed && !confirmDisabled && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: confirmDisabled }}
              >
                <Text style={[styles.btnConfirmText, { color: colors.text }]}>{confirmLabel}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
      <SparkToastContainer />
    </Modal>
  );
}

const getStyles = () =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.56)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    keyboardFrame: {
      width: '100%',
      maxHeight: '100%',
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 380,
      maxHeight: '100%',
      flexShrink: 1,
      backgroundColor: Colors.cardSurface,
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 24,
    },
    aura: { position: 'absolute', top: 0, left: 0, right: 0, height: 168 },
    head: {
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xxl,
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
    bodyScroll: { flexGrow: 0, flexShrink: 1 },
    bodyContent: { paddingHorizontal: Spacing.xl, alignItems: 'center' },
    message: {
      ...Typography.bodyMedium,
      color: Colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    extra: { width: '100%', marginTop: Spacing.md },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xxl,
    },
    btn: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.round,
    },
    btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    btnCancel: {
      flex: 1,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    btnConfirm: { flex: 1.5 },
    btnDisabled: { opacity: 0.45 },
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
