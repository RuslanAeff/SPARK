// S.P.A.R.K. — Veritabanı açılış hatası ekranı (BUG-07)
// Dil sağlayıcısının DIŞINDA çalışır: kayıtlı dil tercihi veritabanında olduğu
// için okunamaz; telefonun dili kullanılır. Ham hata metni gösterilmez.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { getDict, loadLocale, type Language } from '../i18n/translations';
import { suggestLanguageFromDevice } from '../i18n/languageOptions';
import { FontFamily } from '../theme/typography';

type Palette = {
  background: string;
  danger: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  onPrimary: string;
};

const KEYS = ['db_open_failed_title', 'db_open_failed_desc', 'db_open_retry'] as const;

function lookup(lang: Language, key: (typeof KEYS)[number]): string {
  return getDict(lang)?.[key] ?? getDict('en')?.[key] ?? key;
}

export default function DatabaseErrorScreen({
  onRetry,
  retrying,
  palette,
}: {
  onRetry: () => void;
  retrying: boolean;
  palette: Palette;
}) {
  const [lang, setLang] = useState<Language>(() => {
    const device = suggestLanguageFromDevice();
    return device === 'tr' || device === 'en' ? device : 'en';
  });

  useEffect(() => {
    const device = suggestLanguageFromDevice();
    if (device === 'tr' || device === 'en') return;
    let active = true;
    loadLocale(device).then(() => { if (active) setLang(device); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <MaterialCommunityIcons name="database-alert-outline" size={48} color={palette.danger} />
      <Text style={[styles.title, { color: palette.textPrimary }]}>{lookup(lang, 'db_open_failed_title')}</Text>
      <Text style={[styles.desc, { color: palette.textSecondary }]}>{lookup(lang, 'db_open_failed_desc')}</Text>
      <Pressable
        testID="database-error-retry"
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityState={{ disabled: retrying, busy: retrying }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.primary },
          (pressed || retrying) && { opacity: 0.7 },
        ]}
      >
        {retrying
          ? <ActivityIndicator color={palette.onPrimary} />
          : <Text style={[styles.buttonText, { color: palette.onPrimary }]}>{lookup(lang, 'db_open_retry')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    textAlign: 'center',
  },
  desc: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    minWidth: 180,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
});
