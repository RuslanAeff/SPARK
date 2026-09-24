// S.P.A.R.K. — Analiz kartı: Ana kategoriler + seçili kategorinin alt kırılımı
import React, { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import type { CategorySpending } from '../../db/schema';
import type { BaseCardProps } from './shared';
import { useAppTheme, useThemeRevision } from '../../theme/themeStore';

const selectionMotion = { duration: 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

function CategoryOption({ category, selected, faded, onPress, styles, tc, currency }: {
  category: CategorySpending;
  selected: boolean;
  faded: boolean;
  onPress: () => void;
} & Pick<BaseCardProps, 'styles' | 'tc' | 'currency'>) {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  const progress = useSharedValue(selected ? 1 : 0);
  const opacity = useSharedValue(faded ? 0.72 : 1);
  const background = useSharedValue(selected ? category.category_color + '22' : Colors.surface);
  const border = useSharedValue(selected ? category.category_color : Colors.border);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, selectionMotion);
    opacity.value = withTiming(faded ? 0.72 : 1, selectionMotion);
    background.value = withTiming(selected ? category.category_color + '22' : Colors.surface, selectionMotion);
    border.value = withTiming(selected ? category.category_color : Colors.border, selectionMotion);
  }, [selected, faded, category.category_color, scheme, revision, progress, opacity, background, border]);
  const surface = useAnimatedStyle(() => ({
    opacity: opacity.value, backgroundColor: background.value, borderColor: border.value,
  }));
  const arrow = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tc(category.category_name)}, ${formatCurrency(category.total, currency)}`}
      accessibilityState={{ selected, expanded: selected }}
      testID={`category-option-${category.category_id}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Animated.View style={[styles.categoryPill, { minHeight: 48 }, surface]}>
        <View style={[styles.pillIcon, { backgroundColor: category.category_color }]}>
          <MaterialCommunityIcons name={category.category_icon as any} size={16} color="#FFF" />
        </View>
        <View style={styles.pillInfo}>
          <Text style={styles.pillName}>{tc(category.category_name)}</Text>
          <Text style={styles.pillAmount}>{formatCurrency(category.total, currency, false)}</Text>
        </View>
        <Animated.View style={arrow} accessible={false} importantForAccessibility="no-hide-descendants">
          <MaterialCommunityIcons name="chevron-down" size={16} color={Colors.textSecondary} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

interface CategoriesCardProps extends BaseCardProps {
  categories: CategorySpending[];
  subcats: CategorySpending[];
  selectedCategory: number | null;
  setSelectedCategory: Dispatch<SetStateAction<number | null>>;
}

function CategoriesCard({
  styles, t, tc, currency, categories, subcats, selectedCategory, setSelectedCategory,
}: CategoriesCardProps) {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  const detailStyles = useMemo(() => StyleSheet.create({
    viewport: { overflow: 'hidden' },
    // Measure natural height independently from the animated viewport (also on rotation/font changes).
    content: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: Spacing.md },
    divider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.md },
    empty: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },
  }), [scheme, revision]);
  const expanded = selectedCategory !== null;
  // Keep the last rows during collapse, even when the parent clears its query result.
  const [displayedSubcats, setDisplayedSubcats] = useState(subcats);
  if (expanded && displayedSubcats !== subcats) setDisplayedSubcats(subcats);
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);
  const visibility = useSharedValue(0);
  useEffect(() => {
    height.value = withTiming(expanded ? contentHeight : 0, {
      duration: expanded ? 280 : 220,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [expanded, contentHeight, height]);
  useEffect(() => {
    visibility.value = withTiming(expanded ? 1 : 0, {
      ...selectionMotion, duration: expanded ? 200 : 140,
    });
  }, [expanded, visibility]);
  const viewportMotion = useAnimatedStyle(() => ({ height: height.value }));
  const contentMotion = useAnimatedStyle(() => ({ opacity: visibility.value }));

  return (
    <AnimatedCard delay={200} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('main_categories')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.map(c => {
          const isSelected = selectedCategory === c.category_id;
          const isFaded = selectedCategory !== null && !isSelected;
          return (
            <CategoryOption key={c.category_id} category={c} selected={isSelected} faded={isFaded}
              onPress={() => setSelectedCategory(isSelected ? null : c.category_id)}
              styles={styles} tc={tc} currency={currency} />
          );
        })}
      </ScrollView>
      <Animated.View testID="category-breakdown" style={[detailStyles.viewport, viewportMotion]}
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
        <Animated.View testID="category-breakdown-content" style={[detailStyles.content, contentMotion]}
          onLayout={event => setContentHeight(event.nativeEvent.layout.height)}>
          <View style={detailStyles.divider} />
          <Text style={styles.sectionTitle}>{t('subcategories')}</Text>
          {displayedSubcats.length > 0 ? displayedSubcats.map(sc => (
              <View key={sc.category_id} style={[styles.vendorRow, { borderBottomWidth: 0, paddingBottom: Spacing.sm }]}>
                <View style={[styles.pillIcon, { backgroundColor: sc.category_color, width: 44, height: 44, borderRadius: 22 }]}>
                  <MaterialCommunityIcons name={sc.category_icon as any} size={22} color="#FFF" />
                </View>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName}>{tc(sc.category_name)}</Text>
                  <View style={styles.vendorBar}>
                    <View style={[styles.vendorBarFill, { width: `${Math.max(2, sc.percentage)}%`, backgroundColor: sc.category_color }]} />
                  </View>
                </View>
                <View style={styles.vendorAmountCol}>
                  <Text style={styles.vendorAmount}>{formatCurrency(sc.total, currency)}</Text>
                  <Text style={styles.vendorPercent}>{sc.percentage}%</Text>
                </View>
              </View>
          )) : (
            <Text style={detailStyles.empty}>
              {t('no_sub_categories')}
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </AnimatedCard>
  );
}

export default React.memo(CategoriesCard);
