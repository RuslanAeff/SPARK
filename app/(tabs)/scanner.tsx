// S.P.A.R.K. — Receipt Scanner Screen
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
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

/** SPARK'a özgü belge-tarama işareti; platform ikon setine bağlı değildir. */
function ScannerDocumentMark({ color }: { color: string }) {
  return (
    <Svg
      width={35}
      height={35}
      viewBox="0 0 36 36"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M12 5H9a4 4 0 0 0-4 4v3" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M24 5h3a4 4 0 0 1 4 4v3" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 31H9a4 4 0 0 1-4-4v-3" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M24 31h3a4 4 0 0 0 4-4v-3" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path
        d="M12.5 10.5h8.2l4.8 4.8v10.2h-13z"
        stroke={color}
        strokeWidth={2.1}
        strokeLinejoin="round"
      />
      <Path d="M20.7 10.8v4.7h4.5" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 19h17" stroke={color} strokeWidth={2.35} strokeLinecap="round" />
      <Path d="M16 22.8h6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

/** Galeri kaynağı için SPARK tarama çerçevesi; hazır platform ikonu kullanılmaz. */
function ScannerGalleryMark({ color }: { color: string }) {
  return (
    <Svg
      width={31}
      height={31}
      viewBox="0 0 32 32"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M11 4H8a4 4 0 0 0-4 4v3" stroke={color} strokeWidth={2.15} strokeLinecap="round" />
      <Path d="M21 4h3a4 4 0 0 1 4 4v3" stroke={color} strokeWidth={2.15} strokeLinecap="round" />
      <Path d="M11 28H8a4 4 0 0 1-4-4v-3" stroke={color} strokeWidth={2.15} strokeLinecap="round" />
      <Path d="M21 28h3a4 4 0 0 0 4-4v-3" stroke={color} strokeWidth={2.15} strokeLinecap="round" />
      <Path d="M9 21.5l4.7-5 3.5 3.3 2.6-2.5 3.2 4.2" stroke={color} strokeWidth={2.15} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21.2 10.4a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z" stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

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
  const [sourceBusy, setSourceBusy] = useState(false);
  const [resultBusy, setResultBusy] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sourceBusyRef = useRef(false);
  const resultBusyRef = useRef(false);
  // Devam eden Gemini taramasını iptal etmek için (processing → "Durdur").
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, []);

  async function pickImage(useCamera: boolean) {
    if (sourceBusyRef.current) return;
    sourceBusyRef.current = true;
    setSourceBusy(true);
    try {
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
    } finally {
      sourceBusyRef.current = false;
      setSourceBusy(false);
    }
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
    if (!result || resultBusyRef.current) return;
    resultBusyRef.current = true;
    setResultBusy(true);
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
    } finally {
      resultBusyRef.current = false;
      setResultBusy(false);
    }
  }

  async function handleEditBeforeSave() {
    if (!result || resultBusyRef.current) return;
    resultBusyRef.current = true;
    setResultBusy(true);
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
    } finally {
      resultBusyRef.current = false;
      setResultBusy(false);
    }
  }

  return (
    <SafeAreaView testID="scanner-screen" style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('scanner_title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state === 'idle' && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.idleContent}>
            <View style={styles.heroIcon}>
              <ScannerDocumentMark color={theme.primary} />
            </View>
            <Text style={styles.idleTitle}>{t('scan_receipt')}</Text>
            <Text style={styles.idleSubtitle}>
              {t('scanner_subtitle')}
            </Text>

            <View style={styles.actionStack}>
              <Pressable
                testID="scanner-camera-action"
                onPress={() => pickImage(true)}
                disabled={sourceBusy}
                style={({ pressed }) => [
                  styles.actionRail,
                  styles.actionRailPrimary,
                  sourceBusy && styles.actionRailDisabled,
                  pressed && styles.actionRailPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('camera')}
                accessibilityHint={t('scanner_subtitle')}
                accessibilityState={{ disabled: sourceBusy, busy: sourceBusy }}
              >
                <View style={[styles.actionIconCapsule, styles.actionIconCapsulePrimary]}>
                  <Ionicons name="camera-outline" size={25} color="#06130A" />
                </View>
                <Text style={[styles.actionLabel, styles.actionLabelPrimary]} numberOfLines={2}>
                  {t('camera')}
                </Text>
                <Ionicons name="chevron-forward" size={19} color={theme.textMuted} />
              </Pressable>

              <Pressable
                testID="scanner-gallery-action"
                onPress={() => pickImage(false)}
                disabled={sourceBusy}
                style={({ pressed }) => [
                  styles.actionRail,
                  styles.actionRailSecondary,
                  sourceBusy && styles.actionRailDisabled,
                  pressed && styles.actionRailPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('gallery')}
                accessibilityHint={t('scanner_subtitle')}
                accessibilityState={{ disabled: sourceBusy, busy: sourceBusy }}
              >
                <View style={[styles.actionIconCapsule, styles.actionIconCapsuleSecondary]}>
                  <ScannerGalleryMark color={theme.primary} />
                </View>
                <Text style={[styles.actionLabel, styles.actionLabelSecondary]} numberOfLines={2}>
                  {t('gallery')}
                </Text>
                <Ionicons name="chevron-forward" size={19} color={theme.textMuted} />
              </Pressable>
            </View>
          </Animated.View>
        )}

        {state === 'processing' && (
          <View style={styles.processingContent} accessibilityLiveRegion="polite">
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
                <Ionicons name="stop-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.stopButtonText}>{t('stop_scan')}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {state === 'no_key' && (
          <View style={styles.errorContent}>
            <Ionicons name="key-outline" size={44} color={theme.secondary} />
            <Text style={styles.errorTitle}>{t('no_api_key_title')}</Text>
            <Text style={styles.errorMessage}>{errorMsg}</Text>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => { setState('idle'); setImageUri(null); }}
                style={[styles.actionButton, { backgroundColor: theme.surfaceLight }]}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
              >
                <Text style={styles.actionText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings-ai')}
                style={[styles.actionButton, { backgroundColor: theme.primary, flex: 2 }]}
                accessibilityRole="button"
                accessibilityLabel={t('tab_settings')}
              >
                <Ionicons name="settings-outline" size={20} color={theme.textInverse} />
                <Text style={styles.actionText}>{t('tab_settings')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle-outline" size={44} color={theme.danger} />
            <Text style={styles.errorTitle}>{t('error')}</Text>
            <Text style={styles.errorMessage}>{errorMsg}</Text>
            <Pressable
              onPress={() => { setState('idle'); setImageUri(null); }}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel={t('try_again')}
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
                disabled={resultBusy}
                style={({ pressed }) => [
                  styles.savePill,
                  resultBusy && styles.resultActionDisabled,
                  pressed && styles.savePillPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('save')}
                accessibilityState={{ disabled: resultBusy, busy: resultBusy }}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.savePillText}>{t('save')}</Text>
              </Pressable>
              <Pressable
                onPress={handleEditBeforeSave}
                disabled={resultBusy}
                style={({ pressed }) => [
                  styles.editPill,
                  resultBusy && styles.resultActionDisabled,
                  pressed && styles.pillPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('edit')}
                accessibilityState={{ disabled: resultBusy, busy: resultBusy }}
              >
                <Ionicons name="pencil-outline" size={20} color={theme.primary} />
                <Text style={styles.editPillText}>{t('edit')}</Text>
              </Pressable>
              <Pressable
                onPress={() => { setState('idle'); setResult(null); setImageUri(null); }}
                disabled={resultBusy}
                style={[styles.cancelGhost, resultBusy && styles.resultActionDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                accessibilityState={{ disabled: resultBusy }}
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
    alignItems: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.displaySmall,
    fontFamily: FontFamily.bold,
    fontSize: 29,
    lineHeight: 36,
    letterSpacing: -0.65,
    color: theme.textPrimary,
  },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    flexGrow: 1,
  },
  // Idle
  idleContent: {
    alignItems: 'flex-start',
    paddingTop: Spacing.xxl,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: theme.primaryGlow,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  idleTitle: {
    ...Typography.headlineMedium,
    fontFamily: FontFamily.semiBold,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.15,
    color: theme.textPrimary,
    marginBottom: Spacing.sm,
  },
  idleSubtitle: {
    ...Typography.bodyLarge,
    color: theme.textSecondary,
    textAlign: 'left',
    lineHeight: 24,
    maxWidth: 350,
    marginBottom: Spacing.huge,
  },
  actionStack: {
    flexDirection: 'column',
    gap: Spacing.md,
    width: '100%',
  },
  actionRail: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 29,
    padding: 8,
    paddingRight: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  actionRailPrimary: {
    backgroundColor: theme.cardSurface,
    borderColor: theme === LightTheme ? `${theme.primary}33` : theme.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: theme === LightTheme ? 0.07 : 0.16,
        shadowRadius: 14,
      },
      android: { elevation: theme === LightTheme ? 2 : 1 },
    }),
  },
  actionRailSecondary: {
    backgroundColor: theme.cardSurface,
    borderColor: theme.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: theme === LightTheme ? 0.055 : 0.16,
        shadowRadius: 12,
      },
      android: { elevation: 1 },
    }),
  },
  actionRailPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  actionRailDisabled: {
    opacity: 0.55,
  },
  actionIconCapsule: {
    width: 88,
    height: 60,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCapsulePrimary: {
    backgroundColor: theme.primaryLight,
  },
  actionIconCapsuleSecondary: {
    backgroundColor: theme.primaryGlow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
  },
  actionLabel: {
    flex: 1,
    marginLeft: Spacing.lg,
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.15,
  },
  actionLabelPrimary: {
    color: theme.textPrimary,
  },
  actionLabelSecondary: {
    color: theme.textPrimary,
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
  resultActionDisabled: {
    opacity: 0.5,
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
