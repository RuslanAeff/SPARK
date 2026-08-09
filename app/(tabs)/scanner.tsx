// S.P.A.R.K. — Receipt Scanner Screen
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { DarkTheme, LightTheme } from '../../src/theme/colors';
import { useAppTheme } from '../../src/theme/themeStore';
import { Typography, FontFamily } from '../../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../../src/theme/spacing';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { parseReceipt, ParsedReceipt, hasApiKey } from '../../src/services/geminiService';
import { processReceipt } from '../../src/services/receiptParser';
import AnimatedCard from '../../src/components/AnimatedCard';
import { SparkToast } from '../../src/components/SparkToast';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { useRefreshActions } from '../../src/context/RefreshContext';
import { useCurrency } from '../../src/context/CurrencyContext';
import { setScanSessionError } from '../../src/services/scanSession';
import {
  effectiveLineDiscount,
  formatReceiptDiscountAmount,
  lineHasDiscount,
} from '../../src/utils/receiptLineDiscountUi';
import { itemDisplayName } from '../../src/utils/itemDisplayName';
import { compressImageToBase64 } from '../../src/utils/imageCompressor';
import {
  susevarButton,
  susevarButtonPressed,
  susevarButtonRow,
  susevarButtonText,
} from '../../src/theme/susevar';

type ScanState = 'idle' | 'processing' | 'result' | 'error' | 'no_key';

