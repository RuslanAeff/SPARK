import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { Colors } from '../src/theme/colors';
import { BorderRadius, ScreenPadding, Spacing } from '../src/theme/spacing';
import { FontFamily, Typography } from '../src/theme/typography';
import { useLanguage } from '../src/i18n/LanguageContext';
import { LANGUAGE_OPTIONS } from '../src/i18n/languageOptions';
import { useCurrency, DISPLAY_CURRENCIES, DisplayCurrency } from '../src/context/CurrencyContext';
import { useAppTheme } from '../src/theme/themeStore';
import { susevarButton, susevarButtonPressed, susevarButtonText } from '../src/theme/susevar';
import { sanitizeAmount, sanitizeText } from '../src/utils/inputValidation';
import { BudgetDao } from '../src/db/budgetDao';
import { getStartOfMonth } from '../src/utils/dateUtils';
import { useOnboardingStatus } from '../src/hooks/useOnboardingStatus';

const TOTAL_PAGES = 4;

function suggestCurrency(): DisplayCurrency {
  const locale = Intl.NumberFormat().resolvedOptions().locale.toLowerCase();
  if (locale.includes('tr')) return 'TRY';
  if (locale.includes('az')) return 'AZN';
  if (locale.includes('en-us')) return 'USD';
  if (locale.includes('pl')) return 'PLN';
  return 'EUR';
}

