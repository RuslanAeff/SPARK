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

type SettingsNavigationRowBase = {
  title: string;
  description?: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  last?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/** Satırın iki görevi var, ikisi aynı görünmemeli:
 *  - `accent`: ayarlar kök menüsü. Sayfanın tek içeriği satırlar olduğu için renkli
 *    ikon karesi onları birbirinden ayırır ve menüye kimlik verir.
 *  - `plain` (varsayılan): alt sayfalardaki kapı. Nötr ikon, zemin yok — bölüm
 *    başlıkları da renkli kare taşıdığından, kapılar da taşırsa ekran ayırt
 *    edilemeyen bir simge dizisine dönüşüyordu. */
type SettingsNavigationRowProps =
  | (SettingsNavigationRowBase & { tone?: 'plain' })
  | (SettingsNavigationRowBase & {
      tone: 'accent';
      iconColor: string;
      iconBackgroundColor: string;
    });

export function SettingsNavigationRow(props: SettingsNavigationRowProps) {
  const {
    title,
    description,
    icon,
    onPress,
    last = false,
    testID,
    accessibilityLabel,
    accessibilityHint,
  } = props;
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const accent = props.tone === 'accent' ? props : null;

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
      <View
        testID={testID ? `${testID}-icon` : undefined}
        style={[
          styles.navigationIcon,
          accent && {
            backgroundColor: accent.iconBackgroundColor,
            borderRadius: BorderRadius.md,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={accent ? accent.iconColor : Colors.textSecondary}
        />
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
    minHeight: 64,
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    // Bölüm başlığıyla aynı sol hat: 40'lık ikon alanı + sm boşluk = 48.
    gap: Spacing.sm,
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
