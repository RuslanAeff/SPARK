// S.P.A.R.K. — Glassmorphic Check Button (theme primary green)
import React from 'react';
import { Pressable, View, StyleSheet, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';

const SIZE = 48;

export default function GlassCheckButton({ onPress }: { onPress: () => void }) {
  const isDark = useAppTheme() === 'dark';
  const primary = Colors.primary;
  const light = Colors.primaryLight || '#33FF85';
  const pale = isDark ? '#99FFCC' : '#99E6B3';

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <View style={[styles.shadowWrap, { shadowColor: primary }]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={styles.svg}>
          <Defs>
            <RadialGradient id="glassBtnGrad" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
              <Stop offset="0%" stopColor={primary} stopOpacity="1" />
              <Stop offset="60%" stopColor={light} stopOpacity="1" />
              <Stop offset="100%" stopColor={pale} stopOpacity="0.95" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={SIZE / 2 - 1}
            fill="url(#glassBtnGrad)"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth={1.5}
          />
        </Svg>
        <View style={styles.iconWrap} pointerEvents="none">
          <MaterialCommunityIcons name="check-bold" size={22} color="#FFFFFF" />
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
