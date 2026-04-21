import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, ScrollView, SafeAreaView } from "react-native";
import { Colors } from "../theme/colors";

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
    this.setState({ errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
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
            <Text style={{ color: Colors.textSecondary, fontSize: 10, fontFamily: 'monospace' }}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
