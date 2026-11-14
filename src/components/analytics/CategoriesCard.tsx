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
  /** `subcats` satırlarının ait olduğu üst kategori; sorgu bitmeden `selectedCategory` ile eşleşmez. */
  subcatsParentId: number | null;
  selectedCategory: number | null;
  setSelectedCategory: Dispatch<SetStateAction<number | null>>;
}

interface DisplayedBreakdown {
  rows: CategorySpending[];
  /** Panelin gösterdiği kategori; kapanışta null olur ama satırlar solma için kalır. */
  parentId: number | null;
  /** Her yeni içerikte artar; ölçüm kabını yeniden bağlayıp onLayout'u garanti eder. */
  version: number;
}

function CategoriesCard({
  styles, t, tc, currency, categories, subcats, subcatsParentId, selectedCategory, setSelectedCategory,
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

  // Panel yalnızca seçili kategoriye ait sonuç geldiğinde içerik değiştirir. Böylece
  // önce boş/eski satırlarla açılıp veri gelince ikinci kez boy değiştirmez.
  const ready = selectedCategory !== null && subcatsParentId === selectedCategory;
  const [displayed, setDisplayed] = useState<DisplayedBreakdown>(() => ({
    rows: ready ? subcats : [], parentId: ready ? selectedCategory : null, version: 0,
  }));
  if (ready && (displayed.rows !== subcats || displayed.parentId !== selectedCategory)) {
    setDisplayed({ rows: subcats, parentId: selectedCategory, version: displayed.version + 1 });
  } else if (selectedCategory === null && displayed.parentId !== null) {
    setDisplayed({ ...displayed, parentId: null });
  }
  // Kategori değiştirirken yeni sonuç gelene kadar panel açık kalır (kapanıp açılmaz).
  const expanded = selectedCategory !== null && displayed.parentId !== null;

  // Yükseklik yalnızca güncel içeriğin ölçümüyle hedeflenir; eski ölçüme doğru
  // başlayıp sonra yön değiştiren (zıplayan) animasyon oluşmaz.
  const [measured, setMeasured] = useState({ version: -1, height: 0 });
  const height = useSharedValue(0);
  const visibility = useSharedValue(0);
  useEffect(() => {
    if (expanded && measured.version !== displayed.version) return;
    height.value = withTiming(expanded ? measured.height : 0, {
      duration: expanded ? 280 : 220,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    visibility.value = withTiming(expanded ? 1 : 0, {
      ...selectionMotion, duration: expanded ? 200 : 140,
    });
  }, [expanded, measured, displayed.version, height, visibility]);
  const viewportMotion = useAnimatedStyle(() => ({ height: height.value }));
  const contentMotion = useAnimatedStyle(() => ({ opacity: visibility.value }));
  const contentVersion = displayed.version;

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
        <Animated.View key={contentVersion} testID="category-breakdown-content"
          style={[detailStyles.content, contentMotion]}
          onLayout={event => {
            const next = event.nativeEvent.layout.height;
            setMeasured(prev => (prev.version === contentVersion && prev.height === next
              ? prev : { version: contentVersion, height: next }));
          }}>
          <View style={detailStyles.divider} />
          <Text style={styles.sectionTitle}>{t('subcategories')}</Text>
          {displayed.rows.length > 0 ? displayed.rows.map(sc => (
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
