// S.P.A.R.K. — Otomatik tema anahtarı: yeşil (açık) / kırmızı (kapalı), Venom tarzı süpürme animasyonu
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

const RED = '#C62828';
const GREEN = Colors.primary;

type Props = {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  labelOn: string;
  labelOff: string;
};

export default function AutoThemeScheduleToggle({ enabled, onToggle, labelOn, labelOff }: Props) {
  const progress = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(enabled ? 1 : 0, {
      duration: 520,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [enabled, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle(!enabled);
  }

  return (
    <Pressable onPress={handlePress} style={styles.press}>
      <View style={styles.track}>
        {/* Kırmızı taban — "kapalı / gece" */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: RED, borderRadius: BorderRadius.round }]} />
        {/* Yeşil süpürme — soldan sağa büyür (aktif) */}
        <Animated.View style={[styles.greenFill, fillStyle]} />
        <View style={styles.contentRow} pointerEvents="none">
          <MaterialCommunityIcons
            name={enabled ? 'weather-sunny' : 'weather-night'}
            size={22}
            color="#FFF"
            style={styles.icon}
          />
          <Text style={styles.label}>
            {enabled ? labelOn : labelOff}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    marginTop: Spacing.md,
  },
  track: {
    height: 52,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  greenFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: GREEN,
    borderRadius: BorderRadius.round,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  icon: {
    opacity: 0.95,
  },
  label: {
    ...Typography.labelLarge,
    fontFamily: FontFamily.extraBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
