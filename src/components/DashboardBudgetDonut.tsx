// S.P.A.R.K. — Dashboard budget utilization + interactive category drill-down
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import DonutChart from './DonutChart';
import { CategorySpending } from '../db/schema';
import { useLanguage } from '../i18n/LanguageContext';
import { Colors } from '../theme/colors';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily, Typography } from '../theme/typography';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { formatCurrency } from '../utils/formatCurrency';
import { getCurrencyLocale } from '../utils/currencyMeta';

interface DashboardBudgetDonutProps {
  categories: CategorySpending[];
  /** Dashboard başlığında gösterilen gerçek harcama toplamı. */
  totalSpent: number;
  /** Borç nakit akışı ve ek gelir dahil, BudgetCard ile ortak payda. */
  effectiveBudget: number;
  currency: string;
  /** Dönem değişince geçici kategori odağını sıfırlamak için kararlı anahtar. */
  periodKey: string;
}

function formatShare(value: number, currency: string, keepDecimal: boolean): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    minimumFractionDigits: 0,
    maximumFractionDigits: keepDecimal ? 1 : 0,
  }).format(safeValue);
}

export default function DashboardBudgetDonut({
  categories,
  totalSpent,
  effectiveBudget,
  currency,
  periodKey,
}: DashboardBudgetDonutProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = React.useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t, tc } = useLanguage();
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [categoryFocus, setCategoryFocus] = React.useState(false);

  const hasBudgetScale = effectiveBudget > 0;
  const hasCategories = categories.length > 0;
  const categoryTotal = React.useMemo(
    () => categories.reduce((sum, category) => sum + Math.max(0, category.total), 0),
    [categories],
  );
  const segments = React.useMemo(
    () => categories.map(category => ({
      value: Math.max(0, category.total),
      color: category.category_color,
      label: tc(category.category_name),
    })),
    [categories, tc],
  );

  React.useEffect(() => {
    setSelectedIndex(null);
    setCategoryFocus(false);
  }, [periodKey]);

  React.useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= categories.length) {
      setSelectedIndex(null);
    }
  }, [categories.length, selectedIndex]);

  const isBudgetOverview = hasBudgetScale && !categoryFocus;
  const rawBudgetUsage = hasBudgetScale ? (Math.max(0, totalSpent) / effectiveBudget) * 100 : 0;
  const budgetUsageLabel = formatShare(rawBudgetUsage, currency, false);
  const selectedCategory = selectedIndex === null ? null : categories[selectedIndex] ?? null;

  const selectCategory = React.useCallback((index: number) => {
    if (index < 0 || index >= categories.length) return;
    // Bütçe halkasındaki küçük renkli bölüme dokunmak kategori dağılımını
    // büyütür; seçimin hangi kategori olduğu aynı anda korunur.
    setCategoryFocus(true);
    setSelectedIndex(previous => previous === index && categoryFocus ? null : index);
  }, [categories.length, categoryFocus]);

  const moveSelection = React.useCallback((direction: -1 | 1) => {
    if (!hasCategories) return;
    setCategoryFocus(true);
    setSelectedIndex(previous => {
      if (previous === null) return direction > 0 ? 0 : categories.length - 1;
      return (previous + direction + categories.length) % categories.length;
    });
  }, [categories.length, hasCategories]);

  const handleCenterPress = React.useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex(null);
      return;
    }
    if (isBudgetOverview && hasCategories) {
      setCategoryFocus(true);
      return;
    }
    if (hasBudgetScale && categoryFocus) {
      setCategoryFocus(false);
      return;
    }
    if (hasCategories) setSelectedIndex(0);
  }, [categoryFocus, hasBudgetScale, hasCategories, isBudgetOverview, selectedIndex]);

  const centerA11yLabel = selectedIndex !== null
    ? t('donut_center_clear')
    : isBudgetOverview
      ? t('donut_open_categories')
      : hasBudgetScale
        ? t('donut_close_categories')
        : t('donut_select_first_category');

  const spendingShare = selectedCategory && totalSpent > 0
    ? (selectedCategory.total / totalSpent) * 100
    : 0;
  const budgetShare = selectedCategory && hasBudgetScale
    ? (selectedCategory.total / effectiveBudget) * 100
    : 0;
  const selectedShareText = selectedCategory
    ? hasBudgetScale
      ? t('donut_spending_budget_share', {
          spending: formatShare(spendingShare, currency, false),
          budget: formatShare(budgetShare, currency, true),
        })
      : t('donut_spending_share', {
          spending: formatShare(
            categoryTotal > 0 ? (selectedCategory.total / categoryTotal) * 100 : 0,
            currency,
            false,
          ),
        })
    : '';

  return (
    <View style={styles.container}>
      <DonutChart
        segments={segments}
        // Normal görünümde nötr kalan ray bütçenin harcanmayan bölümüdür.
        // Kategori odağında prop kaldırılır ve sevilen eski dağılım 360° açılır.
        totalValue={isBudgetOverview ? effectiveBudget : undefined}
        showTrackGlassEdge
        size={220}
        strokeWidth={26}
        selectedIndex={selectedIndex}
        onSelect={selectCategory}
        innerContent={(
          <Pressable
            testID="dashboard-donut-center"
            onPress={handleCenterPress}
            disabled={!hasCategories}
            style={({ pressed }) => [
              styles.center,
              pressed && styles.centerPressed,
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole={hasCategories ? 'button' : 'text'}
            accessibilityLabel={hasCategories
              ? centerA11yLabel
              : `%${budgetUsageLabel} ${t('donut_budget_used')}`}
          >
            {selectedIndex !== null ? (
              <MaterialCommunityIcons name="close" size={26} color={Colors.primary} />
            ) : isBudgetOverview ? (
              <>
                <Text
                  style={[
                    styles.usageValue,
                    rawBudgetUsage > 100 && { color: Colors.danger },
                  ]}
                >
                  %{budgetUsageLabel}
                </Text>
                <Text style={styles.usageLabel}>{t('donut_budget_used')}</Text>
                {hasCategories ? (
                  <View
                    testID="dashboard-donut-expand-affordance"
                    style={styles.expandBadge}
                    pointerEvents="none"
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <MaterialCommunityIcons
                      name="arrow-expand"
                      size={12}
                      color={Colors.onPrimary}
                    />
                  </View>
                ) : null}
              </>
            ) : hasBudgetScale ? (
              <MaterialCommunityIcons name="arrow-collapse" size={28} color={Colors.primary} />
            ) : (
              <MaterialCommunityIcons name="arrow-right" size={30} color={Colors.primary} />
            )}
          </Pressable>
        )}
      />

      {selectedCategory ? (
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          style={styles.selectionRow}
        >
          <Pressable
            testID="dashboard-donut-previous"
            onPress={() => moveSelection(-1)}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('donut_previous_category')}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textSecondary} />
          </Pressable>

          <View
            style={styles.selectionContent}
            accessible
            accessibilityLabel={`${tc(selectedCategory.category_name)}, ${formatCurrency(selectedCategory.total, currency)}, ${selectedShareText}`}
          >
            <Text
              style={[styles.categoryName, { color: selectedCategory.category_color }]}
              numberOfLines={1}
            >
              {tc(selectedCategory.category_name)}
            </Text>
            <Text style={styles.categoryAmount}>
              {formatCurrency(selectedCategory.total, currency)}
            </Text>
            <Text style={styles.shareText}>
              {selectedShareText}
            </Text>
          </View>

          <Pressable
            testID="dashboard-donut-next"
            onPress={() => moveSelection(1)}
            style={({ pressed }) => [styles.navButton, pressed && styles.navButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('donut_next_category')}
          >
            <MaterialCommunityIcons name="chevron-right" size={26} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  center: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorder,
  },
  centerPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.95 }],
  },
  usageValue: {
    ...Typography.titleMedium,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
    lineHeight: 22,
  },
  usageLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
  expandBadge: {
    position: 'absolute',
    right: -3,
    bottom: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryAction,
    borderWidth: 2,
    borderColor: Colors.surface,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.24,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectionRow: {
    width: '100%',
    minHeight: 92,
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  navButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  selectionContent: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  categoryName: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  categoryAmount: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginTop: Spacing.xxs,
  },
  shareText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
