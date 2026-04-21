import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';
import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { ExpenseDao } from '../src/db/expenseDao';
import { ExpenseItem } from '../src/db/schema';
import { SparkToast } from '../src/components/SparkToast';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import { formatCurrency } from '../src/utils/formatCurrency';
import { useCurrency } from '../src/context/CurrencyContext';
import { useLanguage } from '../src/i18n/LanguageContext';
import { effectiveLineDiscount, lineHasDiscount } from '../src/utils/receiptLineDiscountUi';
import {
  susevarButton,
  susevarButtonPressed,
  susevarButtonText,
} from '../src/theme/susevar';

export default function EditItemsScreen() {
  const styles = getStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (id) loadItems();
  }, [id]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await ExpenseDao.getItems(parseInt(id));
      setItems(data);
    } catch (e) {
      SparkToast.show(t('error_loading_items'), 'error');
    }
    setLoading(false);
  }

  function resetForm() {
    setEditingItemId(null);
    setItemName('');
    setQuantity('1');
    setUnitPrice('');
  }

  function handleEditClick(item: ExpenseItem) {
    setEditingItemId(item.id);
    setItemName(item.name);
    setQuantity(item.quantity.toString());
    setUnitPrice(item.unit_price.toString());
  }

  async function handleSaveItem() {
    if (!itemName.trim() || !unitPrice.trim() || !quantity.trim()) {
      SparkToast.show(t('missing_fields'), 'error');
      return;
    }

    const q = parseFloat(quantity);
    const up = parseFloat(unitPrice.replace(',', '.'));
    if (isNaN(q) || isNaN(up) || q <= 0 || up <= 0) {
      SparkToast.show(t('invalid_qty_price'), 'error');
      return;
    }

    const totalPrice = q * up;
    const expenseId = parseInt(id);

    try {
      if (editingItemId) {
        await ExpenseDao.updateItem(editingItemId, {
          name: itemName.trim(),
          turkish_name: itemName.trim(),
          quantity: q,
          unit_price: up,
          total_price: totalPrice,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SparkToast.show(t('item_updated'), 'success');
      } else {
        await ExpenseDao.addItem({
          expense_id: expenseId,
          name: itemName.trim(),
          turkish_name: itemName.trim(),
          quantity: q,
          unit_price: up,
          total_price: totalPrice,
          category_id: null,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SparkToast.show(t('item_added'), 'success');
      }

      await ExpenseDao.syncExpenseTotal(expenseId);
      resetForm();
      await loadItems();
    } catch (e) {
      SparkToast.show(t('operation_failed'), 'error');
    }
  }

  function confirmDelete(itemId: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteConfirmId(itemId);
  }

  async function handleDeleteItem(itemId: number) {
    try {
      await ExpenseDao.deleteItem(itemId);
      await ExpenseDao.syncExpenseTotal(parseInt(id));
      SparkToast.show(t('item_deleted'), 'success');
      if (editingItemId === itemId) resetForm();
      await loadItems();
    } catch (e) {
      SparkToast.show(t('delete_failed'), 'error');
    }
  }

  const currentTotal = items.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>{t('item_details_title')}</Text>
        </View>

        {/* Grand Total Bar */}
        <View style={styles.totalBar}>
          <Text style={styles.totalBarText}>{t('current_total')}</Text>
          <Text style={styles.totalBarAmount}>{formatCurrency(currentTotal, currency)}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Item List */}
          <Text style={styles.sectionTitle}>{t('receipt_items_count', { count: items.length.toString() })}</Text>
          
          <View style={styles.listContainer}>
            {items.map((item) => {
              const hasDisc = lineHasDiscount(item);
              const discAmt = effectiveLineDiscount(item);
              const listAmt = item.list_line_total_before_discount;
              return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {hasDisc && (
                    <View style={styles.discountMeta}>
                      {listAmt != null && listAmt > item.total_price + 0.001 && (
                        <Text style={styles.itemWasPrice}>
                          {t('receipt_line_was', {
                            amount: formatCurrency(listAmt, currency),
                          })}
                        </Text>
                      )}
                      {discAmt > 0.001 && (
                        <Text style={styles.itemDiscountHint}>
                          {t('receipt_line_discount', {
                            amount: formatCurrency(discAmt, currency, false),
                          })}
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.itemSubText}>{item.quantity}x {formatCurrency(item.unit_price, currency)}</Text>
                </View>
                <Text style={[styles.itemPrice, hasDisc && styles.itemPriceNet]}>
                  {formatCurrency(item.total_price, currency)}
                </Text>
                
                <View style={styles.itemActions}>
                  <Pressable style={styles.actionBtn} onPress={() => handleEditClick(item)}>
                    <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.info} />
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => confirmDelete(item.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.danger} />
                  </Pressable>
                </View>
              </View>
              );
            })}
            {items.length === 0 && !loading && (
              <Text style={styles.emptyText}>{t('no_items_added_yet')}</Text>
            )}
          </View>
        </ScrollView>

        {/* Edit / Add Form Fixed at Bottom */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingItemId ? t('edit_item') : t('add_item_manual')}
            </Text>
            {editingItemId && (
              <Pressable onPress={resetForm}>
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </Pressable>
            )}
          </View>
          
          <TextInput
            style={styles.input}
            placeholder={t('product_name_placeholder')}
            placeholderTextColor={Colors.textMuted}
            value={itemName}
            onChangeText={setItemName}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 0.4 }]}
              placeholder={t('quantity_placeholder')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={setQuantity}
            />
            <TextInput
              style={[styles.input, { flex: 0.6 }]}
              placeholder={t('unit_price_placeholder')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={unitPrice}
              onChangeText={setUnitPrice}
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={handleSaveItem}
          >
            <Text style={styles.saveBtnText}>{editingItemId ? t('update') : t('add')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <GlassDeleteModal
        visible={deleteConfirmId !== null}
        message={t('delete_item_msg')}
        onCancel={() => setDeleteConfirmId(null)}
        onDelete={() => {
          if (deleteConfirmId !== null) {
            handleDeleteItem(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
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
  totalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  totalBarText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },
  totalBarAmount: {
    ...Typography.headlineMedium,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    letterSpacing: 1,
  },
  listContainer: {
    gap: Spacing.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: Spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  discountMeta: {
    marginTop: 6,
    gap: 4,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  itemWasPrice: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  itemDiscountHint: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.medium,
  },
  itemSubText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemPrice: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  itemPriceNet: {
    color: Colors.primary,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    paddingLeft: Spacing.md,
  },
  actionBtn: {
    padding: 4,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xxl,
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: ScreenPadding.horizontal,
    paddingBottom: Spacing.xl, // Safe area padding
    gap: Spacing.md,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formTitle: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  cancelText: {
    ...Typography.labelMedium,
    color: Colors.danger,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  /** Şüşevar — Ekle / Güncelle */
  saveBtn: susevarButton,
  saveBtnPressed: susevarButtonPressed,
  saveBtnText: susevarButtonText,
});
