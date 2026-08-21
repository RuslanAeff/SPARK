// S.P.A.R.K. — Satıcı Seçenekleri Sheet
// Bir satıcı için: logo değiştir, varsayılan kategori belirle, satıcıyı sil.
// Settings → Satıcı Yönetimi'nde tile'a dokunulduğunda açılır.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BottomSheetModal from './BottomSheetModal';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import { CategoryDao } from '../db/categoryDao';
import { VendorDao } from '../db/vendorDao';
import type { Category, Vendor } from '../db/schema';

interface VendorOptionsSheetProps {
  visible: boolean;
  vendor: Vendor | null;
  onClose: () => void;
  onChangeLogo: (vendorId: number) => void;
  onDelete: (vendor: Vendor) => void;
  onChanged: () => void;
}

export default function VendorOptionsSheet({
  visible,
  vendor,
  onClose,
  onChangeLogo,
  onDelete,
  onChanged,
}: VendorOptionsSheetProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t, tc } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [picking, setPicking] = useState(false);
  const [currentDefault, setCurrentDefault] = useState<number | null>(null);
  // Parent kapanışta hedefi null yapar; çıkış animasyonu bitene kadar son
  // satıcıyı tut ki sheet tek karede unmount olmasın.
  const [retainedVendor, setRetainedVendor] = useState<Vendor | null>(vendor);
  const pendingActionRef = useRef<
    | { type: 'logo'; vendorId: number }
    | { type: 'delete'; vendor: Vendor }
    | null
  >(null);
  const activeVendor = vendor ?? retainedVendor;

  useEffect(() => {
    if (vendor) setRetainedVendor(vendor);
  }, [vendor]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      const cats = await CategoryDao.getAll();
      if (!alive) return;
      setCategories(cats);
      setCurrentDefault(activeVendor?.default_category_id ?? null);
      setPicking(false);
    })();
    return () => {
      alive = false;
    };
  }, [visible, activeVendor]);

  // Kategori seçici: alt kategoriler ile birlikte düz liste — kullanıcı yaprak
  // veya kök seçebilir. Kök = "tüm alt kategoriler için tek varsayılan".
  // Erken-return'den ÖNCE çağrılmalı: aksi halde `vendor=null` render'ı ile
  // sonraki render'da hook sayısı değişir → "Rendered more hooks…" hatası.
  const groupedCategories = useMemo(() => {
    const roots = categories.filter((c) => c.parent_id === null);
    return roots.map((root) => ({
      root,
      children: categories.filter((c) => c.parent_id === root.id),
    }));
  }, [categories]);

  const handleDismiss = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setRetainedVendor(null);
    if (action?.type === 'logo') onChangeLogo(action.vendorId);
    if (action?.type === 'delete') onDelete(action.vendor);
  }, [onChangeLogo, onDelete]);

  if (!activeVendor) return null;

  async function handleSetDefault(categoryId: number | null) {
    if (!activeVendor) return;
    try {
      await VendorDao.setDefaultCategory(activeVendor.id, categoryId);
      setCurrentDefault(categoryId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChanged();
      setPicking(false);
    } catch (e) {
      if (__DEV__) console.warn('setDefaultCategory', e);
    }
  }

  const currentCat = categories.find((c) => c.id === currentDefault) ?? null;
  const currentLabel = currentCat ? tc(currentCat.name) : t('vendor_default_none');

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismiss={handleDismiss}
      backdropColor={scheme === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.55)'}
      sheetStyle={styles.sheet}
      showHandle
    >
      {/* Header — satıcı kimliği */}
      <View style={styles.header}>
        <View style={[styles.avatar, !activeVendor.logo_uri && { backgroundColor: Colors.primary + '33' }]}>
          {activeVendor.logo_uri ? (
            <Image source={{ uri: activeVendor.logo_uri }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarInitial}>
              {activeVendor.name.trim().charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vendorName} numberOfLines={2}>
            {activeVendor.name}
          </Text>
          <Text style={styles.vendorMeta} numberOfLines={1}>
            {currentCat
              ? t('vendor_default_current', { category: currentLabel })
              : t('vendor_default_unset_hint')}
          </Text>
        </View>
      </View>

      {!picking ? (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
            onPress={() => {
              pendingActionRef.current = { type: 'logo', vendorId: activeVendor.id };
              onClose();
            }}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.chartBlue + '22' }]}>
              <MaterialCommunityIcons name="image-edit-outline" size={20} color={Colors.chartBlue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>{t('vendor_action_change_logo')}</Text>
              <Text style={styles.actionSub} numberOfLines={1}>
                {activeVendor.logo_uri ? t('vendor_action_change_logo_has') : t('vendor_action_change_logo_none')}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
            onPress={() => setPicking(true)}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '22' }]}>
              <MaterialCommunityIcons name="auto-fix" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>{t('vendor_action_default_category')}</Text>
              <Text style={styles.actionSub} numberOfLines={1}>
                {currentLabel}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
            onPress={() => {
              pendingActionRef.current = { type: 'delete', vendor: activeVendor };
              onClose();
            }}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.danger + '22' }]}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionLabel, { color: Colors.danger }]}>
                {t('vendor_action_delete')}
              </Text>
              <Text style={styles.actionSub} numberOfLines={1}>
                {t('vendor_action_delete_sub')}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.pickerWrap}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setPicking(false)} hitSlop={10} style={styles.pickerBack}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.pickerTitle}>{t('vendor_pick_default_title')}</Text>
            <View style={{ width: 30 }} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.noneRow, pressed && styles.actionRowPressed]}
            onPress={() => handleSetDefault(null)}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.surfaceLight }]}>
              <MaterialCommunityIcons name="close-circle-outline" size={20} color={Colors.textMuted} />
            </View>
            <Text style={styles.noneRowText}>{t('vendor_default_none')}</Text>
            {currentDefault == null && (
              <MaterialCommunityIcons name="check-circle" size={20} color={Colors.primary} />
            )}
          </Pressable>

          <ScrollView
            style={styles.pickerScroll}
            contentContainerStyle={styles.pickerScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {groupedCategories.map(({ root, children }) => (
              <View key={root.id} style={styles.groupBlock}>
                <Pressable
                  style={({ pressed }) => [
                    styles.catChip,
                    {
                      backgroundColor: root.color + '1A',
                      borderColor:
                        currentDefault === root.id ? root.color : 'transparent',
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => handleSetDefault(root.id)}
                >
                  <MaterialCommunityIcons
                    name={root.icon as any}
                    size={16}
                    color={root.color}
                  />
                  <Text style={[styles.catChipText, { color: Colors.textPrimary }]}>
                    {tc(root.name)}
                  </Text>
                  {currentDefault === root.id && (
                    <MaterialCommunityIcons name="check" size={15} color={root.color} />
                  )}
                </Pressable>
                {children.length > 0 && (
                  <View style={styles.subRow}>
                    {children.map((sub) => {
                      const active = currentDefault === sub.id;
                      return (
                        <Pressable
                          key={sub.id}
                          onPress={() => handleSetDefault(sub.id)}
                          style={({ pressed }) => [
                            styles.subChip,
                            active && {
                              backgroundColor: sub.color + '22',
                              borderColor: sub.color,
                            },
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={sub.icon as any}
                            size={13}
                            color={active ? sub.color : Colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.subChipText,
                              active && { color: sub.color, fontFamily: FontFamily.semiBold },
                            ]}
                          >
                            {tc(sub.name)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </BottomSheetModal>
  );
}

const getStyles = () =>
  StyleSheet.create({
    sheet: {
      backgroundColor: Colors.cardSurface,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xl,
      maxHeight: '85%',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 56, height: 56, borderRadius: 28 },
    avatarInitial: {
      ...Typography.headlineMedium,
      fontFamily: FontFamily.extraBold,
      color: Colors.primary,
      lineHeight: 28,
    },
    vendorName: {
      ...Typography.headlineSmall,
      fontSize: 17,
      color: Colors.textPrimary,
      fontFamily: FontFamily.extraBold,
    },
    vendorMeta: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    actions: { gap: Spacing.xs },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.lg,
    },
    actionRowPressed: { backgroundColor: Colors.surfaceLight },
    actionIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      ...Typography.bodyMedium,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
    },
    actionSub: {
      ...Typography.labelSmall,
      color: Colors.textMuted,
      marginTop: 2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.divider,
      marginVertical: Spacing.xs,
      marginHorizontal: Spacing.sm,
    },
    pickerWrap: { flex: 1, minHeight: 320 },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    pickerBack: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerTitle: {
      ...Typography.headlineSmall,
      fontSize: 16,
      color: Colors.textPrimary,
      fontFamily: FontFamily.bold,
      flex: 1,
      textAlign: 'center',
    },
    noneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.sm,
    },
    noneRowText: {
      ...Typography.bodyMedium,
      color: Colors.textPrimary,
      fontFamily: FontFamily.medium,
      flex: 1,
    },
    pickerScroll: { maxHeight: 360 },
    pickerScrollContent: { paddingBottom: Spacing.lg },
    groupBlock: {
      marginBottom: Spacing.md,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.round,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    catChipText: {
      ...Typography.labelMedium,
      fontFamily: FontFamily.bold,
    },
    subRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
      paddingLeft: Spacing.sm,
    },
    subChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 5,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surfaceLight,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    subChipText: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
    },
  });
