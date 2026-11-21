// S.P.A.R.K. — Borç ve ek gelir sayfalarının ortak stilleri (UI denetimi CQ-07)
//
// `DebtSheet` ile `IncomeSheet` aynı sayfa kabuğunu (başlık, liste alanı, boş
// durum, form başlığı, giriş alanları, birincil düğme) paylaşır. Bu bloklar iki
// dosyada birebir kopyaydı; bir taraftaki düzeltme diğerine gitmiyordu. Sayfaya
// özgü renkler (gelirde yeşil, borçta kırmızı alt başlık vb.) sayfanın kendi
// stilinde kalır. Tema kalıbı gereği çağıran `useMemo` içinde yeniden üretir.
import { StyleSheet } from 'react-native';

import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../theme/spacing';
import { createSusevarStyles } from '../theme/susevar';

export const getFinanceSheetBaseStyles = (windowHeight: number) => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: windowHeight * 0.85,
    paddingTop: Spacing.sm,
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sheetDark: {
    borderTopWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  listScroll: {
    flexShrink: 1,
    maxHeight: windowHeight * 0.46,
  },
  // Sanal liste: satır aralığı `FinanceListGap` ayırıcısından gelir.
  listContentVirtual: {
    paddingBottom: Spacing.sm,
  },
  noteText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
  histDeleteText: {
    ...Typography.labelSmall,
    color: Colors.danger,
    fontFamily: FontFamily.semiBold,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
  },
  emptyDesc: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  formTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  formScroll: {
    flexShrink: 1,
    maxHeight: windowHeight * 0.66,
  },
  formContent: {
    paddingBottom: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.labelLarge,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputAsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputButtonText: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  primaryBtn: {
    ...createSusevarStyles(Colors).button,
    marginTop: Spacing.lg,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
});
