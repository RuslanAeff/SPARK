// S.P.A.R.K. — Alt ekran başlığı (UI denetimi DS-06)
//
// Alt ekranlar beş ayrı başlık biçimi taşıyordu: farklı geri ikonları
// (arrow-left 23–24 / chevron-left 23–28), 32–44 dp arası dokunma alanları,
// bazıları etiketsiz, başlık bazen ortalı bazen sola dayalı. Bu bileşen Ayarlar
// ailesinin biçimini tek sözleşmeye bağlar:
//   • 44 dp yuvarlak geri düğmesi, chevron-left 28, her zaman çevrilmiş etiket;
//   • `headlineMedium` extraBold başlık, `header` erişilebilirlik rolü;
//   • sağda isteğe bağlı eylem; yoksa başlığı dengeleyen eşit genişlikte boşluk.
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, ScreenPadding } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';

export const SCREEN_HEADER_BUTTON_SIZE = 44;

export interface ScreenHeaderProps {
  title: string;
  /** Alt satırda kısa açıklama. */
  subtitle?: string;
  /** Varsayılan: `router.back()`. */
  onBack?: () => void;
  /** Geri yerine kapat (ör. seçim modundan çıkış). */
  backIcon?: 'chevron-left' | 'close';
  backAccessibilityLabel?: string;
  backTestID?: string;
  /** Sağ eylem; 44 dp genişliği aşmaması önerilir. */
  right?: React.ReactNode;
  /** Başlığın yanında küçük öğe (ör. okunmamış rozeti). */
  titleAccessory?: React.ReactNode;
  align?: 'start' | 'center';
  /** Altta ince ayırıcı çizgi. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  backIcon = 'chevron-left',
  backAccessibilityLabel,
  backTestID,
  right,
  titleAccessory,
  align = 'start',
  divider = false,
  style,
  testID,
}: ScreenHeaderProps) {
  const scheme = useAppTheme();
  const revision = useThemeRevision();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Colors proxy tema snapshot'ını okur
  const styles = useMemo(() => getStyles(), [scheme, revision]);
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <View testID={testID} style={[styles.header, divider && styles.divider, style]}>
      <Pressable
        testID={backTestID}
        onPress={onBack ?? (() => router.back())}
        style={({ pressed }) => [styles.iconButton, styles.backButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel ?? (backIcon === 'close' ? t('cancel') : t('settings_back'))}
        hitSlop={4}
      >
        <MaterialCommunityIcons
          name={backIcon}
          size={backIcon === 'close' ? 22 : 28}
          color={Colors.textPrimary}
        />
      </Pressable>

      <View style={[styles.titleWrap, align === 'center' && styles.titleWrapCenter]}>
        <View style={[styles.titleRow, align === 'center' && styles.titleRowCenter]}>
          <Text
            style={[styles.title, align === 'center' && styles.titleCenter]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {titleAccessory}
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, align === 'center' && styles.titleCenter]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ?? <View style={styles.iconButton} />}
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconButton: {
    width: SCREEN_HEADER_BUTTON_SIZE,
    height: SCREEN_HEADER_BUTTON_SIZE,
    borderRadius: SCREEN_HEADER_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    backgroundColor: Colors.surfaceLight,
  },
  pressed: { opacity: 0.72 },
  titleWrap: { flex: 1, minWidth: 0 },
  titleWrapCenter: { alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleRowCenter: { justifyContent: 'center' },
  title: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.extraBold,
    flexShrink: 1,
  },
  titleCenter: { textAlign: 'center' },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
