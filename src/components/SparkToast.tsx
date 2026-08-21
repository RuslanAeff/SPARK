// S.P.A.R.K. — Root overlay toast system
//
// Toast'lar React Native Modal kullanmaz. Android'de Modal ayrı bir native
// pencere oluşturup sistem çubuklarını yeniden kompoze ettiği için rutin başarı
// eylemlerinde tam-ekran ışık/kararma patlaması üretiyordu. Bu container zaten
// root layout'ta olduğundan aynı React yüzeyinde absolute overlay olarak çizilir.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, useThemePalette } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  id: number;
  key: string;
  message: string;
  submessage?: string;
  type: ToastType;
}

const CONFIG: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: 'check-circle', color: '#00C853' },
  error: { icon: 'alert-circle', color: '#FF3B3B' },
  info: { icon: 'information', color: '#00A8D6' },
  warning: { icon: 'alert', color: '#E5A900' },
};

const DISMISS_MS = 3500;
type ShowFn = (message: string, type?: ToastType, submessage?: string) => void;
const mountedHosts = new Set<ShowFn>();

export const SparkToast = {
  show: (message: string, type: ToastType = 'success', submessage?: string) => {
    // Root host her zaman vardır. Native bir bottom-sheet açıksa onun içindeki
    // host da aynı bildirimi çizer; sheet kapanınca alttaki root kopyası yaşam
    // süresine kesintisiz devam eder.
    mountedHosts.forEach((show) => show(message, type, submessage));
  },
};

