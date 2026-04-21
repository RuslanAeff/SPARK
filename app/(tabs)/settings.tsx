// S.P.A.R.K. — Settings Screen
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform,
  Switch, Image,
} from 'react-native';
import { useAppTheme } from '../../src/theme/themeStore';

import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import GlassDeleteModal from '../../src/components/GlassDeleteModal';
import GlassCheckButton from '../../src/components/GlassCheckButton';
import { Colors } from '../../src/theme/colors';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../../src/theme/spacing';
import { BudgetDao } from '../../src/db/budgetDao';
import { VendorDao } from '../../src/db/vendorDao';
import { Vendor } from '../../src/db/schema';
import { saveApiKey, hasApiKey } from '../../src/services/geminiService';
import { formatMonthYear } from '../../src/utils/dateUtils';
import BudgetHistoryCard from '../../src/components/BudgetHistoryCard';
import { SparkToast } from '../../src/components/SparkToast';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { languageNativeLabel } from '../../src/i18n/languageOptions';
import LanguagePickerSheet from '../../src/components/LanguagePickerSheet';
import { useCurrency, DISPLAY_CURRENCIES, CURRENCY_META, DisplayCurrency } from '../../src/context/CurrencyContext';
import AutoThemeScheduleToggle from '../../src/components/AutoThemeScheduleToggle';
import {
  loadThemeSettings,
  setAutoThemeSchedule,
  setManualTheme as persistManualTheme,
} from '../../src/utils/themeSchedule';
import { useRefresh } from '../../src/context/RefreshContext';
import { getGoalFeatureEnabled, setGoalFeatureEnabled as persistGoalFeatureEnabled } from '../../src/services/goalFeatureSettings';
import BackupSection from '../../src/components/BackupSection';
import { SettingsInfoHintModal, SettingsInfoIconButton } from '../../src/components/SettingsInfoHint';

