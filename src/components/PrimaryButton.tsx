// S.P.A.R.K. — Birincil eylem düğmesi (UI denetimi DS-07)
//
// Şüşevar sözleşmesinin (`src/theme/susevar.ts`) bileşen hâli. Ekranlar daha
// önce aynı `primaryAction` dolgusunu elle, farklı iç boşluk, köşe ve yazı
// boyutlarıyla yeniden yazıyordu. Yeni ana eylemler bu bileşeni kullanır:
//   • `size="default"`: tam şüşevar ("TÜMÜNÜ GÜNCELLE" ile birebir);
//   • `size="compact"`: aynı renk, kenar, gölge ve yazı ailesi; yan yana iki
//     düğme veya satır içi eylem için daha kısa iç boşluk ve 14 px yazı.
// Metin her zaman `onPrimary`; dolgu `primaryAction` (beş vurguda ≥ 5,4:1).
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

import { createSusevarStyles, susevarButtonPressed } from '../theme/susevar';
import { Spacing } from '../theme/spacing';
import { FontSize } from '../theme/typography';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  size?: 'default' | 'compact';
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  disabled?: boolean;
  /** true iken düğme basılamaz ve etiket yerine dönen gösterge çizilir. */
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export default function PrimaryButton({
  label,
  onPress,
  size = 'default',
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: PrimaryButtonProps) {
  const styles = useThemedStyles(getStyles);
  const inactive = disabled || loading;
  const compact = size === 'compact';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        inactive && styles.disabled,
        pressed && !inactive && susevarButtonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.onPrimary} />
      ) : (
        <View style={styles.row}>
          {icon ? (
            <MaterialCommunityIcons name={icon} size={compact ? 18 : 20} color={Colors.onPrimary} />
          ) : null}
          <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const getStyles = () => {
  const susevar = createSusevarStyles(Colors);
  return StyleSheet.create({
    button: { ...susevar.button, minHeight: 48 },
    buttonCompact: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      minHeight: 44,
    },
    disabled: { opacity: 0.55 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    text: { ...susevar.text },
    textCompact: { fontSize: FontSize.base, letterSpacing: 0.6 },
  });
};
