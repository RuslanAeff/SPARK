import React, { useMemo, useRef } from 'react';
import { Platform, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemePalette } from '../../src/theme/themeStore';
import { TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT } from '../../src/theme/layout';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { TabSwipeProvider, useTabSwipe } from '../../src/context/TabSwipeContext';
import { GlassTabBar, TabBlurProvider, TabBlurScene } from '../../src/components/GlassTabBar';
import { BAR_RADIUS, tabBarSideMargin } from '../../src/components/tabBarLayout';


const { Navigator } = createMaterialTopTabNavigator();
const SwipeableTabs = withLayoutContext(Navigator);

function TabNavigator() {
  // Merkezi store, görünüm şeması ile kullanıcı vurgusunu tek snapshot'ta taşır.
  const theme = useThemePalette();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { swipeEnabled, navigationLocked } = useTabSwipe();
  // tabPress dinleyicisi her olayda güncel kilidi okur.
  const navigationLockedRef = useRef(navigationLocked);
  navigationLockedRef.current = navigationLocked;
  /** Sistem jest çubuğu / home indicator üstünde kalsın (Android gesture bar, iPhone çentik vb.) */
  const tabBarInsetBottom = TAB_BAR_FLOAT_GAP + insets.bottom;
  // Yüzen konum, köşe ve gölge dış sarmalayıcıda; çubuğun kendisi saydamdır ki
  // GlassTabBar'ın bulanık cam katmanı görünsün (UI denetimi UX-01).
  const sideMargin = tabBarSideMargin(windowWidth);
  const floatingStyle = useMemo<ViewStyle>(() => ({
    position: 'absolute',
    bottom: tabBarInsetBottom,
    left: sideMargin + insets.left,
    right: sideMargin + insets.right,
    height: TAB_BAR_HEIGHT,
    // Seçiciyle eş merkezli köşe (tabBarLayout.ts).
    borderRadius: BAR_RADIUS,
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
  }), [tabBarInsetBottom, sideMargin, insets.left, insets.right]);
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
        // Gezinme kilidi (ör. İşlemler'de çoklu seçim) alt menü dokunuşunu da
        // durdurur; kullanıcıya kısa bir uyarı titreşimi verilir.
        tabPress: (event: { preventDefault: () => void }) => {
          if (!navigationLockedRef.current) return;
          event.preventDefault();
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
        // Çubuk, hap vurgusu ve etiket ölçüsü GlassTabBar'da hesaplanır
        // (src/components/tabBarLayout.ts).
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
