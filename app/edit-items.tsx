import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
import ConfirmModal from '../src/components/ConfirmModal';
import { formatCurrency } from '../src/utils/formatCurrency';
import { useCurrency } from '../src/context/CurrencyContext';
import { useLanguage } from '../src/i18n/LanguageContext';
import {
  effectiveLineDiscount,
  effectiveListLineTotal,
  formatReceiptDiscountAmount,
  lineHasDiscount,
} from '../src/utils/receiptLineDiscountUi';
import { itemDisplayName } from '../src/utils/itemDisplayName';
import {
  formatMoneyInput,
  formatUnitRateInput,
  parseMoneyInput,
  parseUnitRateInput,
  subtractMoney,
  sumMoney,
  toMinorUnits,
} from '../src/utils/moneyMath';
import { calculateReceiptLineAmounts } from '../src/utils/receiptMoney';
import {
  createSusevarStyles,
  susevarButtonPressed,
} from '../src/theme/susevar';
import { useThemeRevision } from '../src/theme/themeStore';
import {
  formatMeasurementQuantity,
  measurementInputFromStored,
  measurementUnitSuffix,
  normalizeMeasurementInput,
  type MeasurementInputUnit,
} from '../src/utils/measurementUnit';
import ScreenHeader from '../src/components/ScreenHeader';

const UNIT_OPTIONS: MeasurementInputUnit[] = ['piece', 'kg', 'g', 'l', 'ml'];

