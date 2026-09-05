// S.P.A.R.K. — Kalıcı ürün kimliklerini kullanıcı denetiminde düzenleme
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import BottomSheetModal from '../src/components/BottomSheetModal';
import ConfirmModal from '../src/components/ConfirmModal';
import { SparkToast } from '../src/components/SparkToast';
import {
  ProductIdentityDao,
  type CanonicalProductSummary,
  type ProductAliasSummary,
} from '../src/db/productIdentityDao';
import { useLanguage } from '../src/i18n/LanguageContext';
import { BorderRadius, ScreenPadding, Spacing } from '../src/theme/spacing';
import {
  createSusevarStyles,
  susevarButtonPressed,
  susevarButtonRow,
} from '../src/theme/susevar';
import { useAppTheme, useThemePalette } from '../src/theme/themeStore';
import type { ThemePalette } from '../src/theme/colors';
import { FontFamily, Typography } from '../src/theme/typography';
import { formatDate } from '../src/utils/dateUtils';
import type { MeasurementUnit } from '../src/utils/measurementUnit';
import {
  buildProductMatchCandidates,
  filterAndSortProductMatches,
  groupProductsByActivity,
  type ProductMatchCandidate,
  type ProductMatchSort,
  type ProductMatchTimeFilter,
  type ProductMatchUnitFilter,
} from '../src/utils/productMatchDiscovery';
import * as GeminiService from '../src/services/geminiService';

type ProductMatchViewMode = 'review' | 'all';

type ProductListEntry =
  | { key: string; kind: 'candidate'; candidate: ProductMatchCandidate<CanonicalProductSummary> }
  | { key: string; kind: 'product'; product: CanonicalProductSummary };

interface ProductListSection {
  key: string;
  titleKey: string | null;
  data: ProductListEntry[];
}

const UNIT_FILTER_OPTIONS: Array<{
  value: ProductMatchUnitFilter;
  labelKey: string;
}> = [
  { value: 'all', labelKey: 'product_match_unit_all' },
  { value: 'piece', labelKey: 'measurement_unit_piece' },
  { value: 'kg', labelKey: 'measurement_unit_kg' },
  { value: 'l', labelKey: 'measurement_unit_l' },
];

const DATE_FILTER_OPTIONS: Array<{
  value: ProductMatchTimeFilter;
  labelKey: string;
}> = [
  { value: 'all', labelKey: 'product_match_date_all' },
  { value: '30', labelKey: 'product_match_date_30_days' },
  { value: '90', labelKey: 'product_match_date_90_days' },
  { value: '365', labelKey: 'product_match_date_365_days' },
  { value: 'older', labelKey: 'product_match_date_older' },
  { value: 'none', labelKey: 'product_match_date_no_history' },
];

const SORT_OPTIONS: Array<{
  value: ProductMatchSort;
  labelKey: string;
}> = [
  { value: 'recent', labelKey: 'product_match_sort_recent' },
  { value: 'frequent', labelKey: 'product_match_sort_most_records' },
  { value: 'name', labelKey: 'product_match_sort_alphabetical' },
];

type MatchSuggestion = {
  sameProduct: boolean;
  confidence: number;
  canonicalName: string | null;
  reason: string | null;
};

type SuggestProductMatch = (
  left: {
    name: string;
    measurementUnit: MeasurementUnit;
    canonicalName?: string | null;
    brand?: string | null;
    variant?: string | null;
    packageDescriptor?: string | null;
  },
  right: {
    name: string;
    measurementUnit: MeasurementUnit;
    canonicalName?: string | null;
    brand?: string | null;
    variant?: string | null;
    packageDescriptor?: string | null;
  },
  signal?: AbortSignal,
) => Promise<MatchSuggestion>;

const EMPTY_ALIASES: ProductAliasSummary[] = [];

