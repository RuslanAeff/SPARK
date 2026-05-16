// S.P.A.R.K. — Settings: Data & backup (vendors, subscriptions, backup)
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  TextInput,
} from 'react-native';
import { useAppTheme } from '../src/theme/themeStore';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useRefresh } from '../src/context/RefreshContext';
import { VendorDao } from '../src/db/vendorDao';
import { Vendor } from '../src/db/schema';
import { SparkToast } from '../src/components/SparkToast';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import VendorOptionsSheet from '../src/components/VendorOptionsSheet';
import BackupSection from '../src/components/BackupSection';
import {
  SettingsInfoHintModal,
  SettingsInfoIconButton,
} from '../src/components/SettingsInfoHint';

export default function SettingsDataScreen() {
  const colorScheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [colorScheme]);
  const router = useRouter();
  const { t } = useLanguage();
  const { refreshKey, triggerRefresh } = useRefresh();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorOptionsTarget, setVendorOptionsTarget] = useState<Vendor | null>(null);
  const [deleteVendorPrompt, setDeleteVendorPrompt] = useState<{
    vendor: Vendor;
    expenseCount: number;
  } | null>(null);
  const [vendorInfoOpen, setVendorInfoOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const logoTimestamp = useRef(Date.now());

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return q ? vendors.filter(v => v.name.toLowerCase().includes(q)) : vendors;
  }, [vendors, vendorSearch]);

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
    [],
  );

  const getVendorTileColor = useCallback(
    (name: string) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
      return VENDOR_TILE_COLORS[Math.abs(hash) % VENDOR_TILE_COLORS.length];
    },
    [VENDOR_TILE_COLORS],
  );

  useEffect(() => {
    loadVendors();
  }, [refreshKey]);

  async function loadVendors() {
    const v = await VendorDao.getAll();
    setVendors(v);
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
            {t('settings_group_data')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Vendors */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: Colors.chartGreen + '22' }]}>
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={22}
                    color={Colors.chartGreen}
                  />
                </View>
                <Text
                  style={[styles.sectionTitle, styles.sectionTitleWithInfo]}
                  numberOfLines={2}
                >
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
                  {vendors.length >= 6 && (
                    <View style={styles.vendorSearchWrap}>
                      <MaterialCommunityIcons name="magnify" size={16} color={Colors.textMuted} />
                      <TextInput
                        style={styles.vendorSearchInput}
                        value={vendorSearch}
                        onChangeText={setVendorSearch}
                        placeholder={t('vendor_search_placeholder')}
                        placeholderTextColor={Colors.textMuted}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      {vendorSearch.length > 0 && (
                        <Pressable onPress={() => setVendorSearch('')} hitSlop={8}>
                          <MaterialCommunityIcons name="close-circle" size={14} color={Colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                  )}

                  {filteredVendors.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.vendorCarousel}
                      style={styles.vendorCarouselView}
                    >
                      {filteredVendors.map((v) => {
                        const tileColor = getVendorTileColor(v.name);
                        const hasLogo = !!v.logo_uri;
                        const hasDefaultCategory = v.default_category_id != null;
                        return (
                          <Pressable
                            key={v.id}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setVendorOptionsTarget(v);
                            }}
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
                              <View
                                style={[
                                  styles.vendorTileBadge,
                                  {
                                    backgroundColor: Colors.cardSurface,
                                    borderWidth: 1,
                                    borderColor: Colors.border,
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="dots-horizontal"
                                  size={12}
                                  color={Colors.textPrimary}
                                />
                              </View>
                              {hasDefaultCategory && (
                                <View style={styles.vendorTileDefaultDot}>
                                  <MaterialCommunityIcons
                                    name="auto-fix"
                                    size={10}
                                    color="#fff"
                                  />
                                </View>
                              )}
                            </View>
                            <Text style={styles.vendorTileName} numberOfLines={2}>
                              {v.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.vendorNoResults}>
                      <MaterialCommunityIcons name="magnify-close" size={24} color={Colors.textMuted} />
                      <Text style={[styles.emptyText, { marginTop: Spacing.xs }]}>{t('vendor_no_results')}</Text>
                    </View>
                  )}

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

          {/* Subscriptions link */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/subscriptions');
              }}
              style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
            >
              <View style={[styles.sectionIcon, { backgroundColor: Colors.primary + '22' }]}>
                <MaterialCommunityIcons name="autorenew" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.linkText}>{t('subscriptions_title')}</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={Colors.textSecondary}
              />
            </Pressable>
          </Animated.View>

          {/* Backup */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <BackupSection />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <GlassDeleteModal
        visible={deleteVendorPrompt !== null}
        message={
          deleteVendorPrompt
            ? deleteVendorPrompt.expenseCount > 0
              ? t('confirm_delete_vendor_warning', {
                  name: deleteVendorPrompt.vendor.name,
                  count: deleteVendorPrompt.expenseCount.toString(),
                })
              : t('confirm_delete_vendor_no_expenses', {
                  name: deleteVendorPrompt.vendor.name,
                })
            : ''
        }
        onCancel={() => setDeleteVendorPrompt(null)}
        onDelete={handleDeleteVendor}
      />
      <VendorOptionsSheet
        visible={vendorOptionsTarget !== null}
        vendor={vendorOptionsTarget}
        onClose={() => setVendorOptionsTarget(null)}
        onChangeLogo={(vendorId) => assignVendorLogo(vendorId)}
        onDelete={async (v) => {
          const expenseCount = await VendorDao.countExpenses(v.id);
          setDeleteVendorPrompt({ vendor: v, expenseCount });
        }}
        onChanged={() => loadVendors()}
      />
      <SettingsInfoHintModal
        visible={vendorInfoOpen}
        onClose={() => setVendorInfoOpen(false)}
        title={t('vendor_logos')}
        paragraphs={[t('vendor_logos_hint')]}
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
  content: { paddingHorizontal: ScreenPadding.horizontal, paddingBottom: 40 },
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
  // Vendor list
  vendorBadge: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  vendorBadgeText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  vendorCarouselView: { marginTop: Spacing.sm },
  vendorCarousel: { gap: Spacing.md, paddingVertical: Spacing.xs },
  vendorTile: { width: 76, alignItems: 'center' },
  vendorTilePressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  vendorTileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    marginBottom: Spacing.xs,
  },
  vendorTileImg: { width: 60, height: 60, borderRadius: 30 },
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
  vendorTileDefaultDot: {
    position: 'absolute',
    left: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardSurface,
  },
  vendorTileName: {
    ...Typography.labelSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    lineHeight: 14,
  },
  vendorSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  vendorSearchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    padding: 0,
  },
  vendorNoResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
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
  vendorHintText: { ...Typography.labelSmall, color: Colors.textMuted },
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
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  linkRowPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  linkText: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
    flex: 1,
  },
});
