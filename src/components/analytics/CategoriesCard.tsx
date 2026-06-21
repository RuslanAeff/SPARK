// S.P.A.R.K. — Analiz kartı: Ana kategoriler + seçili kategorinin alt kırılımı
import React, { type Dispatch, type SetStateAction } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import Animated, { SlideInRight, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import type { CategorySpending } from '../../db/schema';
import type { BaseCardProps } from './shared';

interface CategoriesCardProps extends BaseCardProps {
  categories: CategorySpending[];
  subcats: CategorySpending[];
  selectedCategory: number | null;
  setSelectedCategory: Dispatch<SetStateAction<number | null>>;
}

function CategoriesCard({
  styles, t, tc, currency, categories, subcats, selectedCategory, setSelectedCategory,
}: CategoriesCardProps) {
  return (
    <AnimatedCard delay={200} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('main_categories')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.map((c, ci) => {
          const isSelected = selectedCategory === c.category_id;
          const isFaded = selectedCategory !== null && !isSelected;
          return (
            <Animated.View key={c.category_id} entering={SlideInRight.delay(ci * 70).duration(350).springify()}>
              <Pressable
                onPress={() => setSelectedCategory(isSelected ? null : c.category_id)}
                style={[ styles.categoryPill, isSelected ? { backgroundColor: c.category_color + '33', borderColor: c.category_color } : {}, isFaded ? { opacity: 0.5 } : { opacity: 1 } ]}
              >
                <View style={[styles.pillIcon, { backgroundColor: c.category_color }]}>
                  <MaterialCommunityIcons name={c.category_icon as any} size={16} color="#FFF" />
                </View>
                <View style={styles.pillInfo}>
                  <Text style={styles.pillName}>{tc(c.category_name)}</Text>
                  <Text style={styles.pillAmount}>{formatCurrency(c.total, currency, false)}</Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
      {selectedCategory !== null && (
        <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOutUp.duration(200)}>
          <View style={{ height: 1, backgroundColor: Colors.border, marginTop: Spacing.md, marginBottom: Spacing.md }} />
          <Text style={styles.sectionTitle}>{t('subcategories')}</Text>
          {subcats.length > 0 ? subcats.map((sc, i) => (
            <Animated.View key={sc.category_id} entering={FadeInDown.delay(i * 50).duration(280)}>
              <View style={[styles.vendorRow, { borderBottomWidth: 0, paddingBottom: Spacing.sm }]}>
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
            </Animated.View>
          )) : (
            <Text style={{ ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg }}>
              {t('no_sub_categories')}
            </Text>
          )}
        </Animated.View>
      )}
    </AnimatedCard>
  );
}

export default React.memo(CategoriesCard);
