// S.P.A.R.K. — Glassmorphism Delete Confirmation Modal
// Reusable HUD-style modal with red-tinted frosted glass effect
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';

interface GlassDeleteModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onDelete: () => void;
}

/** HUD köşe braketi — border hack yerine iki segment; 4 köşede aynı kalınlık ve yön (Android uyumlu). */
const HUD_CORNER = {
  inset: 8,
  arm: 17,
  thick: 2,
  color: 'rgba(255, 82, 82, 0.92)',
  z: 4 as const,
};

function HudCornerL({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const { inset, arm, thick, color, z } = HUD_CORNER;
  const bar = {
    position: 'absolute' as const,
    backgroundColor: color,
    zIndex: z,
  };

  switch (corner) {
    case 'tl':
      return (
        <>
          <View style={[bar, { top: inset, left: inset, width: arm, height: thick, borderRadius: 0.5 }]} />
          <View style={[bar, { top: inset, left: inset, width: thick, height: arm, borderRadius: 0.5 }]} />
        </>
      );
    case 'tr':
      return (
        <>
          <View style={[bar, { top: inset, right: inset, width: arm, height: thick, borderRadius: 0.5 }]} />
          <View style={[bar, { top: inset, right: inset, width: thick, height: arm, borderRadius: 0.5 }]} />
        </>
      );
    case 'bl':
      return (
        <>
          <View style={[bar, { bottom: inset, left: inset, width: arm, height: thick, borderRadius: 0.5 }]} />
          <View style={[bar, { bottom: inset, left: inset, width: thick, height: arm, borderRadius: 0.5 }]} />
        </>
      );
    case 'br':
      return (
        <>
          <View style={[bar, { bottom: inset, right: inset, width: arm, height: thick, borderRadius: 0.5 }]} />
          <View style={[bar, { bottom: inset, right: inset, width: thick, height: arm, borderRadius: 0.5 }]} />
        </>
      );
  }
}

export default function GlassDeleteModal({
  visible,
  title,
  message,
  onCancel,
  onDelete,
}: GlassDeleteModalProps) {
  const { t } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scanline = useRef(new Animated.Value(0)).current;
  const scanLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      glowAnim.setValue(0);
      scanline.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();

      const loop = Animated.loop(
        Animated.timing(scanline, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      scanLoopRef.current = loop;
      loop.start();
    } else {
      scanLoopRef.current?.stop();
      scanLoopRef.current = null;
    }

    return () => {
      scanLoopRef.current?.stop();
      scanLoopRef.current = null;
    };
  }, [visible]);

  const scanTranslateY = scanline.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 200],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const displayTitle = title ?? t('system_warning');

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <Animated.View
          style={[
            styles.glassContainer,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Red glow layer at top */}
          <Animated.View style={[styles.glowTop, { opacity: glowOpacity }]} />

          {/* Frosted glass layers */}
          <View style={styles.frostLayer1} />
          <View style={styles.frostLayer2} />

          {/* Animated scanline */}
          <Animated.View
            style={[
              styles.scanline,
              { transform: [{ translateY: scanTranslateY }] },
            ]}
          />

          {/* HUD L-brackets — dört köşede aynı geometri (sol üstteki referansla eş) */}
          <HudCornerL corner="tl" />
          <HudCornerL corner="tr" />
          <HudCornerL corner="bl" />
          <HudCornerL corner="br" />

          {/* Content */}
          <View style={styles.content}>
            {/* Danger icon with glow ring */}
            <View style={styles.iconContainer}>
              <View style={styles.iconGlowRing} />
              <View style={styles.iconInner}>
                <MaterialCommunityIcons name="alert-octagon" size={28} color={Colors.danger} />
              </View>
            </View>

            <Text style={styles.title}>{displayTitle}</Text>

            {/* Thin red separator line */}
            <View style={styles.separator} />

            <Text style={styles.message}>{message}</Text>

            {/* Action buttons */}
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.btnCancel, pressed && { opacity: 0.7 }]}
                onPress={onCancel}
              >
                <Text style={styles.btnCancelText}>{t('cancel').toUpperCase()}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btnDelete, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
                onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onDelete(); }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FFFFFF" />
                <Text style={styles.btnDeleteText}>{t('delete').toUpperCase()}</Text>
              </Pressable>
            </View>
          </View>

          {/* Bottom accent bar */}
          <View style={styles.bottomBar} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  glassContainer: {
    width: '85%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 60, 60, 0.35)',
    shadowColor: '#FF3333',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(255, 50, 50, 0.12)',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  frostLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 12, 0.92)',
  },
  frostLayer2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 40, 40, 0.04)',
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 60, 60, 0.15)',
    zIndex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    zIndex: 3,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlowRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 50, 50, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 60, 60, 0.25)',
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 50, 50, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 60, 60, 0.3)',
  },
  title: {
    ...Typography.headlineSmall,
    color: Colors.danger,
    letterSpacing: 2,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  separator: {
    width: 40,
    height: 1.5,
    backgroundColor: 'rgba(255, 60, 60, 0.4)',
    borderRadius: 1,
    marginBottom: Spacing.lg,
  },
  message: {
    ...Typography.bodyMedium,
    color: 'rgba(255, 240, 240, 0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  btnCancel: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    ...Typography.labelMedium,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
    fontFamily: FontFamily.extraBold,
    textTransform: 'uppercase',
  },
  btnDelete: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.danger,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnDeleteText: {
    ...Typography.labelMedium,
    color: '#FFFFFF',
    fontFamily: FontFamily.extraBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bottomBar: {
    height: 3,
    backgroundColor: 'rgba(255, 60, 60, 0.5)',
    shadowColor: '#FF3333',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
});
