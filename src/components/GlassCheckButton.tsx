// S.P.A.R.K. — Glassmorphic Check Button (theme primary green)
import React from 'react';
import { Pressable, View, StyleSheet, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';

const SIZE = 48;

interface GlassCheckButtonProps {
  onPress: () => void;
  /** 'confirm' (yeşil onay ✓) varsayılan; 'danger' (kırmızı sil ✕) aynı cam dil. */
  variant?: 'confirm' | 'danger';
  accessibilityLabel?: string;
}

export default function GlassCheckButton({ onPress, variant = 'confirm', accessibilityLabel }: GlassCheckButtonProps) {
  const isDark = useAppTheme() === 'dark';
  const danger = variant === 'danger';
  // Aynı görsel dil (radial cam küre), yalnız renk + ikon değişir.
  const primary = danger ? Colors.danger : Colors.primary;
  const light = danger ? (Colors.dangerDark || '#CC0000') : (Colors.primaryLight || '#33FF85');
  const pale = danger ? '#FF9999' : (isDark ? '#99FFCC' : '#99E6B3');
  const iconName = danger ? 'close-thick' : 'check-bold';
  // Aynı ekranda iki buton olabilir → gradient id'leri çakışmasın.
  const gradId = danger ? 'glassBtnGradDanger' : 'glassBtnGrad';

  return (
    <Pressable
      onPress={onPress}
      style={styles.wrapper}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.shadowWrap, { shadowColor: primary }]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={styles.svg}>
          <Defs>
            <RadialGradient id={gradId} cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
              <Stop offset="0%" stopColor={primary} stopOpacity="1" />
              <Stop offset="60%" stopColor={light} stopOpacity="1" />
              <Stop offset="100%" stopColor={pale} stopOpacity="0.95" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={SIZE / 2 - 1}
            fill={`url(#${gradId})`}
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={1.5}
          />
        </Svg>
        <View style={styles.iconWrap} pointerEvents="none">
          <MaterialCommunityIcons name={iconName} size={22} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowWrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.36,
        shadowRadius: 11,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  svg: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  iconWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
