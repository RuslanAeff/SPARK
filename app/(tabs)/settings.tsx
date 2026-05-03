// S.P.A.R.K. — Settings Screen (group menu)
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../../src/theme/themeStore';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/theme/colors';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../../src/theme/spacing';
import { useLanguage } from '../../src/i18n/LanguageContext';

interface SettingsGroup {
  key: 'general' | 'budget' | 'data' | 'ai';
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: string;
  iconBg: string;
  titleKey: string;
  descKey: string;
  route: string;
}

export default function SettingsScreen() {
  const colorScheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [colorScheme]);
  const router = useRouter();
  const { t } = useLanguage();

  const groups: SettingsGroup[] = useMemo(
    () => [
      {
        key: 'general',
        icon: 'tune-variant',
        iconColor: Colors.primary,
        iconBg: Colors.primaryGlow,
        titleKey: 'settings_group_general',
        descKey: 'settings_group_general_desc',
        route: '/settings-general',
      },
      {
        key: 'budget',
        icon: 'wallet-outline',
        iconColor: Colors.chartOrange,
        iconBg: Colors.chartOrange + '22',
        titleKey: 'settings_group_budget',
        descKey: 'settings_group_budget_desc',
        route: '/settings-budget',
      },
      {
        key: 'data',
        icon: 'database-outline',
        iconColor: Colors.chartGreen,
        iconBg: Colors.chartGreen + '22',
        titleKey: 'settings_group_data',
        descKey: 'settings_group_data_desc',
        route: '/settings-data',
      },
      {
        key: 'ai',
        icon: 'robot-outline',
        iconColor: Colors.chartPurple,
        iconBg: Colors.chartPurple + '22',
        titleKey: 'settings_group_ai',
        descKey: 'settings_group_ai_desc',
        route: '/settings-ai',
      },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings_title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {groups.map((g, i) => (
          <Animated.View
            key={g.key}
            entering={FadeInDown.delay(80 + i * 70).duration(420)}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(g.route as never);
              }}
              style={({ pressed }) => [styles.groupCard, pressed && styles.groupCardPressed]}
              accessibilityRole="button"
              accessibilityLabel={t(g.titleKey)}
            >
              <View style={[styles.groupIcon, { backgroundColor: g.iconBg }]}>
                <MaterialCommunityIcons name={g.icon} size={24} color={g.iconColor} />
              </View>
              <View style={styles.groupText}>
                <Text style={styles.groupTitle}>{t(g.titleKey)}</Text>
                <Text style={styles.groupDesc} numberOfLines={1}>
                  {t(g.descKey)}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={Colors.textMuted}
              />
            </Pressable>
          </Animated.View>
        ))}

        {/* About */}
        <Animated.View entering={FadeInDown.delay(80 + groups.length * 70 + 60).duration(420)}>
          <View style={styles.about}>
            <Text style={styles.aboutName}>S.P.A.R.K</Text>
            <Text style={styles.aboutFull}>Strategic Parsing & Resource Keeper</Text>
            <View style={styles.aboutSignature}>
              <Text
                style={[
                  styles.aboutSigText,
                  { color: colorScheme === 'dark' ? '#00e5ff' : '#040d7a' },
                ]}
              >
                by Mr. RUSLAN
              </Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.lg,
  },
  title: {
    ...Typography.headlineLarge,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 20,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  groupCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupText: {
    flex: 1,
    gap: 4,
  },
  groupTitle: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  groupDesc: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  about: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.xxs,
  },
  aboutName: {
    ...Typography.headlineMedium,
    color: Colors.primary,
    fontFamily: FontFamily.extraBold,
    fontWeight: '900',
    letterSpacing: 3,
  },
  aboutFull: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  aboutSignature: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  aboutSigText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textShadowColor: '#00e5ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  bottomSpacer: {
    height: 100,
  },
});
