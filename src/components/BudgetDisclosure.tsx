import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Natural-height disclosure; closed controls are hidden from touch and accessibility. */
export default function BudgetDisclosure({ open, children }: React.PropsWithChildren<{ open: boolean }>) {
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    const config = { duration: open ? 260 : 200, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
    height.value = withTiming(open ? contentHeight : 0, config);
    opacity.value = withTiming(open ? 1 : 0, config);
  }, [open, contentHeight, height, opacity]);
  const motion = useAnimatedStyle(() => ({ height: height.value, opacity: opacity.value }));
  return <Animated.View style={[styles.viewport, motion]} pointerEvents={open ? 'auto' : 'none'}
    accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
    <View style={styles.content} onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}>
      {children}
    </View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  content: { position: 'absolute', top: 0, left: 0, right: 0 },
});
