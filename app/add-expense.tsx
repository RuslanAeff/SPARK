// S.P.A.R.K. — Add / Edit Expense Screen
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { ExpenseDao } from '../src/db/expenseDao';
import { CategoryDao } from '../src/db/categoryDao';
import { VendorDao } from '../src/db/vendorDao';
import { Category } from '../src/db/schema';
import { getToday } from '../src/utils/dateUtils';
import CustomDatePicker from '../src/components/CustomDatePicker';
import { SparkToast } from '../src/components/SparkToast';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useCurrency, CURRENCY_META } from '../src/context/CurrencyContext';
import { formatCurrency } from '../src/utils/formatCurrency';
import { getVendorPlaceholderExamples } from '../src/utils/vendorPlaceholders';
import { takePendingReceiptDraft } from '../src/services/pendingReceiptDraft';
import { getPrefillFromParsedReceipt } from '../src/services/receiptParser';
import { useRefresh } from '../src/context/RefreshContext';
import {
  susevarButton,
  susevarButtonMarginTop,
  susevarButtonPressed,
  susevarButtonText,
} from '../src/theme/susevar';

export default function AddExpenseScreen() {
  const styles = getStyles();
  const router = useRouter();
  const { t, tc } = useLanguage();
  const { currency } = useCurrency();
  const { triggerRefresh } = useRefresh();
  const { id, fromScan } = useLocalSearchParams<{ id?: string; fromScan?: string }>();
  const isEditing = !!id;
  const scanPrefillAppliedRef = useRef(false);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getToday());
  const [vendorName, setVendorName] = useState('');
  // Two-level category selection: parent stays selected when picking sub-category
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  /** Satıcının varsayılan kategorisi otomatik atandığında küçük bir bilgi
   *  satırı göstermek için tutulur (kullanıcı seçimi değiştirirse silinir). */
  const [autoCategoryFromVendor, setAutoCategoryFromVendor] = useState<{
    vendorName: string;
    categoryId: number;
  } | null>(null);
  const vendorAutofillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      if (vendorAutofillTimer.current) clearTimeout(vendorAutofillTimer.current);
    };
  }, []);

  /**
   * Satıcı adı yazılırken (250ms debounce) bu satıcı için kayıtlı bir
   * varsayılan kategori varsa kategoriyi otomatik seç. Kullanıcı zaten bir
   * kategori seçtiyse override etmeyiz.
   * Düzenleme modunda devre dışı (mevcut kayıttaki kategori dokunulmaz kalsın).
   */
  useEffect(() => {
    if (isEditing) return;
    if (vendorAutofillTimer.current) clearTimeout(vendorAutofillTimer.current);
    const trimmed = vendorName.trim();
    if (!trimmed) {
      setAutoCategoryFromVendor(null);
      return;
    }
    vendorAutofillTimer.current = setTimeout(async () => {
      try {
        const v = await VendorDao.findByName(trimmed);
        if (!v?.default_category_id) {
          // Daha önce auto-doldurduğumuz bilgi varsa temizle (satıcı değişti)
          setAutoCategoryFromVendor(null);
          return;
        }
        const def = v.default_category_id;
        const cat = categories.find((c) => c.id === def);
        if (!cat) return;
        setParentCategoryId((prev) => {
          if (prev != null && prev !== def && (subCategoryId ?? prev) !== def) {
            // Kullanıcı zaten farklı bir kategori seçmiş; karışmıyoruz.
            return prev;
          }
          return cat.parent_id ?? cat.id;
        });
        setSubCategoryId(cat.parent_id != null ? cat.id : null);
        setAutoCategoryFromVendor({ vendorName: trimmed, categoryId: def });
      } catch {
        /* sessizce yut — autofill kritik değil */
      }
    }, 250);
  }, [vendorName, categories, isEditing, subCategoryId]);

  useEffect(() => {
    if (fromScan !== '1') {
      scanPrefillAppliedRef.current = false;
    }
  }, [fromScan]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id, fromScan])
  );

  async function loadData() {
    const cats = await CategoryDao.getAll();
    setCategories(cats);

    if (isEditing && id) {
      const expense = await ExpenseDao.getById(parseInt(id));
      if (expense) {
        setAmount(expense.total_amount.toString());
        setNote(expense.note || '');
        setDate(expense.date);
        if (expense.vendor_name) setVendorName(expense.vendor_name);
        if (expense.category_id) {
          const cat = cats.find(c => c.id === expense.category_id);
          if (cat && cat.parent_id) {
            setParentCategoryId(cat.parent_id);
            setSubCategoryId(cat.id);
          } else {
            setParentCategoryId(expense.category_id);
            setSubCategoryId(null);
          }
        }
      }
      return;
    }

    if (fromScan === '1' && !id && !scanPrefillAppliedRef.current) {
      const receipt = takePendingReceiptDraft();
      if (receipt) {
        scanPrefillAppliedRef.current = true;
        try {
          const pre = await getPrefillFromParsedReceipt(receipt);
          setAmount(pre.amount);
          setVendorName(pre.vendorName);
          setDate(pre.date);
          setNote(pre.note);
          const cat = cats.find(c => c.id === pre.categoryId);
          if (cat) {
            if (cat.parent_id) {
              setParentCategoryId(cat.parent_id);
              setSubCategoryId(cat.id);
            } else {
              setParentCategoryId(cat.id);
              setSubCategoryId(null);
            }
          }
        } catch (e) {
          console.warn('[add-expense] scan prefill', e);
        }
      }
    }
  }

  // Effective category: sub if selected, otherwise parent
  const effectiveCategoryId = subCategoryId ?? parentCategoryId;

  function handleParentPress(catId: number) {
    if (parentCategoryId === catId) {
      // Deselect
      setParentCategoryId(null);
      setSubCategoryId(null);
    } else {
      setParentCategoryId(catId);
      setSubCategoryId(null); // reset sub when changing parent
    }
  }

  function handleSubPress(subId: number) {
    if (subCategoryId === subId) {
      // Deselect sub, parent stays
      setSubCategoryId(null);
    } else {
      setSubCategoryId(subId);
    }
  }

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }

    setSaving(true);
    try {
      let vendorId: number | null = null;
      if (vendorName.trim()) {
        // Yeni satıcı ilk defa oluşurken kullanıcının seçtiği kategoriyi
        // varsayılan olarak işaretle — bir sonraki harcamada otomatik dolar.
        vendorId = await VendorDao.findOrCreate(vendorName.trim(), {
          defaultCategoryId: effectiveCategoryId,
        });
      }

      if (isEditing && id) {
        await ExpenseDao.update(parseInt(id), {
          total_amount: parsedAmount,
          currency,
          note: note || null,
          date,
          vendor_id: vendorId,
          category_id: effectiveCategoryId,
        });
      } else {
        await ExpenseDao.create({
          total_amount: parsedAmount,
          currency,
          note: note || null,
          date,
          vendor_id: vendorId,
          category_id: effectiveCategoryId,
          receipt_uri: null,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerRefresh();
      queueMicrotask(() => triggerRefresh());
      SparkToast.show(id ? t('expense_updated') : t('expense_added'), 'success', formatCurrency(parsedAmount, currency, false));
      setTimeout(() => router.back(), 150);
    } catch (e) {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDetailedEdit() {
    if (isEditing && id) {
      router.push({ pathname: '/edit-items', params: { id } });
      return;
    }

    // Auto-save logic so we have an ID for the items to attach to
    const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
    
    setSaving(true);
    try {
      let vendorId: number | null = null;
      if (vendorName.trim()) {
        vendorId = await VendorDao.findOrCreate(vendorName.trim(), {
          defaultCategoryId: effectiveCategoryId,
        });
      }
      
      const newId = await ExpenseDao.create({
        total_amount: parsedAmount,
        currency,
        note: note || null,
        date,
        vendor_id: vendorId,
        category_id: effectiveCategoryId,
        receipt_uri: null,
      });

      triggerRefresh();
      queueMicrotask(() => triggerRefresh());
      
      SparkToast.show(t('draft_created'), 'info');
      // Convert current screen to 'editing' mode for the newly saved draft
      router.replace({ pathname: '/add-expense', params: { id: newId.toString() } });
      
      navTimerRef.current = setTimeout(() => {
        router.push({ pathname: '/edit-items', params: { id: newId.toString() } });
      }, 100);
      
    } catch(e) {
      SparkToast.show(t('error_detailed_mode'), 'error');
    }
    setSaving(false);
  }

  async function handleDeleteConfirm() {
    if (!id) return;
    setShowDeleteConfirm(false);
    await ExpenseDao.delete(parseInt(id));
    triggerRefresh();
    queueMicrotask(() => triggerRefresh());
    SparkToast.show(t('record_deleted'), 'success', t('removed_from_system'));
    setTimeout(() => router.back(), 150);
  }

  async function handleDelete() {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDeleteConfirm(true);
  }

  const rootCategories = categories.filter(c => {
    if (c.parent_id !== null) return false;
    if (!categorySearch.trim()) return true;
    const search = categorySearch.trim().toLowerCase();
    const translatedName = tc(c.name).toLowerCase();
    return c.name.toLowerCase().includes(search) || translatedName.includes(search);
  });
  const subCategories = parentCategoryId
    ? categories.filter(c => c.parent_id === parentCategoryId)
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>{isEditing ? t('edit_expense_title') : t('add_expense_title')}</Text>
          {isEditing && (
            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.danger} />
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          {/* Amount — Hero Section */}
          <View style={styles.amountHero}>
            <Text style={styles.amountLabel}>{t('amount')}</Text>
            <View style={styles.amountSection}>
              <Text style={styles.currencySymbol}>{CURRENCY_META[currency].symbol}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.amountDivider} />
          </View>

          {/* Vendor */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('vendor')}</Text>
            <TextInput
              style={styles.textInput}
              value={vendorName}
              onChangeText={setVendorName}
              placeholder={t('vendor_placeholder', {
                examples: getVendorPlaceholderExamples(currency),
              })}
              placeholderTextColor={Colors.textMuted}
            />
            {autoCategoryFromVendor != null && (() => {
              const cat = categories.find(c => c.id === autoCategoryFromVendor.categoryId);
              if (!cat) return null;
              return (
                <View style={styles.vendorAutoHint}>
                  <MaterialCommunityIcons
                    name="auto-fix"
                    size={13}
                    color={Colors.primary}
                  />
                  <Text style={styles.vendorAutoHintText} numberOfLines={2}>
                    {t('vendor_default_applied', { category: tc(cat.name) })}
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Date */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('date')}</Text>
            <Pressable
              style={[styles.textInput, { justifyContent: 'center' }]}
              onPress={() => setDatePickerVisible(true)}
            >
              <Text style={{ color: date ? Colors.textPrimary : Colors.textMuted, fontFamily: FontFamily.medium }}>
                {date || t('select_date')}
              </Text>
            </Pressable>
          </View>

          {/* Note */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('note')}</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 60 }]}
              value={note}
              onChangeText={setNote}
              placeholder={t('note_placeholder')}
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>

          {/* Category Selection — Two-level */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('category_title')}</Text>
            {categories.filter(c => c.parent_id === null).length > 6 && (
              <TextInput
                style={styles.categorySearchInput}
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder={t('search_category')}
                placeholderTextColor={Colors.textMuted}
              />
            )}
            <View style={styles.categoryGrid}>
              {rootCategories.map(cat => {
                const isParentSelected = parentCategoryId === cat.id;
                return (
                  <React.Fragment key={cat.id}>
                    <Pressable
                      onPress={() => handleParentPress(cat.id)}
                      style={[
                        styles.categoryChip,
                        isParentSelected && {
                          backgroundColor: cat.color + '33',
                          borderColor: cat.color,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={18}
                        color={isParentSelected ? cat.color : Colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isParentSelected && { color: cat.color, fontFamily: FontFamily.semiBold },
                        ]}
                      >
                        {tc(cat.name)}
                      </Text>
                    </Pressable>

                    {/* Sub-categories placed exactly below the selected parent */}
                    {isParentSelected && subCategories.length > 0 && (
                      <Animated.View entering={FadeInDown.duration(300)} style={{ width: '100%' }}>
                        <View style={[styles.subCategoryRow, { paddingLeft: 0, marginTop: 4, marginBottom: 8 }]}>
                          {subCategories.map(sub => {
                            const isSubSelected = subCategoryId === sub.id;
                            return (
                              <Pressable
                                key={sub.id}
                                onPress={() => handleSubPress(sub.id)}
                                style={[
                                  styles.subChip,
                                  isSubSelected && {
                                    backgroundColor: sub.color + '33',
                                    borderColor: sub.color,
                                    borderWidth: 1,
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name={sub.icon as any}
                                  size={14}
                                  color={isSubSelected ? sub.color : Colors.textSecondary}
                                />
                                <Text style={[
                                  styles.subChipText,
                                  isSubSelected && { color: sub.color, fontFamily: FontFamily.semiBold },
                                ]}>
                                  {tc(sub.name)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </Animated.View>
                    )}
                  </React.Fragment>
                );
              })}
          </View>
        </View>

          <Pressable
            onPress={handleDetailedEdit}
            disabled={saving}
            style={[styles.detailedButton, saving && { opacity: 0.6 }]}
          >
            <View style={styles.detailedBtnContent}>
              <MaterialCommunityIcons name="format-list-bulleted" size={20} color={Colors.primary} />
              <View style={styles.detailedBtnTextCol}>
                <Text style={styles.detailedButtonText}>{t('detailed_edit_btn')}</Text>
                <Text style={styles.detailedButtonSub}>{t('detailed_edit_btn_desc')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.borderLight} />
            </View>
          </Pressable>

          {/* Save Button — modern pill + glassmorphism inspired */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              saving && { opacity: 0.6 },
              pressed && styles.saveButtonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>
              {saving ? t('processing') : isEditing ? t('update_all') : t('save')}
            </Text>
          </Pressable>

          <View style={{ height: 60 }} />
        </ScrollView>
        <CustomDatePicker
          visible={datePickerVisible}
          onClose={() => setDatePickerVisible(false)}
          initialDate={date}
          onSelectDate={setDate}
        />
      </KeyboardAvoidingView>

      <GlassDeleteModal
        visible={showDeleteConfirm}
        message={t('delete_expense_msg')}
        onCancel={() => setShowDeleteConfirm(false)}
        onDelete={handleDeleteConfirm}
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
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,51,51,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  form: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.lg,
  },
  amountHero: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primaryGlow,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  amountLabel: {
    ...Typography.labelSmall,
    color: Colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  amountDivider: {
    width: 60,
    height: 2,
    backgroundColor: Colors.primary + '30',
    borderRadius: 1,
    marginTop: Spacing.md,
  },
  currencySymbol: {
    ...Typography.displaySmall,
    color: Colors.primary,
  },
  amountInput: {
    ...Typography.displayLarge,
    color: Colors.textPrimary,
    minWidth: 120,
    textAlign: 'center',
    fontSize: 48,
  },
  field: {
    marginBottom: Spacing.xl,
  },
  fieldLabel: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  /** Vendor input altında küçük "otomatik kategori uygulandı" rozeti */
  vendorAutoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.primary + '14',
    borderRadius: BorderRadius.round,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.primary + '44',
  },
  vendorAutoHintText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
    flexShrink: 1,
  },
  categorySearchInput: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipText: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
  },
  subCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingLeft: Spacing.md,
  },
  subChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subChipText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  /** Şüşevar — ana kayıt (KAYDET) */
  saveButton: {
    ...susevarButton,
    ...susevarButtonMarginTop,
  },
  saveButtonPressed: susevarButtonPressed,
  detailedButton: {
    marginTop: Spacing.xxl, // Adds separation from the rest of the form
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  detailedBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailedBtnTextCol: {
    flex: 1,
  },
  detailedButtonText: {
    ...Typography.bodyMedium,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  detailedButtonSub: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  saveButtonText: susevarButtonText,
});
