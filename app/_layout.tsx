import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Animated,
  Easing,
  Image,
  Text,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import ThemeScheduler from '../src/components/ThemeScheduler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, LightTheme } from '../src/theme/colors';
import { useAppTheme } from '../src/theme/themeStore';
import { FontFamily } from '../src/theme/typography';
import { useDatabase } from '../src/hooks/useDatabase';
import { SparkToastContainer } from '../src/components/SparkToast';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { LanguageProvider, useLanguage } from '../src/i18n/LanguageContext';
import { RefreshProvider } from '../src/context/RefreshContext';
import { CurrencyProvider, useCurrency } from '../src/context/CurrencyContext';
import {
  NotificationsProvider,
  useNotifications,
} from '../src/context/NotificationsContext';
import {
  activateAndroidNotificationDelivery,
  ensureAndroidNotificationSetup,
  subscribeAndroidNotificationResponses,
} from '../src/services/androidNotificationsSetup';
import { useOnboardingStatus } from '../src/hooks/useOnboardingStatus';
import { createNavigationTheme } from '../src/theme/navigationTheme';

const BOOT_BACKGROUND = '#050505';

// Native splash, veritabanı/tema/dil/rota hazır olmadan kendiliğinden
// kapanmamalı. Global scope çağrısı Expo'nun önerdiği şekilde mümkün olan en
// erken anda çalışır.
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 220, fade: true });
void SystemUI.setBackgroundColorAsync(BOOT_BACKGROUND).catch(() => {});

function AndroidNotificationBootstrap({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const { openFromNotification, sync } = useNotifications();
  const { t } = useLanguage();
  const channelCopy = React.useMemo(() => ({
    updatesName: t('notif_android_updates_channel'),
    updatesDescription: t('notif_android_updates_channel_desc'),
    alertsName: t('notif_android_alerts_channel'),
    alertsDescription: t('notif_android_alerts_channel_desc'),
  }), [t]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    activateAndroidNotificationDelivery();
    void (async () => {
      const status = await ensureAndroidNotificationSetup(true, channelCopy);
      if (__DEV__ && status === 'error') {
        console.warn('[notifications] Android setup failed');
      }
      if (disposed) return;

      try {
        const cleanup = await subscribeAndroidNotificationResponses(async (notificationId) => {
          try {
            // Cold response normal bootstrap sync'inden önce işlenir. Böylece
            // gecikmiş alarmın occurrence'ı cursor ilerlemeden kanonik feed'e
            // dönüşür ve aynı olay ikinci tray kopyası üretmez.
            await openFromNotification(notificationId);
          } catch {
            // Feed öğesi daha önce silinmiş olabilir; route yine açılabilmelidir.
          }
          router.push('/notifications');
        });
        if (disposed) {
          cleanup();
          return;
        }
        unsubscribe = cleanup;
      } catch {
        if (__DEV__) console.warn('[notifications] response observer failed');
      }

      // Cold response varsa subscribe çağrısı onun tap-aware sync'ini bekler;
      // normal bootstrap uzlaştırması ancak sonrasında çalışır.
      // Denied durumda da eski owned alarm cleanup'ı; iOS/Expo Go'da da domain
      // cursor/feed ilerlemesi gerekir. Yalnız kurulum hatası retry'a bırakılır.
      if (!disposed && status !== 'error') await sync();
    })();

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [channelCopy, enabled, openFromNotification, router, sync]);

  return null;
}

/** Native splash ile birebir koyu yüzey. Native splash desteklenmeyen geliştirme
 * istemcilerinde de hiçbir sağlayıcı/pencere boşluğu beyaz kare gösteremez. */
function BootSurface({ animatedStyle }: { animatedStyle?: object }) {
  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, bootStyles.surface, animatedStyle]}
    >
      <Image
        source={require('../assets/spark-icon.png')}
        style={bootStyles.logo}
        resizeMode="contain"
        fadeDuration={0}
      />
    </Animated.View>
  );
}

interface AppShellProps {
  onboardingLoading: boolean;
  onboardingCompleted: boolean;
}

/** Provider'lar mount edilmişken çalışır. Dil + para birimi + hedef rota hazır
 * olana kadar sabit perdeyi tutar; ardından tek, kontrollü fade ile açar. */