export default function SettingsScreen() {
  const colorScheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [colorScheme]);
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const { refreshKey, triggerRefresh } = useRefresh();
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });
  
  const [budgetAmount, setBudgetAmount] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
  const [manualThemePref, setManualThemePref] = useState<'light' | 'dark'>('dark');
  const [deleteVendorPrompt, setDeleteVendorPrompt] = useState<{
    vendor: Vendor;
    expenseCount: number;
  } | null>(null);
  const [goalFeatureOn, setGoalFeatureOn] = useState(true);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [budgetInfoOpen, setBudgetInfoOpen] = useState(false);
  const [currencyInfoOpen, setCurrencyInfoOpen] = useState(false);
  const [themeInfoOpen, setThemeInfoOpen] = useState(false);
  const [vendorInfoOpen, setVendorInfoOpen] = useState(false);
  const [goalInfoOpen, setGoalInfoOpen] = useState(false);
  const logoTimestamp = useRef(Date.now());

  // Satıcı carousel'i için sabit, hash-tabanlı renk paleti. Aynı isim
  // her zaman aynı rengi alır; listenin karışık ama tutarlı görünmesini sağlar.
  const VENDOR_TILE_COLORS = useMemo(
    () => [
      Colors.chartGreen,
      Colors.info,
      Colors.chartOrange,
      Colors.chartPink,
      Colors.chartPurple,
      Colors.warning,
      Colors.chartBlue,
      Colors.danger,
    ],
    []
  );

  const getVendorTileColor = useCallback(
    (name: string) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
      return VENDOR_TILE_COLORS[Math.abs(hash) % VENDOR_TILE_COLORS.length];
    },
    [VENDOR_TILE_COLORS]
  );

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

  useEffect(() => {
    let alive = true;
    (async () => {
      const on = await getGoalFeatureEnabled();
      if (!alive) return;
      setGoalFeatureOn(on);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleGoalFeatureToggle(next: boolean) {
    try {
      await persistGoalFeatureEnabled(next);
      setGoalFeatureOn(next);
      triggerRefresh();
      queueMicrotask(() => triggerRefresh());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      SparkToast.show(t('goal_feature_saved'), 'success');
    } catch (e) {
      console.warn('goal feature', e);
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

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

  // refreshKey: fiş / manuel harcama sonrası triggerRefresh → satıcı listesi anında güncellenir
  useEffect(() => {
    loadBudgetForMonth(selectedMonth);
    loadVendors();
    checkApiKey();
  }, [selectedMonth, refreshKey]);

  async function checkApiKey() {
    const has = await hasApiKey();
    setHasKey(has);
  }

  async function loadBudgetForMonth(monthStr: string) {
    const budget = await BudgetDao.getForMonth(monthStr);
    if (budget) {
      setBudgetAmount(budget.monthly_amount.toString());
    } else {
      setBudgetAmount('');
    }
  }

  async function loadVendors() {
    const v = await VendorDao.getAll();
    setVendors(v);
  }

  async function handleSaveBudget() {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      SparkToast.show(t('enter_valid_budget'), 'error');
      return;
    }
    await BudgetDao.setMonthlyBudget(amount, selectedMonth, currency);
    triggerRefresh();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const curLabel = currency === 'TRY' ? 'TL' : currency;
    SparkToast.show(t('budget_saved', { month: formatMonthYear(`${selectedMonth}-01`, t) }), 'success', t('budget_saved_desc', { amount: amount.toLocaleString(), currency: curLabel }));
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      SparkToast.show(t('api_key_empty'), 'error');
      return;
    }
    await saveApiKey(apiKey.trim());
    setHasKey(true);
    setApiKey('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    SparkToast.show(t('api_key_saved'), 'success', t('api_key_ready'));
  }

  async function assignVendorLogo(vendorId: number) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    await VendorDao.updateLogo(vendorId, result.assets[0].uri);
    logoTimestamp.current = Date.now();
    await loadVendors();
    SparkToast.show(t('vendor_logo_updated'), 'success');
  }

  async function handleDeleteVendor() {
    if (!deleteVendorPrompt) return;
    const { vendor } = deleteVendorPrompt;
    setDeleteVendorPrompt(null);
    try {
      await VendorDao.delete(vendor.id);
      await loadVendors();
      triggerRefresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('vendor_deleted'), 'success', t('vendor_deleted_desc'));
    } catch (e) {
      console.warn(e);
      SparkToast.show(t('delete_failed'), 'error');
    }
  }


  function changeMonth(delta: number) {
    const [y, m] = selectedMonth.split('-').map(Number);
    let date = new Date(y, m - 1 + delta, 1);
    const newY = date.getFullYear();
    const newM = (date.getMonth() + 1).toString().padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  }

  return (
    <>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings_title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Budget Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="wallet-outline" size={22} color={Colors.primary} />
              <Text style={[styles.sectionTitle, styles.sectionTitleWithInfo]} numberOfLines={2}>
                {t('budget_system')}
              </Text>
              <SettingsInfoIconButton
                onPress={() => setBudgetInfoOpen(true)}
                accessibilityLabel={t('settings_info_accessibility')}
              />
            </View>

            <View style={styles.monthSelector}>
              <Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.monthText}>{formatMonthYear(`${selectedMonth}-01`, t)}</Text>
              <Pressable onPress={() => changeMonth(1)} style={styles.monthArrow}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                keyboardType="decimal-pad"
                placeholder="5000"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.currency}>{currency === 'TRY' ? 'TL' : currency}</Text>
              <GlassCheckButton onPress={handleSaveBudget} />
            </View>

            {/* Budget History inside the same card */}
            <View style={styles.historyDivider}>
              <MaterialCommunityIcons name="history" size={14} color={Colors.textMuted} />
              <Text style={styles.historyDividerText}>{t('past_budgets')}</Text>
            </View>
            <BudgetHistoryCard />
          </View>
        </Animated.View>

        {/* API Key Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="key-outline" size={22} color={Colors.secondary} />
              <Text style={styles.sectionTitle}>{t('api_key_title')}</Text>
            </View>
            {hasKey && (
              <View style={styles.keyStatus}>
                <MaterialCommunityIcons name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.keyStatusText}>{t('api_key_exists')}</Text>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={hasKey ? t('enter_new_key') : t('paste_key')}
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
              <GlassCheckButton onPress={handleSaveApiKey} />
            </View>
          </View>
        </Animated.View>

        {/* Dil — tək kart, alt panel */}
        <Animated.View entering={FadeInDown.delay(225).duration(400)}>
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
                <MaterialCommunityIcons name="google-translate" size={24} color={Colors.primary} />
              </View>
              <View style={styles.languageRowText}>
                <Text style={styles.languageRowTitle}>{t('language_row_label')}</Text>
                <Text style={styles.languageRowSub}>{languageNativeLabel(language)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Display currency */}
        <Animated.View entering={FadeInDown.delay(235).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color={Colors.chartOrange} />
              <Text style={[styles.sectionTitle, styles.sectionTitleWithInfo]} numberOfLines={2}>
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
                    <Text style={[styles.currencyChipSymbol, active && styles.currencyChipSymbolActive]}>{meta.symbol}</Text>
                    <Text style={[styles.currencyChipCode, active && styles.currencyChipCodeActive]}>{codeLabel}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Animated.View>

        {/* Theme Settings Section */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="theme-light-dark" size={22} color={Colors.chartPurple} />
              <Text style={[styles.sectionTitle, styles.sectionTitleWithInfo]} numberOfLines={2}>
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm, gap: Spacing.sm }}>
                <Pressable
                  onPress={() => pickManualTheme('light')}
                  style={[styles.themeBtn, manualThemePref === 'light' && styles.themeBtnActive]}
                >
                  <MaterialCommunityIcons
                    name="white-balance-sunny"
                    size={20}
                    color={manualThemePref === 'light' ? Colors.background : Colors.textPrimary}
                  />
                  <Text style={[styles.themeBtnText, manualThemePref === 'light' && { color: Colors.background }]}>
                    {t('theme_light')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => pickManualTheme('dark')}
                  style={[styles.themeBtn, manualThemePref === 'dark' && styles.themeBtnActive]}
                >
                  <MaterialCommunityIcons
                    name="moon-waning-crescent"
                    size={20}
                    color={manualThemePref === 'dark' ? Colors.background : Colors.textPrimary}
                  />
                  <Text style={[styles.themeBtnText, manualThemePref === 'dark' && { color: Colors.background }]}>
                    {t('theme_dark')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Vendor Management Section */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="storefront-outline" size={22} color={Colors.chartGreen} />
              <Text style={[styles.sectionTitle, styles.sectionTitleWithInfo]} numberOfLines={2}>
                {t('vendor_logos')}
              </Text>
              {vendors.length > 0 && (
                <View style={styles.vendorBadge}>
                  <Text style={styles.vendorBadgeText}>{vendors.length}</Text>
                </View>
              )}
              <SettingsInfoIconButton
                onPress={() => setVendorInfoOpen(true)}
                accessibilityLabel={t('settings_info_accessibility')}
              />
            </View>

            {vendors.length > 0 ? (
              <>
                {/* Yatay scroll carousel — liste uzamaz, her satıcı eşit yer kaplayan
                    modern "story" tarzı tile olarak gösterilir. Uzun isimler 2
                    satırda üç nokta ile biter. Avatar yok ise isme göre stabil
                    bir renk seçilir (hash-tabanlı). */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vendorCarousel}
                  style={styles.vendorCarouselView}
                >
                  {vendors.map((v) => {
                    const tileColor = getVendorTileColor(v.name);
                    const hasLogo = !!v.logo_uri;
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => assignVendorLogo(v.id)}
                        onLongPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          const expenseCount = await VendorDao.countExpenses(v.id);
                          setDeleteVendorPrompt({ vendor: v, expenseCount });
                        }}
                        delayLongPress={400}
                        style={({ pressed }) => [
                          styles.vendorTile,
                          pressed && styles.vendorTilePressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.vendorTileAvatar,
                            !hasLogo && { backgroundColor: tileColor },
                          ]}
                        >
                          {hasLogo ? (
                            <Image
                              source={{ uri: v.logo_uri + '?ts=' + logoTimestamp.current }}
                              style={styles.vendorTileImg}
                            />
                          ) : (
                            <Text style={styles.vendorTileInitial}>
                              {v.name.trim().charAt(0).toUpperCase()}
                            </Text>
                          )}
                          {/* Sağ-üst mini aksiyon rozeti: logo varsa kalem, yoksa + */}
                          <View
                            style={[
                              styles.vendorTileBadge,
                              hasLogo
                                ? { backgroundColor: Colors.primary }
                                : { backgroundColor: Colors.cardSurface, borderWidth: 1, borderColor: Colors.border },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={hasLogo ? 'pencil' : 'plus'}
                              size={11}
                              color={hasLogo ? '#fff' : Colors.primary}
                            />
                          </View>
                        </View>
                        <Text style={styles.vendorTileName} numberOfLines={2}>
                          {v.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Alt hint: dokun / uzun bas ipucu */}
                <View style={styles.vendorHintRow}>
                  <MaterialCommunityIcons
                    name="gesture-tap"
                    size={12}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.vendorHintText}>{t('vendor_tile_hint')}</Text>
                </View>
              </>
            ) : (
              <View style={styles.vendorEmptyState}>
                <View style={styles.vendorEmptyIcon}>
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={28}
                    color={Colors.textMuted}
                  />
                </View>
                <Text style={styles.emptyText}>{t('no_vendors_yet')}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <GlassDeleteModal
          visible={deleteVendorPrompt !== null}
          message={
            deleteVendorPrompt
              ? deleteVendorPrompt.expenseCount > 0
                ? t('confirm_delete_vendor_warning', {
                    name: deleteVendorPrompt.vendor.name,
                    count: deleteVendorPrompt.expenseCount.toString(),
                  })
                : t('confirm_delete_vendor_no_expenses', { name: deleteVendorPrompt.vendor.name })
              : ''
          }
          onCancel={() => setDeleteVendorPrompt(null)}
          onDelete={handleDeleteVendor}
        />

        {/* Goal & limits + Category Management */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="flag-outline" size={22} color={Colors.primary} />
              <Text style={[styles.goalFeatureSectionTitle, styles.sectionTitleWithInfo]} numberOfLines={2}>
                {t('goal_feature_section_title')}
              </Text>
              <SettingsInfoIconButton
                onPress={() => setGoalInfoOpen(true)}
                accessibilityLabel={t('settings_info_accessibility')}
              />
            </View>
            <View style={styles.goalFeatureRow}>
              <Text style={styles.goalFeatureLabel}>{t('goal_feature_toggle')}</Text>
              <Switch
                value={goalFeatureOn}
                onValueChange={handleGoalFeatureToggle}
                trackColor={{ false: Colors.surfaceLight, true: Colors.primary + '55' }}
                thumbColor={goalFeatureOn ? Colors.primary : Colors.textMuted}
              />
            </View>
          </View>
          {/*
            NOT: "Hedef ve limit ayarları" kısayolu burada duplike idi.
            Dashboard'daki "Birikim hedefi" kartına dokunarak aynı ekrana
            ulaşılıyor → ayarlar kalabalığı azaltmak için kaldırıldı.
            Buradaki anahtar sadece özelliği açıp kapatır.
          */}
          <Pressable
            onPress={() => router.push('/categories')}
            style={styles.linkRow}
          >
             <MaterialCommunityIcons name="shape-outline" size={22} color={Colors.chartPurple} />
             <Text style={styles.linkText}>{t('category_management')}</Text>
             <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Backup & Restore */}
        <Animated.View entering={FadeInDown.delay(450).duration(400)}>
          <BackupSection />
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <View style={styles.about}>
            <Text style={styles.aboutName}>S.P.A.R.K</Text>
            <Text style={styles.aboutFull}>Strategic Parsing & Resource Keeper</Text>
            <View style={{ marginTop: Spacing.xl, alignItems: 'center' }}>
              <Text style={{
                color: colorScheme === 'dark' ? '#00e5ff' : '#040d7a',
                fontFamily: FontFamily.extraBold,
                fontSize: 17,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                textShadowColor: '#00e5ff',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 8,
              }}>
                by Mr. RUSLAN
              </Text>
            </View>
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

    </SafeAreaView>

    <SettingsInfoHintModal
      visible={budgetInfoOpen}
      onClose={() => setBudgetInfoOpen(false)}
      title={t('budget_system')}
      paragraphs={[t('budget_hint')]}
    />
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
      visible={vendorInfoOpen}
      onClose={() => setVendorInfoOpen(false)}
      title={t('vendor_logos')}
      paragraphs={[t('vendor_logos_hint')]}
    />
    <SettingsInfoHintModal
      visible={goalInfoOpen}
      onClose={() => setGoalInfoOpen(false)}
      title={t('goal_feature_section_title')}
      paragraphs={[t('goal_feature_section_hint')]}
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 20,
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
  sectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  /** Başlık satırında (i) ile birlikte: taşmayı ve sıkışmayı önler */
  sectionTitleWithInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  monthArrow: {
    padding: Spacing.xs,
  },
  monthText: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
  },
  currency: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
  },
  keyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  keyStatusText: {
    ...Typography.bodySmall,
    color: Colors.success,
  },
  // --- Satıcı yönetimi (modern yatay carousel) ---
  vendorBadge: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    marginLeft: 'auto' as const,
  },
  vendorBadgeText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  vendorCarouselView: {
    marginTop: Spacing.sm,
    // Kart iç padding'inin (Spacing.lg) dışına çıkmaması için margin-negatif
    // kullanmıyoruz. Bu, scroll sırasında tile'ların kartın yuvarlak
    // sınırlarından taşmasını önler.
  },
  vendorCarousel: {
    // Kartın kendi padding'i zaten Spacing.lg; tile'lar kart iç alanında
    // kayar, görsel olarak dışarı sızmaz.
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  vendorTile: {
    width: 76,
    alignItems: 'center',
  },
  vendorTilePressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  vendorTileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    marginBottom: Spacing.xs,
  },
  vendorTileImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  vendorTileInitial: {
    ...Typography.headlineMedium,
    color: '#fff',
    fontFamily: FontFamily.extraBold,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  vendorTileBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // Android shadow (elevation) + iOS shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  vendorTileName: {
    ...Typography.labelSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    lineHeight: 14,
  },
  vendorHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  vendorHintText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  vendorEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  vendorEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  goalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  goalFeatureSectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    letterSpacing: -0.3,
    flex: 1,
  },
  goalFeatureLabel: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: Spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  linkText: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
    flex: 1,
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
  aboutVersion: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
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
  themeBtnActive: {
    backgroundColor: Colors.primary,
  },
  themeBtnText: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  historyDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  historyDividerText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  languageIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    marginTop: 0,
  },
  languageRowPressed: {
    opacity: 0.92,
  },
  languageRowText: {
    flex: 1,
    gap: 4,
  },
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
  currencyChipSymbolActive: {
    color: Colors.primary,
  },
  currencyChipCode: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  currencyChipCodeActive: {
    color: Colors.primary,
  },
});