export default function OnboardingScreen() {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const { t, language, setLanguage } = useLanguage();
  const { setCurrency } = useCurrency();
  const { setOnboardingCompleted } = useOnboardingStatus();

  const [page, setPage] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<DisplayCurrency>(suggestCurrency());
  const [budgetInvalid, setBudgetInvalid] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => page === 0);
    return () => sub.remove();
  }, [page]);

  const skipToDashboard = async () => {
    await setOnboardingCompleted(true);
    router.replace('/(tabs)');
  };

  const goToPage = (target: number) => {
    const safeTarget = Math.max(0, Math.min(TOTAL_PAGES - 1, target));
    scrollRef.current?.scrollTo({ x: safeTarget * width, animated: true });
    setPage(safeTarget);
  };

  const saveAndFinish = async (target: '/(tabs)/scanner' | '/(tabs)') => {
    const normalized = sanitizeText(budgetAmount, 20).replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    const safeBudget = sanitizeAmount(parsed, 0);

    await setCurrency(selectedCurrency);
    if (safeBudget > 0) {
      // getStartOfMonth() yerel saate duyarlı; toISOString UTC'ye çevirip
      // gece yarısı civarında bir önceki ayı döndürebilirdi (P15 timezone fix).
      const monthKey = getStartOfMonth().substring(0, 7);
      await BudgetDao.setMonthlyBudget(safeBudget, monthKey, selectedCurrency);
    }

    await setOnboardingCompleted(true);
    router.replace(target);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <View />
        <Pressable onPress={skipToDashboard} hitSlop={10}>
          <Text style={styles.skipText}>{t('onboarding_skip')}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const nextPage = Math.round(event.nativeEvent.contentOffset.x / width);
          setPage(nextPage);
        }}
      >
        <View style={[styles.page, { width }]}>
          <Animated.View entering={FadeInDown.duration(420)} style={styles.centered}>
            <View style={styles.logoWrap}>
              <MaterialCommunityIcons name="sparkles" size={52} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{t('onboarding_welcome_title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding_welcome_subtitle')}</Text>
            <View style={styles.featureRow}>
              {[
                ['line-scan', t('onboarding_feature_scan')],
                ['wallet-outline', t('onboarding_feature_budget')],
                ['chart-donut', t('onboarding_feature_analytics')],
              ].map(([icon, label]) => (
                <View key={String(label)} style={styles.featurePill}>
                  <MaterialCommunityIcons name={icon as any} size={18} color={Colors.primary} />
                  <Text style={styles.featureText}>{label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

        <View style={[styles.page, { width }]}>
          <Animated.View entering={FadeInDown.duration(420)} style={styles.centered}>
            <Text style={styles.title}>{t('onboarding_language_title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding_language_subtitle')}</Text>
            <View style={styles.languageGrid}>
              {LANGUAGE_OPTIONS.map((option) => {
                const active = selectedLanguage === option.code;
                return (
                  <Pressable
                    key={option.code}
                    style={[styles.languageCard, active && styles.languageCardActive]}
                    onPress={async () => {
                      setSelectedLanguage(option.code);
                      await setLanguage(option.code);
                    }}
                  >
                    <Text style={styles.languageFlag}>
                      {option.code === 'tr' ? '🇹🇷' : option.code === 'en' ? '🇬🇧' : option.code === 'az' ? '🇦🇿' : '🇷🇺'}
                    </Text>
                    <Text style={[styles.languageText, active && styles.languageTextActive]}>{option.nativeLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>

        <View style={[styles.page, { width }]}>
          <Animated.View entering={FadeInDown.duration(420)} style={styles.centered}>
            <Text style={styles.title}>{t('onboarding_budget_title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding_budget_subtitle')}</Text>
            <View style={styles.glassCard}>
              <TextInput
                value={budgetAmount}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setBudgetAmount(value.replace(',', '.'));
                  if (budgetInvalid) setBudgetInvalid(false);
                }}
                placeholder={t('onboarding_budget_input_placeholder')}
                placeholderTextColor={Colors.textMuted}
                style={[styles.input, budgetInvalid && styles.inputInvalid]}
              />
              <View style={styles.currencyRow}>
                {DISPLAY_CURRENCIES.map((item) => {
                  const active = item === selectedCurrency;
                  return (
                    <Pressable
                      key={item}
                      style={[styles.currencyChip, active && styles.currencyChipActive]}
                      onPress={() => setSelectedCurrency(item)}
                    >
                      <Text style={[styles.currencyText, active && styles.currencyTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Pressable onPress={() => goToPage(3)}>
              <Text style={styles.smallLink}>{t('onboarding_budget_skip_link')}</Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={[styles.page, { width }]}>
          <Animated.View entering={FadeInUp.duration(420)} style={styles.centered}>
            <Animated.View entering={ZoomIn.delay(120)} style={styles.doneIconWrap}>
              <MaterialCommunityIcons name="check" size={40} color={Colors.textInverse} />
            </Animated.View>
            <Text style={styles.title}>{t('onboarding_done_title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding_done_subtitle')}</Text>

            <Pressable style={({ pressed }) => [styles.cta, pressed && susevarButtonPressed]} onPress={() => void saveAndFinish('/(tabs)/scanner')}>
              <Text style={styles.ctaText}>{t('onboarding_done_scan_cta')}</Text>
            </Pressable>
            <Pressable onPress={() => void saveAndFinish('/(tabs)')}>
              <Text style={styles.smallLink}>{t('onboarding_done_explore_link')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_PAGES }).map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === page && styles.dotActive]} />
          ))}
        </View>
        {page < TOTAL_PAGES - 1 && (
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && susevarButtonPressed]}
            onPress={() => {
              if (page === 2) {
                const normalized = sanitizeText(budgetAmount, 20).replace(',', '.');
                if (normalized.length > 0 && sanitizeAmount(Number.parseFloat(normalized), 0) <= 0) {
                  setBudgetInvalid(true);
                  return;
                }
              }
              goToPage(page + 1);
            }}
          >
            <Text style={styles.ctaText}>{page === 0 ? t('onboarding_welcome_cta') : t('onboarding_next')}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.md,
  },
  skipText: { ...Typography.labelLarge, color: Colors.textSecondary, fontFamily: FontFamily.bold },
  page: { paddingHorizontal: ScreenPadding.horizontal, justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  title: { ...Typography.displaySmall, color: Colors.textPrimary, textAlign: 'center', fontFamily: FontFamily.bold },
  subtitle: { ...Typography.bodyLarge, color: Colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  featureRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  featureText: { ...Typography.labelMedium, color: Colors.textPrimary, fontFamily: FontFamily.semiBold },
  languageGrid: { width: '100%', gap: Spacing.md },
  languageCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardSurface,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  languageFlag: { fontSize: 24, marginBottom: Spacing.xs },
  languageText: { ...Typography.bodyLarge, color: Colors.textPrimary, fontFamily: FontFamily.medium },
  languageTextActive: { color: Colors.primary, fontFamily: FontFamily.bold },
  glassCard: {
    width: '100%',
    borderRadius: BorderRadius.xxl,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    width: '100%',
  },
  inputInvalid: { borderColor: Colors.danger },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  currencyChip: {
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  currencyChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  currencyText: { ...Typography.labelLarge, color: Colors.textSecondary, fontFamily: FontFamily.semiBold },
  currencyTextActive: { color: Colors.primary },
  smallLink: { ...Typography.labelLarge, color: Colors.textSecondary, fontFamily: FontFamily.semiBold, marginTop: Spacing.sm },
  doneIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { paddingHorizontal: ScreenPadding.horizontal, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textMuted },
  dotActive: { width: 22, backgroundColor: Colors.primary },
  cta: {
    ...susevarButton,
    width: '100%',
  },
  ctaText: {
    ...susevarButtonText,
    textAlign: 'center',
  },
});
