// S.P.A.R.K. — Settings Screen (group menu)
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { useAppTheme, useThemeRevision } from '../../src/theme/themeStore';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/theme/colors';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding } from '../../src/theme/spacing';
import { useLanguage } from '../../src/i18n/LanguageContext';
import LivingSparkWordmark from '../../src/components/LivingSparkWordmark';
import { SettingsNavigationRow } from '../../src/components/SettingsList';

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
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [colorScheme, themeRevision]);
  const router = useRouter();
  const isFocused = useIsFocused();
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
    [colorScheme, themeRevision],
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
            <SettingsNavigationRow
              testID={`settings-group-${g.key}`}
              title={t(g.titleKey)}
              description={t(g.descKey)}
              icon={g.icon}
              iconColor={g.iconColor}
              iconBackgroundColor={g.iconBg}
              last={i === groups.length - 1}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(g.route as never);
              }}
              accessibilityLabel={t(g.titleKey)}
            />
          </Animated.View>
        ))}

        {/* About */}
        <Animated.View entering={FadeInDown.delay(80 + groups.length * 70 + 60).duration(420)}>
          <View style={styles.about}>
            <LivingSparkWordmark
              size="compact"
              active={isFocused}
              accessibilityHint={t('living_wordmark_hint')}
            />
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
            <Pressable
              onPress={() => Linking.openURL('https://ruslanaeff.github.io/privacy-policy.html')}
              style={styles.privacyLink}
            >
              <MaterialCommunityIcons name="shield-check-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.privacyLinkText}>{t('privacy_policy')}</Text>
            </Pressable>
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
  about: {
    alignItems: 'center',
    marginTop: Spacing.xxxl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.xxs,
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
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  privacyLinkText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  bottomSpacer: {
    height: 100,
  },
});