export default function EditItemsScreen() {
  useThemeRevision();
  const styles = getStyles();
  const { t } = useLanguage();
  const { currency: displayCurrency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [recordCurrency, setRecordCurrency] = useState<string>(displayCurrency);
  const [loading, setLoading] = useState(true);

  // Form state
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementInputUnit>('piece');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  // Ref aynı karede gelen ikinci dokunuşu da durdurur; aynı kalem iki kez eklenmez (BUG-29).
  const savingItemRef = useRef(false);
  const [savingItem, setSavingItem] = useState(false);
  // BUG-03 (ürün kararı B, ADR-004 madde 12): basılı fiş toplamı; değişecekse önce onay.
  const [headerTotal, setHeaderTotal] = useState<number | null>(null);
  const [pendingTotalChange, setPendingTotalChange] = useState<{
    from: number;
    to: number;
    run: () => Promise<void>;
  } | null>(null);
  // Düzenleme başladığında para alanlarının form metni; değişmediyse yalnız ad yazılır.
  const editSnapshotRef = useRef<{ quantity: string; unit: MeasurementInputUnit; unitPrice: string; discount: string } | null>(null);

  /** Kupon sınırı ihlali genel hata yerine nedenini söyleyen mesajla gösterilir (BUG-29). */
  function itemWriteErrorKey(error: unknown, fallback: string): string {
    return (error as { message?: string } | null)?.message === 'INVALID_CONTAINER_RECOVERY'
      ? 'item_voucher_exceeds_total'
      : fallback;
  }

  useEffect(() => {
    if (id) loadItems();
  }, [id]);

  async function loadItems() {
    setLoading(true);
    try {
      const expense = await ExpenseDao.getById(parseInt(id));
      setItems(expense?.items ?? []);
      setHeaderTotal(expense ? expense.total_amount : null);
      setRecordCurrency(expense?.currency || displayCurrency);
    } catch (e) {
      SparkToast.show(t('error_loading_items'), 'error');
    }
    setLoading(false);
  }

  function resetForm() {
    editSnapshotRef.current = null;
    setEditingItemId(null);
    setItemName('');
    setQuantity('1');
    setMeasurementUnit('piece');
    setUnitPrice('');
    setDiscount('');
  }

  function handleEditClick(item: ExpenseItem) {
    setEditingItemId(item.id);
    // Kullanıcı listede çeviriyi (birincil) görüyor → düzenlemeye de ondan başlasın.
    setItemName(itemDisplayName(item).primary);
    const measurement = measurementInputFromStored(item.quantity, item.measurement_unit);
    setQuantity(Number(measurement.quantity.toFixed(3)).toString());
    setMeasurementUnit(measurement.inputUnit);
    // Düzenlemede ETİKET (indirim öncesi) birim fiyatı göster; indirim ayrı alanda.
    // Net birim yerine etiket gösterilir ki tekrar kaydetmede indirim çift düşmesin.
    const eff = effectiveLineDiscount(item);
    const listTotal = effectiveListLineTotal(item);
    const labelUnit = item.quantity > 0 ? listTotal / item.quantity : listTotal;
    const snapshot = {
      quantity: Number(measurement.quantity.toFixed(3)).toString(),
      unit: measurement.inputUnit,
      unitPrice: formatUnitRateInput(labelUnit),
      discount: eff > 0 ? formatMoneyInput(eff) : '',
    };
    editSnapshotRef.current = snapshot;
    setQuantity(snapshot.quantity);
    setUnitPrice(snapshot.unitPrice);
    setDiscount(snapshot.discount);
  }

  /** Toplam değişecekse önce onay ister; aksi hâlde doğrudan yazar. */
  async function runWithTotalConfirmation(projected: number, write: () => Promise<void>) {
    if (headerTotal != null && toMinorUnits(projected) !== toMinorUnits(headerTotal)) {
      setPendingTotalChange({ from: headerTotal, to: projected, run: write });
      return;
    }
    await write();
  }

  async function guardedWrite(work: () => Promise<void>, fallbackError: string) {
    if (savingItemRef.current) return;
    savingItemRef.current = true;
    setSavingItem(true);
    try {
      await work();
      resetForm();
      await loadItems();
    } catch (e) {
      SparkToast.show(t(itemWriteErrorKey(e, fallbackError)), 'error');
    } finally {
      savingItemRef.current = false;
      setSavingItem(false);
    }
  }

  async function handleSaveItem() {
    if (!itemName.trim() || !unitPrice.trim() || !quantity.trim()) {
      SparkToast.show(t('missing_fields'), 'error');
      return;
    }

    const expenseIdForLabel = parseInt(id);
    const snapshot = editSnapshotRef.current;
    if (editingItemId && snapshot
      && quantity === snapshot.quantity && measurementUnit === snapshot.unit
      && unitPrice === snapshot.unitPrice && discount === snapshot.discount) {
      // Yalnız ad: para alanları yeniden hesaplanıp yazılmaz, toplam değişmez, onay yok.
      const itemId = editingItemId;
      await guardedWrite(async () => {
        await ExpenseDao.updateItemLabel(expenseIdForLabel, itemId, itemName.trim());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SparkToast.show(t('item_updated'), 'success');
      }, 'operation_failed');
      return;
    }

    const inputQuantity = Number(quantity.replace(',', '.'));
    const up = parseUnitRateInput(unitPrice);
    if (!Number.isFinite(inputQuantity) || up == null || inputQuantity <= 0 || up <= 0) {
      SparkToast.show(t('invalid_qty_price'), 'error');
      return;
    }
    const normalizedMeasurement = normalizeMeasurementInput(inputQuantity, measurementUnit);
    const q = normalizedMeasurement.quantity;

    const expenseId = parseInt(id);

    // Girilen "Unit Price" ETİKET (indirim öncesi) birim fiyattır; indirim satır
    // toplamından DÜŞÜLÜR → ödenen (net) = etiket toplam − indirim. (Eskiden
    // girilen fiyat net sanılıp list = net + indirim ile şişiriliyordu → indirim
    // eklemek fiyatı artırmış gibi görünüyordu.)
    const parsedDiscount = discount.trim() ? parseMoneyInput(discount) : 0;
    if (parsedDiscount == null || parsedDiscount < 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }
    const previewAmounts = calculateReceiptLineAmounts(q, up, 0);
    if (toMinorUnits(parsedDiscount) > toMinorUnits(previewAmounts.listLineTotal)) {
      SparkToast.show(t('discount_exceeds_line_total'), 'error');
      return;
    }
    const amounts = calculateReceiptLineAmounts(q, up, parsedDiscount);
    const hasDisc = amounts.discountAmount > 0;
    const discFields = {
      line_discount: hasDisc ? amounts.discountAmount : null,
      list_line_total_before_discount: hasDisc ? amounts.listLineTotal : null,
    };

    const targetItemId = editingItemId;
    const projected = targetItemId
      ? sumMoney(items.map(item => (item.id === targetItemId ? amounts.netTotal : item.total_price)))
      : sumMoney([...items.map(item => item.total_price), amounts.netTotal]);
    const write = () => guardedWrite(async () => {
      if (targetItemId) {
        await ExpenseDao.updateItemAndSyncTotal(expenseId, targetItemId, {
          // Gösterim düzeltmesi ham fiş adını/ilk çeviriyi ezmez. Böylece ürün
          // kimliği ayrılabilir ve fiş kanıtı daha sonra da denetlenebilir.
          user_label: itemName.trim(),
          quantity: q,
          measurement_unit: normalizedMeasurement.measurementUnit,
          unit_price: amounts.netUnitPrice,
          total_price: amounts.netTotal,
          ...discFields,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SparkToast.show(t('item_updated'), 'success');
      } else {
        await ExpenseDao.addItemAndSyncTotal({
          expense_id: expenseId,
          name: itemName.trim(),
          turkish_name: itemName.trim(),
          quantity: q,
          measurement_unit: normalizedMeasurement.measurementUnit,
          unit_price: amounts.netUnitPrice,
          total_price: amounts.netTotal,
          category_id: null,
          ...discFields,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SparkToast.show(t('item_added'), 'success');
      }
    }, 'operation_failed');
    await runWithTotalConfirmation(projected, write);
  }

  function confirmDelete(itemId: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteConfirmId(itemId);
  }

  async function handleDeleteItem(itemId: number) {
    try {
      await ExpenseDao.deleteItemAndSyncTotal(parseInt(id), itemId);
      SparkToast.show(t('item_deleted'), 'success');
      if (editingItemId === itemId) resetForm();
      await loadItems();
    } catch (e) {
      SparkToast.show(t(itemWriteErrorKey(e, 'delete_failed')), 'error');
    }
  }

  const currentTotal = sumMoney(items.map((item) => item.total_price));
  const headerDiffers = headerTotal != null && toMinorUnits(headerTotal) !== toMinorUnits(currentTotal);
  const deleteTarget = deleteConfirmId == null ? null : items.find(item => item.id === deleteConfirmId) ?? null;
  const totalAfterDelete = deleteTarget
    ? sumMoney(items.filter(item => item.id !== deleteTarget.id).map(item => item.total_price))
    : null;
  const deleteChangesTotal = headerTotal != null && totalAfterDelete != null
    && toMinorUnits(totalAfterDelete) !== toMinorUnits(headerTotal);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScreenHeader title={t('item_details_title')} />

        {/* Grand Total Bar */}
        <View style={styles.totalBar}>
          <Text style={styles.totalBarText}>{t('current_total')}</Text>
          <Text style={styles.totalBarAmount}>{formatCurrency(currentTotal, recordCurrency)}</Text>
        </View>
        {headerDiffers ? (
          // ADR-004 madde 8: basılı toplam ile kalem toplamı farkı sessiz kalmaz.
          <View testID="edit-items-header-diff" style={styles.headerDiffBar}>
            <MaterialCommunityIcons name="scale-unbalanced" size={16} color={Colors.warning} />
            <Text style={styles.headerDiffText}>
              {t('receipt_header_total_diff', {
                total: formatCurrency(headerTotal!, recordCurrency),
                diff: formatCurrency(Math.abs(subtractMoney(headerTotal!, currentTotal)), recordCurrency),
              })}
            </Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Item List */}
          <Text style={styles.sectionTitle}>{t('receipt_items_count', { count: items.length.toString() })}</Text>
          
          <View style={styles.listContainer}>
            {items.map((item) => {
              const hasDisc = lineHasDiscount(item);
              const discAmt = effectiveLineDiscount(item);
              const listAmt = item.list_line_total_before_discount;
              const display = itemDisplayName(item);
              return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{display.primary}</Text>
                  {display.secondary && (
                    <Text style={styles.itemNameOriginal} numberOfLines={1}>{display.secondary}</Text>
                  )}
                  {hasDisc && (
                    <View style={styles.discountMeta}>
                      {listAmt != null && listAmt > item.total_price + 0.001 && (
                        <Text style={styles.itemWasPrice}>
                          {t('receipt_line_was', {
                            amount: formatCurrency(listAmt, recordCurrency),
                          })}
                        </Text>
                      )}
                      {discAmt > 0.001 && (
                        <Text style={styles.itemDiscountHint}>
                          {t('receipt_line_discount', {
                            amount: formatReceiptDiscountAmount(discAmt, recordCurrency),
                          })}
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.itemSubText}>
                    {formatMeasurementQuantity(item.quantity, item.measurement_unit)} ·{' '}
                    {formatCurrency(item.unit_price, recordCurrency)}
                    {measurementUnitSuffix(item.measurement_unit, t('measurement_unit_piece'))}
                  </Text>
                </View>
                <Text style={[styles.itemPrice, hasDisc && styles.itemPriceNet]}>
                  {formatCurrency(item.total_price, recordCurrency)}
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
              placeholder={`${t('unit_price_placeholder')} ${measurementUnitSuffix(normalizeMeasurementInput(1, measurementUnit).measurementUnit, t('measurement_unit_piece'))}`}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={unitPrice}
              onChangeText={setUnitPrice}
            />
          </View>
          <View style={styles.unitSelector}>
            {UNIT_OPTIONS.map(unit => {
              const active = measurementUnit === unit;
              return (
                <Pressable
                  key={unit}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setMeasurementUnit(unit)}
                  style={[styles.unitChip, active && styles.unitChipActive]}
                >
                  <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                    {t(`measurement_unit_${unit}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.input}
            placeholder={t('discount_placeholder')}
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            value={discount}
            onChangeText={setDiscount}
          />
          <Pressable
            testID="edit-items-save"
            style={({ pressed }) => [styles.saveBtn, savingItem && { opacity: 0.6 }, pressed && styles.saveBtnPressed]}
            onPress={handleSaveItem}
            disabled={savingItem}
          >
            <Text style={styles.saveBtnText}>{editingItemId ? t('update') : t('add')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={pendingTotalChange != null}
        title={t('item_total_change_title')}
        message={pendingTotalChange ? t('item_total_change_msg', {
          from: formatCurrency(pendingTotalChange.from, recordCurrency),
          to: formatCurrency(pendingTotalChange.to, recordCurrency),
        }) : ''}
        confirmLabel={t('item_total_change_confirm')}
        cancelLabel={t('cancel')}
        tone="warning"
        icon="scale-balance"
        onCancel={() => setPendingTotalChange(null)}
        onConfirm={() => {
          const run = pendingTotalChange?.run;
          setPendingTotalChange(null);
          if (run) void run();
        }}
      />

      <GlassDeleteModal
        visible={deleteConfirmId !== null}
        message={deleteChangesTotal
          ? t('item_total_change_msg', {
            from: formatCurrency(headerTotal!, recordCurrency),
            to: formatCurrency(totalAfterDelete!, recordCurrency),
          })
          : t('delete_item_msg')}
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
  headerDiffBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  headerDiffText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
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
  itemNameOriginal: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: 1,
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
  unitSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  unitChip: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  unitChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  unitChipText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  unitChipTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
  /** Şüşevar — Ekle / Güncelle */
  saveBtn: createSusevarStyles(Colors).button,
  saveBtnPressed: susevarButtonPressed,
  saveBtnText: createSusevarStyles(Colors).text,
});
