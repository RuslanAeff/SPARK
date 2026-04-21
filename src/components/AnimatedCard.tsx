// S.P.A.R.K. — Glassmorphism Animated Card
import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, Platform, StyleProp } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useAppTheme } from '../theme/themeStore';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  onPress?: () => void;
  elevated?: boolean;
}

export default function AnimatedCard({
  children,
  style,
  delay = 0,
  onPress,
  elevated = false,
}: AnimatedCardProps) {
  // Tek doğruluk kaynağı: hem OS hem manuel Appearance.setColorScheme() değişiminde re-render.
  const scheme = useAppTheme();
  const styles = React.useMemo(() => getStyles(), [scheme]);
  const content = (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={[
        styles.card,
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const getStyles = () => StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  elevated: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.borderLight,
  },
});
