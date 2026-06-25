// S.P.A.R.K. — Analiz kartı: En yüksek tutarlı işlemler (top transactions)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ExpenseWithDetails } from '../../db/schema';
import type { BaseCardProps } from './shared';

interface TopTxCardProps extends BaseCardProps {
  topTx: ExpenseWithDetails[];
}

function TopTxCard({ styles, t, tc, currency, topTx }: TopTxCardProps) {
  if (topTx.length === 0) return null;
  const txList = (
    <>
      {topTx.map((tx, i) => (
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
      <Text style={styles.sectionTitle}>{t('top_transactions')}</Text>
      {/* İç içe dikey ScrollView yok — dış sayfanın pull-to-refresh'i ile çakışır.
          Liste 8 ile sınırlı (useTopTransactions), satır içi render dış sayfayla kayar. */}
      {txList}
    </AnimatedCard>
  );
}

export default React.memo(TopTxCard);
