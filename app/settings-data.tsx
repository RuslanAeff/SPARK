// S.P.A.R.K. — Settings: Data & backup (vendors, export, restore)
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
import { useAppTheme, useThemeRevision } from '../src/theme/themeStore';
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
import {
  SettingsNavigationRow,
  SettingsSection,
} from '../src/components/SettingsList';

type BulkVendorDeletePrompt = {
  vendorIds: number[];
  vendorCount: number;
  expenseCount: number;
};

export default function SettingsDataScreen() {
  const colorScheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [colorScheme, themeRevision]);
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
  const [vendorSelectionMode, setVendorSelectionMode] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [bulkDeletePrompt, setBulkDeletePrompt] =
    useState<BulkVendorDeletePrompt | null>(null);
  const [bulkDeletePreparing, setBulkDeletePreparing] = useState(false);
  const logoTimestamp = useRef(Date.now());
  const deleteInFlight = useRef(false);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return q ? vendors.filter(v => v.name.toLowerCase().includes(q)) : vendors;
  }, [vendors, vendorSearch]);

  const selectedVendorCount = selectedVendorIds.size;
  const allVendorsSelected = vendors.length > 0 && selectedVendorCount === vendors.length;

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
    const availableIds = new Set(v.map(vendor => vendor.id));
    setSelectedVendorIds(previous => {
      const next = new Set(Array.from(previous).filter(id => availableIds.has(id)));
      if (next.size === previous.size) return previous;
      return next;
    });
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

  function enterVendorSelection() {
    setVendorOptionsTarget(null);
    setSelectedVendorIds(new Set());
    setVendorSelectionMode(true);
    void Haptics.selectionAsync();
  }

  function exitVendorSelection() {
    setVendorSelectionMode(false);
    setSelectedVendorIds(new Set());
    setBulkDeletePrompt(null);
    setBulkDeletePreparing(false);
  }

  function toggleVendorSelection(vendorId: number) {
    setSelectedVendorIds(previous => {
      const next = new Set(previous);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
    void Haptics.selectionAsync();
  }

  function toggleAllVendors() {
    setSelectedVendorIds(
      allVendorsSelected ? new Set() : new Set(vendors.map(vendor => vendor.id)),
    );
    void Haptics.selectionAsync();
  }

  async function prepareBulkVendorDelete() {
    if (selectedVendorCount === 0 || bulkDeletePreparing) return;
    const vendorIds = Array.from(selectedVendorIds);
    setBulkDeletePreparing(true);
    try {
      const expenseCount = await VendorDao.countExpensesForVendors(vendorIds);
      setBulkDeletePrompt({
        vendorIds,
        vendorCount: vendorIds.length,
        expenseCount,
      });
    } catch (e) {
      console.warn(e);
      SparkToast.show(t('delete_failed'), 'error');
    } finally {
      setBulkDeletePreparing(false);
    }
  }

  async function handleDeleteVendor() {
    if (!deleteVendorPrompt || deleteInFlight.current) return;
    const { vendor } = deleteVendorPrompt;
    setDeleteVendorPrompt(null);
    deleteInFlight.current = true;
    try {
      await VendorDao.delete(vendor.id);
      await loadVendors();
      triggerRefresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('vendor_deleted'), 'success', t('vendor_deleted_desc'));
    } catch (e) {
      console.warn(e);
      SparkToast.show(t('delete_failed'), 'error');
    } finally {
      deleteInFlight.current = false;
    }
  }

  async function handleBulkDeleteVendors() {
    if (!bulkDeletePrompt || deleteInFlight.current) return;
    const prompt = bulkDeletePrompt;
    setBulkDeletePrompt(null);
    deleteInFlight.current = true;
    try {
      const deletedCount = await VendorDao.deleteMany(prompt.vendorIds);
      await loadVendors();
      triggerRefresh();
      exitVendorSelection();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(
        t('vendors_deleted_bulk', { count: deletedCount.toString() }),
        'success',
        t('vendor_deleted_desc'),
      );
    } catch (e) {
      console.warn(e);
      SparkToast.show(t('delete_failed'), 'error');
    } finally {
      deleteInFlight.current = false;
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
            <SettingsSection testID="settings-data-vendors-section">
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
                  {!vendorSelectionMode ? (
                    <Pressable
                      testID="vendor-multi-select-enter"
                      onPress={enterVendorSelection}
                      style={({ pressed }) => [
                        styles.vendorMultiSelectEntry,
                        pressed && styles.vendorActionPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('vendor_multi_select')}
                    >
                      <MaterialCommunityIcons
                        name="checkbox-multiple-outline"
                        size={17}
                        color={Colors.primary}
                      />
                      <Text style={styles.vendorMultiSelectEntryText}>
                        {t('vendor_multi_select')}
                      </Text>
                    </Pressable>
                  ) : (
                    <View testID="vendor-selection-panel" style={styles.vendorSelectionPanel}>
                      <View style={styles.vendorSelectionSummary}>
                        <Text style={styles.vendorSelectionCount}>
                          {t('vendor_selected_count', {
                            count: selectedVendorCount.toString(),
                          })}
                        </Text>
                        <Pressable
                          testID="vendor-selection-cancel"
                          onPress={exitVendorSelection}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t('cancel')}
                        >
                          <Text style={styles.vendorSelectionCancel}>{t('cancel')}</Text>
                        </Pressable>
                      </View>
                      <View style={styles.vendorSelectionActions}>
                        <Pressable
                          testID="vendor-selection-toggle-all"
                          onPress={toggleAllVendors}
                          style={({ pressed }) => [
                            styles.vendorSelectionButton,
                            pressed && styles.vendorActionPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            allVendorsSelected
                              ? 'vendor_clear_selection'
                              : 'vendor_select_all',
                          )}
                        >
                          <MaterialCommunityIcons
                            name={
                              allVendorsSelected
                                ? 'checkbox-multiple-blank-outline'
                                : 'checkbox-multiple-marked-outline'
                            }
                            size={17}
                            color={Colors.primary}
                          />
                          <Text style={styles.vendorSelectionButtonText} numberOfLines={2}>
                            {t(
                              allVendorsSelected
                                ? 'vendor_clear_selection'
                                : 'vendor_select_all',
                            )}
                          </Text>
                        </Pressable>
                        <Pressable
                          testID="vendor-selection-delete"
                          onPress={() => void prepareBulkVendorDelete()}
                          disabled={selectedVendorCount === 0 || bulkDeletePreparing}
                          style={({ pressed }) => [
                            styles.vendorSelectionButton,
                            styles.vendorSelectionDeleteButton,
                            (selectedVendorCount === 0 || bulkDeletePreparing)
                              && styles.vendorSelectionButtonDisabled,
                            pressed && selectedVendorCount > 0 && styles.vendorActionPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t('vendor_delete_selected', {
                            count: selectedVendorCount.toString(),
                          })}
                          accessibilityState={{
                            disabled: selectedVendorCount === 0 || bulkDeletePreparing,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={17}
                            color={Colors.danger}
                          />
                          <Text
                            style={[
                              styles.vendorSelectionButtonText,
                              styles.vendorSelectionDeleteText,
                            ]}
                            numberOfLines={2}
                          >
                            {t('vendor_delete_selected', {
                              count: selectedVendorCount.toString(),
                            })}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

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
                        const selected = selectedVendorIds.has(v.id);
                        return (
                          <Pressable
                            key={v.id}
                            testID={`vendor-tile-${v.id}`}
                            onPress={() => {
                              if (vendorSelectionMode) {
                                toggleVendorSelection(v.id);
                                return;
                              }
                              void Haptics.selectionAsync();
                              setVendorOptionsTarget(v);
                            }}
                            onLongPress={
                              vendorSelectionMode
                                ? undefined
                                : async () => {
                                    void Haptics.impactAsync(
                                      Haptics.ImpactFeedbackStyle.Medium,
                                    );
                                    const expenseCount = await VendorDao.countExpenses(v.id);
                                    setDeleteVendorPrompt({ vendor: v, expenseCount });
                                  }
                            }
                            delayLongPress={400}
                            style={({ pressed }) => [
                              styles.vendorTile,
                              vendorSelectionMode && styles.vendorTileSelectionMode,
                              pressed && styles.vendorTilePressed,
                            ]}
                            accessibilityRole={vendorSelectionMode ? 'checkbox' : 'button'}
                            accessibilityLabel={
                              vendorSelectionMode
                                ? t('vendor_select_accessibility', { name: v.name })
                                : v.name
                            }
                            accessibilityState={
                              vendorSelectionMode ? { checked: selected } : undefined
                            }
                          >
                            <View
                              style={[
                                styles.vendorTileAvatar,
                                !hasLogo && { backgroundColor: tileColor },
                                selected && styles.vendorTileAvatarSelected,
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
                              {vendorSelectionMode ? (
                                <View
                                  testID={`vendor-selection-indicator-${v.id}`}
                                  style={[
                                    styles.vendorTileBadge,
                                    styles.vendorTileSelectionBadge,
                                    selected && styles.vendorTileSelectionBadgeSelected,
                                  ]}
                                >
                                  <MaterialCommunityIcons
                                    name={
                                      selected
                                        ? 'check-bold'
                                        : 'checkbox-blank-circle-outline'
                                    }
                                    size={selected ? 12 : 15}
                                    color={selected ? Colors.onPrimary : Colors.textSecondary}
                                  />
                                </View>
                              ) : (
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
                              )}
                              {hasDefaultCategory && (
                                <View style={styles.vendorTileDefaultDot}>
                                  <MaterialCommunityIcons
                                    name="auto-fix"
                                    size={10}
                                    color={Colors.onPrimary}
                                  />
                                </View>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.vendorTileName,
                                selected && styles.vendorTileNameSelected,
                              ]}
                              numberOfLines={2}
                            >
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
                    <Text style={styles.vendorHintText}>
                      {t(
                        vendorSelectionMode
                          ? 'vendor_selection_hint'
                          : 'vendor_tile_hint',
                      )}
                    </Text>
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
            </SettingsSection>
          </Animated.View>

          {/* Persistent product identity review */}
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <SettingsNavigationRow
              testID="manage-product-matching"
              title={t('product_match_entry_title')}
              description={t('product_match_entry_hint')}
              icon="tag-multiple-outline"
              iconColor={Colors.primary}
              iconBackgroundColor={Colors.primarySoft}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/product-matching');
              }}
              accessibilityLabel={t('product_match_entry_title')}
              accessibilityHint={t('product_match_entry_hint')}
            />
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
      <GlassDeleteModal
        visible={bulkDeletePrompt !== null}
        title={t('delete_selected_vendors_title')}
        message={
          bulkDeletePrompt
            ? bulkDeletePrompt.expenseCount > 0
              ? t('confirm_delete_vendors_warning', {
                  vendorCount: bulkDeletePrompt.vendorCount.toString(),
                  expenseCount: bulkDeletePrompt.expenseCount.toString(),
                })
              : t('confirm_delete_vendors_no_expenses', {
                  vendorCount: bulkDeletePrompt.vendorCount.toString(),
                })
            : ''
        }
        onCancel={() => setBulkDeletePrompt(null)}
        onDelete={handleBulkDeleteVendors}
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
  vendorMultiSelectEntry: {
    minHeight: 36,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  vendorMultiSelectEntryText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
  vendorSelectionPanel: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  vendorSelectionSummary: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  vendorSelectionCount: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  vendorSelectionCancel: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
  vendorSelectionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  vendorSelectionButton: {
    minHeight: 42,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySoft,
  },
  vendorSelectionDeleteButton: {
    borderColor: Colors.danger + '66',
    backgroundColor: Colors.danger + '12',
  },
  vendorSelectionButtonDisabled: { opacity: 0.42 },
  vendorActionPressed: { opacity: 0.7 },
  vendorSelectionButtonText: {
    ...Typography.labelSmall,
    flexShrink: 1,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
    textAlign: 'center',
  },
  vendorSelectionDeleteText: { color: Colors.danger },
  vendorCarouselView: { marginTop: Spacing.sm },
  vendorCarousel: { gap: Spacing.md, paddingVertical: Spacing.xs },
  vendorTile: { width: 76, alignItems: 'center' },
  vendorTileSelectionMode: { minHeight: 84 },
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
  vendorTileAvatarSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
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
    backgroundColor: Colors.primaryAction,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardSurface,
  },
  vendorTileSelectionBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  vendorTileSelectionBadgeSelected: {
    backgroundColor: Colors.primaryAction,
    borderColor: Colors.primary,
  },
  vendorTileName: {
    ...Typography.labelSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    lineHeight: 14,
  },
  vendorTileNameSelected: { color: Colors.primary },
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
});
