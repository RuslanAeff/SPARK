// S.P.A.R.K. — Birikim hedefi ve aylık kategori limitleri
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { GoalDao } from '../src/db/goalDao';
import { CategoryLimitDao, CategoryLimitRow } from '../src/db/categoryLimitDao';
import { CategoryDao } from '../src/db/categoryDao';
import { Category } from '../src/db/schema';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useCurrency } from '../src/context/CurrencyContext';
import { useRefresh } from '../src/context/RefreshContext';
import { SparkToast } from '../src/components/SparkToast';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import CustomDatePicker from '../src/components/CustomDatePicker';
import { getToday, normalizeToYYYYMMDD } from '../src/utils/dateUtils';
import { susevarButton, susevarButtonText } from '../src/theme/susevar';

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function GoalSettingsScreen() {
  const router = useRouter();
  const { t, tc } = useLanguage();
  const { currency } = useCurrency();
  const { triggerRefresh } = useRefresh();
  const styles = getStyles();

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [targetDate, setTargetDate] = useState(getToday());
  const [limits, setLimits] = useState<CategoryLimitRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearGoalModalVisible, setClearGoalModalVisible] = useState(false);

  const m = monthKey();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, cats, lim] = await Promise.all([
        GoalDao.get(),
        CategoryDao.getAll(),
        CategoryLimitDao.getForMonth(m),
      ]);
      setCategories(cats);
      setLimits(lim);
      if (g) {
        setTitle(g.title);
        setAmountStr(String(g.target_amount));
        setCurrentAmountStr(g.current_amount > 0 ? String(g.current_amount) : '');
        setTargetDate(g.target_date);
      } else {
        setTitle('');
        setAmountStr('');
        setCurrentAmountStr('');
        setTargetDate(getToday());
      }
    } finally {
      setLoading(false);
    }
  }, [m]);

  useEffect(() => {
    load();
  }, [load]);

  const categoriesAvailableToAdd = useMemo(() => {
    const used = new Set(limits.map(l => l.category_id));
    return categories.filter(c => !used.has(c.id));
  }, [categories, limits]);

  function removeLimit(row: CategoryLimitRow) {
    setLimits(prev => prev.filter(l => !(l.id === row.id && l.category_id === row.category_id)));
  }

  function addCategory(cat: Category) {
    setLimits(prev => [
      ...prev,
      {
        id: -Date.now(),
        category_id: cat.id,
        month: m,
        limit_amount: 100,
      },
    ]);
    setAddModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleSave() {
    const amt = parseFloat(amountStr.replace(',', '.'));
    if (!title.trim()) {
      SparkToast.show(t('goal_title_required'), 'error');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }

    const curRaw = parseFloat((currentAmountStr || '0').replace(',', '.'));
    const current_amount = isFinite(curRaw) && curRaw > 0 ? curRaw : 0;

    setSaving(true);
    try {
      await GoalDao.upsert({
        title: title.trim(),
        target_amount: amt,
        target_date: normalizeToYYYYMMDD(targetDate),
        currency,
        current_amount,
      });

      const existing = await CategoryLimitDao.getForMonth(m);
      const kept = new Set(limits.map(l => l.category_id));
      for (const e of existing) {
        if (!kept.has(e.category_id)) {
          await CategoryLimitDao.remove(e.id);
        }
      }

      for (const l of limits) {
        await CategoryLimitDao.upsert(l.category_id, m, l.limit_amount);
      }

      triggerRefresh();
      queueMicrotask(() => triggerRefresh());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('goal_settings_saved'), 'success');
      router.back();
    } catch (e) {
      console.warn(e);
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function performClearGoal() {
    setClearGoalModalVisible(false);
    try {
      await GoalDao.clear();
      await CategoryLimitDao.deleteAll();
      setTitle('');
      setAmountStr('');
      setTargetDate(getToday());
      setLimits([]);
      triggerRefresh();
      queueMicrotask(() => triggerRefresh());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('goal_settings_saved'), 'success');
      router.back();
    } catch (e) {
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('goal_settings_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>{t('goal_settings_savings_section')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('goal_settings_placeholder_title')}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.fieldLbl}>{t('amount')}</Text>
          <TextInput
            style={styles.input}
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.fieldLbl}>{t('savings_goal_current_amount')}</Text>
          <TextInput
            style={styles.input}
            value={currentAmountStr}
            onChangeText={setCurrentAmountStr}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.hint}>{t('savings_goal_current_amount_hint')}</Text>
          <Text style={styles.fieldLbl}>{t('savings_goal_target_date')}</Text>
          <Pressable style={styles.input} onPress={() => setDatePickerVisible(true)}>
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.medium }}>{targetDate}</Text>
          </Pressable>

          <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>{t('goal_settings_limits_section')}</Text>
          <Text style={styles.hint}>{t('goal_settings_month_hint')}</Text>

          {limits.map(row => {
            const cat = categories.find(c => c.id === row.category_id);
            if (!cat) return null;
            return (
              <View key={`${row.id}-${row.category_id}`} style={styles.limitRow}>
                <View style={[styles.miniIcon, { backgroundColor: cat.color + '22' }]}>
                  <MaterialCommunityIcons name={cat.icon as any} size={18} color={cat.color} />
                </View>
                <Text style={styles.limitName} numberOfLines={1}>{tc(cat.name)}</Text>
                <TextInput
                  style={styles.limitInput}
                  keyboardType="decimal-pad"
                  value={String(row.limit_amount)}
                  onChangeText={txt => {
                    const n = parseFloat(txt.replace(',', '.'));
                    setLimits(prev =>
                      prev.map(l =>
                        l.id === row.id ? { ...l, limit_amount: isNaN(n) ? 0 : Math.max(0, n) } : l
                      )
                    );
                  }}
                />
                <Pressable onPress={() => removeLimit(row)} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle-outline" size={22} color={Colors.danger} />
                </Pressable>
              </View>
            );
          })}

          <Pressable
            style={styles.addBtn}
            onPress={() => {
              if (categoriesAvailableToAdd.length === 0) {
                SparkToast.show(t('no_categories'), 'info');
                return;
              }
              setAddModal(true);
            }}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={22} color={Colors.primary} />
            <Text style={styles.addBtnText}>{t('goal_settings_add_limit')}</Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={saving || loading}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || loading) && { opacity: 0.6 },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.saveBtnText}>{saving ? t('processing') : t('save')}</Text>
          </Pressable>

          <Pressable
            onPress={() => setClearGoalModalVisible(true)}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.clearBtnText}>{t('goal_settings_clear_goal')}</Text>
          </Pressable>

          <View style={{ height: 48 }} />
        </ScrollView>

        <CustomDatePicker
          visible={datePickerVisible}
          onClose={() => setDatePickerVisible(false)}
          initialDate={targetDate}
          onSelectDate={d => setTargetDate(d)}
        />

        <GlassDeleteModal
          visible={clearGoalModalVisible}
          title={t('goal_settings_clear_goal')}
          message={t('goal_clear_confirm_message')}
          onCancel={() => setClearGoalModalVisible(false)}
          onDelete={performClearGoal}
        />

        <Modal visible={addModal} transparent animationType="fade">
          <Pressable style={styles.modalBackdrop} onPress={() => setAddModal(false)}>
            <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
              <Text style={styles.modalTitle}>{t('goal_settings_pick_category')}</Text>
              <FlatList
                data={categoriesAvailableToAdd}
                keyExtractor={c => String(c.id)}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => (
                  <Pressable style={styles.catPickRow} onPress={() => addCategory(item)}>
                    <View style={[styles.miniIcon, { backgroundColor: item.color + '22' }]}>
                      <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <Text style={styles.limitName}>{tc(item.name)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
                  </Pressable>
                )}
              />
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.92 }]}
                onPress={() => setAddModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>{t('cancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
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
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: Spacing.xxl,
  },
  sectionLabel: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  fieldLbl: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.cardSurface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  limitInput: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    minWidth: 72,
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
  },
  addBtnText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  /** Şüşevar — kaydet */
  saveBtn: {
    ...susevarButton,
    marginTop: Spacing.xxl,
  },
  saveBtnText: susevarButtonText,
  clearBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.round,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  clearBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  modalCancelBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.round,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  modalCancelBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.cardSurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  catPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
});
