// S.P.A.R.K. — Toast Notification System
// Success → Revolut-style bottom sheet with swipe-to-dismiss
// Error/Info/Warning → HUD top toast
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  Modal, Dimensions, PanResponder, Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, LightTheme, getEffectiveColorScheme } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  message: string;
  submessage?: string;
  type: ToastType;
}

const CONFIG: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: 'check-circle', color: '#00FF66' },
  error:   { icon: 'alert-circle', color: '#FF3B3B' },
  info:    { icon: 'information',  color: '#00CCFF' },
  warning: { icon: 'alert',       color: '#FFCC00' },
};

const DISMISS_MS = 3500;
const SCREEN_W = Dimensions.get('window').width;

// ─── Module-level show function ─────────────────────────────────
type ShowFn = (message: string, type?: ToastType, submessage?: string) => void;
let _show: ShowFn = () => {};

export const SparkToast = {
  show: (message: string, type: ToastType = 'success', submessage?: string) => {
    _show(message, type, submessage);
  },
};

// ─── Container Component (no forwardRef, no refs needed from parent) ─
export function SparkToastContainer() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const { t } = useLanguage();
  const isDark = getEffectiveColorScheme() === 'dark';
  const theme = isDark ? DarkTheme : LightTheme;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pauseSuccessRef = useRef<() => void>(() => {});
  const resumeSuccessRef = useRef<() => void>(() => {});
  const dismissSuccessRef = useRef<() => void>(() => {});

  // HUD animated values
  const hudY = useRef(new Animated.Value(-120)).current;
  const hudOp = useRef(new Animated.Value(0)).current;
  const scanVal = useRef(new Animated.Value(0)).current;
  const iconSc = useRef(new Animated.Value(1)).current;

  // Bottom sheet animated values
  const btmY = useRef(new Animated.Value(300)).current;
  const btmOp = useRef(new Animated.Value(0)).current;
  const progW = useRef(new Animated.Value(1)).current;
  const chkSc = useRef(new Animated.Value(0)).current;

  /** Başarı sheet: basılı tutunca süre çubuğu durur; bırakınca kaldığı yerden devam eder */
  useLayoutEffect(() => {
    dismissSuccessRef.current = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      progW.stopAnimation();
      Animated.parallel([
        Animated.timing(btmY, { toValue: 400, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(btmOp, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setToast(null));
    };

    pauseSuccessRef.current = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      progW.stopAnimation();
    };

    resumeSuccessRef.current = () => {
      progW.stopAnimation((value) => {
        const remaining = Math.max(0, value * DISMISS_MS);
        if (remaining < 32) {
          dismissSuccessRef.current();
          return;
        }
        Animated.timing(progW, {
          toValue: 0,
          duration: remaining,
          easing: Easing.linear,
          useNativeDriver: false,
        }).start();
        timerRef.current = setTimeout(() => dismissSuccessRef.current(), remaining);
      });
    };
  }, []);

  /** Sadece üst tutamaktan aşağı kaydırarak kapat (süre çubuğu duraklat → iptal veya devam) */
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8,
      onPanResponderGrant: () => {
        btmY.stopAnimation();
        pauseSuccessRef.current();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) btmY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50 || gs.vy > 0.4) {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          progW.stopAnimation();
          Animated.parallel([
            Animated.timing(btmY, { toValue: 400, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(btmOp, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => setToast(null));
        } else {
          Animated.spring(btmY, { toValue: 0, friction: 10, tension: 80, useNativeDriver: true }).start();
          resumeSuccessRef.current();
        }
      },
    })
  ).current;

  // Register module-level show function on mount
  useEffect(() => {
    _show = (message: string, type: ToastType = 'success', submessage?: string) => {
      // Clear any pending work
      if (timerRef.current) clearTimeout(timerRef.current);
      if (delayRef.current) clearTimeout(delayRef.current);
      scanLoopRef.current?.stop();

      setToast({ message, type, submessage });

      // Delay animation start so the Modal has time to mount
      delayRef.current = setTimeout(() => {
        if (type === 'success') {
          btmY.setValue(300);
          btmOp.setValue(0);
          progW.setValue(1);
          chkSc.setValue(0);

          Animated.parallel([
            Animated.spring(btmY, { toValue: 0, friction: 10, tension: 80, useNativeDriver: true }),
            Animated.timing(btmOp, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(200),
              Animated.spring(chkSc, { toValue: 1, friction: 5, tension: 150, useNativeDriver: true }),
            ]),
            Animated.timing(progW, { toValue: 0, duration: DISMISS_MS, easing: Easing.linear, useNativeDriver: false }),
          ]).start();

          timerRef.current = setTimeout(() => {
            dismissSuccessRef.current();
          }, DISMISS_MS);
        } else {
          hudY.setValue(-120);
          hudOp.setValue(0);
          iconSc.setValue(0.3);

          Animated.parallel([
            Animated.timing(hudY, { toValue: 0, duration: 380, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
            Animated.timing(hudOp, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(200),
              Animated.spring(iconSc, { toValue: 1.25, friction: 4, tension: 200, useNativeDriver: true }),
              Animated.spring(iconSc, { toValue: 1, friction: 6, useNativeDriver: true }),
            ]),
          ]).start();

          scanVal.setValue(0);
          const loop = Animated.loop(
            Animated.timing(scanVal, { toValue: 1, duration: 1800, useNativeDriver: true })
          );
          scanLoopRef.current = loop;
          loop.start();

          timerRef.current = setTimeout(() => {
            scanLoopRef.current?.stop();
            scanLoopRef.current = null;
            Animated.parallel([
              Animated.timing(hudY, { toValue: -120, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
              Animated.timing(hudOp, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start(() => setToast(null));
          }, DISMISS_MS);
        }
      }, 80);
    };

    return () => { _show = () => {}; };
    // All captured values are stable refs/animated values/setState — safe with []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (delayRef.current) clearTimeout(delayRef.current);
      scanLoopRef.current?.stop();
    };
  }, []);

  if (!toast) return null;

  // ─── Success: Bottom sheet ────────────────────────────────────
  if (toast.type === 'success') {
    const sheetInnerW = SCREEN_W - Spacing.lg * 2 - Spacing.xxl * 2;
    const barWidth = progW.interpolate({
      inputRange: [0, 1],
      outputRange: [0, sheetInnerW],
    });

    return (
      <Modal visible transparent animationType="none" statusBarTranslucent>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            style={[StyleSheet.absoluteFill, bS.backdrop, { opacity: btmOp }]}
            pointerEvents="none"
          />
          <Animated.View
            style={[bS.sheet, {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderWidth: isDark ? 1 : 0,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
              transform: [{ translateY: btmY }],
              opacity: btmOp,
            }]}
          >
            <View {...handlePanResponder.panHandlers} style={bS.swipeHandle}>
              <View style={[bS.swipeBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)' }]} />
            </View>

            <Pressable
              style={bS.pressableBody}
              onPressIn={() => pauseSuccessRef.current()}
              onPressOut={() => resumeSuccessRef.current()}
            >
              <View style={[bS.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <Animated.View style={[bS.progressFill, { width: barWidth }]} />
              </View>

              <Animated.View style={[bS.checkCircle, { transform: [{ scale: chkSc }] }]}>
                <View style={bS.checkInner}>
                  <MaterialCommunityIcons name="check" size={32} color="#FFF" />
                </View>
              </Animated.View>

              <Text style={[bS.message, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>{toast.message}</Text>
              {toast.submessage ? <Text style={[bS.submessage, { color: isDark ? '#A0A0B0' : '#6E6E80' }]}>{toast.submessage}</Text> : null}
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // ─── Error / Info / Warning: Top HUD (tema uyumlu: aydınlıkta gri/beyaz kart, koyuda yüzey tonu) ─
  const cfg = CONFIG[toast.type];
  const scanTranslate = scanVal.interpolate({ inputRange: [0, 1], outputRange: [-4, 64] });
  const accentSoft = isDark ? `${cfg.color}99` : `${cfg.color}CC`;
  const borderTint = isDark ? `${cfg.color}44` : `${cfg.color}33`;
  const scanTint = isDark ? `${cfg.color}28` : `${cfg.color}18`;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[
            hS.container,
            {
              backgroundColor: theme.surface,
              borderColor: borderTint,
              shadowColor: isDark ? '#000' : 'rgba(0,0,0,0.35)',
              shadowOpacity: isDark ? 0.45 : 0.12,
              transform: [{ translateY: hudY }],
              opacity: hudOp,
            },
          ]}
        >
          <Animated.View
            style={[
              hS.scanline,
              { backgroundColor: scanTint, opacity: isDark ? 0.45 : 0.35, transform: [{ translateY: scanTranslate }] },
            ]}
          />
          <View style={[hS.corner, hS.cornerTL, { borderColor: accentSoft }]} />
          <View style={[hS.corner, hS.cornerTR, { borderColor: accentSoft }]} />
          <View style={[hS.corner, hS.cornerBL, { borderColor: accentSoft }]} />
          <View style={[hS.corner, hS.cornerBR, { borderColor: accentSoft }]} />
          <View style={hS.content}>
            <Animated.View style={[hS.iconWrap, { shadowColor: cfg.color, transform: [{ scale: iconSc }] }]}>
              <MaterialCommunityIcons name={cfg.icon as any} size={26} color={cfg.color} />
            </Animated.View>
            <View style={hS.textArea}>
              <Text style={[hS.typeLabel, { color: cfg.color }]}>{t(`toast_${toast.type}`)}</Text>
              <Text style={[hS.message, { color: theme.textPrimary }]}>{toast.message}</Text>
              {toast.submessage ? (
                <Text style={[hS.submessage, { color: theme.textSecondary }]}>{toast.submessage}</Text>
              ) : null}
            </View>
            <Text style={[hS.badge, { color: isDark ? `${cfg.color}66` : `${cfg.color}99` }]}>S.P.A.R.K</Text>
          </View>
          <Animated.View style={[hS.progressBar, { backgroundColor: cfg.color, transform: [{ scaleX: hudOp }] }]} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Bottom sheet styles (Revolut-inspired) ─────────────────────
const bS = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  swipeHandle: {
    width: '100%',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  swipeBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  pressableBody: {
    width: '100%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.xxl,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00CC52',
    borderRadius: 2,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 204, 82, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  checkInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00CC52',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00CC52',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  message: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.semiBold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  submessage: {
    ...Typography.bodyMedium,
    textAlign: 'center',
  },
});

// ─── Top HUD styles (error / info / warning) — arka plan ve metin rengi runtime’da tema ile verilir ─
const hS = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    elevation: 16,
  },
  scanline: { position: 'absolute', left: 0, right: 0, height: 2, opacity: 0.6 },
  corner: { position: 'absolute', width: 10, height: 10, borderWidth: 1.5 },
  cornerTL: { top: 6, left: 6, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 6, right: 6, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 6, left: 6, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 6, right: 6, borderLeftWidth: 0, borderTopWidth: 0 },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md },
  iconWrap: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 6 },
  textArea: { flex: 1, gap: 2 },
  typeLabel: { fontSize: 9, fontFamily: FontFamily.bold, letterSpacing: 2 },
  message: { ...Typography.bodyMedium, fontFamily: FontFamily.medium },
  submessage: { ...Typography.bodySmall, marginTop: 1 },
  badge: { fontSize: 8, fontFamily: FontFamily.bold, letterSpacing: 1.5, transform: [{ rotate: '90deg' }] },
  progressBar: { height: 2, alignSelf: 'stretch', transformOrigin: 'left' },
});
