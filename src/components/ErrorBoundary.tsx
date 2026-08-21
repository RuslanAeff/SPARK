import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, ScrollView, SafeAreaView, Pressable } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { Colors } from "../theme/colors";
import { useThemeRevision } from "../theme/themeStore";

function ThemeAwareErrorSurface({ children }: { children: () => ReactNode }) {
  useThemeRevision();
  return <>{children()}</>;
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
    console.error("Uncaught error:", error, errorInfo);
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
                <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>Tekrar Dene</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
          )}</ThemeAwareErrorSurface>
        );
      }

      // Üretim: kullanıcı dostu, sade kurtarma ekranı (ham hata gösterilmez).
      return (
        <ThemeAwareErrorSurface>{() => (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 14 }}>
            <Text style={{ fontSize: 52 }}>⚠️</Text>
            <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
              Bir şeyler ters gitti
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              Uygulamada beklenmedik bir sorun oluştu. Verileriniz güvende. Lütfen tekrar deneyin.
            </Text>
            <Pressable
              onPress={this.handleReset}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: 8,
                paddingVertical: 12,
                paddingHorizontal: 28,
                borderRadius: 14,
                backgroundColor: Colors.primaryGlow,
                borderWidth: 1,
                borderColor: Colors.glassBorder,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: Colors.primary, fontSize: 15, fontWeight: 'bold' }}>Tekrar Dene</Text>
            </Pressable>
          </View>
        </SafeAreaView>
        )}</ThemeAwareErrorSurface>
      );
    }

    return this.props.children;
  }
}
