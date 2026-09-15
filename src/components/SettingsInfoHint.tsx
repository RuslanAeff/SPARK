// S.P.A.R.K. — Ayarlar kartları: başlık yanında küçük (i) → ek bilgi modalı
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius, ScreenPadding } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';

type InfoModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Modal başlığı (genelde kart başlığı ile aynı) */
  title: string;
  /** Bir veya daha fazla paragraf */
  paragraphs: string[];
};

export function SettingsInfoHintModal({ visible, onClose, title, paragraphs }: InfoModalProps) {
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getModalStyles(), [scheme, themeRevision]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            bounces={false}
          >
            {paragraphs.filter(Boolean).map((p, i) => (
              <Text key={i} style={[styles.para, i > 0 && styles.paraGap]}>
                {p}
              </Text>
            ))}
          </ScrollView>
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.92 }]}
            onPress={onClose}
          >
            <Text style={styles.closeBtnText}>{t('close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type IconProps = {
  onPress: () => void;
  /** Erişilebilirlik etiketi */
  accessibilityLabel?: string;
};

export function SettingsInfoIconButton({ onPress, accessibilityLabel }: IconProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getIconStyles(), [scheme, themeRevision]);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.circle, pressed && styles.circlePressed]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="info-button-glass" x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={Colors.textPrimary} stopOpacity={0.09} />
              <Stop offset="0.5" stopColor={Colors.textPrimary} stopOpacity={0.025} />
              <Stop offset="1" stopColor={Colors.textPrimary} stopOpacity={0.045} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#info-button-glass)" />
        </Svg>
      </View>
      <MaterialCommunityIcons name="information-variant" size={18} color={Colors.textSecondary} />
    </Pressable>
  );
}

const getIconStyles = () =>
  StyleSheet.create({
    circle: {
      width: 28,
      height: 28,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.textSecondary + '30',
      overflow: 'hidden',
    },
    circlePressed: {
      backgroundColor: Colors.primaryGlow,
      borderColor: Colors.glassBorder,
    },
  });

const getModalStyles = () =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: ScreenPadding.horizontal,
    },
    sheet: {
      backgroundColor: Colors.cardSurface,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      padding: Spacing.xl,
      maxHeight: '78%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
        },
        android: { elevation: 12 },
      }),
    },
    sheetTitle: {
      ...Typography.headlineSmall,
      color: Colors.textPrimary,
      fontFamily: FontFamily.extraBold,
      marginBottom: Spacing.md,
    },
    scroll: {
      maxHeight: 360,
    },
    scrollContent: {
      paddingBottom: Spacing.sm,
    },
    para: {
      ...Typography.bodyMedium,
      color: Colors.textSecondary,
      lineHeight: 22,
      fontFamily: FontFamily.regular,
    },
    paraGap: {
      marginTop: Spacing.md,
    },
    closeBtn: {
      marginTop: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surfaceLight,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    closeBtnText: {
      ...Typography.labelLarge,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
    },
  });
