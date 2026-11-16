// S.P.A.R.K. — Dil seçici alt sayfası
//
// UI denetimi UX-08: Eskiden kendi `Modal`'ını, gesture kökünü, sürükle-kapat
// mantığını ve Android pencere boşluğu hesabını yeniden yazıyordu (311 satır).
// Artık ortak `BottomSheetModal` (tutamak, sürükle-kapat, güvenli alan, temalı
// karartı, aynı açılış/kapanış süreleri) üzerinde yalnız seçim listesidir.
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import BottomSheetModal from './BottomSheetModal';
import { useThemePalette } from '../theme/themeStore';
import type { ThemePalette } from '../theme/colors';
import { FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import type { Language } from '../i18n/translations';
import { LANGUAGE_OPTIONS } from '../i18n/languageOptions';

type Props = {
  visible: boolean;
  onClose: () => void;
  current: Language;
  onSelect: (lang: Language) => void;
  title: string;
  /** Karartı dokunmasının ekran okuyucu etiketi (A11Y-04: sabit "Kapat" idi). */
  closeLabel: string;
};

export default function LanguagePickerSheet({
  visible,
  onClose,
  current,
  onSelect,
  title,
  closeLabel,
}: Props) {
  const theme = useThemePalette();
  const styles = useMemo(() => getStyles(theme), [theme]);

  function pick(code: Language) {
    if (code !== current) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(code);
    }
    onClose();
  }

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      showHandle
      sheetStyle={styles.sheet}
      backdropAccessibilityLabel={closeLabel}
    >
      <Text style={styles.sheetTitle} accessibilityRole="header">{title}</Text>
      <View accessibilityRole="radiogroup">
        {LANGUAGE_OPTIONS.map(({ code, nativeLabel }, index) => {
          const selected = current === code;
          const isLast = index === LANGUAGE_OPTIONS.length - 1;
          return (
            <Pressable
              key={code}
              testID={`language-option-${code}`}
              onPress={() => pick(code)}
              style={({ pressed }) => [styles.row, isLast && styles.rowLast, pressed && styles.rowPressed]}
              accessibilityRole="radio"
              accessibilityLabel={nativeLabel}
              accessibilityState={{ selected, checked: selected }}
            >
              <Text style={styles.rowLabel}>{nativeLabel}</Text>
              <View style={[styles.radioOuter, selected && styles.radioOuterOn]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheetModal>
  );
}

const getStyles = (theme: ThemePalette) => StyleSheet.create({
  sheet: {
    backgroundColor: theme.surfaceElevated,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.cardBorder,
  },
  sheetTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: theme.textPrimary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { opacity: 0.88 },
  rowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 17,
    color: theme.textPrimary,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterOn: { borderColor: theme.primary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.primary,
  },
});
