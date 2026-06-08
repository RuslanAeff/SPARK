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
  PanResponder,
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

  // ── Drag-to-multiselect + auto-scroll (Word'deki çoklu seçim hissi) ──
  // Long-press → seçim modu + ilk satır seçilir; parmak basılı tutulup
  // sürüklendikçe altındaki satırlar seçim setine eklenir. Parmak ekranın
  // alt/üst kenarına yaklaşınca liste otomatik kayar.
  const flatListRef = useRef<FlatList<Row>>(null);
  const wrapperRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const listLayoutRef = useRef({ y: 0, height: 0 });
  const dragSelectingRef = useRef(false);
  const lastTouchedIdRef = useRef<number | null>(null);
  const rowsRef = useRef<Row[]>([]);
  const [dragSelecting, setDragSelecting] = useState(false);
  const [autoScrollDir, setAutoScrollDir] = useState<-1 | 0 | 1>(0);

  // İlk render'da gerçek cell yüksekliklerini ölç → drag sırasında parmak
  // altındaki satırı pixel-perfect tespit. Tahmin başlangıç değerleri (sabit
  // değişmesin diye ref).
  const measuredRef = useRef({ header: 32, row: 72, headerLocked: false, rowLocked: false });
  const EDGE_THRESHOLD = 90;
  const AUTO_SCROLL_SPEED = 14;

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

  const handleRowPress = useCallback((expenseId: number) => {
    if (selectionMode) {
      Haptics.selectionAsync();
      toggleSelect(expenseId);
      return;
    }
    router.push(`/add-expense?id=${expenseId}`);
  }, [selectionMode, router, toggleSelect]);

  const handleRowLongPress = useCallback((expenseId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectionMode) {
      toggleSelect(expenseId);
    } else {
      setSelectionMode(true);
      setSelectedIds(new Set([expenseId]));
    }
    // Drag-to-multiselect: long-press anından parmak kalkana kadar sürükleme
    // ile ek satırlar seçilir. flag ref + state ikisi de set edilir (ref
    // PanResponder closure'ı için, state FlatList scrollEnabled için).
    lastTouchedIdRef.current = expenseId;
    dragSelectingRef.current = true;
    setDragSelecting(true);
  }, []);

  // Auto-scroll loop: parmak edge'deyken liste otomatik kayar.
  useEffect(() => {
    if (autoScrollDir === 0) return;
    const interval = setInterval(() => {
      const next = Math.max(0, scrollOffsetRef.current + autoScrollDir * AUTO_SCROLL_SPEED);
      flatListRef.current?.scrollToOffset({ offset: next, animated: false });
      scrollOffsetRef.current = next;
    }, 16);
    return () => clearInterval(interval);
  }, [autoScrollDir]);

  // Parmak Y'sinden hangi satırın altında olduğunu bulur — ölçülen gerçek
  // yükseklikleri kullanır (header + row).
  const findExpenseIdAtListY = useCallback((listY: number): number | null => {
    const { header: HH, row: RH } = measuredRef.current;
    let cumY = 0;
    for (const row of rowsRef.current) {
      const h = row.kind === 'header' ? HH : RH;
      if (listY >= cumY && listY < cumY + h) {
        return row.kind === 'row' ? row.expense.id : null;
      }
      cumY += h;
    }
    return null;
  }, []);

  // PanResponder — ref pattern ile referans-kararlı. Drag aktif olduğunda
  // FlatList scroll'unu intercept eder (scrollEnabled=false ile uyum içinde).
  const dragPan = useRef(
    PanResponder.create({
      // Capture fazı önemli: TransactionRow Pressable olduğu için normal akışta
      // touch event'lerini yutuyor → PanResponder'a hareket düşmüyor. Capture
      // ile drag aktifken child responder'lardan önce yakalıyoruz.
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        dragSelectingRef.current && (Math.abs(gs.dy) > 4 || Math.abs(gs.dx) > 4),
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        dragSelectingRef.current && (Math.abs(gs.dy) > 4 || Math.abs(gs.dx) > 4),
      onPanResponderMove: (evt) => {
        if (!dragSelectingRef.current) return;
        const touchPageY = evt.nativeEvent.pageY;
        const { y: listTop, height: listH } = listLayoutRef.current;
        const relY = touchPageY - listTop;

        // Edge auto-scroll
        if (relY < EDGE_THRESHOLD) setAutoScrollDir(-1);
        else if (relY > listH - EDGE_THRESHOLD) setAutoScrollDir(1);
        else setAutoScrollDir(0);

        // Parmak altındaki satırı tespit + ek seç
        const listCoordY = scrollOffsetRef.current + relY;
        const id = findExpenseIdAtListY(listCoordY);
        if (id !== null && id !== lastTouchedIdRef.current) {
          lastTouchedIdRef.current = id;
          setSelectedIds(prev => {
            if (prev.has(id)) return prev; // additive — geri silmez
            const next = new Set(prev);
            next.add(id);
            Haptics.selectionAsync();
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        dragSelectingRef.current = false;
        lastTouchedIdRef.current = null;
        setDragSelecting(false);
        setAutoScrollDir(0);
      },
      onPanResponderTerminate: () => {
        dragSelectingRef.current = false;
        lastTouchedIdRef.current = null;
        setDragSelecting(false);
        setAutoScrollDir(0);
      },
    }),
  ).current;

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

  // P9: Tek boyutlu liste — FlatList virtualization'ı artık iç içe `.map` değil
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

  // findExpenseIdAtListY closure'ı ref'ten okuyacak — her render güncel veri.
  rowsRef.current = rows;

  const keyExtractor = useCallback((item: Row) => item.key, []);

  // Cell yüksekliklerini ilk render'da ölç — drag select pixel-doğru olsun.
  const onCellLayout = useCallback((kind: 'header' | 'row', height: number) => {
    const m = measuredRef.current;
    if (kind === 'header' && !m.headerLocked && height > 0) {
      m.header = height;
      m.headerLocked = true;
    } else if (kind === 'row' && !m.rowLocked && height > 0) {
      m.row = height;
      m.rowLocked = true;
    }
  }, []);

  // renderItem — selectionMode ve selectedIds bağımlılık dizisindedir.
  // Seçim durumu değiştiğinde renderItem referansı güncellenir ve FlatList
  // tüm görünür hücreleri yeni seçim durumuna göre yeniden çizer.
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      if (item.kind === 'header') {
        return (
          <Text
            style={styles.dateHeader}
            onLayout={(e) => onCellLayout('header', e.nativeEvent.layout.height)}
          >
            {formatDate(item.date, t)}
          </Text>
        );
      }
      return (
        <View onLayout={(e) => onCellLayout('row', e.nativeEvent.layout.height)}>
          <TransactionRow
            expense={item.expense}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.expense.id)}
            onPress={() => handleRowPress(item.expense.id)}
            onLongPress={() => handleRowLongPress(item.expense.id)}
          />
        </View>
      );
    },
    [t, styles, handleRowPress, handleRowLongPress, onCellLayout, selectionMode, selectedIds],
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

  // FlatList'e extraData vererek selectionMode/selectedIds değiştiğinde
  // yeniden render tetiklenir — renderItem referansı değişmeden.
  const extraData = useMemo(
    () => ({ selectionMode, selectedIds }),
    [selectionMode, selectedIds],
  );

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

      <View
        ref={wrapperRef}
        style={{ flex: 1 }}
        onLayout={() => {
          // measure ile pageY (ekran-mutlak Y) — drag pan responder bunu kullanır.
          wrapperRef.current?.measure((_x, _y, _w, h, _pageX, pageY) => {
            listLayoutRef.current = { y: pageY, height: h };
          });
        }}
        {...dragPan.panHandlers}
      >
        <FlatList
          ref={flatListRef}
          data={rows}
          extraData={extraData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          removeClippedSubviews={false}
          initialNumToRender={18}
          maxToRenderPerBatch={16}
          windowSize={9}
          updateCellsBatchingPeriod={40}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={listFooter}
          // Drag aktifken FlatList kendi scroll'unu devre dışı bırakıyor; auto-scroll
          // loop scrollToOffset ile programatik kaydırıyor → çakışma olmuyor.
          scrollEnabled={!dragSelecting}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          // Drag aktifken pull-to-refresh devre dışı (Android `enabled` prop'u).
          // refreshControl'ü tamamen kaldırmak FlatList'i resetleyip scroll
          // pozisyonunu en üste atıyordu — onun yerine prop ile kontrol.
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              enabled={!dragSelecting}
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
      </View>

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
