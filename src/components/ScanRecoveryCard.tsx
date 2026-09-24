import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { useAppTheme, useThemePalette } from '../theme/themeStore';
import { FontFamily } from '../theme/typography';
import { createSusevarStyles, susevarButtonPressed } from '../theme/susevar';

interface Props {
  message: string;
  settings: boolean;
  onPrimary: () => void;
  onManual: () => void;
}

/** Recovery stays in the scrollable scanner; no modal or automatic API retry. */
export default function ScanRecoveryCard({ message, settings, onPrimary, onManual }: Props) {
  const scheme = useAppTheme();
  const theme = useThemePalette();
  const { t } = useLanguage();
  const styles = useMemo(() => {
    const primary = createSusevarStyles(theme);
    return StyleSheet.create({
      shell: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 32, paddingBottom: 32 },
      card: { backgroundColor: theme.cardSurface, borderColor: theme.border, borderWidth: 1, borderRadius: 28, padding: 24, gap: 24 },
      header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
      mark: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center' },
      eyebrow: { flex: 1, color: theme.textSecondary, fontFamily: FontFamily.semiBold, fontSize: 13, lineHeight: 19 },
      copy: { gap: 12 },
      title: { color: theme.textPrimary, fontFamily: FontFamily.bold, fontSize: 26, lineHeight: 33, letterSpacing: -0.6 },
      message: { color: theme.textSecondary, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 24 },
      actions: { gap: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 24 },
      primary: { ...primary.button, minHeight: 56, flexDirection: 'row', gap: 10 },
      primaryText: { ...primary.text, flexShrink: 1, textAlign: 'center' },
      secondary: { minHeight: 56, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 28, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
      secondaryText: { color: theme.textPrimary, fontFamily: FontFamily.semiBold, fontSize: 15, lineHeight: 22, flexShrink: 1, textAlign: 'center' },
      hint: { color: theme.textSecondary, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingHorizontal: 16, marginTop: 18 },
    });
  }, [scheme, theme]);

  return (
    <View style={styles.shell}>
      <View testID="scanner-recovery-card" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name={settings ? 'key-outline' : 'document-text-outline'} size={24} color={theme.textSecondary} />
          </View>
          <Text style={styles.eyebrow}>{t('scan_recovery_label')}</Text>
        </View>
        <View style={styles.copy} accessibilityLiveRegion="polite">
          <Text style={styles.title} accessibilityRole="header">
            {t(settings ? 'scan_recovery_settings' : 'scan_recovery_title')}
          </Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            testID={settings ? 'scanner-error-settings' : 'scanner-error-retry'}
            accessibilityRole="button"
            accessibilityLabel={t(settings ? 'tab_settings' : 'scan_retry')}
            onPress={onPrimary}
            style={({ pressed }) => [styles.primary, pressed && susevarButtonPressed]}
          >
            <Ionicons name={settings ? 'settings-outline' : 'refresh-outline'} size={20} color={theme.onPrimary} />
            <Text style={styles.primaryText}>{t(settings ? 'tab_settings' : 'scan_retry')}</Text>
          </Pressable>
          <Pressable
            testID="scanner-error-manual"
            accessibilityRole="button"
            accessibilityLabel={t('manual_entry')}
            onPress={onManual}
            style={({ pressed }) => [styles.secondary, pressed && susevarButtonPressed]}
          >
            <Ionicons name="create-outline" size={20} color={theme.textPrimary} />
            <Text style={styles.secondaryText}>{t('manual_entry')}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.hint}>{t('scan_recovery_hint')}</Text>
    </View>
  );
}
