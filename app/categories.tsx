// S.P.A.R.K. — Category Manager Screen
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { CategoryDao } from '../src/db/categoryDao';
import { CategoryWithChildren } from '../src/db/schema';
import { useLanguage } from '../src/i18n/LanguageContext';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import { SparkToast } from '../src/components/SparkToast';

export default function CategoriesScreen() {
  const styles = getStyles();
  const router = useRouter();
  const { t, tc } = useLanguage();
  const [tree, setTree] = useState<CategoryWithChildren[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newCatName, setNewCatName] = useState('');
  const [addingTo, setAddingTo] = useState<number | null>(null); // null = root, id = sub
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  useFocusEffect(useCallback(() => { loadTree(); }, []));

  async function loadTree() {
    const data = await CategoryDao.getTree();
    setTree(data);
  }

  function toggleExpand(id: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!newCatName.trim()) return;
    await CategoryDao.create({
      name: newCatName.trim(),
      parent_id: addingTo,
    });
    setNewCatName('');
    setShowAdd(false);
    setAddingTo(null);
    await loadTree();
  }

  function handleDelete(id: number, name: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await CategoryDao.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadTree();
    } catch (e) {
      setDeleteTarget(null);
      if (e instanceof Error && e.message === 'SYSTEM_CATEGORY_LOCKED') {
        SparkToast.show(t('category_system_locked'), 'error');
      } else {
        SparkToast.show(t('operation_failed'), 'error');
      }
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('categories_title')}</Text>
        <Pressable
          onPress={() => { setAddingTo(null); setShowAdd(!showAdd); }}
          style={styles.addBtn}
        >
          <MaterialCommunityIcons name="plus" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Add category input */}
      {showAdd && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newCatName}
            onChangeText={setNewCatName}
            placeholder={addingTo ? t('subcategory_placeholder') : t('new_category_placeholder')}
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
          <Pressable onPress={handleAdd} style={styles.saveBtn}>
            <MaterialCommunityIcons name="check" size={22} color={Colors.success} />
          </Pressable>
          <Pressable onPress={() => { setShowAdd(false); setNewCatName(''); }} style={styles.cancelBtn}>
            <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {tree.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="shape-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('empty_categories_title')}</Text>
            <Text style={styles.emptyDesc}>{t('empty_categories_desc')}</Text>
            <Pressable
              onPress={() => { setAddingTo(null); setShowAdd(true); }}
              style={styles.emptyCTA}
            >
              <MaterialCommunityIcons name="plus" size={18} color={Colors.textInverse} />
              <Text style={styles.emptyCTAText}>{t('empty_categories_cta')}</Text>
            </Pressable>
          </View>
        )}
        {tree.map((cat, i) => (
          <Animated.View key={cat.id} entering={FadeInDown.delay(i * 40).duration(400)}>
            {/* Parent Category */}
            <Pressable
              onPress={() => toggleExpand(cat.id)}
              style={styles.categoryItem}
            >
              <View style={[styles.iconCircle, { backgroundColor: cat.color + '22' }]}>
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={22}
                  color={cat.color}
                />
              </View>
              <Text style={styles.categoryName}>{tc(cat.name)}</Text>
              <Text style={styles.childCount}>{cat.children.length}</Text>
              <MaterialCommunityIcons
                name={expanded.has(cat.id) ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textSecondary}
              />
            </Pressable>

            {/* Children */}
            {expanded.has(cat.id) && (
              <Animated.View layout={LinearTransition.duration(750)} style={styles.children}>
                {cat.children.map(child => (
                  <View key={child.id} style={styles.childItem}>
                    <MaterialCommunityIcons
                      name={child.icon as any}
                      size={18}
                      color={child.color}
                    />
                    <Text style={styles.childName}>{tc(child.name)}</Text>
                    {child.is_system !== 1 ? (
                      <Pressable
                        onPress={() => handleDelete(child.id, child.name)}
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      >
                        <MaterialCommunityIcons name="close" size={16} color={Colors.textMuted} />
                      </Pressable>
                    ) : (
                      <View style={styles.systemBadge} accessibilityLabel={t('category_system_badge_a11y')}>
                        <MaterialCommunityIcons name="lock-outline" size={14} color={Colors.textMuted} />
                      </View>
                    )}
                  </View>
                ))}
                <Pressable
                  onPress={() => { setAddingTo(cat.id); setShowAdd(true); }}
                  style={styles.addChildBtn}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={Colors.primary} />
                  <Text style={styles.addChildText}>{t('add_sub_category')}</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <GlassDeleteModal
        visible={deleteTarget !== null}
        message={deleteTarget ? t('confirm_delete_category', { name: tc(deleteTarget.name) }) : ''}
        onCancel={() => setDeleteTarget(null)}
        onDelete={confirmDelete}
      />
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  addBtn: {
    padding: Spacing.xs,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  saveBtn: {
    padding: Spacing.sm,
  },
  cancelBtn: {
    padding: Spacing.sm,
  },
  list: {
    paddingHorizontal: ScreenPadding.horizontal,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
    flex: 1,
  },
  childCount: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  children: {
    paddingLeft: Spacing.huge,
    paddingBottom: Spacing.sm,
  },
  childItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  systemBadge: {
    width: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  childName: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    flex: 1,
  },
  addChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  addChildText: {
    ...Typography.labelSmall,
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.md,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
  },
  emptyDesc: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    marginTop: Spacing.md,
  },
  emptyCTAText: {
    ...Typography.labelMedium,
    color: Colors.textInverse,
    fontFamily: FontFamily.semiBold,
  },
});
