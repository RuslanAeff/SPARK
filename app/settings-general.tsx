// S.P.A.R.K. — Settings: General (language, currency, theme)
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../src/theme/themeStore';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { languageNativeLabel } from '../src/i18n/languageOptions';
import LanguagePickerSheet from '../src/components/LanguagePickerSheet';
import {
  useCurrency,
  DISPLAY_CURRENCIES,
  CURRENCY_META,
  DisplayCurrency,
} from '../src/context/CurrencyContext';
import AutoThemeScheduleToggle from '../src/components/AutoThemeScheduleToggle';
import {
  loadThemeSettings,
  setAutoThemeSchedule,
  setManualTheme as persistManualTheme,
} from '../src/utils/themeSchedule';
import { SparkToast } from '../src/components/SparkToast';
import {
  SettingsInfoHintModal,
  SettingsInfoIconButton,
} from '../src/components/SettingsInfoHint';

export default function SettingsGeneralScreen() {
  const colorScheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [colorScheme]);
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { currency, setCurrency } = useCurrency();

  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
  const [manualThemePref, setManualThemePref] = useState<'light' | 'dark'>('dark');
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [currencyInfoOpen, setCurrencyInfoOpen] = useState(false);
  const [themeInfoOpen, setThemeInfoOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadThemeSettings();
      if (!alive) return;
      setAutoScheduleEnabled(s.autoEnabled);
      setManualThemePref(s.manual);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleAutoScheduleToggle(next: boolean) {
    try {
      await setAutoThemeSchedule(next);
      setAutoScheduleEnabled(next);
      SparkToast.show(t('theme_changed'), 'success', t('theme_restart'));
    } catch (e) {
      console.warn('Auto theme toggle', e);
      SparkToast.show(t('theme_changed'), 'error');
    }
  }

  async function pickManualTheme(mode: 'light' | 'dark') {
    try {
      await persistManualTheme(mode);
      setManualThemePref(mode);
      SparkToast.show(t('theme_changed'), 'success', t('theme_restart'));
    } catch (e) {
      console.warn('Manual theme', e);
    }
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('settings_back')}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.subHeaderTitle} numberOfLines={1}>
            {t('settings_group_general')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Language */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={styles.section}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLangSheetOpen(true);
                }}
                style={({ pressed }) => [styles.languageRow, pressed && styles.languageRowPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('language_title')}
              >
                <View style={styles.languageIconWrap}>
                  <MaterialCommunityIcons
                    name="google-translate"
                    size={24}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.languageRowText}>
                  <Text style={styles.languageRowTitle}>{t('language_row_label')}</Text>
                  <Text style={styles.languageRowSub}>{languageNativeLabel(language)}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Currency */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: Colors.chartOrange + '22' }]}>
                  <MaterialCommunityIcons
                    name="cash-multiple"
                    size={22}
                    color={Colors.chartOrange}
                  />
                </View>
                <Text
                  style={[styles.sectionTitle, styles.sectionTitleWithInfo]}
                  numberOfLines={2}
                >
                  {t('currency_title')}
                </Text>
                <SettingsInfoIconButton
                  onPress={() => setCurrencyInfoOpen(true)}
                  accessibilityLabel={t('settings_info_accessibility')}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.currencyRow}
              >
                {DISPLAY_CURRENCIES.map((code: DisplayCurrency) => {
                  const meta = CURRENCY_META[code];
                  const active = currency === code;
                  const codeLabel = code === 'TRY' ? 'TL' : code;
                  return (
                    <Pressable
                      key={code}
                      onPress={async () => {
                        await setCurrency(code);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        SparkToast.show(t('currency_changed'), 'success');
                      }}
                      style={[styles.currencyChip, active && styles.currencyChipActive]}
                    >
                      <Text
                        style={[
                          styles.currencyChipSymbol,
                          active && styles.currencyChipSymbolActive,
                        ]}
                      >
                        {meta.symbol}
                      </Text>
                      <Text
                        style={[
                          styles.currencyChipCode,
                          active && styles.currencyChipCodeActive,
                        ]}
                      >
                        {codeLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>

          {/* Theme */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionIcon, { backgroundColor: Colors.chartPurple + '22' }]}
                >
                  <MaterialCommunityIcons
                    name="theme-light-dark"
                    size={22}
                    color={Colors.chartPurple}
                  />
                </View>
                <Text
                  style={[styles.sectionTitle, styles.sectionTitleWithInfo]}
                  numberOfLines={2}
                >
                  {t('theme_title')}
                </Text>
                <SettingsInfoIconButton
                  onPress={() => setThemeInfoOpen(true)}
                  accessibilityLabel={t('settings_info_accessibility')}
                />
              </View>
              <AutoThemeScheduleToggle
                enabled={autoScheduleEnabled}
                onToggle={handleAutoScheduleToggle}
                labelOn={t('theme_auto_on')}
                labelOff={t('theme_auto_off')}
              />
              {!autoScheduleEnabled && (
                <View style={styles.themeBtnRow}>
                  <Pressable
                    onPress={() => pickManualTheme('light')}
                    style={[
                      styles.themeBtn,
                      manualThemePref === 'light' && styles.themeBtnActive,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="white-balance-sunny"
                      size={20}
                      color={
                        manualThemePref === 'light' ? Colors.background : Colors.textPrimary
                      }
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        manualThemePref === 'light' && { color: Colors.background },
                      ]}
                    >
                      {t('theme_light')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => pickManualTheme('dark')}
                    style={[
                      styles.themeBtn,
                      manualThemePref === 'dark' && styles.themeBtnActive,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="moon-waning-crescent"
                      size={20}
                      color={
                        manualThemePref === 'dark' ? Colors.background : Colors.textPrimary
                      }
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        manualThemePref === 'dark' && { color: Colors.background },
                      ]}
                    >
                      {t('theme_dark')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <SettingsInfoHintModal
        visible={currencyInfoOpen}
        onClose={() => setCurrencyInfoOpen(false)}
        title={t('currency_title')}
        paragraphs={[t('currency_hint')]}
      />
      <SettingsInfoHintModal
        visible={themeInfoOpen}
        onClose={() => setThemeInfoOpen(false)}
        title={t('theme_title')}
        paragraphs={[
          autoScheduleEnabled ? t('theme_schedule_hint') : t('theme_manual_section'),
          t('theme_hint'),
        ]}
      />
      <LanguagePickerSheet
        visible={langSheetOpen}
        onClose={() => setLangSheetOpen(false)}
        current={language}
        title={t('language_sheet_title')}
        hostBottomInset={safeAreaInsets.bottom}
        onSelect={async (code) => {
          await setLanguage(code);
          SparkToast.show(t('language_changed'), 'success');
        }}
      />
    </>
  );
}

const getStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  backBtnPressed: { opacity: 0.7 },
  subHeaderTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    flex: 1,
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  sectionTitleWithInfo: { flex: 1, flexShrink: 1, minWidth: 0 },
  // Language row
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  languageRowPressed: { opacity: 0.92 },
  languageIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageRowText: { flex: 1, gap: 4 },
  languageRowTitle: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  languageRowSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Currency row
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
  },
  currencyChip: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  currencyChipActive: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  currencyChipSymbol: {
    fontSize: 22,
    marginBottom: 4,
    color: Colors.textPrimary,
  },
  currencyChipSymbolActive: { color: Colors.primary },
  currencyChipCode: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  currencyChipCodeActive: { color: Colors.primary },
  // Theme buttons
  themeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.xs,
    gap: Spacing.xs,
  },
  themeBtnActive: { backgroundColor: Colors.primary },
  themeBtnText: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
