// S.P.A.R.K. — Veri ve Yedek: Verileri sıfırlama
//
// Konum bilinçlidir: sayfanın EN ALTI, yedek bölümünün hemen altı. İki nedeni
// var — kullanıcı buraya inmek için her şeyin yanından geçmek zorunda kalır ve
// kaçış yolu (yedek al) fiziksel olarak bir üstünde durur.
//
// "Tehlikeli Bölge" gibi bir başlık KULLANILMAZ: yetişkin bir kullanıcıya
// uyarı levhası asmak bilgi vermez, yalnız ton düşürür. Bölüm eylemin kendi
// adını taşır; ağırlığı işin ne olduğu verir, etiket değil.
//
// Görsel dil de kasıtlı olarak sakindir: dolu kırmızı panel değil, ince danger
// kenarlıklı kart ve hayalet düğme. Asıl koruma renkte değil, onay
// penceresindeki basılı tutma kapısındadır.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import { useNotifications } from '../context/NotificationsContext';
import { SettingsSection } from './SettingsList';
import { SparkToast } from './SparkToast';
import DataResetModal from './DataResetModal';
import {
  resetAllUserData,
  summarizeUserData,
  type UserDataSummary,
} from '../services/dataReset';

export default function DataResetSection() {
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = React.useMemo(() => getStyles(), [scheme, themeRevision]);
  const { sync } = useNotifications();

  const [promptOpen, setPromptOpen] = useState(false);
  const [summary, setSummary] = useState<UserDataSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const openPrompt = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const next = await summarizeUserData();
      // Silinecek bir şey yoksa pencere açmak kullanıcıyı boşuna korkutur.
      if (next.total === 0) {
        SparkToast.show(t('data_reset_already_empty'), 'info');
        return;
      }
      setSummary(next);
      setPromptOpen(true);
    } catch {
      SparkToast.show(t('data_reset_failed'), 'error');
    }
  }, [t]);

  const handleConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await resetAllUserData();
      // Silinen borç/planların native alarmları ancak uzlaştırma ile iptal
      // olur; istenen durum artık boş olduğu için sync hepsini temizler.
      await sync().catch(() => {});
      setPromptOpen(false);
      setSummary(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('data_reset_done'), 'success', t('data_reset_done_desc'));
    } catch {
      SparkToast.show(t('data_reset_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }, [sync, t]);

  return (
    <SettingsSection testID="settings-data-danger-section" last>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: Colors.danger + '1F' }]}>
          <MaterialCommunityIcons name="database-remove-outline" size={22} color={Colors.danger} />
        </View>
        <Text style={styles.sectionTitle} numberOfLines={2}>
          {t('data_reset_title')}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardText}>
          <Text style={styles.cardDescription}>{t('data_reset_row_description')}</Text>
        </View>
        <Pressable
          testID="data-reset-open"
          accessibilityRole="button"
          accessibilityLabel={t('data_reset_title')}
          accessibilityHint={t('data_reset_row_description')}
          onPress={() => void openPrompt()}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{t('data_reset_cta')}</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>{t('data_reset_preserved')}</Text>

      <DataResetModal
        visible={promptOpen}
        summary={summary}
        busy={busy}
        onCancel={() => {
          if (busy) return;
          setPromptOpen(false);
          setSummary(null);
        }}
        onConfirm={() => void handleConfirm()}
      />
    </SettingsSection>
  );
}

const getStyles = () => StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    // Dolu kırmızı zemin yerine yalnız tonlu kenarlık: sakin ama ayrışan.
    borderColor: Colors.danger + '59',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  actionText: {
    ...Typography.labelLarge,
    color: Colors.danger,
    fontFamily: FontFamily.bold,
  },
  footnote: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 15,
  },
});
