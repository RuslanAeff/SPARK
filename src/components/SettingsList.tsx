// S.P.A.R.K. — Ayarlar alt sayfaları için kart-dışı bölüm ve gezinme satırları.
import React, { type ComponentProps, type ReactNode, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily, Typography } from '../theme/typography';

type SettingsSectionProps = {
  children: ReactNode;
  last?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SettingsSection({
  children,
  last = false,
  style,
  testID,
}: SettingsSectionProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);

  return (
    <View
      testID={testID}
      style={[styles.section, last && styles.sectionLast, style]}
    >
      {children}
    </View>
  );
}

type SettingsNavigationRowProps = {
  title: string;
  description?: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: string;
  iconBackgroundColor: string;
  onPress: () => void;
  last?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function SettingsNavigationRow({
  title,
  description,
  icon,
  iconColor,
  iconBackgroundColor,
  onPress,
  last = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: SettingsNavigationRowProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navigationRow,
        last && styles.navigationRowLast,
        pressed && styles.navigationRowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
    >
      <View style={[styles.navigationIcon, { backgroundColor: iconBackgroundColor }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.navigationCopy}>
        <Text style={styles.navigationTitle}>{title}</Text>
        {description ? (
          <Text style={styles.navigationDescription}>{description}</Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
    </Pressable>
  );
}

const getStyles = () => StyleSheet.create({
  section: {
    paddingVertical: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  sectionLast: {
    borderBottomWidth: 0,
    paddingBottom: Spacing.lg,
  },
  navigationRow: {
    minHeight: 76,
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  navigationRowLast: {
    borderBottomWidth: 0,
  },
  navigationRowPressed: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
  },
  navigationIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  navigationTitle: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  navigationDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
