// S.P.A.R.K. — Analiz kartı: En yüksek tutarlı işlemler (top transactions)
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ExpenseWithDetails } from '../../db/schema';
import type { TopTransactionSelection } from '../../db/expenseDao';
import type { BaseCardProps } from './shared';

interface TopTxCardProps extends BaseCardProps {
  topTx: ExpenseWithDetails[];
  selection?: TopTransactionSelection;
}

const TOP_TX_VISIBLE = 3;

function TopTxCard({ styles, t, tc, currency, topTx, selection = 'overall' }: TopTxCardProps) {
  // Varsayılan ilk 3'ü göster + "Daha çok" ile satır içi genişlet (iç içe
  // ScrollView yerine → pull-to-refresh çakışması yok, kart kısa kalır).
  const [expanded, setExpanded] = useState(false);
  if (topTx.length === 0) return null;
  const canCollapse = topTx.length > TOP_TX_VISIBLE;
  const visibleTx = canCollapse && !expanded ? topTx.slice(0, TOP_TX_VISIBLE) : topTx;
  const isPerVendor = selection === 'per-vendor';
  const txList = (
    <>
      {visibleTx.map((tx, i) => (
        <View key={tx.id} style={styles.topTxRow}>
          <View style={[styles.topTxRank, { backgroundColor: i === 0 ? Colors.warning : Colors.surfaceLight }]}>
            <Text style={[styles.topTxRankText, i === 0 && { color: Colors.background }]}>{i + 1}</Text>
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
      ))}
    </>
  );
  return (
    <AnimatedCard delay={350} style={styles.section}>
      <Text style={[styles.sectionTitle, isPerVendor && styles.topTxTitleWithHint]}>
        {t(isPerVendor ? 'top_transactions_per_vendor' : 'top_transactions')}
      </Text>
      {isPerVendor && (
        <View style={styles.topTxHintRow}>
          <MaterialCommunityIcons name="information-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.topTxHint}>{t('top_transactions_per_vendor_hint')}</Text>
        </View>
      )}
      {txList}
      {canCollapse && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.showMoreBtn}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={styles.showMoreText}>
            {expanded ? t('show_less') : t('show_more_top_tx', { count: (topTx.length - TOP_TX_VISIBLE).toString() })}
          </Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.primary}
          />
        </Pressable>
      )}
    </AnimatedCard>
  );
}

export default React.memo(TopTxCard);
