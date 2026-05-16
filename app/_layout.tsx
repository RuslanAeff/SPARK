import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import ThemeScheduler from '../src/components/ThemeScheduler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, LightTheme } from '../src/theme/colors';
import { useAppTheme } from '../src/theme/themeStore';
import { FontFamily } from '../src/theme/typography';
import { useDatabase } from '../src/hooks/useDatabase';
import { SparkToastContainer } from '../src/components/SparkToast';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { RefreshProvider } from '../src/context/RefreshContext';
import { CurrencyProvider } from '../src/context/CurrencyContext';
import { NotificationsProvider } from '../src/context/NotificationsContext';
import { ensureAndroidNotificationSetup } from '../src/services/androidNotificationsSetup';
import { useOnboardingStatus } from '../src/hooks/useOnboardingStatus';

function AndroidNotificationBootstrap() {
  useEffect(() => {
    void ensureAndroidNotificationSetup();
  }, []);
  return null;
}

export default function RootLayout() {
  // Tek doğruluk kaynağı: hem OS değişimi hem manuel setColorScheme'i dinler.
  const scheme = useAppTheme();
  const theme = scheme === 'light' ? LightTheme : DarkTheme;
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { isReady, error } = useDatabase();
  const { isLoading: onboardingLoading, completed: onboardingCompleted } = useOnboardingStatus();
  const router = useRouter();
  const onboardingHandledRef = React.useRef(false);

  // Stack mount edildikten sonra route'a yönlendir — yoksa router.replace
  // henüz tanımlanmamış route'u arıyor ve splash'te kilit oluyor.
  useEffect(() => {
    if (!isReady || onboardingLoading || onboardingHandledRef.current) return;
    onboardingHandledRef.current = true;
    if (!onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [isReady, onboardingLoading, onboardingCompleted, router]);

  if (error) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={theme.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Tema senkronlanmadan Stack mount edilirse `(tabs)` ekranı OS şemasıyla
  // doğar; modül seviyesi `Colors` proxy çağrıları dark değerini hash'leyip
  // dondurur → aydınlık modda "flash of dark". `applyThemeFromDatabase()`
  // `isReady=true` öncesinde await edildiği için Stack'i bu kapının
  // arkasında tutmak P12 regresyonunu önler (DESIGN_BRIEF §6.1.2).
  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>S.P.A.R.K.</Text>
      </View>
    );
  }

  const showSplash = onboardingLoading;

  return (
    <SafeAreaProvider>
    <LanguageProvider>
      <CurrencyProvider>
      <RefreshProvider>
      <NotificationsProvider>
      <AndroidNotificationBootstrap />
      <ThemeScheduler />
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ presentation: 'card', animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="add-expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="categories" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="edit-items" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="goal-settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="notifications"
            options={{ presentation: 'card', animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
          />
          <Stack.Screen
            name="subscriptions"
            options={{ presentation: 'card', animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
          />
          <Stack.Screen
            name="settings-general"
            options={{ presentation: 'card', animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
          />
          <Stack.Screen
            name="settings-budget"
            options={{ presentation: 'card', animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
          />
          <Stack.Screen
            name="settings-data"
            options={{ presentation: 'card', animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
          />
          <Stack.Screen
            name="settings-ai"
            options={{ presentation: 'card', animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
          />
        </Stack>
        <SparkToastContainer />
        {showSplash && (
          <View style={styles.splashOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>S.P.A.R.K.</Text>
          </View>
        )}
      </View>
      </NotificationsProvider>
      </RefreshProvider>
      </CurrencyProvider>
    </LanguageProvider>
    </SafeAreaProvider>
  );
}

const getStyles = (theme: typeof DarkTheme) => StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    gap: 16,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    gap: 16,
    zIndex: 100,
  },
  loadingText: {
    color: theme.textSecondary,
    fontFamily: FontFamily.medium,
    fontSize: 16,
  },
  errorText: {
    color: theme.danger,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
