// S.P.A.R.K. — Analiz kartı: Satıcılar/mağazalar + seçili satıcı detay paneli
// (ürün donut'u, 2 sütun lejant ve en çok alınan ürünler listesi)
import React, { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import VendorAvatar from '../VendorAvatar';
import DonutChart from '../DonutChart';
import { Colors, ChartColorArray } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import { itemDisplayName } from '../../utils/itemDisplayName';
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
  // Uzun listeleri varsayılan daralt; "Tümünü göster" ile satır içi genişlet
  // (iç içe ScrollView yerine → pull-to-refresh çakışması yok).
  const [vendorsExpanded, setVendorsExpanded] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  // Başka satıcı seçilince ürün listesi tekrar daralsın.
  useEffect(() => { setItemsExpanded(false); }, [selectedVendor]);

  return (
    <AnimatedCard delay={400} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('vendors_stores')}</Text>
      <Animated.View layout={LinearTransition.duration(320)}>
      {(() => {
          const VENDORS_COLLAPSED = 4;
          const canCollapseVendors = vendors.length > VENDORS_COLLAPSED;
          const visibleVendors = canCollapseVendors && !vendorsExpanded
            ? vendors.slice(0, VENDORS_COLLAPSED)
            : vendors;
          const vendorsContent = (
        <>
        {visibleVendors.map((v, i) => {
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

                {/* "En çok alınanlar" listesi — iç içe ScrollView KULLANMA (dış sayfanın
                    pull-to-refresh'i ile çakışıp kaydırmayı kapatıyordu). Bunun yerine
                    varsayılan ilk N ürünü göster + "Tümünü göster" ile satır içi genişlet:
                    panel kısa kalır, çakışma olmaz. */}
                {(() => {
                    const itemsToRender = selectedDonutIdx !== null ? [vendorItems[selectedDonutIdx]] : vendorItems;
                    const filteredItems = itemsToRender.filter(Boolean);
                    const ITEMS_COLLAPSED = 5;
                    // Donut'tan tek ürün seçiliyse zaten 1 satır → daraltma yok.
                    const canCollapseItems = selectedDonutIdx === null && filteredItems.length > ITEMS_COLLAPSED;
                    const visibleItems = canCollapseItems && !itemsExpanded
                      ? filteredItems.slice(0, ITEMS_COLLAPSED)
                      : filteredItems;
                    const itemsList = visibleItems.map((item: any, j: number) => {
                      const nameDisplay = itemDisplayName(item);
                      const primaryName = nameDisplay.primary;
                      const secondaryName = nameDisplay.secondary ?? '';
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
                          {j < visibleItems.length - 1 && <View style={styles.microItemDivider} />}
                        </Pressable>
                      );
                    });

                    return (
                      <>
                        {itemsList}
                        {canCollapseItems && (
                          <Pressable
                            onPress={() => setItemsExpanded((v) => !v)}
                            style={styles.showMoreBtn}
                            accessibilityRole="button"
                          >
                            <Text style={styles.showMoreText}>
                              {itemsExpanded
                                ? t('show_less')
                                : t('show_all', { count: (filteredItems.length - ITEMS_COLLAPSED).toString() })}
                            </Text>
                            <MaterialCommunityIcons
                              name={itemsExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={Colors.primary}
                            />
                          </Pressable>
                        )}
                      </>
                    );
                })()}
              </Animated.View>
            )}
          </Animated.View>
        ); })}
        </>
          );
          return (
            <>
              {vendorsContent}
              {canCollapseVendors && (
                <Pressable
                  onPress={() => setVendorsExpanded((v) => !v)}
                  style={styles.showMoreBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.showMoreText}>
                    {vendorsExpanded
                      ? t('show_less_vendors')
                      : t('show_all_vendors', { count: vendors.length.toString() })}
                  </Text>
                  <MaterialCommunityIcons
                    name={vendorsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.primary}
                  />
                </Pressable>
              )}
            </>
          );
        })()}
      </Animated.View>
    </AnimatedCard>
  );
}

export default React.memo(VendorsCard);