export default function ProductMatchingScreen() {
  const router = useRouter();
  const scheme = useAppTheme();
  const theme = useThemePalette();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const susevar = useMemo(() => createSusevarStyles(theme), [theme]);
  const { t } = useLanguage();

  const [products, setProducts] = useState<CanonicalProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ProductMatchViewMode>('review');
  const [unitFilter, setUnitFilter] = useState<ProductMatchUnitFilter>('all');
  const [dateFilter, setDateFilter] = useState<ProductMatchTimeFilter>('all');
  const [sort, setSort] = useState<ProductMatchSort>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [preferredTargetId, setPreferredTargetId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [aliasesByProduct, setAliasesByProduct] = useState<
    Record<number, ProductAliasSummary[]>
  >({});
  const [loadingAliasIds, setLoadingAliasIds] = useState<Set<number>>(new Set());
  const [mergePromptOpen, setMergePromptOpen] = useState(false);
  const [splitTarget, setSplitTarget] = useState<ProductAliasSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<CanonicalProductSummary | null>(null);
  const [renameText, setRenameText] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<MatchSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const suggestionAbortRef = useRef<AbortController | null>(null);

  const selectedProducts = useMemo(
    () => selectedIds
      .map(id => products.find(product => product.id === id))
      .filter((product): product is CanonicalProductSummary => product != null),
    [products, selectedIds],
  );

  const preferredTarget = selectedProducts.find(product => product.id === preferredTargetId) ?? null;
  const sourceProduct = selectedProducts.find(product => product.id !== preferredTargetId) ?? null;
  const canMerge = selectedProducts.length === 2 && preferredTarget !== null && !busy;

  const reviewCandidates = useMemo(
    () => buildProductMatchCandidates(products, 60),
    [products],
  );

  const searchMatchedIds = useMemo(() => new Set(
    filterAndSortProductMatches(products, {
      search,
      unit: 'all',
      time: 'all',
      sort: 'name',
    }).map(product => product.id),
  ), [products, search]);

  const visibleReviewCandidates = useMemo(() => {
    const anchorId = selectedProducts[0]?.id ?? null;
    return reviewCandidates.filter(candidate => {
      if (search.trim() && (
        !searchMatchedIds.has(candidate.left.id)
        && !searchMatchedIds.has(candidate.right.id)
      )) return false;
      return anchorId == null
        || candidate.left.id === anchorId
        || candidate.right.id === anchorId;
    });
  }, [reviewCandidates, search, searchMatchedIds, selectedProducts]);

  const visibleProducts = useMemo(() => {
    const anchor = selectedProducts.length === 1 ? selectedProducts[0] : null;
    return filterAndSortProductMatches(products, {
      search,
      unit: anchor ? 'all' : unitFilter,
      time: dateFilter,
      sort,
      anchorUnit: anchor?.measurement_unit,
    }).filter(product => product.id !== anchor?.id);
  }, [dateFilter, products, search, selectedProducts, sort, unitFilter]);

  const listSections = useMemo<ProductListSection[]>(() => {
    if (viewMode === 'review') {
      return visibleReviewCandidates.length === 0 ? [] : [{
        key: 'review',
        titleKey: null,
        data: visibleReviewCandidates.map(candidate => ({
          key: `candidate:${Math.min(candidate.left.id, candidate.right.id)}:${Math.max(candidate.left.id, candidate.right.id)}`,
          kind: 'candidate' as const,
          candidate,
        })),
      }];
    }
    const titleKeys = {
      recent30: 'product_match_time_recent_30',
      recent90: 'product_match_time_recent_90',
      recent365: 'product_match_time_recent_365',
      older: 'product_match_time_older',
      unknown: 'product_match_time_no_history',
    } as const;
    return groupProductsByActivity(visibleProducts).map(section => ({
      key: section.key,
      titleKey: titleKeys[section.key],
      data: section.data.map(product => ({
        key: `product:${product.id}`,
        kind: 'product' as const,
        product,
      })),
    }));
  }, [viewMode, visibleProducts, visibleReviewCandidates]);

  const activeFilterCount = (
    (unitFilter === 'all' ? 0 : 1)
    + (dateFilter === 'all' ? 0 : 1)
    + (sort === 'recent' ? 0 : 1)
  );
  const selectionLockedUnit = selectedProducts.length === 1
    ? selectedProducts[0].measurement_unit
    : null;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const summaries = await ProductIdentityDao.getProductSummaries();
      setProducts(summaries);
    } catch (error) {
      if (__DEV__) console.warn('[ProductMatching] load failed', error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    suggestionAbortRef.current?.abort();
    suggestionAbortRef.current = null;
    setSuggestion(null);
    setSuggesting(false);
  }, [selectedIds]);

  useEffect(() => () => suggestionAbortRef.current?.abort(), []);

  const unitLabel = useCallback((unit: MeasurementUnit) => {
    if (unit === 'kg') return t('measurement_unit_kg');
    if (unit === 'l') return t('measurement_unit_l');
    return t('measurement_unit_piece');
  }, [t]);

  const selectProduct = useCallback((product: CanonicalProductSummary) => {
    if (busy) return;
    if (selectedIds.includes(product.id)) {
      const next = selectedIds.filter(id => id !== product.id);
      setSelectedIds(next);
      setPreferredTargetId(next[0] ?? null);
      return;
    }
    if (selectedProducts.length >= 2) {
      SparkToast.show(t('product_match_selection_full'), 'info');
      return;
    }
    if (
      selectedProducts[0]
      && selectedProducts[0].measurement_unit !== product.measurement_unit
    ) {
      SparkToast.show(t('product_match_unit_mismatch'), 'warning');
      return;
    }
    Haptics.selectionAsync();
    setSelectedIds(current => [...current, product.id]);
    setPreferredTargetId(current => current ?? product.id);
  }, [busy, selectedIds, selectedProducts, t]);

  const reviewCandidate = useCallback((
    candidate: ProductMatchCandidate<CanonicalProductSummary>,
  ) => {
    if (busy) return;
    Haptics.selectionAsync();
    setSelectedIds([candidate.left.id, candidate.right.id]);
    setPreferredTargetId(candidate.left.id);
  }, [busy]);

  const clearSelection = useCallback(() => {
    if (busy) return;
    setSelectedIds([]);
    setPreferredTargetId(null);
  }, [busy]);

  const closeMergeReview = useCallback(() => {
    if (busy) return;
    const keptId = preferredTargetId ?? selectedIds[0] ?? null;
    setSelectedIds(keptId == null ? [] : [keptId]);
    setPreferredTargetId(keptId);
    setViewMode('all');
  }, [busy, preferredTargetId, selectedIds]);

  const clearFilters = useCallback(() => {
    setUnitFilter('all');
    setDateFilter('all');
    setSort('recent');
  }, []);

  const toggleAliases = useCallback(async (productId: number) => {
    if (expandedIds.has(productId)) {
      setExpandedIds(current => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
      return;
    }

    setExpandedIds(current => new Set(current).add(productId));
    if (aliasesByProduct[productId]) return;
    setLoadingAliasIds(current => new Set(current).add(productId));
    try {
      const aliases = await ProductIdentityDao.getAliases(productId);
      setAliasesByProduct(current => ({ ...current, [productId]: aliases }));
    } catch (error) {
      if (__DEV__) console.warn('[ProductMatching] aliases failed', error);
      SparkToast.show(t('product_match_aliases_failed'), 'error');
      setExpandedIds(current => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    } finally {
      setLoadingAliasIds(current => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    }
  }, [aliasesByProduct, expandedIds, t]);

  const mergeSelectedProducts = useCallback(async () => {
    if (!sourceProduct || !preferredTarget || busy) return;
    setMergePromptOpen(false);
    setBusy(true);
    try {
      await ProductIdentityDao.mergeProducts(sourceProduct.id, preferredTarget.id);
      setSelectedIds([]);
      setPreferredTargetId(null);
      setAliasesByProduct({});
      setExpandedIds(new Set());
      await loadProducts();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('product_match_merge_success'), 'success');
    } catch (error) {
      if (__DEV__) console.warn('[ProductMatching] merge failed', error);
      SparkToast.show(t('product_match_merge_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, loadProducts, preferredTarget, sourceProduct, t]);

  const splitSelectedAlias = useCallback(async () => {
    if (!splitTarget || busy) return;
    const productId = splitTarget.canonical_product_id;
    setSplitTarget(null);
    setBusy(true);
    try {
      await ProductIdentityDao.splitAlias(splitTarget.id);
      const aliases = await ProductIdentityDao.getAliases(productId);
      setAliasesByProduct(current => ({ ...current, [productId]: aliases }));
      await loadProducts();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('product_match_split_success'), 'success');
    } catch (error) {
      if (__DEV__) console.warn('[ProductMatching] split failed', error);
      SparkToast.show(t('product_match_split_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, loadProducts, splitTarget, t]);

  const saveRename = useCallback(async () => {
    const name = renameText.trim();
    if (!renameTarget || busy) return;
    if (!name) {
      SparkToast.show(t('product_match_rename_invalid'), 'warning');
      return;
    }
    setBusy(true);
    try {
      await ProductIdentityDao.renameProduct(renameTarget.id, name);
      setRenameTarget(null);
      setRenameText('');
      await loadProducts();
      SparkToast.show(t('product_match_rename_success'), 'success');
    } catch (error) {
      if (__DEV__) console.warn('[ProductMatching] rename failed', error);
      SparkToast.show(t('product_match_rename_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, loadProducts, renameTarget, renameText, t]);

  const askAi = useCallback(async () => {
    if (selectedProducts.length !== 2 || suggesting) return;
    suggestionAbortRef.current?.abort();
    const controller = new AbortController();
    suggestionAbortRef.current = controller;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const suggestProductMatch = (
        GeminiService as typeof GeminiService & { suggestProductMatch?: SuggestProductMatch }
      ).suggestProductMatch;
      if (!suggestProductMatch) {
        SparkToast.show(t('product_match_ai_unavailable'), 'info');
        return;
      }
      const [left, right] = selectedProducts;
      const result = await suggestProductMatch(
        {
          name: left.canonical_name,
          measurementUnit: left.measurement_unit,
          canonicalName: left.canonical_name,
          brand: left.brand,
          variant: left.variant,
          packageDescriptor: left.package_descriptor,
        },
        {
          name: right.canonical_name,
          measurementUnit: right.measurement_unit,
          canonicalName: right.canonical_name,
          brand: right.brand,
          variant: right.variant,
          packageDescriptor: right.package_descriptor,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setSuggestion(result);
    } catch (error) {
      if (!controller.signal.aborted) {
        if (__DEV__) console.warn('[ProductMatching] AI suggestion failed', error);
        SparkToast.show(t('product_match_ai_failed'), 'error');
      }
    } finally {
      if (suggestionAbortRef.current === controller) {
        suggestionAbortRef.current = null;
        setSuggesting(false);
      }
    }
  }, [selectedProducts, suggesting, t]);

  const aliasSourceLabel = useCallback((source: ProductAliasSummary['source']) => {
    if (source === 'ai') return t('product_match_alias_source_ai');
    if (source === 'user') return t('product_match_alias_source_user');
    return t('product_match_alias_source_deterministic');
  }, [t]);

  const renderProduct = (product: CanonicalProductSummary) => {
    const selected = selectedIds.includes(product.id);
    const expanded = expandedIds.has(product.id);
    const aliases = aliasesByProduct[product.id] ?? EMPTY_ALIASES;
    const aliasesLoading = loadingAliasIds.has(product.id);
    return (
      <View
        key={product.id}
        style={[styles.productCard, selected && styles.productCardSelected]}
      >
        <Pressable
          testID={`product-select-${product.id}`}
          onPress={() => selectProduct(product)}
          style={({ pressed }) => [styles.productMain, pressed && styles.pressed]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected, disabled: busy }}
          accessibilityLabel={t('product_match_select_accessibility', {
            name: product.canonical_name,
          })}
        >
          <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
            {selected ? (
              <MaterialCommunityIcons name="check" size={16} color={theme.onPrimary} />
            ) : null}
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>{product.canonical_name}</Text>
            <View style={styles.metadataRow}>
              <Text style={styles.unitPill}>{unitLabel(product.measurement_unit)}</Text>
              <Text style={styles.metadataText}>
                {t('product_match_observation_count', { count: product.observation_count })}
              </Text>
              {product.latest_date ? (
                <Text style={styles.metadataText}>
                  {t('product_match_last_seen', { date: formatDate(product.latest_date, t) })}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        <View style={styles.productActions}>
          <Pressable
            testID={`toggle-aliases-${product.id}`}
            onPress={() => void toggleAliases(product.id)}
            style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={t('product_match_aliases_accessibility', {
              name: product.canonical_name,
            })}
          >
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.primary}
            />
            <Text style={styles.smallActionText}>
              {t('product_match_alias_count', { count: product.alias_count })}
            </Text>
          </Pressable>
          <Pressable
            testID={`rename-product-${product.id}`}
            onPress={() => {
              setRenameTarget(product);
              setRenameText(product.canonical_name);
            }}
            style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('product_match_rename_accessibility', {
              name: product.canonical_name,
            })}
          >
            <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>

        {expanded ? (
          <View style={styles.aliasPanel}>
            {aliasesLoading ? (
              <ActivityIndicator color={theme.primary} style={styles.aliasLoader} />
            ) : aliases.length === 0 ? (
              <Text style={styles.emptyInline}>{t('product_match_no_aliases')}</Text>
            ) : aliases.map(alias => (
              <View key={alias.id} style={styles.aliasRow}>
                <View style={styles.aliasInfo}>
                  <Text style={styles.aliasName} numberOfLines={2}>{alias.normalized_alias}</Text>
                  <Text style={styles.aliasSource}>{aliasSourceLabel(alias.source)}</Text>
                </View>
                {product.alias_count > 1 ? (
                  <Pressable
                    testID={`split-alias-${alias.id}`}
                    onPress={() => setSplitTarget(alias)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.splitButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('product_match_split_accessibility', {
                      alias: alias.normalized_alias,
                    })}
                  >
                    <MaterialCommunityIcons name="source-branch" size={16} color={theme.primary} />
                    <Text style={styles.splitButtonText}>{t('product_match_split')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderCandidateSummary = (product: CanonicalProductSummary) => (
    <View style={styles.candidateProduct}>
      <View style={styles.candidateProductIcon}>
        <MaterialCommunityIcons name="tag-outline" size={18} color={theme.primary} />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.candidateProductName} numberOfLines={2}>
          {product.canonical_name}
        </Text>
        <View style={styles.metadataRow}>
          <Text style={styles.unitPill}>{unitLabel(product.measurement_unit)}</Text>
          <Text style={styles.metadataText}>
            {t('product_match_observation_count', { count: product.observation_count })}
          </Text>
          {product.latest_date ? (
            <Text style={styles.metadataText}>
              {t('product_match_last_seen', { date: formatDate(product.latest_date, t) })}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  const renderCandidate = (
    candidate: ProductMatchCandidate<CanonicalProductSummary>,
  ) => (
    <Pressable
      testID={`product-review-pair-${Math.min(candidate.left.id, candidate.right.id)}-${Math.max(candidate.left.id, candidate.right.id)}`}
      onPress={() => reviewCandidate(candidate)}
      disabled={busy}
      style={({ pressed }) => [
        styles.candidateCard,
        pressed && styles.pressed,
        busy && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      accessibilityLabel={t('product_match_review_pair_accessibility', {
        left: candidate.left.canonical_name,
        right: candidate.right.canonical_name,
      })}
    >
      <View style={styles.candidateHeader}>
        <View style={styles.candidateBadge}>
          <MaterialCommunityIcons name="link-variant" size={16} color={theme.primary} />
          <Text style={styles.candidateBadgeText}>{t('product_match_possible_match')}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textMuted} />
      </View>
      {renderCandidateSummary(candidate.left)}
      <View style={styles.candidateConnector}>
        <View style={styles.candidateConnectorLine} />
        <MaterialCommunityIcons name="swap-vertical" size={18} color={theme.primary} />
        <View style={styles.candidateConnectorLine} />
      </View>
      {renderCandidateSummary(candidate.right)}
      <Text style={styles.candidateReason}>{t('product_match_possible_match_reason')}</Text>
      <View style={styles.candidateActionRow}>
        <Text style={styles.candidateActionText}>{t('product_match_review_action')}</Text>
        <MaterialCommunityIcons name="arrow-right" size={17} color={theme.primary} />
      </View>
    </Pressable>
  );

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('settings_back')}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
            {t('product_match_title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <SectionList<ProductListEntry, ProductListSection>
          testID="product-matching-list"
          sections={listSections}
          keyExtractor={item => item.key}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={false}
          extraData={{
            selectedIds,
            expandedIds,
            aliasesByProduct,
            loadingAliasIds,
            busy,
          }}
          contentContainerStyle={styles.content}
          ListHeaderComponent={(
            <>
              <View style={styles.introCard}>
                <View style={styles.introIcon}>
                  <MaterialCommunityIcons name="tag-multiple-outline" size={24} color={theme.primary} />
                </View>
                <View style={styles.introCopy}>
                  <Text style={styles.introTitle}>{t('product_match_intro')}</Text>
                  <Text style={styles.introText}>{t('product_match_preservation_note')}</Text>
                </View>
              </View>

              <View style={styles.viewTabs} accessibilityRole="tablist">
                {(['review', 'all'] as ProductMatchViewMode[]).map(mode => {
                  const active = viewMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      testID={`product-view-${mode}`}
                      onPress={() => setViewMode(mode)}
                      style={({ pressed }) => [
                        styles.viewTab,
                        active && styles.viewTabActive,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.viewTabText, active && styles.viewTabTextActive]}>
                        {t(mode === 'review'
                          ? 'product_match_view_review'
                          : 'product_match_view_all')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
                <TextInput
                  testID="product-search"
                  value={search}
                  onChangeText={setSearch}
                  placeholder={selectedProducts.length === 1
                    ? t('product_match_search_compare_placeholder', {
                        name: selectedProducts[0].canonical_name,
                      })
                    : t('product_match_search_placeholder')}
                  placeholderTextColor={theme.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel={selectedProducts.length === 1
                    ? t('product_match_search_compare_placeholder', {
                        name: selectedProducts[0].canonical_name,
                      })
                    : t('product_match_search_placeholder')}
                />
                {search ? (
                  <Pressable
                    onPress={() => setSearch('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('product_match_clear_search')}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color={theme.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              {selectedProducts.length === 1 ? (
                <View style={styles.selectedBanner} testID="product-selected-banner">
                  <View style={styles.selectedBannerIcon}>
                    <MaterialCommunityIcons name="check" size={18} color={theme.onPrimary} />
                  </View>
                  <View style={styles.selectedBannerCopy}>
                    <Text style={styles.selectedBannerTitle} numberOfLines={1}>
                      {t('product_match_selected_product_pinned', {
                        name: selectedProducts[0].canonical_name,
                      })}
                    </Text>
                    <Text style={styles.selectedBannerHint}>
                      {t('product_match_select_compatible_hint')}
                    </Text>
                  </View>
                  <Pressable
                    testID="product-clear-selection"
                    onPress={clearSelection}
                    hitSlop={8}
                    style={({ pressed }) => [styles.bannerClose, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t('product_match_clear_selection')}
                  >
                    <MaterialCommunityIcons name="close" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ) : null}

              {viewMode === 'review' ? (
                <View style={styles.listIntro}>
                  <View style={styles.selectionHeader}>
                    <Text style={styles.sectionTitle}>{t('product_match_review_title')}</Text>
                    <Text style={styles.resultCount}>
                      {t('product_match_pair_count', {
                        count: visibleReviewCandidates.length,
                      })}
                    </Text>
                  </View>
                  <Text style={styles.sectionHint}>{t('product_match_review_hint')}</Text>
                </View>
              ) : (
                <View style={styles.listIntro}>
                  <View style={styles.allProductsToolbar}>
                    <View>
                      <Text style={styles.sectionTitle}>{t('product_match_products_title')}</Text>
                      <Text style={styles.resultCount}>
                        {t('product_match_result_count', { count: visibleProducts.length })}
                      </Text>
                    </View>
                    <Pressable
                      testID="product-filter-button"
                      onPress={() => setFiltersOpen(true)}
                      style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t('product_match_filters')}
                    >
                      <MaterialCommunityIcons name="tune-variant" size={18} color={theme.primary} />
                      <Text style={styles.filterButtonText}>{t('product_match_filters')}</Text>
                      {activeFilterCount > 0 ? (
                        <Text style={styles.filterCount}>{activeFilterCount}</Text>
                      ) : null}
                    </Pressable>
                  </View>
                  <View style={styles.toolbarHintRow}>
                    <Text style={styles.sectionHint}>
                      {selectedProducts.length === 1
                        ? t('product_match_select_compatible_hint')
                        : t('product_match_select_hint')}
                    </Text>
                    {activeFilterCount > 0 ? (
                      <Pressable
                        testID="product-clear-filters"
                        onPress={clearFilters}
                        accessibilityRole="button"
                      >
                        <Text style={styles.clearFiltersText}>
                          {t('product_match_clear_filters')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )}
            </>
          )}
          renderSectionHeader={({ section }) => section.titleKey ? (
            <View style={styles.timeSectionHeader}>
              <Text style={styles.timeSectionTitle}>{t(section.titleKey)}</Text>
              <View style={styles.timeSectionRule} />
            </View>
          ) : null}
          renderItem={({ item }) => (
            <View style={styles.listItemGap}>
              {item.kind === 'candidate'
                ? renderCandidate(item.candidate)
                : renderProduct(item.product)}
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.stateCard}>
              {loading ? (
                <>
                  <ActivityIndicator color={theme.primary} />
                  <Text style={styles.stateText}>{t('product_match_loading')}</Text>
                </>
              ) : loadFailed ? (
                <>
                  <MaterialCommunityIcons name="alert-circle-outline" size={30} color={theme.warning} />
                  <Text style={styles.stateText}>{t('product_match_load_failed')}</Text>
                  <Pressable
                    testID="product-retry"
                    onPress={() => void loadProducts()}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>{t('product_match_retry')}</Text>
                  </Pressable>
                </>
              ) : products.length === 0 ? (
                <>
                  <MaterialCommunityIcons name="tag-search-outline" size={34} color={theme.textMuted} />
                  <Text style={styles.stateTitle}>{t('product_match_empty_title')}</Text>
                  <Text style={styles.stateText}>{t('product_match_empty_hint')}</Text>
                </>
              ) : viewMode === 'review' ? (
                <>
                  <MaterialCommunityIcons name="check-decagram-outline" size={34} color={theme.success} />
                  <Text style={styles.stateTitle}>{t('product_match_review_no_title')}</Text>
                  <Text style={styles.stateText}>{t('product_match_review_no_hint')}</Text>
                  <Pressable
                    testID="product-open-all"
                    onPress={() => setViewMode('all')}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>{t('product_match_view_all')}</Text>
                  </Pressable>
                </>
              ) : selectedProducts.length === 1 ? (
                <>
                  <MaterialCommunityIcons name="link-off" size={34} color={theme.textMuted} />
                  <Text style={styles.stateTitle}>{t('product_match_no_compatible_title')}</Text>
                  <Text style={styles.stateText}>{t('product_match_no_compatible_hint')}</Text>
                  {search.trim() || activeFilterCount > 0 ? (
                    <Pressable
                      testID="product-empty-compatible-clear-filters"
                      onPress={() => {
                        setSearch('');
                        clearFilters();
                      }}
                      style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.retryText}>{t('product_match_clear_filters')}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    testID="product-empty-clear-selection"
                    onPress={clearSelection}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>{t('product_match_clear_selection')}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="filter-off-outline" size={34} color={theme.textMuted} />
                  <Text style={styles.stateTitle}>{t('product_match_filtered_empty_title')}</Text>
                  <Text style={styles.stateText}>{t('product_match_filtered_empty_hint')}</Text>
                  <Pressable
                    testID="product-empty-clear-filters"
                    onPress={() => {
                      setSearch('');
                      clearFilters();
                    }}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>{t('product_match_clear_filters')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        />
      </SafeAreaView>

      <ConfirmModal
        visible={mergePromptOpen}
        title={t('product_match_merge_confirm_title')}
        message={sourceProduct && preferredTarget
          ? t('product_match_merge_confirm_message', {
              source: sourceProduct.canonical_name,
              target: preferredTarget.canonical_name,
            })
          : ''}
        confirmLabel={t('product_match_merge_confirm_cta')}
        cancelLabel={t('cancel')}
        icon="source-merge"
        onCancel={() => setMergePromptOpen(false)}
        onConfirm={() => void mergeSelectedProducts()}
      />

      <ConfirmModal
        visible={splitTarget !== null}
        title={t('product_match_split_confirm_title')}
        message={splitTarget
          ? t('product_match_split_confirm_message', { alias: splitTarget.normalized_alias })
          : ''}
        confirmLabel={t('product_match_split_confirm_cta')}
        cancelLabel={t('cancel')}
        icon="source-branch"
        onCancel={() => setSplitTarget(null)}
        onConfirm={() => void splitSelectedAlias()}
      />

      <BottomSheetModal
        visible={selectedProducts.length === 2}
        onClose={closeMergeReview}
        showHandle
        backdropColor={scheme === 'dark' ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)'}
        sheetStyle={styles.mergeSheet}
      >
        <ScrollView
          style={styles.mergeSheetScroll}
          contentContainerStyle={styles.mergePanel}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.mergePanelTitle}>{t('product_match_keep_name_title')}</Text>
          <Text style={styles.mergePanelHint}>{t('product_match_keep_name_hint')}</Text>
          <View style={styles.keepChoices}>
            {selectedProducts.map(product => {
              const preferred = preferredTargetId === product.id;
              return (
                <Pressable
                  key={product.id}
                  testID={`keep-product-${product.id}`}
                  onPress={() => setPreferredTargetId(product.id)}
                  style={({ pressed }) => [
                    styles.keepChoice,
                    preferred && styles.keepChoiceSelected,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: preferred }}
                >
                  <MaterialCommunityIcons
                    name={preferred ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={preferred ? theme.primary : theme.textMuted}
                  />
                  <Text style={[styles.keepChoiceText, preferred && styles.keepChoiceTextSelected]}>
                    {product.canonical_name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            testID="product-ai-button"
            onPress={() => void askAi()}
            disabled={suggesting || busy}
            style={({ pressed }) => [
              styles.aiButton,
              pressed && styles.pressed,
              (suggesting || busy) && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: suggesting || busy }}
          >
            {suggesting ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <MaterialCommunityIcons name="robot-outline" size={18} color={theme.primary} />
            )}
            <Text style={styles.aiButtonText}>
              {suggesting ? t('product_match_ai_loading') : t('product_match_ai_cta')}
            </Text>
          </Pressable>

          {suggestion ? (
            <View style={styles.suggestionCard} testID="product-ai-result">
              <MaterialCommunityIcons
                name={suggestion.sameProduct ? 'check-decagram-outline' : 'alert-decagram-outline'}
                size={22}
                color={suggestion.sameProduct ? theme.success : theme.warning}
              />
              <View style={styles.suggestionCopy}>
                <Text style={styles.suggestionTitle}>
                  {t(suggestion.sameProduct
                    ? 'product_match_ai_same'
                    : 'product_match_ai_different')}
                </Text>
                <Text style={styles.suggestionText}>
                  {t('product_match_ai_confidence', {
                    confidence: Math.round(suggestion.confidence * 100),
                  })}
                </Text>
                {suggestion.canonicalName ? (
                  <Text style={styles.suggestionText}>{suggestion.canonicalName}</Text>
                ) : null}
                {suggestion.reason ? (
                  <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                ) : null}
                <Text style={styles.suggestionAdvisory}>{t('product_match_ai_advisory')}</Text>
              </View>
            </View>
          ) : null}

          <Pressable
            testID="product-merge-button"
            onPress={() => setMergePromptOpen(true)}
            disabled={!canMerge}
            style={({ pressed }) => [
              susevar.button,
              susevarButtonRow,
              pressed && susevarButtonPressed,
              !canMerge && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canMerge }}
          >
            {busy ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <MaterialCommunityIcons name="source-merge" size={20} color={theme.onPrimary} />
            )}
            <Text style={susevar.text}>{t('product_match_merge_cta')}</Text>
          </Pressable>
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        showHandle
        backdropColor={scheme === 'dark' ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)'}
        sheetStyle={styles.filterSheet}
      >
        <View style={styles.filterSheetHeader}>
          <Text style={styles.renameTitle} accessibilityRole="header">
            {t('product_match_filters')}
          </Text>
          {activeFilterCount > 0 ? (
            <Pressable
              testID="product-filter-sheet-clear"
              onPress={clearFilters}
              accessibilityRole="button"
            >
              <Text style={styles.clearFiltersText}>{t('product_match_clear_filters')}</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.filterGroupTitle}>{t('product_match_unit_filter')}</Text>
          <View style={styles.filterOptions}>
            {UNIT_FILTER_OPTIONS.map(option => {
              const selected = (selectionLockedUnit ?? unitFilter) === option.value;
              const disabled = selectionLockedUnit !== null;
              return (
                <Pressable
                  key={option.value}
                  testID={`product-unit-filter-${option.value}`}
                  onPress={() => setUnitFilter(option.value)}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.filterOption,
                    selected && styles.filterOptionSelected,
                    pressed && styles.pressed,
                    disabled && styles.disabled,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                >
                  <MaterialCommunityIcons
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={selected ? theme.primary : theme.textMuted}
                  />
                  <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterGroupTitle}>{t('product_match_date_filter')}</Text>
          <View style={styles.filterOptions}>
            {DATE_FILTER_OPTIONS.map(option => {
              const selected = dateFilter === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`product-date-filter-${option.value}`}
                  onPress={() => setDateFilter(option.value)}
                  style={({ pressed }) => [
                    styles.filterOption,
                    selected && styles.filterOptionSelected,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <MaterialCommunityIcons
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={selected ? theme.primary : theme.textMuted}
                  />
                  <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterGroupTitle}>{t('product_match_sort')}</Text>
          <View style={styles.filterOptions}>
            {SORT_OPTIONS.map(option => {
              const selected = sort === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`product-sort-${option.value}`}
                  onPress={() => setSort(option.value)}
                  style={({ pressed }) => [
                    styles.filterOption,
                    selected && styles.filterOptionSelected,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <MaterialCommunityIcons
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={selected ? theme.primary : theme.textMuted}
                  />
                  <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Pressable
          testID="product-filter-close"
          onPress={() => setFiltersOpen(false)}
          style={({ pressed }) => [susevar.button, pressed && susevarButtonPressed]}
          accessibilityRole="button"
        >
          <Text style={susevar.text}>{t('product_match_filter_close')}</Text>
        </Pressable>
      </BottomSheetModal>

      <BottomSheetModal
        visible={renameTarget !== null}
        onClose={() => {
          if (!busy) {
            setRenameTarget(null);
            setRenameText('');
          }
        }}
        showHandle
        backdropColor={scheme === 'dark' ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.45)'}
        sheetStyle={styles.renameSheet}
      >
        <Text style={styles.renameTitle} accessibilityRole="header">
          {t('product_match_rename_title')}
        </Text>
        <Text style={styles.renameHint}>{t('product_match_rename_hint')}</Text>
        <TextInput
          testID="product-rename-input"
          value={renameText}
          onChangeText={setRenameText}
          placeholder={t('product_match_rename_placeholder')}
          placeholderTextColor={theme.textMuted}
          style={styles.renameInput}
          autoFocus
          maxLength={500}
          returnKeyType="done"
          onSubmitEditing={() => void saveRename()}
        />
        <Pressable
          testID="product-rename-save"
          onPress={() => void saveRename()}
          disabled={busy}
          style={({ pressed }) => [
            susevar.button,
            pressed && susevarButtonPressed,
            busy && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={susevar.text}>{t('save')}</Text>
        </Pressable>
      </BottomSheetModal>
    </>
  );
}

const getStyles = (theme: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.headlineMedium,
    color: theme.textPrimary,
    fontFamily: FontFamily.extraBold,
    flex: 1,
  },
  headerSpacer: { width: 40 },
  content: {
    flexGrow: 1,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: Spacing.xxxl,
  },
  introCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: theme.cardSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: { flex: 1, gap: Spacing.xs },
  introTitle: { ...Typography.bodyLarge, color: theme.textPrimary, fontFamily: FontFamily.bold },
  introText: { ...Typography.bodySmall, color: theme.textSecondary, lineHeight: 19 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: theme.textPrimary,
    paddingVertical: Spacing.md,
  },
  viewTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: BorderRadius.round,
    backgroundColor: theme.surfaceLight,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: Spacing.md,
  },
  viewTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  viewTabActive: { backgroundColor: theme.primarySoft },
  viewTabText: {
    ...Typography.labelMedium,
    color: theme.textSecondary,
    fontFamily: FontFamily.medium,
  },
  viewTabTextActive: { color: theme.primary, fontFamily: FontFamily.bold },
  listIntro: { marginBottom: Spacing.sm },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...Typography.headlineSmall, color: theme.textPrimary, fontFamily: FontFamily.bold },
  selectionCount: {
    ...Typography.labelSmall,
    color: theme.primary,
    fontFamily: FontFamily.bold,
    backgroundColor: theme.primarySoft,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  resultCount: { ...Typography.labelSmall, color: theme.textMuted, marginTop: 2 },
  sectionHint: { ...Typography.bodySmall, color: theme.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    backgroundColor: theme.primarySoft,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  selectedBannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.primaryAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBannerCopy: { flex: 1, gap: 2 },
  selectedBannerTitle: {
    ...Typography.bodyMedium,
    color: theme.textPrimary,
    fontFamily: FontFamily.bold,
  },
  selectedBannerHint: { ...Typography.labelSmall, color: theme.textSecondary },
  bannerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceLight,
  },
  allProductsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  filterButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    backgroundColor: theme.primarySoft,
    paddingHorizontal: Spacing.md,
  },
  filterButtonText: { ...Typography.labelMedium, color: theme.primary, fontFamily: FontFamily.bold },
  filterCount: {
    ...Typography.labelSmall,
    minWidth: 20,
    textAlign: 'center',
    color: theme.onPrimary,
    backgroundColor: theme.primaryAction,
    borderRadius: BorderRadius.round,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  toolbarHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  clearFiltersText: { ...Typography.labelSmall, color: theme.primary, fontFamily: FontFamily.bold },
  timeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  timeSectionTitle: {
    ...Typography.labelMedium,
    color: theme.textSecondary,
    fontFamily: FontFamily.bold,
  },
  timeSectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
  listItemGap: { marginBottom: Spacing.md },
  mergePanel: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  mergeSheet: {
    backgroundColor: theme.cardSurface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.sm,
  },
  mergeSheetScroll: { maxHeight: 620 },
  mergePanelTitle: { ...Typography.bodyLarge, color: theme.textPrimary, fontFamily: FontFamily.bold },
  mergePanelHint: { ...Typography.bodySmall, color: theme.textSecondary, marginTop: -Spacing.sm },
  keepChoices: { gap: Spacing.sm },
  keepChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: Spacing.md,
  },
  keepChoiceSelected: { borderColor: theme.primary, backgroundColor: theme.primarySoft },
  keepChoiceText: { ...Typography.bodyMedium, color: theme.textSecondary, flex: 1 },
  keepChoiceTextSelected: { color: theme.textPrimary, fontFamily: FontFamily.bold },
  aiButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    borderRadius: BorderRadius.round,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: theme.primarySoft,
  },
  aiButtonText: { ...Typography.labelMedium, color: theme.primary, fontFamily: FontFamily.bold },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: theme.surfaceLight,
    padding: Spacing.md,
  },
  suggestionCopy: { flex: 1, gap: 2 },
  suggestionTitle: { ...Typography.bodyMedium, color: theme.textPrimary, fontFamily: FontFamily.bold },
  suggestionText: { ...Typography.bodySmall, color: theme.textSecondary },
  suggestionReason: { ...Typography.bodySmall, color: theme.textPrimary, marginTop: Spacing.xs },
  suggestionAdvisory: { ...Typography.labelSmall, color: theme.textMuted, marginTop: Spacing.xs },
  candidateCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    backgroundColor: theme.cardSurface,
    padding: Spacing.lg,
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  candidateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.round,
    backgroundColor: theme.primarySoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  candidateBadgeText: { ...Typography.labelSmall, color: theme.primary, fontFamily: FontFamily.bold },
  candidateProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: theme.surfaceLight,
    padding: Spacing.md,
  },
  candidateProductIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primarySoft,
  },
  candidateProductName: {
    ...Typography.bodyMedium,
    color: theme.textPrimary,
    fontFamily: FontFamily.bold,
  },
  candidateConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  candidateConnectorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
  candidateReason: {
    ...Typography.labelSmall,
    color: theme.textSecondary,
    lineHeight: 17,
    marginTop: Spacing.sm,
  },
  candidateActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: Spacing.sm,
  },
  candidateActionText: { ...Typography.labelMedium, color: theme.primary, fontFamily: FontFamily.bold },
  productList: { gap: Spacing.md },
  productCard: {
    backgroundColor: theme.cardSurface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  productCardSelected: { borderColor: theme.primary, backgroundColor: theme.primarySoft },
  productMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: { borderColor: theme.primaryAction, backgroundColor: theme.primaryAction },
  productInfo: { flex: 1, gap: Spacing.xs },
  productName: { ...Typography.bodyLarge, color: theme.textPrimary, fontFamily: FontFamily.bold },
  metadataRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs },
  unitPill: {
    ...Typography.labelSmall,
    color: theme.primary,
    backgroundColor: theme.primarySoft,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  metadataText: { ...Typography.labelSmall, color: theme.textMuted },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  smallAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallActionText: { ...Typography.labelMedium, color: theme.primary, fontFamily: FontFamily.medium },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceLight,
  },
  aliasPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    backgroundColor: theme.surfaceLight,
    paddingHorizontal: Spacing.lg,
  },
  aliasLoader: { marginVertical: Spacing.lg },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  aliasInfo: { flex: 1, gap: 2 },
  aliasName: { ...Typography.bodySmall, color: theme.textPrimary, fontFamily: FontFamily.medium },
  aliasSource: { ...Typography.labelSmall, color: theme.textMuted },
  splitButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  splitButtonText: { ...Typography.labelSmall, color: theme.primary, fontFamily: FontFamily.bold },
  emptyInline: { ...Typography.bodySmall, color: theme.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },
  stateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 180,
    backgroundColor: theme.cardSurface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: Spacing.xl,
  },
  stateTitle: { ...Typography.bodyLarge, color: theme.textPrimary, fontFamily: FontFamily.bold, textAlign: 'center' },
  stateText: { ...Typography.bodySmall, color: theme.textSecondary, textAlign: 'center' },
  retryButton: {
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryText: { ...Typography.labelMedium, color: theme.primary, fontFamily: FontFamily.bold },
  renameSheet: {
    backgroundColor: theme.cardSurface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  renameTitle: { ...Typography.headlineSmall, color: theme.textPrimary, fontFamily: FontFamily.bold },
  renameHint: { ...Typography.bodySmall, color: theme.textSecondary },
  renameInput: {
    ...Typography.bodyLarge,
    color: theme.textPrimary,
    backgroundColor: theme.inputBackground,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  filterSheet: {
    backgroundColor: theme.cardSurface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  filterScroll: { maxHeight: 520 },
  filterGroupTitle: {
    ...Typography.labelMedium,
    color: theme.textSecondary,
    fontFamily: FontFamily.bold,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterOptions: { gap: Spacing.xs, marginBottom: Spacing.md },
  filterOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterOptionSelected: { borderColor: theme.primary, backgroundColor: theme.primarySoft },
  filterOptionText: { ...Typography.bodyMedium, color: theme.textSecondary, flex: 1 },
  filterOptionTextSelected: { color: theme.textPrimary, fontFamily: FontFamily.bold },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
