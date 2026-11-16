// S.P.A.R.K. — Category Manager Screen
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import ScreenHeader from '../src/components/ScreenHeader';
import PrimaryButton from '../src/components/PrimaryButton';
import { toIconName } from '../src/utils/iconName';
import { useBottomClearance } from '../src/hooks/useBottomClearance';

const isFabricEnabled = Boolean(
  (globalThis as typeof globalThis & { nativeFabricUIManager?: unknown }).nativeFabricUIManager,
);
if (
  Platform.OS === 'android'
  && !isFabricEnabled
  && UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { Colors } from '../src/theme/colors';
import { useThemeRevision } from '../src/theme/themeStore';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { CategoryDao } from '../src/db/categoryDao';
import { CategoryWithChildren } from '../src/db/schema';
import { useLanguage } from '../src/i18n/LanguageContext';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import { SparkToast } from '../src/components/SparkToast';
import { logError } from '../src/utils/logError';

export default function CategoriesScreen() {
  // UX-06: sistem gezinme alanı (jest/üç düğme) kadar ek alt boşluk.
  const bottomClearance = useBottomClearance('screen', Spacing.xxl);
  useThemeRevision();
  const styles = getStyles();
  const { t, tc } = useLanguage();
  const [tree, setTree] = useState<CategoryWithChildren[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newCatName, setNewCatName] = useState('');
  const [addingTo, setAddingTo] = useState<number | null>(null); // null = root, id = sub
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; usage: number } | null>(null);
  const addingRef = useRef(false);

  useFocusEffect(useCallback(() => { loadTree(); }, []));

  async function loadTree() {
    try {
      const data = await CategoryDao.getTree();
      setTree(data);
    } catch (error) {
      logError('categories load failed', error);
      SparkToast.show(t('operation_failed'), 'error');
    }
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
    if (!newCatName.trim() || addingRef.current) return;
    addingRef.current = true;
    try {
      await CategoryDao.create({
        name: newCatName.trim(),
        parent_id: addingTo,
      });
    } catch (error) {
      // Eskiden yakalanmamış ret; kullanıcı hiçbir geri bildirim almıyordu (BUG-30).
      if (error instanceof Error && error.message === 'CATEGORY_NAME_EXISTS') {
        SparkToast.show(t('category_name_exists'), 'error');
        return;
      }
      logError('categories add failed', error);
      SparkToast.show(t('error_saving_data'), 'error');
      return;
    } finally {
      addingRef.current = false;
    }
    setNewCatName('');
    setShowAdd(false);
    setAddingTo(null);
    await loadTree();
  }

  async function handleDelete(id: number, name: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // BUG-13 eki: kullanımdaysa onay penceresi "Diğer"e taşıyıp silmeyi önerir.
    let usage = 0;
    try {
      usage = await CategoryDao.getUsageCount(id);
    } catch (error) {
      logError('categories usage count failed', error);
    }
    setDeleteTarget({ id, name, usage });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.usage > 0) await CategoryDao.deleteMovingUsageToOther(deleteTarget.id);
      else await CategoryDao.delete(deleteTarget.id);
      if (deleteTarget.usage > 0) {
        SparkToast.show(t('category_moved_and_deleted', { count: deleteTarget.usage.toString(), other: tc('Diğer') }), 'success');
      }
      setDeleteTarget(null);
      await loadTree();
    } catch (e) {
      setDeleteTarget(null);
      if (e instanceof Error && e.message === 'SYSTEM_CATEGORY_LOCKED') {
        SparkToast.show(t('category_system_locked'), 'error');
      } else if (e instanceof Error && e.message === 'CATEGORY_IN_USE') {
        // Sayımdan sonra yeni kullanım oluştu: pencereyi taşıma seçeneğiyle yeniden aç.
        void handleDelete(deleteTarget.id, deleteTarget.name);
      } else {
        SparkToast.show(t('operation_failed'), 'error');
      }
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — DS-06 ortak başlık */}
      <ScreenHeader
        title={t('categories_title')}
        right={(
          <Pressable
            onPress={() => { setAddingTo(null); setShowAdd(!showAdd); }}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel={t('add_main_category')}
            accessibilityState={{ expanded: showAdd }}
          >
            <MaterialCommunityIcons name="plus" size={24} color={Colors.primary} />
          </Pressable>
        )}
      />

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
            <PrimaryButton
              size="compact"
              icon="plus"
              label={t('empty_categories_cta')}
              onPress={() => { setAddingTo(null); setShowAdd(true); }}
              style={styles.emptyCTA}
            />
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
                  name={toIconName(cat.icon)}
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
                      name={toIconName(child.icon)}
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

        <View style={{ height: bottomClearance }} />
      </ScrollView>

      <GlassDeleteModal
        visible={deleteTarget !== null}
        title={deleteTarget && deleteTarget.usage > 0 ? t('category_in_use_title') : undefined}
        message={!deleteTarget ? '' : deleteTarget.usage > 0
          ? t('category_move_to_other_confirm', { name: tc(deleteTarget.name), count: deleteTarget.usage.toString(), other: tc('Diğer') })
          : t('confirm_delete_category', { name: tc(deleteTarget.name) })}
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyCTA: { marginTop: Spacing.md },

});
