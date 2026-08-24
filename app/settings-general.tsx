// S.P.A.R.K. — Settings: General (language, currency, theme)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import {
  useAppTheme,
  useThemeAccent,
  useThemePalette,
} from '../src/theme/themeStore';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { type ThemeAccent, type ThemePalette } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { languageNativeLabel } from '../src/i18n/languageOptions';
import LanguagePickerSheet from '../src/components/LanguagePickerSheet';
import AutoThemeScheduleToggle from '../src/components/AutoThemeScheduleToggle';
import AccentPaletteCarousel from '../src/components/AccentPaletteCarousel';
import {
  useCurrency,
  DISPLAY_CURRENCIES,
  CURRENCY_META,
  DisplayCurrency,
} from '../src/context/CurrencyContext';
import {
  loadThemeSettings,
  setAutoThemeSchedule,
  setThemeAccent,
  setManualTheme as persistManualTheme,
} from '../src/utils/themeSchedule';
import { SparkToast } from '../src/components/SparkToast';
import {
  SettingsInfoHintModal,
  SettingsInfoIconButton,
} from '../src/components/SettingsInfoHint';
import {
  SettingsNavigationRow,
  SettingsSection,
} from '../src/components/SettingsList';

export default function SettingsGeneralScreen() {
  const colorScheme = useAppTheme();
  const activeAccent = useThemeAccent();
  const palette = useThemePalette();
  const styles = useMemo(() => getStyles(palette), [palette]);
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { currency, setCurrency } = useCurrency();

  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
  const [manualThemePref, setManualThemePref] = useState<'light' | 'dark'>('dark');
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [currencyInfoOpen, setCurrencyInfoOpen] = useState(false);
  const [themeInfoOpen, setThemeInfoOpen] = useState(false);
  const [accentInfoOpen, setAccentInfoOpen] = useState(false);
  const [appearancePending, setAppearancePending] = useState(false);
  const [accentPending, setAccentPending] = useState(false);
  const themeMutationPending = useRef(false);

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

  async function syncAppearancePreferences() {
    try {
      const settings = await loadThemeSettings();
      setAutoScheduleEnabled(settings.autoEnabled);
      setManualThemePref(settings.manual);
    } catch {
      // Mevcut ekrandaki son doğrulanmış seçim korunur.
    }
  }

  async function handleAutoScheduleToggle(next: boolean) {
    if (next === autoScheduleEnabled || themeMutationPending.current) return;

    themeMutationPending.current = true;
    setAppearancePending(true);
    try {
      await setAutoThemeSchedule(next);
      setAutoScheduleEnabled(next);
      SparkToast.show(t('theme_changed'), 'success', t('theme_restart'));
    } catch (e) {
      if (__DEV__) console.warn('[Settings] auto appearance update failed', e);
      await syncAppearancePreferences();
      SparkToast.show(t('theme_change_failed'), 'error');
    } finally {
      themeMutationPending.current = false;
      setAppearancePending(false);
    }
  }

  async function pickManualTheme(mode: 'light' | 'dark') {
    if (mode === manualThemePref || themeMutationPending.current) return;

    themeMutationPending.current = true;
    setAppearancePending(true);
    try {
      await persistManualTheme(mode);
      setManualThemePref(mode);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      SparkToast.show(t('theme_changed'), 'success', t('theme_restart'));
    } catch (e) {
      if (__DEV__) console.warn('[Settings] manual appearance update failed', e);
      await syncAppearancePreferences();
      SparkToast.show(t('theme_change_failed'), 'error');
    } finally {
      themeMutationPending.current = false;
      setAppearancePending(false);
    }
  }

  async function pickAccent(accent: ThemeAccent): Promise<boolean> {
    if (themeMutationPending.current) return false;

    themeMutationPending.current = true;
    setAccentPending(true);
    try {
      await setThemeAccent(accent);
      SparkToast.show(t('theme_accent_changed'), 'success', t('theme_restart'));
      return true;
    } catch (e) {
      if (__DEV__) console.warn('[Settings] accent update failed', e);
      SparkToast.show(t('theme_accent_change_failed'), 'error');
      return false;
    } finally {
      themeMutationPending.current = false;
      setAccentPending(false);
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
            <MaterialCommunityIcons name="chevron-left" size={28} color={palette.textPrimary} />
          </Pressable>
          <Text style={styles.subHeaderTitle} numberOfLines={1}>
            {t('settings_group_general')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Language */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <SettingsNavigationRow
              testID="settings-general-language-row"
              title={t('language_row_label')}
              description={languageNativeLabel(language)}
              icon="google-translate"
              iconColor={palette.primary}
              iconBackgroundColor={palette.primaryGlow}
              accessibilityLabel={t('language_title')}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLangSheetOpen(true);
              }}
            />
          </Animated.View>

          {/* Currency */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <SettingsSection testID="settings-general-currency-section">
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: palette.chartOrange + '22' }]}>
                  <MaterialCommunityIcons
                    name="cash-multiple"
                    size={22}
                    color={palette.chartOrange}
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
            </SettingsSection>
          </Animated.View>

          {/* Theme */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <SettingsSection testID="settings-general-theme-section">
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionIcon, { backgroundColor: palette.chartPurple + '22' }]}
                >
                  <MaterialCommunityIcons
                    name="theme-light-dark"
                    size={22}
                    color={palette.chartPurple}
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
                testID="theme-auto-toggle"
                enabled={autoScheduleEnabled}
                onToggle={handleAutoScheduleToggle}
                labelOn={t('theme_auto_on')}
                labelOff={t('theme_auto_off')}
                disabled={appearancePending || accentPending}
              />
              {!autoScheduleEnabled && (
                <View style={styles.themeBtnRow}>
                  {(
                    [
                      ['light', 'white-balance-sunny', 'theme_light'],
                      ['dark', 'moon-waning-crescent', 'theme_dark'],
                    ] as const
                  ).map(([mode, icon, labelKey]) => {
                    const selected = manualThemePref === mode;
                    const label = t(labelKey);
                    return (
                      <Pressable
                        key={mode}
                        testID={`theme-appearance-${mode}`}
                        onPress={() => pickManualTheme(mode)}
                        disabled={appearancePending || accentPending}
                        style={({ pressed }) => [
                          styles.themeBtn,
                          selected && styles.themeBtnActive,
                          pressed && !appearancePending && styles.optionPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        accessibilityHint={t('theme_appearance_option_hint', { mode: label })}
                        accessibilityState={{
                          selected,
                          disabled: appearancePending || accentPending,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={icon}
                          size={20}
                          color={selected ? '#FFFFFF' : palette.textPrimary}
                        />
                        <Text style={[styles.themeBtnText, selected && styles.themeBtnTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </SettingsSection>
          </Animated.View>

          {/* Accent color */}
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <SettingsSection testID="settings-general-accent-section" last>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: palette.primarySoft }]}>
                  <MaterialCommunityIcons name="palette-outline" size={22} color={palette.primary} />
                </View>
                <Text style={[styles.sectionTitle, styles.sectionTitleWithInfo]} numberOfLines={2}>
                  {t('theme_accent_title')}
                </Text>
                <SettingsInfoIconButton
                  onPress={() => setAccentInfoOpen(true)}
                  accessibilityLabel={t('settings_info_accessibility')}
                />
              </View>
              <AccentPaletteCarousel
                scheme={colorScheme}
                selectedAccent={activeAccent}
                // Carousel kendi latest-intent kuyruğuyla hızlı seçimleri seri
                // uygular. İlk kayıt sürerken bile aynı gesture'ın son snap'i
                // alınabilsin; yalnız görünüm mutasyonu sırasında kilitle.
                disabled={appearancePending}
                labelFor={(accent) => t(`theme_accent_${accent}`)}
                optionHintFor={(accent) =>
                  t('theme_accent_option_hint', { color: t(`theme_accent_${accent}`) })
                }
                swipeHint={t('theme_accent_swipe_hint')}
                onSelect={pickAccent}
              />
            </SettingsSection>
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
      <SettingsInfoHintModal
        visible={accentInfoOpen}
        onClose={() => setAccentInfoOpen(false)}
        title={t('theme_accent_title')}
        paragraphs={[t('theme_accent_hint'), t('theme_accent_semantic_hint')]}
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

const getStyles = (colors: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.surfaceLight,
  },
  backBtnPressed: { opacity: 0.7 },
  subHeaderTitle: {
    ...Typography.headlineMedium,
    color: colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    flex: 1,
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 40,
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
    color: colors.textPrimary,
    fontSize: 16,
  },
  sectionTitleWithInfo: { flex: 1, flexShrink: 1, minWidth: 0 },
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
    backgroundColor: colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  currencyChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  currencyChipSymbol: {
    fontSize: 22,
    marginBottom: 4,
    color: colors.textPrimary,
  },
  currencyChipSymbolActive: { color: colors.primary },
  currencyChipCode: {
    ...Typography.labelSmall,
    color: colors.textSecondary,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  currencyChipCodeActive: { color: colors.primary },
  // Eski görünüm kontrolü: otomatik anahtar + yalnız manuelde iki seçenek.
  themeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  themeBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  themeBtnActive: { backgroundColor: '#00C853' },
  themeBtnText: {
    color: colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  themeBtnTextActive: { color: '#FFFFFF' },
  optionPressed: { opacity: 0.72 },
});
