import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, ScrollView, SafeAreaView, Pressable } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { Colors } from "../theme/colors";
import { useThemeRevision } from "../theme/themeStore";
import { reportErrorKind } from "../utils/logError";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Typography, FontFamily } from "../theme/typography";
import { Spacing } from "../theme/spacing";
import { getDict } from "../i18n/translations";
import { suggestLanguageFromDevice } from "../i18n/languageOptions";
import { useOptionalLanguage } from "../i18n/LanguageContext";
import PrimaryButton from "./PrimaryButton";

function ThemeAwareErrorSurface({ children }: { children: () => ReactNode }) {
  useThemeRevision();
  return <>{children()}</>;
}

const RECOVERY_KEYS = ['error_boundary_title', 'error_boundary_desc', 'error_boundary_retry'] as const;

/**
 * A11Y-04: kurtarma ekranı dört dilde ve tasarım sistemiyle çizilir. Dil
 * sağlayıcısı da çökmüş olabileceği için `useOptionalLanguage` kullanılır;
 * sağlayıcı yoksa telefonun dili, o dilin sözlüğü yüklenmemişse İngilizce.
 */
function ErrorRecoveryScreen({ onRetry }: { onRetry: () => void }) {
  const languageContext = useOptionalLanguage();
  const lang = languageContext?.language ?? suggestLanguageFromDevice();
  const text = (key: (typeof RECOVERY_KEYS)[number]) =>
    getDict(lang)?.[key] ?? getDict('en')?.[key] ?? key;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <View
        testID="error-recovery-screen"
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxxl, gap: Spacing.md }}
      >
        <View
          style={{
            width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
            backgroundColor: Colors.warning + '1F', borderWidth: 1, borderColor: Colors.warning + '4D',
          }}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={32} color={Colors.warning} />
        </View>
        <Text
          accessibilityRole="header"
          style={{ ...Typography.headlineMedium, color: Colors.textPrimary, fontFamily: FontFamily.bold, textAlign: 'center' }}
        >
          {text('error_boundary_title')}
        </Text>
        <Text style={{ ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center' }}>
          {text('error_boundary_desc')}
        </Text>
        <PrimaryButton
          testID="error-recovery-retry"
          size="compact"
          label={text('error_boundary_retry')}
          onPress={onRetry}
          style={{ marginTop: Spacing.sm }}
        />
      </View>
    </SafeAreaView>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Kök başlangıç perdesi manuel tutuluyor olabilir. Kurtarma ekranının
    // sonsuza dek native splash arkasında kalmasına izin verme.
    void SplashScreen.hideAsync().catch(() => {});
    this.setState({ errorInfo });
    console.error('[UI] UNCAUGHT_RENDER_ERROR');
    // Yerel hata günlüğüne yalnız hata TÜRÜ düşer; mesaj ve bileşen yığını yazılmaz.
    reportErrorKind('UI UNCAUGHT_RENDER_ERROR', error);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      // Geliştirme: tam tanılama (mesaj + component stack + JS stack).
      if (__DEV__) {
        return (
          <ThemeAwareErrorSurface>{() => (
          <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            <ScrollView style={{ flex: 1, padding: 20 }}>
              <Text style={{ color: Colors.danger, fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>🚨 Crash Detected</Text>

              <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: 'bold' }}>Error Message:</Text>
              <Text style={{ color: Colors.danger, marginBottom: 20, fontFamily: 'monospace' }}>
                {this.state.error?.message || 'Unknown Error'}
              </Text>

              <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: 'bold' }}>Component Stack:</Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontFamily: 'monospace', marginBottom: 20 }}>
                {this.state.errorInfo?.componentStack}
              </Text>

              <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: 'bold' }}>JS Stack Trace:</Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 10, fontFamily: 'monospace', marginBottom: 24 }}>
                {this.state.error?.stack}
              </Text>

              <Pressable
                onPress={this.handleReset}
                style={{ alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: Colors.primaryGlow, borderWidth: 1, borderColor: Colors.glassBorder }}
              >
                <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>Retry</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
          )}</ThemeAwareErrorSurface>
        );
      }

      // Üretim: kullanıcı dostu, sade kurtarma ekranı (ham hata gösterilmez).
      return (
        <ThemeAwareErrorSurface>{() => <ErrorRecoveryScreen onRetry={this.handleReset} />}</ThemeAwareErrorSurface>
      );
    }

    return this.props.children;
  }
}
