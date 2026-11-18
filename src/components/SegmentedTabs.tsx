// S.P.A.R.K. — Kayan vurgulu sekme seçici
//
// Borç ("Açık / Geçmiş") ve ek gelir ("Bu dönem / Tümü") sayfalarında sekme
// değişimi anlık bir renk atlamasıydı; içerik de bir anda yer değiştiriyordu
// (ürün sahibi geri bildirimi, 18 Kasım 2026). Bu bileşen Analiz dönem
// sekmeleriyle aynı cam vurguyu (`GlassSelectionIndicator`) kaydırır;
// `SegmentedContent` yeni içeriği sekme yönünden yumuşak solma ile getirir.
// Sistem "hareketi azalt" tercihi açıksa ikisi de anında geçer.
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInLeft, FadeInRight, ReduceMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import GlassSelectionIndicator from './GlassSelectionIndicator';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  testID?: string;
}

export function SegmentedTabs<K extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: ReadonlyArray<SegmentOption<K>>;
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Colors proxy tema snapshot'ını okur
  const styles = useMemo(() => getStyles(), [scheme, revision]);
  const [layouts, setLayouts] = useState<Partial<Record<K, LayoutRectangle>>>({});

  return (
    <View style={[styles.segment, style]} accessibilityRole="tablist">
      <GlassSelectionIndicator target={layouts[value]} />
      {options.map(option => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            testID={option.testID}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(option.key);
            }}
            onLayout={({ nativeEvent: { layout } }) => {
              setLayouts(previous => {
                const old = previous[option.key];
                if (old && old.x === layout.x && old.y === layout.y
                  && old.width === layout.width && old.height === layout.height) return previous;
                return { ...previous, [option.key]: layout };
              });
            }}
            style={styles.segmentBtn}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Sekme içeriği: değer değişince yeni içerik, sekme sırasındaki yönden
 * (ileri = sağdan, geri = soldan) kısa bir kayma ve solmayla girer.
 */
export function SegmentedContent<K extends string>({
  order,
  value,
  children,
}: {
  order: ReadonlyArray<K>;
  value: K;
  children: React.ReactNode;
}) {
  const previousRef = useRef(value);
  const directionRef = useRef<1 | -1>(1);
  if (previousRef.current !== value) {
    directionRef.current = order.indexOf(value) >= order.indexOf(previousRef.current) ? 1 : -1;
    previousRef.current = value;
  }
  const entering = (directionRef.current === 1 ? FadeInRight : FadeInLeft)
    .duration(240)
    .reduceMotion(ReduceMotion.System);

  return (
    <Animated.View key={value} entering={entering} style={contentStyles.content}>
      {children}
    </Animated.View>
  );
}

const contentStyles = StyleSheet.create({
  // Sayfa küçülünce (klavye) liste de kısalsın.
  content: { flexShrink: 1 },
});

const getStyles = () => StyleSheet.create({
  segment: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.round,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    minHeight: 40,
  },
  segmentText: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
    // Android'de içeriğe göre ölçülen Text son glifi kırpıyordu (DebtSheet dersi).
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
});