export default function ScannerScreen() {
  const scheme = useAppTheme();
  const theme = scheme === 'light' ? LightTheme : DarkTheme;
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { t, language } = useLanguage();
  const { triggerRefresh } = useRefreshActions();
  const { currency } = useCurrency();
  const [state, setState] = useState<ScanState>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedReceipt | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Devam eden Gemini taramasını iptal etmek için (processing → "Durdur").
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, []);

  async function pickImage(useCamera: boolean) {
    let result;
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        SparkToast.show(t('camera_permission_required'), 'error');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: false,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        SparkToast.show(t('gallery_permission_required'), 'error');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        base64: false,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const asset = result.assets[0];
    setImageUri(asset.uri);
    await processImage(asset.uri);
  }

  async function processImage(uri: string) {
    const hasKey = await hasApiKey();
    if (!hasKey) {
      setScanSessionError(null);
      setErrorMsg(t('no_api_key_msg'));
      setState('no_key');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setState('processing');
    setErrorMsg('');
    setScanSessionError(null);

    try {
      // P3: Görüntüyü sıkıştır + base64'e çevir (max 1536px, JPEG %70)
      const base64 = await compressImageToBase64(uri);

      const parsed = await parseReceipt(base64, language, controller.signal);
      if (controller.signal.aborted) return; // kullanıcı "Durdur" dedi
      setResult(parsed);
      setState('result');
    } catch (e) {
      // İptal (Durdur) → sessizce idle'a dönüldü; hata gösterme.
      if (controller.signal.aborted) return;
      const msg = e instanceof Error ? e.message : t('unknown_error');
      setScanSessionError(msg);
      setErrorMsg(msg);
      setState('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function handleStopScan() {
    abortRef.current?.abort();
    abortRef.current = null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('idle');
    setImageUri(null);
  }

  async function handleSave() {
    if (!result) return;
    const receiptToSave = result;
    try {
      await processReceipt(receiptToSave);
      setScanSessionError(null);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      triggerRefresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(t('receipt_parsed'), 'success', `${receiptToSave.vendor_name} • ${receiptToSave.items?.length || 0}`);
      setState('idle');
      setResult(null);
      setImageUri(null);
    } catch (e) {
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

  async function handleEditBeforeSave() {
    if (!result) return;
    const receiptToSave = result;
    try {
      // Düzenlemeden önce fişi (ÜRÜNLER DAHİL) kaydet, sonra edit modunda aç.
      // Eskiden yalnız başlık prefill ediliyordu → ürünler kayboluyordu.
      const expenseId = await processReceipt(receiptToSave);
      setScanSessionError(null);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      triggerRefresh();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setState('idle');
      setResult(null);
      setImageUri(null);
      router.push(`/add-expense?id=${expenseId}`);
    } catch (e) {
      SparkToast.show(t('error_saving_data'), 'error');
    }
  }

  return (
    <SafeAreaView testID="scanner-screen" style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('scanner_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state === 'idle' && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.idleContent}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="receipt" size={64} color={theme.primary} />
            </View>
            <Text style={styles.idleTitle}>{t('scan_receipt')}</Text>
            <Text style={styles.idleSubtitle}>
              {t('scanner_subtitle')}
            </Text>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => pickImage(true)}
                style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.scanButtonIconWrap}>
                  <MaterialCommunityIcons name="camera-iris" size={28} color={theme.primary} />
                </View>
                <Text style={styles.scanButtonText}>{t('camera')}</Text>
              </Pressable>
              
              <Pressable
                onPress={() => pickImage(false)}
                style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.scanButtonIconWrap}>
                  <MaterialCommunityIcons name="image-auto-adjust" size={28} color={theme.primary} />
                </View>
                <Text style={styles.scanButtonText}>{t('gallery')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {state === 'processing' && (
          <View style={styles.processingContent}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            )}
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.processingText}>{t('scanning_ai_toast')}</Text>
            <Text style={styles.processingSubtext}>{t('processing')}</Text>
            <Pressable
              onPress={handleStopScan}
              style={({ pressed }) => [styles.stopButton, pressed && styles.stopButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('stop_scan')}
            >
              <View style={styles.stopButtonRow}>
                <MaterialCommunityIcons name="stop-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.stopButtonText}>{t('stop_scan')}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {state === 'no_key' && (
          <View style={styles.errorContent}>
            <MaterialCommunityIcons name="key-alert" size={48} color={theme.secondary} />
            <Text style={styles.errorTitle}>{t('no_api_key_title')}</Text>
            <Text style={styles.errorMessage}>{errorMsg}</Text>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => { setState('idle'); setImageUri(null); }}
                style={[styles.actionButton, { backgroundColor: theme.surfaceLight }]}
              >
                <Text style={styles.actionText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings-ai')}
                style={[styles.actionButton, { backgroundColor: theme.primary, flex: 2 }]}
              >
                <MaterialCommunityIcons name="cog-outline" size={20} color={theme.textPrimary} />
                <Text style={styles.actionText}>{t('tab_settings')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.errorContent}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.danger} />
            <Text style={styles.errorTitle}>{t('error')}</Text>
            <Text style={styles.errorMessage}>{errorMsg}</Text>
            <Pressable
              onPress={() => { setState('idle'); setImageUri(null); }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>{t('try_again')}</Text>
            </Pressable>
          </View>
        )}

        {state === 'result' && result && (() => {
          const lineCurrency = result.currency || currency;
          return (
          <Animated.View entering={FadeInDown.duration(500)}>
            <AnimatedCard style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={styles.vendorName}>{result.vendor_name}</Text>
                  {result._modelUsed && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <View style={{ backgroundColor: theme.primary + '22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ ...Typography.labelSmall, color: theme.primary, fontFamily: FontFamily.semiBold, fontSize: 10 }}>
                          ✨ {result._modelUsed.split(' (')[0].replace('gemini-', '')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.resultDate}>{result.date}</Text>
              </View>

              <View style={styles.divider} />

              {/* Line Items */}
              {result.items.map((item, i) => {
                const hasDisc = lineHasDiscount(item);
                const discAmt = effectiveLineDiscount(item);
                const listAmt = item.list_line_total_before_discount;
                const display = itemDisplayName(item);
                return (
                <View key={i} style={styles.lineItem}>
                  <View style={styles.lineItemLeft}>
                    <Text style={styles.itemName}>{display.primary}</Text>
                    {display.secondary && (
                      <Text style={styles.itemNameOriginal} numberOfLines={1}>{display.secondary}</Text>
                    )}
                    <Text style={styles.itemCategory}>{item.suggested_category}</Text>
                    {hasDisc && discAmt > 0.001 && (
                      <Text style={styles.itemDiscountHint}>
                        {t('receipt_line_discount', {
                          amount: formatReceiptDiscountAmount(discAmt, lineCurrency),
                        })}
                      </Text>
                    )}
                  </View>
                  <View style={styles.lineItemRight}>
                    {item.quantity > 1 && (
                      <Text style={styles.itemQty}>x{item.quantity}</Text>
                    )}
                    {hasDisc && listAmt != null && listAmt > (item.total_price ?? 0) + 0.001 && (
                      <Text style={styles.itemWasPrice}>
                        {t('receipt_line_was', {
                          amount: formatCurrency(listAmt, lineCurrency),
                        })}
                      </Text>
                    )}
                    <Text style={[styles.itemPrice, hasDisc && styles.itemPriceNet]}>
                      {formatCurrency(item.total_price, lineCurrency)}
                    </Text>
                  </View>
                </View>
                );
              })}

              <View style={styles.divider} />

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('total').toUpperCase()}</Text>
                <Text style={styles.totalAmount}>
                  {formatCurrency(result.total, lineCurrency)}
                </Text>
              </View>
            </AnimatedCard>

            <View style={styles.resultActionsCol}>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.savePill,
                  pressed && styles.savePillPressed,
                ]}
              >
                <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                <Text style={styles.savePillText}>{t('save')}</Text>
              </Pressable>
              <Pressable
                onPress={handleEditBeforeSave}
                style={({ pressed }) => [
                  styles.editPill,
                  pressed && styles.pillPressed,
                ]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.primary} />
                <Text style={styles.editPillText}>{t('edit')}</Text>
              </Pressable>
              <Pressable
                onPress={() => { setState('idle'); setResult(null); setImageUri(null); }}
                style={styles.cancelGhost}
              >
                <Text style={styles.cancelGhostText}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </Animated.View>
          );
        })()}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: typeof DarkTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingVertical: Spacing.lg,
  },
  title: {
    ...Typography.headlineLarge,
    color: theme.textPrimary,
  },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    flexGrow: 1,
  },
  // Idle
  idleContent: {
    alignItems: 'center',
    paddingTop: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  idleTitle: {
    ...Typography.headlineMedium,
    color: theme.textPrimary,
    marginBottom: Spacing.sm,
  },
  idleSubtitle: {
    ...Typography.bodyMedium,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxxl,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: Spacing.lg,
    width: '100%',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    backgroundColor: theme.cardSurface,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  scanButtonIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primaryGlow,
  },
  scanButtonText: {
    color: theme.primary,
    fontFamily: FontFamily.extraBold,
    fontSize: 16,
    letterSpacing: 0.6,
  },
  // Processing
  processingContent: {
    alignItems: 'center',
    paddingTop: 40,
    gap: Spacing.lg,
  },
  previewImage: {
    width: 200,
    height: 280,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  processingText: {
    ...Typography.headlineSmall,
    color: theme.textPrimary,
  },
  processingSubtext: {
    ...Typography.bodySmall,
    color: theme.textSecondary,
  },
  /** Durdur — şüşevar dili, kırmızı (danger) varyant */
  stopButton: {
    ...susevarButton,
    backgroundColor: theme.danger,
    shadowColor: theme.danger,
    marginTop: Spacing.xl,
  },
  stopButtonPressed: susevarButtonPressed,
  stopButtonRow: susevarButtonRow,
  stopButtonText: susevarButtonText,
  // Error
  errorContent: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  errorTitle: {
    ...Typography.headlineSmall,
    color: theme.danger,
  },
  errorMessage: {
    ...Typography.bodyMedium,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    backgroundColor: theme.surface,
    borderRadius: BorderRadius.round,
    marginTop: Spacing.lg,
  },
  retryText: {
    ...Typography.labelLarge,
    color: theme.primary,
  },
  // Result
  resultCard: {
    marginTop: Spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vendorName: {
    ...Typography.headlineSmall,
    color: theme.textPrimary,
  },
  resultDate: {
    ...Typography.bodySmall,
    color: theme.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.divider,
    marginVertical: Spacing.md,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  lineItemLeft: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing.sm,
  },
  lineItemRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 2,
    minWidth: 100,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: theme.textPrimary,
  },
  itemNameOriginal: {
    ...Typography.labelSmall,
    color: theme.textMuted,
  },
  itemCategory: {
    ...Typography.labelSmall,
    color: theme.textSecondary,
  },
  itemDiscountHint: {
    ...Typography.labelSmall,
    color: theme.primary,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  itemQty: {
    ...Typography.labelSmall,
    color: theme.textMuted,
  },
  itemWasPrice: {
    ...Typography.labelSmall,
    color: theme.textMuted,
    textDecorationLine: 'line-through',
  },
  itemPrice: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.semiBold,
    color: theme.textPrimary,
  },
  itemPriceNet: {
    color: theme.primary,
    fontFamily: FontFamily.bold,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...Typography.labelLarge,
    color: theme.textSecondary,
    letterSpacing: 1,
  },
  totalAmount: {
    ...Typography.headlineMedium,
    color: theme.primary,
    fontFamily: FontFamily.bold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  actionText: {
    ...Typography.labelLarge,
    color: theme.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  /** Fiş sonucu — şüşevar (Kaydet) + Düzenle */
  resultActionsCol: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  savePill: {
    ...susevarButton,
    ...susevarButtonRow,
    // Shared susevar geometrisini korurken tema rengini runtime'da yenile.
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
  },
  savePillPressed: susevarButtonPressed,
  /**
   * İkincil pill: outline stili — primaryGlow + gölge gri-yeşil “kirli halo” yapıyordu.
   * Kart yüzeyi ile aynı düz dolgu + tam opak yeşil çerçeve, gölge yok (tam uyum).
   */
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: theme.cardSurface,
    borderRadius: BorderRadius.round,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  pillPressed: {
    opacity: 0.9,
  },
  savePillText: susevarButtonText,
  editPillText: {
    color: theme.primary,
    fontFamily: FontFamily.extraBold,
    fontSize: 17,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cancelGhost: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  cancelGhostText: {
    ...Typography.labelLarge,
    color: theme.textSecondary,
    fontFamily: FontFamily.bold,
  },
});
