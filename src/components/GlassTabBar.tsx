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
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextLayoutEventData,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BlurTargetView, BlurView } from 'expo-blur';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useAppTheme, useThemePalette } from '../theme/themeStore';
import { FontFamily, Typography } from '../theme/typography';
import {
  BAR_RADIUS,
  BAR_SIDE_PADDING,
  SELECTOR_HEIGHT,
  SELECTOR_RADIUS,
  computeTabBarGeometry,
  selectorOffset,
  type TabBarGeometry,
} from './tabBarLayout';

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

/** İkon yuvası (tarayıcı ikonu 26 dp); etiket hemen altında. */
const ICON_SLOT = 26;
const LABEL_GAP = 2;
const LABEL_BASE = {
  ...Typography.labelTiny,
  fontFamily: FontFamily.medium,
  // Harf aralığı dar hücrede ~4 dp yer kaplıyordu; okunurluğu bozmadan sıfır.
  letterSpacing: 0,
} as const;
/** Sistem yazı büyütmesi etiketi bundan fazla büyütmez (ortak ölçek yine sığdırır). */
const LABEL_MAX_FONT_MULTIPLIER = 1.3;

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
      <GlassTabItems {...barProps} />
    </View>
  );
}

/**
 * Sekme düğmeleri. React Navigation'ın hazır çubuğu hücre genişliğini ve
 * etiket boyutunu bizim hesabımıza bırakmadığı için kendi düzenimiz: hücre,
 * hap ve ortak etiket ölçeği `computeTabBarGeometry` ile hesaplanır.
 */
function GlassTabItems({ state, navigation, descriptors, position }: MaterialTopTabBarProps) {
  const theme = useThemePalette();
  const [barWidth, setBarWidth] = useState(0);
  const [naturalWidths, setNaturalWidths] = useState<Record<string, number>>({});
  const routes = state.routes;
  const labels = routes.map(route => {
    const options = descriptors[route.key]?.options;
    return typeof options?.title === 'string' ? options.title : route.name;
  });
  const labelSignature = labels.join('\u0000');
  // Dil değişince eski ölçümler geçersiz.
  useEffect(() => { setNaturalWidths({}); }, [labelSignature]);

  const measured = labels.every(label => naturalWidths[label] != null);
  const geometry = computeTabBarGeometry(
    barWidth,
    routes.length,
    measured ? labels.map(label => naturalWidths[label]) : [],
  );
  const fontSize = LABEL_BASE.fontSize * geometry.labelScale;
  const lineHeight = LABEL_BASE.lineHeight * geometry.labelScale;

  const onBarLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setBarWidth(previous => (Math.abs(previous - width) < 0.5 ? previous : width));
  }, []);

  const onMeasure = useCallback((label: string) => (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    const width = Math.max(0, ...event.nativeEvent.lines.map(line => line.width));
    setNaturalWidths(previous => (previous[label] === width ? previous : { ...previous, [label]: width }));
  }, []);

  return (
    <View style={styles.row} onLayout={onBarLayout} accessibilityRole="tablist">
      {/* Ölçüm katmanı: etiketlerin taban boyuttaki gerçek genişliği (sistem
          yazı büyütmesi dahil). Görünmez ve ekran okuyucudan gizli. */}
      <View
        pointerEvents="none"
        style={styles.measureLayer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {labels.map(label => (
          <Text
            key={label}
            style={LABEL_BASE}
            numberOfLines={1}
            maxFontSizeMultiplier={LABEL_MAX_FONT_MULTIPLIER}
            onTextLayout={onMeasure(label)}
          >
            {label}
          </Text>
        ))}
      </View>

      {geometry.cellWidth > 0 ? (
        <GlassTabIndicator position={position} routeCount={routes.length} geometry={geometry} />
      ) : null}

      {routes.map((route, index) => {
        const options = descriptors[route.key]?.options ?? {};
        const focused = state.index === index;
        const color = focused
          ? options.tabBarActiveTintColor ?? theme.tabActive
          : options.tabBarInactiveTintColor ?? theme.tabInactive;
        const label = labels[index];
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={[styles.cell, geometry.cellWidth > 0 ? { width: geometry.cellWidth } : styles.cellFlex]}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          >
            <View style={styles.iconSlot}>
              {options.tabBarIcon?.({ focused, color })}
            </View>
            <Text
              style={[
                LABEL_BASE,
                styles.label,
                { color, fontSize, lineHeight },
                geometry.labelWidth > 0 ? { width: geometry.labelWidth } : null,
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={LABEL_MAX_FONT_MULTIPLIER}
              // Ortak ölçek en fazla %10 küçültür; çok dar ekranda son güvence.
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface GlassTabIndicatorProps {
  /** Sekme gezgininin sayfa konumu (0…n-1); kaydırırken ara değer alır. */
  position: Animated.AnimatedInterpolation<number>;
  routeCount: number;
  geometry: TabBarGeometry;
}

/**
 * Seçili sekmenin ikonunu ve yazısını birlikte saran, yumuşak köşeli cam
 * dikdörtgen (borç/ek gelir sekmeleriyle aynı cam dili). Konum sayfa gezgininin kendi animasyonlu
 * değerinden okunur: dokununca sayfa geçişiyle birlikte kayar, parmakla
 * kaydırırken parmağı izler; sayfa ile vurgu hiç ayrışmaz.
 */
export function GlassTabIndicator({ position, routeCount, geometry }: GlassTabIndicatorProps) {
  const theme = useThemePalette();
  if (geometry.selectorWidth <= 0 || routeCount < 1) return null;
  const indices = Array.from({ length: routeCount }, (_, i) => i);
  const translateX = routeCount > 1
    ? position.interpolate({
      inputRange: indices,
      outputRange: indices.map(i => selectorOffset(i, geometry)),
      extrapolate: 'clamp',
    })
    : selectorOffset(0, geometry);

  return (
    <Animated.View
      testID="glass-tab-indicator"
      pointerEvents="none"
      accessible={false}
      style={[
        styles.indicator,
        {
          width: geometry.selectorWidth,
          borderColor: theme.glassBorder,
          backgroundColor: theme.primary + '1A',
          transform: [{ translateX }],
        },
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="tab-selection-glass" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={theme.textPrimary} stopOpacity={0.14} />
            <Stop offset="0.45" stopColor={theme.primary} stopOpacity={0.08} />
            <Stop offset="1" stopColor={theme.primary} stopOpacity={0.2} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tab-selection-glass)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  clip: { overflow: 'hidden' },
  rim: { borderWidth: 1, borderRadius: BAR_RADIUS },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_SIDE_PADDING,
  },
  measureLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1000,
    opacity: 0,
    alignItems: 'flex-start',
  },
  cell: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFlex: { flex: 1 },
  iconSlot: {
    height: ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: LABEL_GAP,
    textAlign: 'center',
  },
  // Dikeyde ortalı: hücre içeriği (ikon + yazı, 42 dp) ile aynı merkezde.
  indicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -SELECTOR_HEIGHT / 2,
    height: SELECTOR_HEIGHT,
    borderRadius: SELECTOR_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
