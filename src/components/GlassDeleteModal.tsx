// S.P.A.R.K. — Sade, tema uyumlu silme onayı
//
// Görsel dil `ConfirmModal` ile ortaktır: vurgu rengi kartın üstünde düz bir
// şerit yerine simgenin arkasından sönen bir hâle (radial gradient) olarak
// taşınır, aksiyon butonu yalnız metindir (anlamı baştaki büyük simge taşır) ve
// vazgeç butonu hayalet (şeffaf + ince kenarlık) kalır.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import { SparkToastContainer } from './SparkToast';

interface GlassDeleteModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onDelete: () => void;
  onDismiss?: () => void;
}

export default function GlassDeleteModal({
  visible,
  title,
  message,
  onCancel,
  onDelete,
  onDismiss,
}: GlassDeleteModalProps) {
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
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
          toValue: 0.97,
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

  const displayTitle = title ?? t('delete_confirmation_title');

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
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel={t('cancel')}
        />

        <Animated.View
          testID="delete-confirm-modal"
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Simgenin arkasından sönen tehlike hâlesi. */}
          <View pointerEvents="none" style={styles.aura}>
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="delete-aura" cx="50%" cy="4%" rx="72%" ry="100%">
                  <Stop offset="0" stopColor={Colors.danger} stopOpacity={0.26} />
                  <Stop offset="0.55" stopColor={Colors.danger} stopOpacity={0.07} />
                  <Stop offset="1" stopColor={Colors.danger} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#delete-aura)" />
            </Svg>
          </View>

          <View style={styles.body}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={26}
                color={Colors.danger}
              />
            </View>

            <Text accessibilityRole="header" style={styles.title}>
              {displayTitle}
            </Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.actions}>
              <Pressable
                testID="delete-confirm-cancel"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onCancel}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                testID="delete-confirm-action"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  styles.deleteButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  onDelete();
                }}
              >
                <Text style={styles.deleteButtonText}>{t('delete')}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
      <SparkToastContainer />
    </Modal>
  );
}

const getStyles = () => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    backgroundColor: Colors.danger + '1F',
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
    paddingHorizontal: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cancelButtonText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bold,
  },
  deleteButton: {
    flex: 1.5,
    backgroundColor: Colors.dangerDark,
  },
  deleteButtonText: {
    ...Typography.labelLarge,
    color: '#FFFFFF',
    fontFamily: FontFamily.extraBold,
    letterSpacing: 0.2,
  },
});
