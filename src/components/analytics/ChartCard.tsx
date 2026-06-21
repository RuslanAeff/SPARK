// S.P.A.R.K. — Analiz kartı: Günlük/yıllık harcama grafiği (bar chart)
import React from 'react';
import { Text } from 'react-native';
import AnimatedCard from '../AnimatedCard';
import BarChart from '../BarChart';
import type { BaseCardProps, Timeframe } from './shared';

interface BarDatum {
  label: string;
  value: number;
}

interface ChartCardProps extends BaseCardProps {
  timeframe: Timeframe;
  barData: BarDatum[];
  prevBarData?: BarDatum[];
}

function ChartCard({ styles, t, currency, timeframe, barData, prevBarData }: ChartCardProps) {
  return (
    <AnimatedCard delay={100} style={{ ...styles.section, ...styles.primaryCard }}>
      <Text style={styles.trendTitle}>
        {timeframe === 'year' ? t('annual_distribution') : t('daily_fluctuation')}
      </Text>
      <BarChart data={barData} prevData={prevBarData} height={160} currency={currency} />
    </AnimatedCard>
  );
}

export default React.memo(ChartCard);
