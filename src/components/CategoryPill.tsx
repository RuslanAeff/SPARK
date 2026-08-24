// S.P.A.R.K. — Category Pill Component
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius, IconSize } from '../theme/spacing';

interface CategoryPillProps {
  name: string;
  icon: string;
  color: string;
  percentage?: number;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export default function CategoryPill({
  name,
  icon,
  color,
  percentage,
  onPress,
  size = 'medium',
}: CategoryPillProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const ringSize = size === 'large' ? 64 : size === 'medium' ? 52 : 40;
  const iconSize = size === 'large' ? 28 : size === 'medium' ? 22 : 16;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = percentage != null ? (percentage / 100) * circumference : 0;
  const itemWidth = size === 'large' ? 92 : size === 'medium' ? 80 : 68;
  const accessibilityLabel = percentage == null ? name : `${name}, ${percentage}%`;

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.container,
        { width: itemWidth },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
        <Svg width={ringSize} height={ringSize}>
          {/* Background ring */}
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={color + '33'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress ring */}
          {percentage != null && (
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${progress} ${circumference}`}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
              fill="none"
              rotation="-90"
              origin={`${ringSize / 2}, ${ringSize / 2}`}
            />
          )}
        </Svg>
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <MaterialCommunityIcons
            name={icon as any}
            size={iconSize}
            color={color}
          />
        </View>
      </View>
      <View style={styles.details}>
        <Text
          style={styles.name}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
        {percentage != null && (
          <Text style={[styles.percentage, { color }]}>{percentage}%</Text>
        )}
      </View>
    </Pressable>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ring: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  name: {
    ...Typography.labelSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  percentage: {
    ...Typography.labelSmall,
    fontFamily: FontFamily.semiBold,
  },
});
