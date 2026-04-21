// S.P.A.R.K. — Transactions Screen
// P9: Liste artık iç içe `sections.map` yerine tek boyutlu item array’i kullanır;
// her satır (tarih başlığı ya da işlem) FlatList virtualization’ı ile yalnızca
// görünür alanda render edilir. Pagination (`loadMore`) veriyi DB’den sayfa
// sayfa çeker, böylece binlerce kayıtta bile anlık açılış süresi sabit kalır.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
  Pressable,
  BackHandler,
  ActivityIndicator,
  type ListRenderItemInfo,
} from 'react-native';
import { useAppTheme } from '../../src/theme/themeStore';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/theme/colors';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../../src/theme/spacing';
import { ExpenseWithDetails } from '../../src/db/schema';
import { usePaginatedExpenses } from '../../src/hooks/useExpenses';
import { formatDate, groupByDate } from '../../src/utils/dateUtils';
import TransactionRow from '../../src/components/TransactionRow';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { useRefresh, useExpenseDataRefresh } from '../../src/context/RefreshContext';
import GlassDeleteModal from '../../src/components/GlassDeleteModal';
import { SparkToast } from '../../src/components/SparkToast';
import { ExpenseDao } from '../../src/db/expenseDao';

type Row =
  | { kind: 'header'; date: string; key: string }
  | { kind: 'row'; expense: ExpenseWithDetails; key: string };

export default function TransactionsScreen() {
  const scheme = useAppTheme();
  // P10: StyleSheet sadece tema değiştiğinde yeniden oluşur.
  const styles = useMemo(() => getStyles(), [scheme]);
  const router = useRouter();
  const { t } = useLanguage();
  const { items: expenses, loadingMore, hasMore, loadMore, refresh } = usePaginatedExpenses(60);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { refreshKey, triggerRefresh } = useRefresh();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useExpenseDataRefresh(refresh);

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectionMode) {
        exitSelection();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selectionMode, exitSelection]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // P9: Callback referans kararlılığı — TransactionRow React.memo’lu;
  // onPress/onLongPress referansı her render’da değişirse tüm satırlar
  // boşuna yeniden çizilirdi. Ref pattern ile referansı sabit tutuyoruz.
  const stateRef = useRef({ selectionMode, router, toggleSelect });
  stateRef.current = { selectionMode, router, toggleSelect };

  const handleRowPress = useCallback((expenseId: number) => {
    const s = stateRef.current;
    if (s.selectionMode) {
      Haptics.selectionAsync();
      s.toggleSelect(expenseId);
      return;
    }
    s.router.push(`/add-expense?id=${expenseId}`);
  }, []);

  const handleRowLongPress = useCallback((expenseId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const s = stateRef.current;
    if (s.selectionMode) {
      s.toggleSelect(expenseId);
    } else {
      setSelectionMode(true);
      setSelectedIds(new Set([expenseId]));
    }
  }, []);

  const openBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBulkDeleteVisible(true);
  }, [selectedIds.size]);

  const runBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setBulkDeleteVisible(false);
      return;
    }
    setDeleting(true);
    try {
      await ExpenseDao.deleteMany(ids);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(
        t('transactions_deleted_bulk', { count: ids.length.toString() }),
        'success',
      );
      triggerRefresh();
      await refresh();
      exitSelection();
    } catch (e) {
      console.error(e);
      SparkToast.show(t('delete_failed'), 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteVisible(false);
    }
  }, [selectedIds, t, triggerRefresh, refresh, exitSelection]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(e =>
      (e.vendor_name || '').toLowerCase().includes(q) ||
      (e.category_name || '').toLowerCase().includes(q) ||
      (e.note || '').toLowerCase().includes(q),
    );
  }, [expenses, searchQuery]);

  // P9: Tek boyutlu liste — FlatList virtualization’ı artık iç içe `.map` değil
  // gerçek satırlar üzerinde çalışır.
  const rows = useMemo<Row[]>(() => {
    const grouped = groupByDate(filtered);
    const sorted = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
    const out: Row[] = [];
    for (const [date, group] of sorted) {
      out.push({ kind: 'header', date, key: `h:${date}` });
      for (const exp of group) out.push({ kind: 'row', expense: exp, key: `e:${exp.id}` });
    }
    return out;
  }, [filtered]);

  const keyExtractor = useCallback((item: Row) => item.key, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.kind === 'header') {
        return <Text style={styles.dateHeader}>{formatDate(item.date, t)}</Text>;
      }
      return (
        <TransactionRow
          expense={item.expense}
          selectionMode={selectionMode}
          selected={selectedIds.has(item.expense.id)}
          onPress={() => handleRowPress(item.expense.id)}
          onLongPress={() => handleRowLongPress(item.expense.id)}
        />
      );
    },
    [t, styles, selectionMode, selectedIds, handleRowPress, handleRowLongPress],
  );

  const selectedCount = selectedIds.size;
  const headerActionDisabled = selectionMode && selectedCount === 0;

  const listFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }, [loadingMore, styles]);

  const handleEndReached = useCallback(() => {
    // Arama açıkken liste sonuna yaklaşmak pratik olarak mümkün değildir; yine de
    // hasMore true ise arka planda devamını çek ki arama sonuçları genişlesin.
    if (hasMore) loadMore();
  }, [hasMore, loadMore]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {selectionMode ? (
          <Pressable
            onPress={exitSelection}
            style={styles.headerIconBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
          >
            <MaterialCommunityIcons name="close" size={24} color={Colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.headerIconPlaceholder} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {selectionMode
            ? t('transactions_selected', { count: selectedCount.toString() })
            : t('transactions_title')}
        </Text>
        <Pressable
          onPress={selectionMode ? openBulkDelete : () => router.push('/add-expense')}
          disabled={headerActionDisabled || deleting}
          style={[
            styles.addButton,
            selectionMode && styles.deleteButton,
            headerActionDisabled && styles.addButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={selectionMode ? t('delete') : t('add_expense_title')}
        >
          <MaterialCommunityIcons
            name={selectionMode ? 'delete-outline' : 'plus'}
            size={24}
            color={selectionMode ? Colors.danger : Colors.primary}
          />
        </Pressable>
      </View>

      <Animated.View entering={FadeIn.duration(300)} style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_transaction')}
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={!selectionMode}
        />
        {searchQuery.length > 0 && !selectionMode && (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      </Animated.View>

      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        removeClippedSubviews={!selectionMode}
        initialNumToRender={18}
        maxToRenderPerBatch={16}
        windowSize={9}
        updateCellsBatchingPeriod={40}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="receipt" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('no_transactions')}</Text>
            <Text style={styles.emptySubtitle}>{t('no_transactions_subtitle')}</Text>
          </View>
        }
      />

      <GlassDeleteModal
        visible={bulkDeleteVisible}
        title={t('delete')}
        message={t('confirm_delete_transactions', { count: selectedCount.toString() })}
        onCancel={() => !deleting && setBulkDeleteVisible(false)}
        onDelete={runBulkDelete}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    ...Typography.headlineLarge,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 51, 51, 0.12)',
    borderColor: 'rgba(255, 51, 51, 0.35)',
  },
  addButtonDisabled: {
    opacity: 0.35,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginHorizontal: ScreenPadding.horizontal,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 100,
  },
  dateHeader: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.headlineSmall,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
