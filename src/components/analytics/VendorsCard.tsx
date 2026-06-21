// S.P.A.R.K. — Analiz kartı: Satıcılar/mağazalar + seçili satıcı detay paneli
// (ürün donut'u, 2 sütun lejant ve en çok alınan ürünler listesi)
import React, { type Dispatch, type SetStateAction } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import VendorAvatar from '../VendorAvatar';
import DonutChart from '../DonutChart';
import { Colors, ChartColorArray } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import type { VendorSpending } from '../../db/schema';
import { CountUpText, type BaseCardProps } from './shared';

interface VendorsCardProps extends BaseCardProps {
  vendors: VendorSpending[];
  prevVendorTotals: Map<number, number>;
  selectedVendor: number | null;
  vendorItems: any[];
  selectedDonutIdx: number | null;
  handleVendorPress: (vendorId: number) => void;
  setSelectedDonutIdx: Dispatch<SetStateAction<number | null>>;
  onSelectItem: (name: string) => void;
}

function VendorsCard({
  styles, t, currency, vendors, prevVendorTotals, selectedVendor, vendorItems,
  selectedDonutIdx, handleVendorPress, setSelectedDonutIdx, onSelectItem,
}: VendorsCardProps) {
  return (
    <AnimatedCard delay={400} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('vendors_stores')}</Text>
      <Animated.View layout={LinearTransition.duration(320)}>
      {(() => {
          const VENDORS_VISIBLE = 4;
          const needsVendorScroll = vendors.length > VENDORS_VISIBLE;
          const vendorsContent = (
        <>
        {vendors.map((v, i) => {
          const prevVTotal = prevVendorTotals.get(v.vendor_id);
          const isNewVendor = prevVTotal === undefined && prevVendorTotals.size > 0;
          const vendorDelta = prevVTotal && prevVTotal > 0
            ? Math.round(((v.total - prevVTotal) / prevVTotal) * 100)
            : null;
          return (
          <Animated.View key={v.vendor_id} entering={FadeInDown.delay(i * 60).duration(400)}>
            <Pressable
              onPress={() => handleVendorPress(v.vendor_id)}
              style={[
                styles.vendorRow,
                selectedVendor === v.vendor_id && styles.vendorRowActive,
                selectedVendor === v.vendor_id && styles.vendorRowActiveNoDivider,
              ]}
            >
              <View>
                <VendorAvatar name={v.vendor_name} logoUri={v.vendor_logo} size={44} />
                {isNewVendor && (
                  <View style={styles.newBadge}><Text style={styles.newBadgeText}>{t('badge_new')}</Text></View>
                )}
              </View>
              <View style={styles.vendorInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.vendorName}>{v.vendor_name}</Text>
                  {vendorDelta !== null && vendorDelta !== 0 && (
                    <MaterialCommunityIcons
                      name={vendorDelta > 0 ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={vendorDelta > 0 ? Colors.danger : Colors.success}
                    />
                  )}
                </View>
                <View style={styles.vendorBar}><View style={[styles.vendorBarFill, { width: `${Math.max(2, v.percentage)}%`, backgroundColor: Colors.primary }]} /></View>
              </View>
              <View style={styles.vendorAmountCol}>
                <Text style={styles.vendorAmount}>{formatCurrency(v.total, currency)}</Text>
                <CountUpText value={v.percentage} suffix="%" style={styles.vendorPercent} />
              </View>
            </Pressable>
            {selectedVendor === v.vendor_id && vendorItems.length > 0 && (
              <Animated.View
                /*
                  Satıcının detay paneli: donut + lejant + "En çok alınan
                  ürünler". Girişte aşağıdan fade-in, kapanışta yukarı fade-out
                  ile yumuşak bir geçiş sağlıyoruz. Bu olmadan React direkt
                  unmount ettiği için panel birden "pat" diye yok oluyordu.
                */
                entering={FadeInDown.duration(260)}
                exiting={FadeOutUp.duration(240)}
                layout={LinearTransition.duration(260)}
                style={styles.microAnalysis}
              >
                {/* Donut chart - full-width, interactive */}
                {vendorItems.length >= 2 && (() => {
                  const totalSpent = vendorItems.reduce((s: number, i: any) => s + i.total_spent, 0);
                  const selItem = selectedDonutIdx !== null ? vendorItems[selectedDonutIdx] : null;
                  return (
                    <View style={styles.vendorDonutSection}>
                      <DonutChart
                        segments={vendorItems.slice(0, 8).map((item: any, idx: number) => ({
                          label: item.turkish_name || item.name,
                          value: item.total_spent,
                          color: ChartColorArray[idx % ChartColorArray.length],
                        }))}
                        size={180}
                        strokeWidth={26}
                        selectedIndex={selectedDonutIdx}
                        onSelect={(idx) => {
                          setSelectedDonutIdx((prev) => (prev === idx ? null : idx));
                        }}
                        innerContent={
                          <Pressable
                            onPress={() => {
                              setSelectedDonutIdx(null);
                            }}
                            style={({ pressed }) => [
                              styles.vendorDonutCenter,
                              selectedDonutIdx !== null && pressed && styles.vendorDonutCenterPressed,
                            ]}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            accessibilityRole="button"
                            accessibilityLabel={t('donut_center_clear')}
                          >
                            {selItem ? (
                              <>
                                <Text style={[styles.vendorDonutPct, { color: ChartColorArray[selectedDonutIdx! % ChartColorArray.length] }]}>
                                  {Math.round((selItem.total_spent / totalSpent) * 100)}%
                                </Text>
                                <Text style={styles.vendorDonutLabel} numberOfLines={2}>
                                  {selItem.turkish_name || selItem.name}
                                </Text>
                                <Text style={styles.vendorDonutSub}>
                                  {formatCurrency(selItem.total_spent, currency, false)}
                                </Text>
                              </>
                            ) : (
                              <>
                                <Text style={styles.vendorDonutTotal}>{vendorItems.length}</Text>
                                <Text style={styles.vendorDonutLabel}>{t('product_variety')}</Text>
                              </>
                            )}
                          </Pressable>
                        }
                      />
                      {/* 2-column legend grid */}
                      <View style={styles.legendGrid}>
                        {vendorItems.slice(0, 8).map((item: any, idx: number) => {
                          const pct = Math.round((item.total_spent / totalSpent) * 100);
                          const isSelected = selectedDonutIdx === idx;
                          return (
                            <Pressable
                              key={idx}
                              onPress={() => {
                                setSelectedDonutIdx(idx === selectedDonutIdx ? null : idx);
                              }}
                              style={[styles.legendItem, isSelected && { borderColor: ChartColorArray[idx % ChartColorArray.length], backgroundColor: ChartColorArray[idx % ChartColorArray.length] + '18' }]}
                            >
                              <View style={[styles.legendDot, { backgroundColor: ChartColorArray[idx % ChartColorArray.length] }]} />
                              <Text style={styles.legendText} numberOfLines={1}>
                                {item.turkish_name || item.name}
                              </Text>
                              <Text style={[styles.legendPct, isSelected && { color: ChartColorArray[idx % ChartColorArray.length] }]}>{pct}%</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
                <Text style={[styles.microTitle, { marginTop: vendorItems.length >= 2 ? Spacing.lg : 0 }]}>
                  {selectedDonutIdx !== null
                    ? `🔍 ${vendorItems[selectedDonutIdx]?.turkish_name || vendorItems[selectedDonutIdx]?.name || t('product_details')}`
                    : t('top_bought_products')}
                </Text>

                {/* Rendering the items list - scroll when > 3 */}
                {(() => {
                    const itemsToRender = selectedDonutIdx !== null ? [vendorItems[selectedDonutIdx]] : vendorItems;
                    const needsItemScroll = itemsToRender.length > 3;
                    const filteredItems = itemsToRender.filter(Boolean);
                    const itemsList = filteredItems.map((item: any, j: number) => {
                      const primaryName = item.turkish_name || item.name;
                      const secondaryName = item.turkish_name ? item.name : '';
                      const isExpense = item.total_spent >= 0;
                      return (
                        <Pressable key={j} style={styles.microItem} onPress={() => onSelectItem(item.name)}>
                          <View style={styles.microItemContent}>
                            <View style={styles.microItemMain}>
                              <Text style={styles.microItemPrimary} numberOfLines={1}>{primaryName}</Text>
                              <Text style={styles.microItemSecondary} numberOfLines={1}>
                                {secondaryName ? `${secondaryName}  •  ` : ''}{t('pieces', { count: item.purchase_count.toString() })}
                              </Text>
                            </View>
                            <View style={styles.microItemPriceCol}>
                              <Text style={[styles.microItemAmount, !isExpense && { color: Colors.success }]}>
                                {formatCurrency(item.total_spent, currency, false)}
                              </Text>
                              <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.borderLight} />
                            </View>
                          </View>
                          {j < filteredItems.length - 1 && <View style={styles.microItemDivider} />}
                        </Pressable>
                      );
                    });

                    return needsItemScroll ? (
                      <ScrollView style={styles.vendorItemsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                        {itemsList}
                      </ScrollView>
                    ) : (
                      <>{itemsList}</>
                    );
                })()}
              </Animated.View>
            )}
          </Animated.View>
        ); })}
        </>
          );
          return needsVendorScroll ? (
            <ScrollView style={styles.vendorsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {vendorsContent}
            </ScrollView>
          ) : vendorsContent;
        })()}
      </Animated.View>
    </AnimatedCard>
  );
}

export default React.memo(VendorsCard);
