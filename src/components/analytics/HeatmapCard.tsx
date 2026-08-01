// S.P.A.R.K. — Analiz kartı: Harcama takvimi (ısı haritası)
import React from 'react';
import { Text } from 'react-native';
import AnimatedCard from '../AnimatedCard';
import SpendingHeatmap from '../SpendingHeatmap';
import type { BaseCardProps } from './shared';

interface HeatmapCardProps extends BaseCardProps {
  heatmapInfo: { start: string; end: string } | null;
  dailyData: { date: string; total: number }[];
}

function HeatmapCard({ styles, t, heatmapInfo, dailyData }: HeatmapCardProps) {
  // Yalnızca aylık görünümde anlamlı; aksi halde kart render edilmez.
  if (!heatmapInfo) return null;
  return (
    <AnimatedCard delay={350} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('spending_calendar')}</Text>
      <SpendingHeatmap
        data={dailyData}
        startDate={heatmapInfo.start}
        endDate={heatmapInfo.end}
      />
    </AnimatedCard>
  );
}

export default React.memo(HeatmapCard);
