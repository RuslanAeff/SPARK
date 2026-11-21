// S.P.A.R.K. — Borç ve ek gelir listelerinin ortak sanal liste ayarları (UX-12)
//
// Geçmiş listeleri eskiden bütün kayıtları açılışta bir kerede çiziyordu.
// `FlatList` yalnız ekranda görünen satırları ve hemen çevresini çizer;
// kaydırdıkça sıradakileri hazırlar. Satır aralığı `gap` yerine ayırıcıyla
// verilir: sanal liste görünmeyen satırların yerine boşluk koyduğunda `gap`
// o boşluğa da eklenip kaydırma konumunu kaydırırdı.
import React from 'react';
import { View } from 'react-native';

import { Spacing } from '../theme/spacing';

export function FinanceListGap() {
  return <View style={{ height: Spacing.sm }} />;
}

/** İlk açılışta çizilen satır sayısı ve önceden hazırlanan ekran sayısı. */
export const FINANCE_LIST_VIRTUALIZATION = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 12,
  windowSize: 7,
} as const;