export function SparkToastContainer() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const scheme = useAppTheme();
  const theme = useThemePalette();
  const isDark = scheme === 'dark';
  const { top, bottom } = useSafeAreaInsets();
  const { t } = useLanguage();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const nextIdRef = useRef(0);
  const activeIdRef = useRef<number | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const phaseRef = useRef<'idle' | 'entering' | 'visible' | 'exiting'>('idle');
  // Render/effect callback'lerinin her zaman güncel toast'ı görmesi için ref.
  const toastRef = useRef<ToastData | null>(null);
  toastRef.current = toast;

  const successY = useRef(new Animated.Value(280)).current;
  const successOpacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0.72)).current;

  const hudY = useRef(new Animated.Value(-140)).current;
  const hudOpacity = useRef(new Animated.Value(1)).current;
  const hudIconScale = useRef(new Animated.Value(0.8)).current;

  const dismissRef = useRef<() => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});

  const clearTimer = () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const clearFrame = () => {
    if (frameRef.current == null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  const stopAllAnimations = () => {
    successY.stopAnimation();
    successOpacity.stopAnimation();
    progress.stopAnimation();
    checkScale.stopAnimation();
    hudY.stopAnimation();
    hudOpacity.stopAnimation();
    hudIconScale.stopAnimation();
  };

  useLayoutEffect(() => {
    const clearIfCurrent = (id: number) => {
      if (activeIdRef.current !== id) return;
      activeIdRef.current = null;
      activeKeyRef.current = null;
      phaseRef.current = 'idle';
      setToast(null);
    };

    const scheduleDismiss = (id: number, delay = DISMISS_MS) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (activeIdRef.current === id) dismissRef.current();
      }, delay);
    };

    dismissRef.current = () => {
      const id = activeIdRef.current;
      if (id == null || phaseRef.current === 'exiting') return;
      clearTimer();
      phaseRef.current = 'exiting';
      const type = toastRef.current?.type;

      if (type === 'success') {
        progress.stopAnimation();
        Animated.parallel([
          Animated.timing(successY, {
            toValue: 300,
            duration: 230,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(successOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) clearIfCurrent(id);
        });
      } else {
        Animated.parallel([
          Animated.timing(hudY, {
            toValue: -140,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(hudOpacity, {
            toValue: 0,
            duration: 170,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) clearIfCurrent(id);
        });
      }
    };

    pauseRef.current = () => {
      if (toastRef.current?.type !== 'success' || phaseRef.current === 'exiting') return;
      clearTimer();
      progress.stopAnimation();
    };

    resumeRef.current = () => {
      const id = activeIdRef.current;
      if (id == null || toastRef.current?.type !== 'success' || phaseRef.current === 'exiting') {
        return;
      }
      progress.stopAnimation((value) => {
        if (activeIdRef.current !== id) return;
        const remaining = Math.max(0, value * DISMISS_MS);
        if (remaining < 32) {
          dismissRef.current();
          return;
        }
        Animated.timing(progress, {
          toValue: 0,
          duration: remaining,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start();
        scheduleDismiss(id, remaining);
      });
    };

    return () => {
      dismissRef.current = () => {};
      pauseRef.current = () => {};
      resumeRef.current = () => {};
    };
  }, [
    successY,
    successOpacity,
    progress,
    checkScale,
    hudY,
    hudOpacity,
    hudIconScale,
  ]);

  useEffect(() => {
    const show: ShowFn = (
      message: string,
      type: ToastType = 'success',
      submessage?: string,
    ) => {
      const key = `${type}|${message}|${submessage ?? ''}`;
      const activeId = activeIdRef.current;

      // Aynı görünür bildirimi yeniden mount etme; yalnız yaşam süresini uzat.
      if (
        activeId != null &&
        activeKeyRef.current === key &&
        phaseRef.current !== 'exiting'
      ) {
        clearTimer();
        if (type === 'success') {
          progress.stopAnimation();
          progress.setValue(1);
          Animated.timing(progress, {
            toValue: 0,
            duration: DISMISS_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }).start();
        }
        timerRef.current = setTimeout(() => {
          if (activeIdRef.current === activeId) dismissRef.current();
        }, DISMISS_MS);
        return;
      }

      const current = toastRef.current;
      // Aynı yerleşim türünde yeni içerik geldiğinde görünür yüzeyi kaldırma.
      // İçerik yerinde güncellenir, sayaç/pulse yeniden başlar. Özellikle art
      // arda gelen kayıt bildirimlerinde tek karelik boşluğu ortadan kaldırır.
      if (activeId != null && current?.type === type) {
        const id = ++nextIdRef.current;
        activeIdRef.current = id;
        activeKeyRef.current = key;
        phaseRef.current = 'visible';
        clearTimer();
        clearFrame();

        const nextToast: ToastData = { id, key, message, type, submessage };
        toastRef.current = nextToast;
        setToast(nextToast);

        if (type === 'success') {
          successY.stopAnimation();
          successOpacity.stopAnimation();
          progress.stopAnimation();
          checkScale.stopAnimation();
          progress.setValue(1);
          checkScale.setValue(0.88);
          Animated.parallel([
            Animated.spring(successY, {
              toValue: 0,
              speed: 20,
              bounciness: 3,
              useNativeDriver: true,
            }),
            Animated.timing(successOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.spring(checkScale, {
              toValue: 1,
              speed: 22,
              bounciness: 4,
              useNativeDriver: true,
            }),
            Animated.timing(progress, {
              toValue: 0,
              duration: DISMISS_MS,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]).start();
        } else {
          hudY.stopAnimation();
          hudOpacity.stopAnimation();
          hudIconScale.stopAnimation();
          hudIconScale.setValue(0.9);
          Animated.parallel([
            Animated.timing(hudY, {
              toValue: 0,
              duration: 160,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(hudOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.spring(hudIconScale, {
              toValue: 1,
              speed: 22,
              bounciness: 3,
              useNativeDriver: true,
            }),
          ]).start();
        }
        timerRef.current = setTimeout(() => {
          if (activeIdRef.current === id) dismissRef.current();
        }, DISMISS_MS);
        return;
      }

      // Eski callback'ler yeni toast'ı silemesin: önce generation değişir, tüm
      // işler durur ve animasyon değerleri içerik değiştirilmeden gizli konuma alınır.
      const id = ++nextIdRef.current;
      activeIdRef.current = id;
      activeKeyRef.current = key;
      phaseRef.current = 'entering';
      clearTimer();
      clearFrame();
      stopAllAnimations();

      if (type === 'success') {
        successY.setValue(280);
        successOpacity.setValue(0);
        progress.setValue(1);
        checkScale.setValue(0.72);
      } else {
        hudY.setValue(-140);
        hudOpacity.setValue(0);
        hudIconScale.setValue(0.8);
      }

      const nextToast: ToastData = { id, key, message, type, submessage };
      toastRef.current = nextToast;
      setToast(nextToast);

      // Tek frame: içerik gizli konumda commit edilir, ardından yalnız kendi
      // yüzeyi hareket eder. Native pencere veya 80ms boş Modal aşaması yok.
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (activeIdRef.current !== id) return;

        if (type === 'success') {
          Animated.parallel([
            Animated.spring(successY, {
              toValue: 0,
              speed: 18,
              bounciness: 4,
              useNativeDriver: true,
            }),
            Animated.spring(checkScale, {
              toValue: 1,
              speed: 20,
              bounciness: 5,
              useNativeDriver: true,
            }),
            Animated.timing(successOpacity, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(progress, {
              toValue: 0,
              duration: DISMISS_MS,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(hudY, {
              toValue: 0,
              duration: 280,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(hudIconScale, {
              toValue: 1,
              speed: 20,
              bounciness: 4,
              useNativeDriver: true,
            }),
            Animated.timing(hudOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
        phaseRef.current = 'visible';
        timerRef.current = setTimeout(() => {
          if (activeIdRef.current === id) dismissRef.current();
        }, DISMISS_MS);
      });
    };
    mountedHosts.add(show);

    return () => {
      mountedHosts.delete(show);
      clearTimer();
      clearFrame();
      stopAllAnimations();
    };
    // Animated.Value/ref kimlikleri sabittir; kayıt yalnız bir kez yapılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderGrant: () => {
        successY.stopAnimation();
        pauseRef.current();
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) successY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 52 || gesture.vy > 0.45) {
          dismissRef.current();
          return;
        }
        Animated.spring(successY, {
          toValue: 0,
          speed: 20,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
        resumeRef.current();
      },
      onPanResponderTerminate: () => {
        Animated.spring(successY, {
          toValue: 0,
          speed: 20,
          bounciness: 3,
          useNativeDriver: true,
        }).start();
        resumeRef.current();
      },
    }),
  ).current;

  if (!toast) return null;

  if (toast.type === 'success') {
    return (
      <View testID="spark-toast-host" style={hostStyles.host} pointerEvents="box-none">
        <Animated.View
          testID="spark-toast-success"
          style={[
            successStyles.sheet,
            {
              bottom: bottom + Spacing.lg,
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              opacity: successOpacity,
              transform: [{ translateY: successY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={successStyles.swipeHandle}>
            <View
              style={[
                successStyles.swipeBar,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.32)'
                    : 'rgba(0,0,0,0.18)',
                },
              ]}
            />
          </View>
          <Pressable
            style={successStyles.body}
            onPressIn={() => pauseRef.current()}
            onPressOut={() => resumeRef.current()}
          >
            <View
              style={[
                successStyles.progressTrack,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <Animated.View
                style={[
                  successStyles.progressFill,
                  {
                    transform: [{ scaleX: progress }],
                    transformOrigin: 'left center',
                  } as any,
                ]}
              />
            </View>
            <Animated.View
              style={[successStyles.checkCircle, { transform: [{ scale: checkScale }] }]}
            >
              <View style={successStyles.checkInner}>
                <MaterialCommunityIcons name="check" size={28} color="#FFF" />
              </View>
            </Animated.View>
            <Text
              style={[
                successStyles.message,
                { color: isDark ? '#FFFFFF' : '#1A1A1A' },
              ]}
            >
              {toast.message}
            </Text>
            {toast.submessage ? (
              <Text
                style={[
                  successStyles.submessage,
                  { color: isDark ? '#A0A0B0' : '#6E6E80' },
                ]}
              >
                {toast.submessage}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  const cfg = CONFIG[toast.type];
  return (
    <View testID="spark-toast-host" style={hostStyles.host} pointerEvents="box-none">
      <Animated.View
        testID="spark-toast-hud"
        pointerEvents="none"
        style={[
          hudStyles.container,
          {
            top: top + Spacing.sm,
            backgroundColor: theme.surface,
            borderColor: `${cfg.color}${isDark ? '55' : '33'}`,
            shadowOpacity: isDark ? 0.32 : 0.10,
            opacity: hudOpacity,
            transform: [{ translateY: hudY }],
          },
        ]}
      >
        <View style={[hudStyles.accent, { backgroundColor: cfg.color }]} />
        <View style={hudStyles.content}>
          <Animated.View
            style={[
              hudStyles.iconWrap,
              { backgroundColor: `${cfg.color}1F`, transform: [{ scale: hudIconScale }] },
            ]}
          >
            <MaterialCommunityIcons name={cfg.icon as any} size={24} color={cfg.color} />
          </Animated.View>
          <View style={hudStyles.textArea}>
            <Text style={[hudStyles.typeLabel, { color: cfg.color }]}>
              {t(`toast_${toast.type}`)}
            </Text>
            <Text style={[hudStyles.message, { color: theme.textPrimary }]}>
              {toast.message}
            </Text>
            {toast.submessage ? (
              <Text style={[hudStyles.submessage, { color: theme.textSecondary }]}>
                {toast.submessage}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const hostStyles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50_000,
    elevation: 50_000,
    pointerEvents: 'box-none',
  },
});

const successStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 24,
  },
  swipeHandle: {
    width: '100%',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  swipeBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  body: {
    width: '100%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#00C853',
    borderRadius: 2,
  },
  checkCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0, 200, 83, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  checkInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00C853',
    alignItems: 'center',
    justifyContent: 'center',
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

const hudStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 20,
  },
  accent: {
    height: 3,
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    flex: 1,
    gap: 2,
  },
  typeLabel: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.5,
  },
  message: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.medium,
  },
  submessage: {
    ...Typography.bodySmall,
    marginTop: 1,
  },
});
