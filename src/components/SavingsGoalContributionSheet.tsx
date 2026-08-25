import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GoalDao } from '../db/goalDao';
import { useNotifications } from '../context/NotificationsContext';
import { useRefreshActions } from '../context/RefreshContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import BottomSheetModal from './BottomSheetModal';
import { SparkToast } from './SparkToast';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SavingsGoalContributionSheet({ visible, onClose }: Props) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { triggerRefresh } = useRefreshActions();
  const { sync: syncNotifications } = useNotifications();
  const [amount, setAmount] = useState('');
  const [sign, setSign] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setAmount('');
      setSign(1);
    }
  }, [visible]);

  function requestClose() {
    if (!savingRef.current) onClose();
  }

  async function handleSave() {
    if (savingRef.current) return;
    const value = Number.parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      SparkToast.show(t('invalid_amount'), 'error');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await GoalDao.addContribution(value * sign);
      // Finansal mutasyon tamamlandıktan sonra haptic yalnız best-effort'tur;
      // native titreşim hatası başarıyı sahte bir kayıt hatasına çeviremez.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      SparkToast.show(
        sign > 0 ? t('goal_contribution_added') : t('goal_contribution_removed'),
        'success',
      );
      triggerRefresh();
      // Katkı hedefi tamamlayabilir veya yeniden aktif hale getirebilir. Eski
      // kilometre taşını iptal etmek/yeni planı kurmak için sheet kapanmadan
      // native desired-state'i uzlaştır.
      try {
        await syncNotifications();
      } catch (error) {
        // Katkı SQLite'a kalıcı olarak yazıldı. İkincil native senkronizasyon
        // hatası işlemi başarısızmış gibi gösterip ikinci katkıya yol açmamalı;
        // provider refresh/resume geçişinde yeniden dener.
        if (__DEV__) console.warn('[goal] notification sync failed', error);
      }
      onClose();
    } catch (error) {
      console.warn('goal contribution', error);
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={requestClose} sheetStyle={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.title}>{t('goal_update_savings')}</Text>
      <Text style={styles.hint}>{t('goal_contribution_hint')}</Text>

      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setSign(1)}
          disabled={saving}
          style={[styles.toggleButton, sign === 1 && styles.toggleButtonActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: sign === 1, disabled: saving }}
        >
          <MaterialCommunityIcons
            name="plus"
            size={16}
            color={sign === 1 ? '#fff' : Colors.textSecondary}
          />
          <Text style={[styles.toggleText, sign === 1 && styles.toggleTextActive]}>
            {t('goal_contribution_add')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSign(-1)}
          disabled={saving}
          style={[styles.toggleButton, sign === -1 && styles.toggleButtonNegative]}
          accessibilityRole="button"
          accessibilityState={{ selected: sign === -1, disabled: saving }}
        >
          <MaterialCommunityIcons
            name="minus"
            size={16}
            color={sign === -1 ? '#fff' : Colors.textSecondary}
          />
          <Text style={[styles.toggleText, sign === -1 && styles.toggleTextActive]}>
            {t('goal_contribution_remove')}
          </Text>
        </Pressable>
      </View>

      <TextInput
        testID="goal-contribution-input"
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        accessibilityLabel={t('amount')}
        editable={!saving}
        autoFocus
      />

      <View style={styles.actionsRow}>
        <Pressable
          onPress={requestClose}
          disabled={saving}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.cancelText}>{t('cancel')}</Text>
        </Pressable>
        <Pressable
          testID="goal-contribution-save"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.saveText}>{saving ? t('processing') : t('save')}</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}

const getStyles = () => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.cardSurface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    marginBottom: 4,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primaryAction,
    borderColor: Colors.primaryAction,
  },
  toggleButtonNegative: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  toggleText: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    fontFamily: FontFamily.semiBold,
  },
  toggleTextActive: {
    color: Colors.onPrimary,
  },
  input: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  saveButton: {
    flex: 1.4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primaryAction,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontFamily: FontFamily.extraBold,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
});