function AppShell({ onboardingLoading, onboardingCompleted }: AppShellProps) {
  const scheme = useAppTheme();
  const theme = scheme === 'light' ? LightTheme : DarkTheme;
  const navigationTheme = React.useMemo(() => createNavigationTheme(scheme), [scheme]);
  const { isLoaded: languageLoaded } = useLanguage();
  const { isLoaded: currencyLoaded } = useCurrency();
  const router = useRouter();
  const pathname = usePathname();
  const [rootLaidOut, setRootLaidOut] = useState(false);
  const [curtainMounted, setCurtainMounted] = useState(true);
  const curtainOpacity = useRef(new Animated.Value(1)).current;
  const revealStartedRef = useRef(false);
  const revealGenerationRef = useRef(0);
  const onboardingRouteRequestedRef = useRef(false);
  const startupRouteGuardRef = useRef(true);

  useEffect(() => {
    if (onboardingLoading) return;

    if (pathname === '/onboarding') {
      onboardingRouteRequestedRef.current = true;
      // Yalnız boot koruması: onboarding tamamlandıktan sonraki hedefi
      // onboarding ekranının kendi handler'ı seçer (örn. "kaydet ve tara").
      if (onboardingCompleted && startupRouteGuardRef.current) {
        router.replace('/(tabs)');
      }
      return;
    }

    if (!onboardingCompleted && !onboardingRouteRequestedRef.current) {
      onboardingRouteRequestedRef.current = true;
      router.replace('/onboarding');
    }
  }, [onboardingLoading, onboardingCompleted, pathname, router]);

  useEffect(() => {
    if (
      revealStartedRef.current ||
      !rootLaidOut ||
      onboardingLoading ||
      !languageLoaded ||
      !currencyLoaded ||
      (onboardingCompleted
        ? pathname === '/onboarding'
        : pathname !== '/onboarding')
    ) {
      return;
    }
    revealStartedRef.current = true;
    startupRouteGuardRef.current = false;
    const generation = ++revealGenerationRef.current;
    curtainOpacity.setValue(1);

    let cancelled = false;
    let completed = false;
    let frameOne = 0;
    let frameTwo = 0;
    frameOne = requestAnimationFrame(() => {
      frameTwo = requestAnimationFrame(() => {
        void SplashScreen.hideAsync()
          .catch(() => {})
          .finally(() => {
            if (cancelled || revealGenerationRef.current !== generation) return;
            Animated.timing(curtainOpacity, {
              toValue: 0,
              duration: 300,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (
                finished &&
                !cancelled &&
                revealGenerationRef.current === generation
              ) {
                completed = true;
                setCurtainMounted(false);
              }
            });
          });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameOne);
      cancelAnimationFrame(frameTwo);
      curtainOpacity.stopAnimation();
      if (!completed && revealGenerationRef.current === generation) {
        revealStartedRef.current = false;
      }
    };
  }, [
    rootLaidOut,
    onboardingLoading,
    onboardingCompleted,
    pathname,
    languageLoaded,
    currencyLoaded,
    curtainOpacity,
  ]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View
        style={{ flex: 1, backgroundColor: theme.background }}
        onLayout={() => setRootLaidOut(true)}
      >
        <StatusBar
          animated
          style={curtainMounted ? 'light' : scheme === 'light' ? 'dark' : 'light'}
        />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{
              presentation: 'card',
              animation: curtainMounted ? 'none' : 'fade',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="add-expense"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="categories"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="edit-items"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="goal-settings"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <Stack.Screen
            name="subscriptions"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <Stack.Screen
            name="settings-general"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <Stack.Screen
            name="settings-budget"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <Stack.Screen
            name="settings-data"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <Stack.Screen
            name="settings-ai"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.background },
            }}
          />
        </Stack>
        <SparkToastContainer />
        <AndroidNotificationBootstrap enabled={!curtainMounted} />
        {curtainMounted ? <BootSurface animatedStyle={{ opacity: curtainOpacity }} /> : null}
      </View>
    </NavigationThemeProvider>
  );
}

function RootLayoutContent() {
  const scheme = useAppTheme();
  const theme = scheme === 'light' ? LightTheme : DarkTheme;
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { isReady, error } = useDatabase();
  const {
    isLoading: onboardingLoading,
    completed: onboardingCompleted,
  } = useOnboardingStatus();

  useEffect(() => {
    if (error) void SplashScreen.hideAsync().catch(() => {});
  }, [error]);

  if (error) {
    return (
      <View style={styles.center}>
        <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
        <MaterialCommunityIcons name="alert-circle" size={48} color={theme.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={bootStyles.root}>
        <StatusBar style="light" />
        <BootSurface />
      </View>
    );
  }

  return (
    <LanguageProvider>
      <CurrencyProvider>
        <RefreshProvider>
          <NotificationsProvider>
            <ThemeScheduler />
            <AppShell
              onboardingLoading={onboardingLoading}
              onboardingCompleted={onboardingCompleted}
            />
          </NotificationsProvider>
        </RefreshProvider>
      </CurrencyProvider>
    </LanguageProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={bootStyles.root}>
      <ErrorBoundary>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <RootLayoutContent />
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const bootStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BOOT_BACKGROUND,
  },
  surface: {
    zIndex: 100_000,
    elevation: 100_000,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BOOT_BACKGROUND,
  },
  logo: {
    width: 160,
    height: 160,
  },
});

const getStyles = (theme: typeof DarkTheme) =>
  StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      gap: 16,
    },
    errorText: {
      color: theme.danger,
      fontFamily: FontFamily.medium,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
  });
