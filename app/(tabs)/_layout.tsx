import React from 'react';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkTheme, LightTheme } from '../../src/theme/colors';
import { useAppTheme } from '../../src/theme/themeStore';
import { FontFamily } from '../../src/theme/typography';
import { BorderRadius, Spacing } from '../../src/theme/spacing';
import { useLanguage } from '../../src/i18n/LanguageContext';

const { Navigator } = createMaterialTopTabNavigator();
const SwipeableTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  // Merkezi store: OS + manuel setColorScheme her iki kanalı da dinler.
  const scheme = useAppTheme();
  const theme = scheme === 'light' ? LightTheme : DarkTheme;
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  /** Sistem jest çubuğu / home indicator üstünde kalsın (Android gesture bar, iPhone çentik vb.) */
  const tabBarInsetBottom = Spacing.xl + insets.bottom;

  return (
    <SwipeableTabs
      tabBarPosition="bottom"
      screenListeners={{
        state: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
      screenOptions={({ route }) => ({
        // Tüm sekmeler mount kalsın; yoksa fiş kaydı sonrası refreshKey diğer ekranlara gitmez
        lazy: false,
        swipeEnabled: true,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarShowIcon: true,
        tabBarIndicatorStyle: { height: 0 },
        tabBarStyle: {
          position: 'absolute',
          bottom: tabBarInsetBottom,
          left: Spacing.xl + insets.left,
          right: Spacing.xl + insets.right,
          backgroundColor: theme.glass,
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
          borderRadius: BorderRadius.round,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 10,
          borderWidth: 1,
          borderColor: theme.border,
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
