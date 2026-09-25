import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, type LayoutRectangle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';

/** Measured in the same content container as the option buttons. */
export default function GlassSelectionIndicator({ target }: { target?: LayoutRectangle }) {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  const styles = useMemo(() => StyleSheet.create({
    capsule: {
      position: 'absolute', left: 0, top: 0, borderRadius: 999,
      overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder,
      backgroundColor: Colors.primary + '12',
    },
  }), [scheme, revision]);
  const initialized = useRef(false);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (!target) return;
    const config = {
      duration: initialized.current ? 300 : 0,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    };
    // Keep a small breathing gap inside the selector while giving the glass
    // enough vertical presence to read as a surface rather than a thin stripe.
    x.value = withTiming(target.x + 2, config);
    y.value = withTiming(target.y + 3, config);
    width.value = withTiming(Math.max(0, target.width - 4), config);
    height.value = withTiming(Math.max(0, target.height - 6), config);
    initialized.current = true;
  }, [target, x, y, width, height]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    width: width.value, height: height.value,
  }));

  return (
    <Animated.View pointerEvents="none" accessible={false} style={[styles.capsule, motion]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="selection-glass" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={Colors.textPrimary} stopOpacity={0.14} />
            <Stop offset="0.45" stopColor={Colors.primary} stopOpacity={0.07} />
            <Stop offset="1" stopColor={Colors.primary} stopOpacity={0.16} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#selection-glass)" />
      </Svg>
    </Animated.View>
  );
}
