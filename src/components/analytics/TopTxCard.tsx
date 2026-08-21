// S.P.A.R.K. — Analiz kartı: En yüksek tutarlı işlemler (top transactions)
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ExpenseWithDetails } from '../../db/schema';
import type { TopTransactionSelection } from '../../db/expenseDao';
import type { BaseCardProps } from './shared';
import { useTabSwipe } from '../../context/TabSwipeContext';

interface TopTxCardProps extends BaseCardProps {
  topTx: ExpenseWithDetails[];
  selection?: TopTransactionSelection;
}

const TOP_TX_PAGE_SIZE = 5;

function TopTxCard({ styles, t, tc, currency, topTx, selection = 'overall' }: TopTxCardProps) {
  useThemeRevision();
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  const [pageWidth, setPageWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const pages = useMemo(() => {
    const result: ExpenseWithDetails[][] = [];
    for (let index = 0; index < topTx.length; index += TOP_TX_PAGE_SIZE) {
      result.push(topTx.slice(index, index + TOP_TX_PAGE_SIZE));
    }
    return result;
  }, [topTx]);

  useEffect(() => {
    setPageIndex(current => Math.min(current, Math.max(0, pages.length - 1)));
  }, [pages.length]);
  useEffect(
    () => () => setNestedHorizontalGestureActive(false),
    [setNestedHorizontalGestureActive],
  );

  if (topTx.length === 0) return null;
  const isPerVendor = selection === 'per-vendor';
  const releaseTabSwipe = () => setNestedHorizontalGestureActive(false);

  return (
    <AnimatedCard delay={350} style={styles.section}>
      <View style={styles.topTxHeader}>
        <Text style={[styles.sectionTitle, isPerVendor && styles.topTxTitleWithHint]}>
          {t(isPerVendor ? 'top_transactions_per_vendor' : 'top_transactions')}
        </Text>
        {pages.length > 1 && (
          <Text testID="top-tx-page-counter" style={styles.vendorPageCounter}>
            {pageIndex + 1} / {pages.length}
          </Text>
        )}
      </View>
      {isPerVendor && (
        <View style={styles.topTxHintRow}>
          <MaterialCommunityIcons name="information-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.topTxHint}>{t('top_transactions_per_vendor_hint')}</Text>
        </View>
      )}
      <View
        testID="top-tx-pager-viewport"
        onLayout={event => setPageWidth(Math.round(event.nativeEvent.layout.width))}
        style={styles.topTxPagerViewport}
      >
        <ScrollView
          testID="top-tx-pager"
          horizontal
          pagingEnabled
          scrollEnabled={pages.length > 1}
          nestedScrollEnabled
          directionalLockEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onTouchStart={() => pages.length > 1 && setNestedHorizontalGestureActive(true)}
          onTouchEnd={releaseTabSwipe}
          onTouchCancel={releaseTabSwipe}
          onMomentumScrollEnd={event => {
            releaseTabSwipe();
            if (pageWidth > 0) {
              setPageIndex(Math.max(0, Math.min(
                pages.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / pageWidth),
              )));
            }
          }}
        >
          {pages.map((page, pageNumber) => (
            <View
              key={`top-tx-page-${pageNumber}`}
              testID={`top-tx-page-${pageNumber}`}
              style={[
                styles.topTxPage,
                pages.length > 1 && styles.topTxPageFixed,
                pageWidth > 0 && { width: pageWidth },
              ]}
            >
              {page.map((tx, rowIndex) => {
                const rank = pageNumber * TOP_TX_PAGE_SIZE + rowIndex + 1;
                return (
        <View key={tx.id} style={[styles.topTxRow, rowIndex === page.length - 1 && styles.topTxRowLast]}>
          <View style={[styles.topTxRank, { backgroundColor: rank === 1 ? Colors.warning : Colors.surfaceLight }]}>
            <Text style={[styles.topTxRankText, rank === 1 && { color: Colors.background }]}>{rank}</Text>
          </View>
          {tx.category_icon ? (
            <View style={[styles.topTxCatIcon, { backgroundColor: (tx.category_color || Colors.primary) + '22' }]}>
              <MaterialCommunityIcons name={tx.category_icon as any} size={16} color={tx.category_color || Colors.primary} />
            </View>
          ) : null}
          <View style={styles.topTxContent}>
            <Text style={styles.topTxVendor}>{tx.vendor_name || t('unknown')}</Text>
            <Text style={styles.topTxDate}>{tx.date.split('-').reverse().slice(0, 2).join('-')} • {tc(tx.category_name ?? '')}</Text>
          </View>
          <Text style={[styles.topTxAmount, { color: Colors.danger }]}>-{formatCurrency(tx.total_amount, currency)}</Text>
        </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
      {pages.length > 1 && (
        <View style={styles.pricePageDots}>
          {pages.map((_, index) => (
            <View key={`top-tx-dot-${index}`} style={[styles.pricePageDot, index === pageIndex && styles.pricePageDotActive]} />
          ))}
        </View>
      )}
    </AnimatedCard>
  );
}

export default React.memo(TopTxCard);
