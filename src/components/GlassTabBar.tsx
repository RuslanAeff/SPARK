// S.P.A.R.K. — Bulanık cam alt sekme çubuğu (UI denetimi UX-01)
//
// Eski çubuk %90 opak düz bir renk taşıyordu; arkadan geçen yazılar sekme
// etiketlerinin arasından okunup onlarla karışıyordu. Çubuk artık arkasındaki
// içeriği gerçekten bulanıklaştırır: içerik yalnız yumuşak bir renk ışıltısı
// olarak görünür, etiketler her zaman okunur.
//
// ANDROID: `expo-blur` Dimezis yöntemi, bulanıklaştırılacak içeriğin bir
// `BlurTargetView` içinde olmasını ve BlurView'in o hedefin DIŞINDA kalmasını
// ister. Bu yüzden her sekme ekranı navigator'ın `screenLayout`'u ile
// `TabBlurScene` içine sarılır; çubuk (navigator'ın `tabBar`'ı) sahnelerin
// dışında çizilir ve o an odaktaki sekmenin hedefini bulanıklaştırır.
// Hedef henüz yoksa veya Android 12 (SDK 31) altıysa blur kapalıdır ve çubuk
// okunabilirliği koruyan yarı opak tonla görünür.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { MaterialTopTabBar, type MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useAppTheme, useThemePalette } from '../theme/themeStore';

type TargetRef = RefObject<View | null>;

interface TabBlurRegistry {
  targets: ReadonlyMap<string, TargetRef>;
  register: (routeKey: string, ref: TargetRef) => void;
  unregister: (routeKey: string) => void;
}

const TabBlurContext = createContext<TabBlurRegistry | null>(null);

/** Sekme sahnelerinin bulanıklık hedeflerini çubuğa ulaştırır. */
export function TabBlurProvider({ children }: React.PropsWithChildren) {
  const [targets, setTargets] = useState<ReadonlyMap<string, TargetRef>>(() => new Map());
  const register = useCallback((routeKey: string, ref: TargetRef) => {
    setTargets(previous => {
      if (previous.get(routeKey) === ref) return previous;
      const next = new Map(previous);
      next.set(routeKey, ref);
      return next;
    });
  }, []);
  const unregister = useCallback((routeKey: string) => {
    setTargets(previous => {
      if (!previous.has(routeKey)) return previous;
      const next = new Map(previous);
      next.delete(routeKey);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ targets, register, unregister }), [targets, register, unregister]);
  return <TabBlurContext.Provider value={value}>{children}</TabBlurContext.Provider>;
}

/** Bir sekme ekranını, çubuğun bulanıklaştırabileceği hedefe sarar. */
export function TabBlurScene({ routeKey, children }: React.PropsWithChildren<{ routeKey: string }>) {
  const registry = useContext(TabBlurContext);
  const theme = useThemePalette();
  const ref = useRef<View | null>(null);
  const register = registry?.register;
  const unregister = registry?.unregister;
  useEffect(() => {
    if (!register || !unregister) return undefined;
    register(routeKey, ref);
    return () => unregister(routeKey);
  }, [routeKey, register, unregister]);

  // Opak arka plan: hedef saydam olursa bulanık görüntüde siyah/boş alan oluşur.
  return (
    <BlurTargetView ref={ref} style={[styles.scene, { backgroundColor: theme.background }]}>
      {children}
    </BlurTargetView>
  );
}

interface GlassTabBarProps extends MaterialTopTabBarProps {
  /** Çubuğun yüzen konumu, boyutu, köşe ve kenarlığı. */
  containerStyle: StyleProp<ViewStyle>;
}

export function GlassTabBar({ containerStyle, ...barProps }: GlassTabBarProps) {
  const scheme = useAppTheme();
  const theme = useThemePalette();
  const registry = useContext(TabBlurContext);
  const focusedKey = barProps.state.routes[barProps.state.index]?.key;
  const target = focusedKey ? registry?.targets.get(focusedKey) : undefined;
  const isDark = scheme === 'dark';

  return (
    <View testID="glass-tab-bar" style={[containerStyle, styles.clip]}>
      <BlurView
        testID="glass-tab-bar-blur"
        style={StyleSheet.absoluteFill}
        tint={isDark ? 'dark' : 'light'}
        intensity={isDark ? 55 : 60}
        blurReductionFactor={4}
        // Hedef yokken Dimezis yöntemi istenirse expo-blur uyarı basar ve
        // zaten 'none'a düşer; bunu açıkça yapıyoruz.
        blurMethod={Platform.OS === 'android' && !target ? 'none' : 'dimezisBlurViewSdk31Plus'}
        blurTarget={target}
      />
      {/* Bulanıklığın üstünde ince tema tonu: içerik ne olursa olsun etiketler okunur. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(10,10,12,0.55)' : 'rgba(255,255,255,0.62)' }]}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, { borderColor: theme.border }]} />
      <MaterialTopTabBar {...barProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  clip: { overflow: 'hidden' },
  rim: { borderWidth: 1, borderRadius: 9999 },
});
