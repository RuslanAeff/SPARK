// S.P.A.R.K. — Vendor Avatar Component
import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { IconSize, BorderRadius } from '../theme/spacing';
import { FontFamily } from '../theme/typography';
import { useAppTheme } from '../theme/themeStore';

interface VendorAvatarProps {
  name: string;
  logoUri?: string | null;
  size?: number;
  color?: string;
}

export default function VendorAvatar({
  name,
  logoUri,
  size = IconSize.logo,
  color = Colors.primary,
}: VendorAvatarProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  if (logoUri) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={{ uri: logoUri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Fallback: initial letter avatar
  const initial = name.charAt(0).toUpperCase();
  const bgColor = stringToColor(name);

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor + '22',
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4, color: bgColor }]}>
        {initial}
      </Text>
    </View>
  );
}

function stringToColor(str: string): string {
  const colors = [
    Colors.chartPurple, Colors.chartBlue, Colors.chartOrange,
    Colors.chartGreen, Colors.chartPink, Colors.chartYellow,
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const getStyles = () => StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: FontFamily.bold,
  },
});
