// S.P.A.R.K. — Settings: AI (Gemini API key)
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Linking } from 'react-native';
import { useAppTheme } from '../src/theme/themeStore';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../src/theme/colors';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { saveApiKey, hasApiKey, deleteApiKey } from '../src/services/geminiService';
import GlassCheckButton from '../src/components/GlassCheckButton';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import { SparkToast } from '../src/components/SparkToast';
import { SettingsSection } from '../src/components/SettingsList';

const API_KEY_CONSOLE_URL = 'https://aistudio.google.com/app/apikey';

export default function SettingsAiScreen() {
  const colorScheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [colorScheme]);
  const router = useRouter();
  const { t } = useLanguage();

  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      const has = await hasApiKey();
      setHasKey(has);
    })();
  }, []);

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      SparkToast.show(t('api_key_empty'), 'error');
      return;
    }
    await saveApiKey(apiKey.trim());
    setHasKey(true);
    setApiKey('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    SparkToast.show(t('api_key_saved'), 'success', t('api_key_ready'));
  }

  function handleOpenKeyConsole() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(API_KEY_CONSOLE_URL).catch(() => {
      SparkToast.show(t('unknown_error'), 'error');
    });
  }

  async function handleDeleteApiKey() {
    setShowDeleteConfirm(false);
    await deleteApiKey();
    setHasKey(false);
    setApiKey('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    SparkToast.show(t('api_key_deleted'), 'success');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.subHeader}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('settings_back')}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.subHeaderTitle} numberOfLines={1}>
          {t('settings_group_ai')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <SettingsSection testID="settings-ai-key-section" last>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: Colors.secondary + '22' }]}>
                <MaterialCommunityIcons name="key-outline" size={22} color={Colors.secondary} />
              </View>
              <Text style={styles.sectionTitle}>{t('api_key_title')}</Text>
            </View>
            {hasKey && (
              <View style={styles.keyStatus}>
                <MaterialCommunityIcons name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.keyStatusText}>{t('api_key_exists')}</Text>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={hasKey ? t('enter_new_key') : t('paste_key')}
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
              <GlassCheckButton onPress={handleSaveApiKey} accessibilityLabel={t('save')} />
              {hasKey && (
                <GlassCheckButton
                  variant="danger"
                  onPress={() => setShowDeleteConfirm(true)}
                  accessibilityLabel={t('delete')}
                />
              )}
            </View>
            <Text style={styles.helpText}>{t('api_key_help')}</Text>
            <Pressable
              testID="api-key-console-link"
              onPress={handleOpenKeyConsole}
              style={({ pressed }) => [styles.helpLink, pressed && styles.helpLinkPressed]}
              accessibilityRole="link"
              accessibilityLabel={t('api_key_get')}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="open-in-new" size={14} color={Colors.secondary} />
              <Text style={styles.helpLinkText}>{t('api_key_get')}</Text>
            </Pressable>
          </SettingsSection>
        </Animated.View>
      </ScrollView>

      <GlassDeleteModal
        visible={showDeleteConfirm}
        message={t('delete_api_key_msg')}
        onCancel={() => setShowDeleteConfirm(false)}
        onDelete={handleDeleteApiKey}
      />
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  backBtnPressed: { opacity: 0.7 },
  subHeaderTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    flex: 1,
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontSize: 16,
    flex: 1,
  },
  keyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  keyStatusText: {
    ...Typography.bodySmall,
    color: Colors.success,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  helpText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  helpLinkPressed: { opacity: 0.6 },
  helpLinkText: {
    ...Typography.bodySmall,
    color: Colors.secondary,
    fontFamily: FontFamily.bold,
  },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
