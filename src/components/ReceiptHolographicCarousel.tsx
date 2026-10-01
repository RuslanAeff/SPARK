import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, runOnJS, useAnimatedStyle, useReducedMotion,
  useSharedValue, withRepeat, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme, useThemePalette } from '../theme/themeStore';
import { FontFamily } from '../theme/typography';

// The same physical detent profile used by AccentPaletteCarousel.
export function triggerReceiptHapticFeedback() {
  const pulse = Platform.OS === 'android'
    ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  void Promise.resolve(pulse).catch(() => {});
}

export const RECEIPT_CAROUSEL_MOTION = { damping: 22, stiffness: 190, mass: 0.85 };

type Props = {
  images: ReadonlyArray<{ uri: string }>;
  accessibilityLabel: string;
  onCardSelected?: (index: number) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  triggerHapticFeedback?: () => void;
};

function ReceiptCard({ uri, index, position, float, width, selected, onPress }: {
  uri: string; index: number; position: SharedValue<number>; float: SharedValue<number>;
  width: number; selected: boolean; onPress: () => void;
}) {
  const theme = useThemePalette();
  const animated = useAnimatedStyle(() => {
    const delta = index - position.value;
    const distance = Math.min(Math.abs(delta), 2);
    const focus = Math.max(0, 1 - distance);
    return {
      opacity: Math.max(0, 1 - distance * 0.25),
      zIndex: Math.round(100 - distance * 30),
      shadowOpacity: 0.08 + focus * 0.3,
      transform: [
        { perspective: 800 },
        { translateX: Math.sin(Math.max(-1.6, Math.min(1.6, delta)) * 0.85) * width * 0.44 },
        { translateY: distance * distance * 13 + Math.sin(float.value + index * 0.65) * 3 },
        { scale: 0.82 + focus * 0.4 },
        { rotateY: `${Math.max(-35, Math.min(35, -delta * 28))}deg` },
      ],
    };
  });
  return (
    <Animated.View testID={`scanner-processing-preview-${index + 1}`} style={[
      styles.card, { left: (width - 136) / 2, backgroundColor: theme.cardSurface,
        borderColor: selected ? theme.primary : theme.glassBorder, shadowColor: theme.primary }, animated,
    ]}>
      <Pressable onPress={onPress} style={styles.cardPress} accessible={false}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
        <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.primaryLight }]}>
          <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{index + 1}</Text>
        </View>
        <View pointerEvents="none" style={[styles.innerRim, { borderColor: theme.primary + '35' }]} />
      </Pressable>
    </Animated.View>
  );
}

export default function ReceiptHolographicCarousel({ images, accessibilityLabel,
  onCardSelected, onSwipeStart, onSwipeEnd, triggerHapticFeedback = triggerReceiptHapticFeedback,
}: Props) {
  const scheme = useAppTheme();
  const theme = useThemePalette();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(320);
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);
  const mounted = useRef(true);
  const position = useSharedValue(0);
  const origin = useSharedValue(0);
  const float = useSharedValue(0);
  const stride = Math.max(90, width * 0.42);

  useEffect(() => {
    mounted.current = true;
    if (!reducedMotion) float.value = withRepeat(withTiming(Math.PI * 2, { duration: 3800, easing: Easing.linear }), -1);
    else float.value = 0;
    return () => { mounted.current = false; cancelAnimation(float); cancelAnimation(position); };
  }, [reducedMotion, float, position]);

  const settled = (index: number) => {
    if (!mounted.current || selectedRef.current === index) return;
    selectedRef.current = index;
    setSelected(index);
    triggerHapticFeedback();
    onCardSelected?.(index);
  };
  const select = (index: number) => {
    const target = Math.max(0, Math.min(images.length - 1, index));
    cancelAnimation(position);
    if (reducedMotion) { position.value = target; settled(target); }
    else position.value = withSpring(target, RECEIPT_CAROUSEL_MOTION, finished => {
      if (finished) runOnJS(settled)(target);
    });
  };
  const start = () => onSwipeStart?.();
  const end = () => onSwipeEnd?.();
  const pan = Gesture.Pan().enabled(images.length > 1).activeOffsetX([-8, 8]).failOffsetY([-14, 14])
    .onStart(() => { cancelAnimation(position); origin.value = position.value; runOnJS(start)(); })
    .onUpdate(event => {
      position.value = Math.max(0, Math.min(images.length - 1, origin.value - event.translationX / stride));
    })
    .onEnd(event => {
      const target = Math.max(0, Math.min(images.length - 1,
        Math.round(position.value - Math.max(-0.5, Math.min(0.5, event.velocityX / stride * 0.12)))));
      position.value = withSpring(target, RECEIPT_CAROUSEL_MOTION, finished => {
        if (finished) runOnJS(settled)(target);
      });
    })
    .onFinalize((_event, success) => {
      if (!success) position.value = withSpring(selected, RECEIPT_CAROUSEL_MOTION);
      runOnJS(end)();
    });
  const stageStyle = useMemo(() => ({ backgroundColor: scheme === 'dark' ? '#000000' : theme.background }), [scheme, theme]);

  if (!images.length) return null;
  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.stage, stageStyle]} onLayout={event => setWidth(event.nativeEvent.layout.width)}
        accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 1, max: images.length, now: selected + 1, text: `${selected + 1} / ${images.length}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => select(selected + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
        <View pointerEvents="none" style={[styles.orbit, { borderColor: theme.primary + '22' }]} />
        {images.map((asset, index) => <ReceiptCard key={`${index}:${asset.uri}`} uri={asset.uri} index={index}
          position={position} float={float} width={width} selected={selected === index} onPress={() => select(index)} />)}
        <View pointerEvents="none" style={styles.dots}>
          {images.map((_, index) => <View key={index} style={[styles.dot, {
            backgroundColor: theme.primary, opacity: index === selected ? 1 : 0.25,
            width: index === selected ? 18 : 5,
          }]} />)}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', height: 300, overflow: 'hidden' },
  card: { position: 'absolute', top: 35, width: 136, height: 192, padding: 4, borderRadius: 28,
    borderWidth: 1.5, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 5 },
  cardPress: { flex: 1, borderRadius: 23, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  innerRim: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderRadius: 23 },
  badge: { position: 'absolute', left: 7, bottom: 7, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontFamily: FontFamily.semiBold, fontSize: 10, lineHeight: 12, includeFontPadding: false },
  orbit: { position: 'absolute', left: '8%', right: '8%', top: 206, height: 42, borderRadius: 100,
    borderWidth: 1, transform: [{ rotateX: '55deg' }] },
  dots: { position: 'absolute', bottom: 9, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { height: 5, borderRadius: 3 },
});
