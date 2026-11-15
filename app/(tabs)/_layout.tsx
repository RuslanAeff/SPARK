import React, { useMemo } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemePalette } from '../../src/theme/themeStore';
import { FontFamily } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { TabSwipeProvider, useTabSwipe } from '../../src/context/TabSwipeContext';
import { GlassTabBar, TabBlurProvider, TabBlurScene } from '../../src/components/GlassTabBar';

const { Navigator } = createMaterialTopTabNavigator();
const SwipeableTabs = withLayoutContext(Navigator);

function TabNavigator() {
  // Merkezi store, görünüm şeması ile kullanıcı vurgusunu tek snapshot'ta taşır.
  const theme = useThemePalette();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { swipeEnabled } = useTabSwipe();
  /** Sistem jest çubuğu / home indicator üstünde kalsın (Android gesture bar, iPhone çentik vb.) */
  const tabBarInsetBottom = Spacing.xl + insets.bottom;
  // Yüzen konum, köşe ve gölge dış sarmalayıcıda; çubuğun kendisi saydamdır ki
  // GlassTabBar'ın bulanık cam katmanı görünsün (UI denetimi UX-01).
  const floatingStyle = useMemo<ViewStyle>(() => ({
    position: 'absolute',
    bottom: tabBarInsetBottom,
    left: Spacing.xl + insets.left,
    right: Spacing.xl + insets.right,
    height: 65,
    borderRadius: BorderRadius.round,
    // Android elevation yarı saydam yüzeyin İÇİNDE gri gölge olarak görünür;
    // gölge yalnız iOS'ta.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      default: {},
    }),
  }), [tabBarInsetBottom, insets.left, insets.right]);

  return (
    <SwipeableTabs
      tabBarPosition="bottom"
      tabBar={(props: any) => <GlassTabBar {...props} containerStyle={floatingStyle} />}
      screenLayout={({ children, route }: { children: React.ReactNode; route: { key: string } }) => (
        <TabBlurScene routeKey={route.key}>{children}</TabBlurScene>
      )}
      screenListeners={{
        state: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
      screenOptions={() => ({
        // Soğuk açılışta yalnız görünür sekmeyi mount et. Diğer sekmeler ilk
        // focus'ta güncel veriyi çeker; startup sırasında gizli analytics
        // sorguları/animasyonları ana ekranın ilk karesiyle yarışmaz.
        lazy: true,
        // Lazy route içeriği henüz mount edilmemiş olsa bile PagerView hiçbir
        // zaman React Navigation'ın varsayılan açık yüzeyini göstermez.
        sceneStyle: { backgroundColor: theme.background },
        lazyPlaceholder: () => (
          <View
            testID="tab-lazy-placeholder"
            style={{ flex: 1, backgroundColor: theme.background }}
          />
        ),
        swipeEnabled,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarShowIcon: true,
        tabBarIndicatorStyle: { height: 0 },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.medium,
          fontSize: 10,
          textTransform: 'none',
          marginTop: 0,
          maxWidth: 76,
        },
        tabBarItemStyle: {
          padding: 0,
        },
      })}
    >
      <SwipeableTabs.Screen
        name="index"
        options={{
          title: t('tab_dashboard'),
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={24} color={color} />
          ),
        }}
      />
      <SwipeableTabs.Screen
        name="transactions"
        options={{
          title: t('tab_transactions'),
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialCommunityIcons name="swap-horizontal" size={24} color={color} />
          ),
        }}
      />
      <SwipeableTabs.Screen
        name="scanner"
        options={{
          title: t('tab_scanner'),
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialCommunityIcons name="camera-iris" size={26} color={color} />
          ),
        }}
      />
      <SwipeableTabs.Screen
        name="analytics"
        options={{
          title: t('tab_analytics'),
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialCommunityIcons name="chart-arc" size={24} color={color} />
          ),
        }}
      />
      <SwipeableTabs.Screen
        name="settings"
        options={{
          title: t('tab_settings'),
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialCommunityIcons name="cog-outline" size={24} color={color} />
          ),
        }}
      />
    </SwipeableTabs>
  );
}

export default function TabLayout() {
  return (
    <TabSwipeProvider>
      <TabBlurProvider>
        <TabNavigator />
      </TabBlurProvider>
    </TabSwipeProvider>
  );
}
