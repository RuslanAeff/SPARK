// S.P.A.R.K. — Yedek parolası penceresi (SEC-01, ADR-018)
// 'set': dışa aktarırken parola + tekrarı; 'enter': şifreli yedeği açarken parola.
// Parola yalnız bu bileşenin durumunda ve çağıranın tek işleminde yaşar; saklanmaz.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ConfirmModal from './ConfirmModal';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import {
  MAX_BACKUP_PASSWORD_LENGTH,
  MIN_BACKUP_PASSWORD_LENGTH,
} from '../services/backupEncryption';

export interface BackupPasswordModalProps {
  visible: boolean;
  mode: 'set' | 'enter';
  /** 'enter': önceki deneme yanlış parolaydı. */
  wrongPassword?: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}

export default function BackupPasswordModal({
  visible,
  mode,
  wrongPassword = false,
  onCancel,
  onSubmit,
}: BackupPasswordModalProps) {
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState(false);

  // Her açılışta boş başla: önceki parola bellekte/ekranda kalmasın.
  useEffect(() => {
    if (!visible) return;
    setPassword('');
    setRepeat('');
    setReveal(false);
    setTouched(false);
  }, [visible]);

  const tooShort = password.length < MIN_BACKUP_PASSWORD_LENGTH;
  const mismatch = mode === 'set' && password !== repeat;
  const canSubmit = mode === 'set' ? !tooShort && !mismatch : password.length > 0;

  let error: string | null = null;
  if (mode === 'enter' && wrongPassword && !touched) error = t('backup_password_wrong');
  else if (mode === 'set' && touched && password.length > 0 && tooShort) error = t('backup_password_too_short');
  else if (mode === 'set' && touched && repeat.length > 0 && mismatch) error = t('backup_password_mismatch');

  function submit() {
    if (!canSubmit) return;
    const value = password;
    setPassword('');
    setRepeat('');
    // Yanlış parola sonrası pencere kapanmadan yeniden açılabilir (aynı render
    // turunda); hata mesajı yeni denemede görünsün diye burada sıfırlanır.
    setTouched(false);
    onSubmit(value);
  }

  const inputProps = {
    secureTextEntry: !reveal,
    autoCapitalize: 'none' as const,
    autoCorrect: false,
    autoComplete: 'off' as const,
    textContentType: 'password' as const,
    importantForAutofill: 'no' as const,
    maxLength: MAX_BACKUP_PASSWORD_LENGTH,
    placeholderTextColor: Colors.textMuted,
    style: styles.input,
  };

  return (
    <ConfirmModal
      visible={visible}
      title={t(mode === 'set' ? 'backup_password_set_title' : 'backup_password_enter_title')}
      message={t(mode === 'set' ? 'backup_password_set_msg' : 'backup_password_enter_msg')}
      confirmLabel={t(mode === 'set' ? 'backup_password_set_confirm' : 'backup_password_enter_confirm')}
      cancelLabel={t('cancel')}
      icon="lock-outline"
      confirmDisabled={!canSubmit}
      confirmTestID="backup-password-submit"
      cancelTestID="backup-password-cancel"
      onCancel={onCancel}
      onConfirm={submit}
    >
      <View style={styles.field}>
        <TextInput
          {...inputProps}
          testID="backup-password-input"
          value={password}
          onChangeText={(value) => { setPassword(value); setTouched(true); }}
          placeholder={t('backup_password_label')}
          accessibilityLabel={t('backup_password_label')}
          returnKeyType={mode === 'set' ? 'next' : 'done'}
          onSubmitEditing={mode === 'enter' ? submit : undefined}
        />
        <Pressable
          onPress={() => setReveal(value => !value)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('backup_password_toggle_visibility')}
          style={styles.eye}
        >
          <MaterialCommunityIcons
            name={reveal ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={Colors.textMuted}
          />
        </Pressable>
      </View>
      {mode === 'set' && (
        <View style={[styles.field, styles.fieldGap]}>
          <TextInput
            {...inputProps}
            testID="backup-password-repeat"
            value={repeat}
            onChangeText={(value) => { setRepeat(value); setTouched(true); }}
            placeholder={t('backup_password_repeat_label')}
            accessibilityLabel={t('backup_password_repeat_label')}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
      )}
      {error != null && (
        <Text testID="backup-password-error" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </ConfirmModal>
  );
}

const getStyles = () => StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
  },
  fieldGap: {
    marginTop: Spacing.sm,
  },
  input: {
    ...Typography.bodyMedium,
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    paddingVertical: Spacing.md,
  },
  eye: {
    paddingLeft: Spacing.sm,
  },
  error: {
    ...Typography.bodySmall,
    color: Colors.danger,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
