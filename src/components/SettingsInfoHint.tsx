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
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
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
  const styles = useMemo(() => getModalStyles(), [scheme]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
  const styles = useMemo(() => getIconStyles(), [scheme]);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.circle, pressed && styles.circlePressed]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/*
        Yeşil donut (border) + kart rengi iç. Ortada metin “i” değil, MDI
        `information` (dolu varyant — outline’tan daha kalın çizgi hissi).
        Hafif scale ile okunaklılık artırıldı.
      */}
      <MaterialCommunityIcons
        name="information"
        size={15}
        color={Colors.primary}
        style={styles.infoGlyph}
      />
    </Pressable>
  );
}

const getIconStyles = () =>
  StyleSheet.create({
    circle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.cardSurface,
      borderWidth: 2,
      borderColor: Colors.primary,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        android: { elevation: 2 },
      }),
    },
    infoGlyph: {
      // Vektörde çizgi kalınlığını doğrudan artıramıyoruz; dolu ikon + hafif büyütme
      transform: [{ scale: 1.12 }],
    },
    circlePressed: {
      opacity: 0.86,
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
