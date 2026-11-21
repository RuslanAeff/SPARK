import { isLocalImageUri } from '../src/utils/localImageUri';
// S.P.A.R.K. — Settings: Data & backup (vendors, export, restore)
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  TextInput,
} from 'react-native';

import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../src/theme/colors';
import { Typography, FontFamily, FontSize } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useRefresh } from '../src/context/RefreshContext';
import { VendorDao } from '../src/db/vendorDao';
import { Vendor } from '../src/db/schema';
import { SparkToast } from '../src/components/SparkToast';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import VendorOptionsSheet from '../src/components/VendorOptionsSheet';
import BackupSection from '../src/components/BackupSection';
import DataResetSection from '../src/components/DataResetSection';
import {
  SettingsInfoHintModal,
  SettingsInfoIconButton,
} from '../src/components/SettingsInfoHint';
import {
  SettingsNavigationRow,
  SettingsSection,
} from '../src/components/SettingsList';
import { logError } from '../src/utils/logError';
import { setVendorLogo, sweepOrphanVendorLogos } from '../src/services/vendorLogoStore';
import ScreenHeader from '../src/components/ScreenHeader';
import { useBottomClearance } from '../src/hooks/useBottomClearance';
import { useThemedStyles } from '../src/theme/useThemedStyles';

type BulkVendorDeletePrompt = {
  vendorIds: number[];
  vendorCount: number;
  expenseCount: number;
};

export default function SettingsDataScreen() {
  // UX-06: sistem gezinme alanı (jest/üç düğme) kadar ek alt boşluk.
  const bottomClearance = useBottomClearance('screen', 40);
  const styles = useThemedStyles(getStyles);
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

  // UX-12: FlatList satırları seçim durumu değişince yeniden çizilsin.
  const vendorTileExtraData = useMemo(
    () => ({ vendorSelectionMode, selectedVendorIds }),
    [vendorSelectionMode, selectedVendorIds],
  );
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
    try {
      // BUG-27: önbellekteki seçici kopyası kalıcı klasöre alınır; eski logo silinir.
      await setVendorLogo(vendorId, result.assets[0].uri);
    } catch (e) {
      logError('settings-data vendor logo failed', e);
      SparkToast.show(t('vendor_logo_failed'), 'error');
      return;
    }
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
      logError('settings-data vendor impact count failed', e);
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
      void sweepOrphanVendorLogos();
      await loadVendors();
      triggerRefresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('vendor_deleted'), 'success', t('vendor_deleted_desc'));
    } catch (e) {
      logError('settings-data vendor delete failed', e);
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
      void sweepOrphanVendorLogos();
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
      logError('settings-data bulk vendor delete failed', e);
      SparkToast.show(t('delete_failed'), 'error');
    } finally {
      deleteInFlight.current = false;
    }
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title={t('settings_group_data')} />

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]} showsVerticalScrollIndicator={false}>
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
                  {vendorSelectionMode && (
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

                  {/* Araç satırı: arama ve çoklu seçim tek hizada; ayrı bir
                      satırda tek başına duran düğme kalmaz. */}
                  <View style={styles.vendorToolbar}>
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
                          <Pressable
                            onPress={() => setVendorSearch('')}
                            // A11Y-02: 14 px ikon + 15 px her yöne = 44 dp dokunma alanı.
                            hitSlop={15}
                            accessibilityRole="button"
                            accessibilityLabel={t('vendor_search_clear')}
                          >
                            <MaterialCommunityIcons name="close-circle" size={14} color={Colors.textMuted} />
                          </Pressable>
                        )}
                      </View>
                    )}
                    {!vendorSelectionMode && (
                      <Pressable
                        testID="vendor-multi-select-enter"
                        onPress={enterVendorSelection}
                        style={({ pressed }) => [
                          vendors.length >= 6
                            ? styles.vendorSelectIconButton
                            : styles.vendorMultiSelectEntry,
                          pressed && styles.vendorActionPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('vendor_multi_select')}
                      >
                        <MaterialCommunityIcons
                          name="checkbox-multiple-outline"
                          size={vendors.length >= 6 ? 20 : 17}
                          color={Colors.primary}
                        />
                        {vendors.length < 6 && (
                          <Text style={styles.vendorMultiSelectEntryText}>
                            {t('vendor_multi_select')}
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>

                  {filteredVendors.length > 0 ? (
                    // UX-12: yatay sanallaştırılmış liste; yüzlerce satıcı ve logo
                    // tek seferde çizilmez.
                    <FlatList
                      horizontal
                      data={filteredVendors}
                      keyExtractor={(v) => String(v.id)}
                      extraData={vendorTileExtraData}
                      initialNumToRender={12}
                      maxToRenderPerBatch={12}
                      windowSize={5}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.vendorCarousel}
                      style={styles.vendorCarouselView}
                      renderItem={({ item: v }) => {
                        const tileColor = getVendorTileColor(v.name);
                        const hasLogo = isLocalImageUri(v.logo_uri);
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
                      }}
                    />
                  ) : (
                    <View style={styles.vendorNoResults}>
                      <MaterialCommunityIcons name="magnify-close" size={24} color={Colors.textMuted} />
                      <Text style={[styles.emptyText, { marginTop: Spacing.xs }]}>{t('vendor_no_results')}</Text>
                    </View>
                  )}

                  <View style={styles.vendorHintRow}>
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
            {/* İki araç kapısı tek bölüm: bölücüler bölüm hattıyla hizalı. */}
            <SettingsSection style={styles.toolsSection}>
              <SettingsNavigationRow
                testID="manage-product-matching"
                title={t('product_match_entry_title')}
                description={t('product_match_entry_hint')}
                icon="tag-multiple-outline"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/product-matching');
                }}
                accessibilityLabel={t('product_match_entry_title')}
                accessibilityHint={t('product_match_entry_hint')}
              />
              {/* Yerel, onaylı paylaşılan teknik hata raporu (ADR-016) */}
              <SettingsNavigationRow
                testID="manage-error-journal"
                title={t('error_journal_entry_title')}
                description={t('error_journal_entry_hint')}
                icon="bug-outline"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/error-journal');
                }}
                accessibilityLabel={t('error_journal_entry_title')}
                accessibilityHint={t('error_journal_entry_hint')}
                last
              />
            </SettingsSection>
          </Animated.View>

          {/* Backup */}
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <BackupSection />
          </Animated.View>

          {/* Sıfırlama en altta: kaçış yolu (yedek) hemen üstünde kalsın. */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <DataResetSection />
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
    fontSize: FontSize.xl,
  },
  toolsSection: { paddingVertical: Spacing.sm },
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
  vendorToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  vendorSelectIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.inputBorder,
  },
  vendorMultiSelectEntry: {
    minHeight: 36,
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
  // Seçim paneli üst/alt çizgiler yerine tek parça dolgulu yüzey.
  vendorSelectionPanel: {
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
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
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.inputBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
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
  // Bölümün alt notu: ayrı çizgiyle bölünmüş bir şerit değil, kartın son
  // satırı gibi sol hizalı kısa bir açıklama.
  vendorHintRow: { marginTop: Spacing.sm },
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
