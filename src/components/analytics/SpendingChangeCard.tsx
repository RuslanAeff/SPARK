import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTabSwipe } from '../../context/TabSwipeContext';
import AnimatedCard from '../AnimatedCard';
import { SettingsInfoHintModal, SettingsInfoIconButton } from '../SettingsInfoHint';
import { Colors } from '../../theme/colors';
import { useAppTheme, useThemeRevision } from '../../theme/themeStore';
import { Typography, FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import { buildSpendingChange } from '../../utils/spendingChange';
import type { AnalyticsComparisonRanges } from '../../utils/analyticsPeriod';
import type { BaseCardProps } from './shared';

export interface SpendingChangeState {
  status: 'ready' | 'loading' | 'unavailable' | 'no_completed_days';
  data: ReturnType<typeof buildSpendingChange>;
  ranges: AnalyticsComparisonRanges | null;
}

export default function SpendingChangeCard({ state, t, tc, currency, styles: shared }: BaseCardProps & { state: SpendingChangeState }) {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  const styles = useMemo(getStyles, [scheme, revision]);
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  const pager = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const rows = useMemo(() => state.data.all.filter(r => r.delta !== 0), [state.data]);
  const pages = useMemo(() => Array.from({ length: Math.ceil(rows.length / 4) }, (_, i) => rows.slice(i * 4, i * 4 + 4)), [rows]);
  useEffect(() => {
    setPageIndex(0);
    pager.current?.scrollTo({ x: 0, animated: false });
    setNestedHorizontalGestureActive(false);
  }, [rows, pageWidth, setNestedHorizontalGestureActive]);
  useEffect(() => () => setNestedHorizontalGestureActive(false), [setNestedHorizontalGestureActive]);
  const [info, setInfo] = useState(false);
  const max = Math.max(1, ...rows.map(row => Math.abs(row.delta)));
  const tone = state.data.delta > 0 ? Colors.danger : state.data.delta < 0 ? Colors.success : Colors.textSecondary;
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n), currency)}`;
  const date = (d: string) => d.split('-').reverse().join('.');
  return (
    <AnimatedCard delay={170} style={shared.section}>
      <View style={styles.header}>
        <View style={styles.icon}><MaterialCommunityIcons name="chart-waterfall" size={18} color={Colors.info} /></View>
        <Text style={styles.title}>{t('spending_change_title')}</Text>
        <SettingsInfoIconButton onPress={() => setInfo(true)} accessibilityLabel={t('spending_change_title')} />
      </View>
      {state.status !== 'ready' ? <Text style={styles.hint}>{t(state.status === 'loading' ? 'loading' : state.status === 'unavailable' ? 'comparison_data_unavailable' : 'comparison_no_completed_days')}</Text> : <>
        <Text testID="spending-change-total" style={[styles.total, { color: tone }]}>{signed(state.data.delta)}</Text>
        <Text style={styles.hint}>{t(state.data.delta > 0 ? 'spending_change_up' : state.data.delta < 0 ? 'spending_change_down' : 'spending_change_equal')}</Text>
        <View testID="change-viewport" style={styles.viewport} onLayout={e => setPageWidth(e.nativeEvent.layout.width)}>
          <ScrollView ref={pager} testID="change-pager" horizontal pagingEnabled scrollEnabled={pages.length > 1}
            showsHorizontalScrollIndicator={false} nestedScrollEnabled directionalLockEnabled
            onTouchStart={() => pages.length > 1 && setNestedHorizontalGestureActive(true)}
            onTouchEnd={() => setNestedHorizontalGestureActive(false)}
            onTouchCancel={() => setNestedHorizontalGestureActive(false)}
            onMomentumScrollEnd={e => {
              setNestedHorizontalGestureActive(false);
              if (pageWidth > 0) setPageIndex(Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / pageWidth))));
            }}>
          {pages.map((page, index) => <View key={index} testID={`change-page-${index}`} style={[styles.list, { width: pageWidth }]}>
          {page.map(row => {
            const color = row.delta > 0 ? Colors.danger : row.delta < 0 ? Colors.success : Colors.textMuted;
            return <View key={row.id} testID={`spending-change-${row.id}`} style={styles.row}>
              <View style={styles.rowHeading}>
                <Text style={styles.name} numberOfLines={1}>{row.name ? tc(row.name) : t('spending_change_uncategorized')}</Text>
                <Text style={[styles.amount, { color }]}>{signed(row.delta)}</Text>
              </View>
              <View style={styles.track}><View style={[styles.bar, { width: `${Math.abs(row.delta) / max * 100}%`, backgroundColor: color }]} /></View>
            </View>;
          })}
          {pages.length > 1 && Array.from({ length: 4 - page.length }, (_, slot) => <View key={`empty-${slot}`} style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text style={[styles.amount, { opacity: 0 }]}>—</Text><View style={{ height: 4 }} /></View>)}
          </View>)}
          </ScrollView>
          {rows.length === 0 && <Text style={styles.hint}>{t('spending_change_unchanged')}</Text>}
        </View>
        {pages.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageButtons}>
          {pages.map((_, index) => <Pressable key={index} testID={`change-page-button-${index}`} accessibilityRole="button"
            accessibilityLabel={t('price_page_jump', { page: String(index + 1) })} accessibilityState={{ selected: index === pageIndex }}
            onPress={() => { pager.current?.scrollTo({ x: index * pageWidth, animated: true }); setPageIndex(index); }}
            style={styles.pageButton}>
            <View style={[styles.pageIndicator, index === pageIndex && styles.pageIndicatorActive]} pointerEvents="none">
              <Text style={[styles.pageNumber, index === pageIndex && styles.pageNumberActive]}>{index + 1}</Text>
            </View>
          </Pressable>)}
        </ScrollView>}
      </>}
      {state.ranges && <View style={styles.dates}>
        <Text style={styles.date}>{t('this_period')} · {date(state.ranges.current.start)} – {date(state.ranges.current.end)}</Text>
        <Text style={styles.date}>{t('last_period')} · {date(state.ranges.previous.start)} – {date(state.ranges.previous.end)}</Text>
      </View>}
      <SettingsInfoHintModal visible={info} onClose={() => setInfo(false)} title={t('spending_change_title')} paragraphs={[t('spending_change_info')]} />
    </AnimatedCard>
  );
}
const getStyles = () => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.info + '18' },
  title: { ...Typography.bodyLarge, fontFamily: FontFamily.semiBold, color: Colors.textPrimary, flex: 1 },
  total: { ...Typography.headlineLarge, fontFamily: FontFamily.bold },
  hint: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xs },
  viewport: { marginTop: Spacing.lg, overflow: 'hidden' },
  list: { gap: Spacing.md, flexShrink: 0, overflow: 'hidden' },
  row: { gap: Spacing.sm },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { ...Typography.bodyMedium, color: Colors.textPrimary, flex: 1 },
  amount: { ...Typography.bodyMedium, fontFamily: FontFamily.semiBold, fontVariant: ['tabular-nums'] },
  track: { height: 4, backgroundColor: Colors.divider, borderRadius: BorderRadius.round, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: BorderRadius.round },
  dates: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider, marginTop: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.xs },
  date: { ...Typography.labelSmall, color: Colors.textMuted },
  pageButtons: { flexGrow: 1, justifyContent: 'center', gap: Spacing.xs, paddingTop: Spacing.sm },
  pageButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pageIndicator: {
    minWidth: 26, minHeight: 26, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 3,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
  },
  pageIndicatorActive: { backgroundColor: Colors.primary + '0D', borderColor: Colors.glassBorder },
  pageNumber: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium, color: Colors.textMuted, fontVariant: ['tabular-nums'] },
  pageNumberActive: { color: Colors.primary },
});
