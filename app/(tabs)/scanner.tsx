// S.P.A.R.K. — Receipt Scanner Screen
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image, Platform, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { DarkTheme } from '../../src/theme/colors';
import { useAppTheme, useThemePalette } from '../../src/theme/themeStore';
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
import { formatMeasurementQuantity } from '../../src/utils/measurementUnit';
import { canonicalReceiptCategoryName } from '../../src/utils/receiptCategory';
import {
  createSusevarStyles,
  susevarButtonPressed,
  susevarButtonRow,
} from '../../src/theme/susevar';

type ScanState = 'idle' | 'processing' | 'result' | 'error' | 'no_key';

const CAMERA_RESULT_TIMEOUT_MS = 120_000;
const SCAN_TOTAL_TIMEOUT_MS = 90_000;

function waitForPickerResult<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CAMERA_RESULT_TIMEOUT')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Referanstaki açık tarama işaretinin tema uyumlu, platformdan bağımsız çizimi. */
function ScannerDocumentMark({ color }: { color: string }) {
  return (
    <Svg
      testID="scanner-document-mark"
      width={40}
      height={38}
      viewBox="0 0 40 38"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M11 5.5H9A2.5 2.5 0 0 0 6.5 8v2.5M29 5.5h2A2.5 2.5 0 0 1 33.5 8v2.5M11 32.5H9A2.5 2.5 0 0 1 6.5 30v-2.5M29 32.5h2a2.5 2.5 0 0 0 2.5-2.5v-2.5"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.5 15v-1.5A4.5 4.5 0 0 1 15 9h10a4.5 4.5 0 0 1 4.5 4.5V15"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 19h22" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path
        d="M10.5 23v1.5A4.5 4.5 0 0 0 15 29h10a4.5 4.5 0 0 0 4.5-4.5V23"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const theme = useThemePalette();
  const styles = React.useMemo(() => getStyles(theme, scheme === 'dark'), [scheme, theme]);
  const router = useRouter();
  const { t, tc, language } = useLanguage();
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
  const mountedRef = useRef(true);
  const scanIdRef = useRef(0);
  const recoveringPendingRef = useRef(false);
  // Devam eden Gemini taramasını iptal etmek için (processing → "Durdur").
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      scanIdRef.current += 1;
      timersRef.current.forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, []);

  const processImage = useCallback(async (
    asset: ImagePicker.ImagePickerAsset,
    scanId: number,
  ) => {
    const isCurrent = () => mountedRef.current && scanIdRef.current === scanId;
    const hasKey = await hasApiKey();
    if (!isCurrent()) return;
    if (!hasKey) {
      setScanSessionError(null);
      setErrorMsg(t('no_api_key_msg'));
      setState('no_key');
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const totalTimeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SCAN_TOTAL_TIMEOUT_MS);
    abortRef.current = controller;
    setResult(null);
    setState('processing');
    setErrorMsg('');
    setScanSessionError(null);

    try {
      const base64 = await compressImageToBase64(asset.uri, {
        width: asset.width,
        height: asset.height,
        signal: controller.signal,
      });
      const parsed = await parseReceipt(base64, language, controller.signal);
      if (!isCurrent() || controller.signal.aborted) return;
      setResult(parsed);
      setState('result');
    } catch (error) {
      if (!isCurrent()) return;
      if (controller.signal.aborted && !timedOut) return;
      const code = error instanceof Error ? error.message : '';
      const message = timedOut
        ? t('scan_timeout_error')
        : code === 'RECEIPT_INVALID_RESULT'
          ? t('scan_invalid_result')
          : code === 'IMAGE_PROCESSING_TIMEOUT'
            ? t('scan_image_processing_timeout')
            : t('scan_failed_generic');
      setScanSessionError(message);
      setErrorMsg(message);
      setState('error');
    } finally {
      clearTimeout(totalTimeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [language, t]);

  async function pickImage(useCamera: boolean) {
    if (sourceBusyRef.current) return;
    const scanId = scanIdRef.current + 1;
    scanIdRef.current = scanId;
    sourceBusyRef.current = true;
    setSourceBusy(true);
    let asset: ImagePicker.ImagePickerAsset | null = null;
    try {
      let pickerResult: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (scanIdRef.current !== scanId) return;
        if (!perm.granted) {
          SparkToast.show(t('camera_permission_required'), 'error');
          return;
        }
        pickerResult = await waitForPickerResult(
          ImagePicker.launchCameraAsync({ quality: 1, base64: false }),
          CAMERA_RESULT_TIMEOUT_MS,
        );
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (scanIdRef.current !== scanId) return;
        if (!perm.granted) {
          SparkToast.show(t('gallery_permission_required'), 'error');
          return;
        }
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          quality: 1,
          base64: false,
        });
      }

      if (
        scanIdRef.current !== scanId
        || pickerResult.canceled
        || !pickerResult.assets?.[0]?.uri
      ) return;
      asset = pickerResult.assets[0];
    } catch (error) {
      if (scanIdRef.current !== scanId) return;
      const code = error instanceof Error ? error.message : '';
      const message = code === 'CAMERA_RESULT_TIMEOUT'
        ? t('camera_result_timeout')
        : useCamera
          ? t('camera_open_failed')
          : t('gallery_open_failed');
      setScanSessionError(message);
      setErrorMsg(message);
      setState('error');
    } finally {
      if (scanIdRef.current === scanId) {
        sourceBusyRef.current = false;
        setSourceBusy(false);
      }
    }
    if (asset && scanIdRef.current === scanId) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setImageUri(asset.uri);
      await processImage(asset, scanId);
    }
  }

  // Android sistem kamera Activity'si yeniden oluşturulursa kaybolan sonucu geri al.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    let active = true;
    const recover = async () => {
      if (
        !active
        || recoveringPendingRef.current
        || sourceBusyRef.current
        || abortRef.current
      ) return;
      recoveringPendingRef.current = true;
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        if (!active || !mountedRef.current || !pending) return;
        if ('code' in pending) {
          const message = t('camera_result_recovery_failed');
          setScanSessionError(message);
          setErrorMsg(message);
          setState('error');
          return;
        }
        if (pending.canceled || !pending.assets?.[0]?.uri) return;
        const scanId = scanIdRef.current + 1;
        scanIdRef.current = scanId;
        const recoveredAsset = pending.assets[0];
        setImageUri(recoveredAsset.uri);
        await processImage(recoveredAsset, scanId);
      } catch {
        if (active && mountedRef.current) {
          const message = t('camera_result_recovery_failed');
          setScanSessionError(message);
          setErrorMsg(message);
          setState('error');
        }
      } finally {
        recoveringPendingRef.current = false;
      }
    };

    void recover();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void recover();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [processImage, t]);

  function handleStopScan() {
    scanIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    sourceBusyRef.current = false;
    setSourceBusy(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('idle');
    setResult(null);
    setErrorMsg('');
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
            <View testID="scanner-hero-mark" style={styles.heroIcon}>
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
                  <Ionicons name="camera-outline" size={25} color={theme.onPrimary} />
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
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            )}
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.processingText}>{t('scanning_ai_toast')}</Text>
            <Text style={styles.processingSubtext}>{t('processing')}</Text>
            <Pressable
              testID="scanner-stop-action"
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
                style={[styles.actionButton, { backgroundColor: theme.primaryAction, flex: 2 }]}
                accessibilityRole="button"
                accessibilityLabel={t('tab_settings')}
              >
                <Ionicons name="settings-outline" size={20} color={theme.onPrimary} />
                <Text style={[styles.actionText, { color: theme.onPrimary }]}>{t('tab_settings')}</Text>
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
                    <Text style={styles.itemCategory}>
                      {tc(canonicalReceiptCategoryName(item.category_key, item.suggested_category))}
                    </Text>
                    {hasDisc && discAmt > 0.001 && (
                      <Text style={styles.itemDiscountHint}>
                        {t('receipt_line_discount', {
                          amount: formatReceiptDiscountAmount(discAmt, lineCurrency),
                        })}
                      </Text>
                    )}
                  </View>
                  <View style={styles.lineItemRight}>
                    {(item.quantity !== 1 || item.measurement_unit !== 'piece') && (
                      <Text style={styles.itemQty}>
                        {formatMeasurementQuantity(item.quantity, item.measurement_unit)}
                      </Text>
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
                <Ionicons name="checkmark" size={20} color={theme.onPrimary} />
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

const getStyles = (theme: typeof DarkTheme, isDark: boolean) => {
  const susevar = createSusevarStyles(theme);
  return StyleSheet.create({
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
    borderRadius: 29,
    backgroundColor: theme.primarySoft,
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
    borderColor: !isDark ? `${theme.primary}33` : theme.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: !isDark ? 0.07 : 0.16,
        shadowRadius: 14,
      },
      android: { elevation: !isDark ? 2 : 1 },
    }),
  },
  actionRailSecondary: {
    backgroundColor: theme.cardSurface,
    borderColor: theme.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: !isDark ? 0.055 : 0.16,
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
    backgroundColor: theme.primaryAction,
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
    ...susevar.button,
    backgroundColor: theme.danger,
    shadowColor: theme.danger,
    marginTop: Spacing.xl,
  },
  stopButtonPressed: susevarButtonPressed,
  stopButtonRow: susevarButtonRow,
  stopButtonText: susevar.text,
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
    ...susevar.button,
    ...susevarButtonRow,
    // Shared susevar geometrisini korurken tema rengini runtime'da yenile.
    backgroundColor: theme.primaryAction,
    shadowColor: theme.primaryAction,
  },
  savePillPressed: susevarButtonPressed,
  /**
   * İkincil pill: outline stili — primaryGlow + gölge kirli bir halo yapıyordu.
   * Kart yüzeyi ile aynı düz dolgu + tam opak vurgu çerçevesi, gölge yok.
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
  savePillText: susevar.text,
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
};
