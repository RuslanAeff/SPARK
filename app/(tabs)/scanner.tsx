import { subtractMoney } from '../../src/utils/moneyMath';
import { removeReceiptCopy } from '../../src/services/temporaryFiles';
import { confirmAiTransfer } from '../../src/utils/confirmAiTransfer';
// S.P.A.R.K. — Receipt Scanner Screen
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image, Platform, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import type { Language } from '../../src/i18n/translations';
import { useRefreshActions } from '../../src/context/RefreshContext';
import { useCurrency } from '../../src/context/CurrencyContext';
import { setScanSessionError } from '../../src/services/scanSession';
import { presentAiError } from '../../src/utils/aiErrorPresentation';
import ScanRecoveryCard from '../../src/components/ScanRecoveryCard';
import ReceiptHolographicCarousel from '../../src/components/ReceiptHolographicCarousel';
import {
  effectiveLineDiscount,
  formatReceiptDiscountAmount,
  lineHasDiscount,
} from '../../src/utils/receiptLineDiscountUi';
import { itemDisplayName } from '../../src/utils/itemDisplayName';
import { compressImageToBase64 } from '../../src/utils/imageCompressor';
import { formatMeasurementQuantity } from '../../src/utils/measurementUnit';
import { canonicalReceiptCategoryName } from '../../src/utils/receiptCategory';
import { ContainerDepositDao } from '../../src/db/containerDepositDao';
import {
  createSusevarStyles,
  susevarButtonPressed,
  susevarButtonRow,
} from '../../src/theme/susevar';

type ScanState = 'idle' | 'collecting' | 'processing' | 'result' | 'error' | 'no_key';

const CAMERA_RESULT_TIMEOUT_MS = 120_000;
const SCAN_TOTAL_TIMEOUT_MS = 90_000;

function waitForPickerResult<T>(promise: Promise<T>, timeoutMs: number, onLate?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => { expired = true; reject(new Error('CAMERA_RESULT_TIMEOUT')); }, timeoutMs);
    promise.then(
      (value) => {
        if (expired) onLate?.(value);
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
  const { t, tc, language } = useLanguage();
  const styles = React.useMemo(
    () => getStyles(theme, scheme === 'dark', language),
    [scheme, theme, language],
  );
  const router = useRouter();
  const { triggerRefresh } = useRefreshActions();
  const { currency } = useCurrency();
  const [state, setState] = useState<ScanState>('idle');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [result, setResult] = useState<ParsedReceipt | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  // Hata ekranının birincil eylemi: anahtar sorunlarında doğrudan Ayarlar.
  const [errorAction, setErrorAction] = useState<'settings' | 'retry'>('retry');
  const [sourceBusy, setSourceBusy] = useState(false);
  const [resultBusy, setResultBusy] = useState(false);
  const receiptCopiesRef = useRef<string[]>([]);
  const replaceReceiptCopies = (uris: string[]) => {
    for (const previous of receiptCopiesRef.current) {
      if (!uris.includes(previous)) void removeReceiptCopy(previous);
    }
    receiptCopiesRef.current = uris;
  };
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
      replaceReceiptCopies([]);
      mountedRef.current = false;
      scanIdRef.current += 1;
      timersRef.current.forEach(clearTimeout);
      abortRef.current?.abort();
    };
  }, []);

  const processImages = useCallback(async (
    assets: ImagePicker.ImagePickerAsset[],
    scanId: number,
  ) => {
    const isCurrent = () => mountedRef.current && scanIdRef.current === scanId;
    const hasKey = await hasApiKey();
    if (!isCurrent()) { for (const asset of assets) await removeReceiptCopy(asset.uri); return; }
    if (!hasKey) {
      for (const asset of assets) await removeReceiptCopy(asset.uri);
      receiptCopiesRef.current = [];
      setImages([]);
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
      if (!await confirmAiTransfer(t, 'receipt', controller.signal) || !isCurrent()) {
        if (isCurrent()) { setState('idle'); replaceReceiptCopies([]); setImages([]); }
        return;
      }
      const base64: string[] = [];
      for (const asset of assets) {
        base64.push(await compressImageToBase64(asset.uri, {
          width: asset.width,
          height: asset.height,
          signal: controller.signal,
        }));
      }
      if (!isCurrent() || controller.signal.aborted) return;
      const parsed = await parseReceipt(base64, language, controller.signal);
      if (!isCurrent() || controller.signal.aborted) return;
      setResult(parsed);
      setState('result');
    } catch (error) {
      if (!isCurrent()) return;
      if (controller.signal.aborted && !timedOut) return;
      const code = error instanceof Error ? error.message : '';
      // Servis nedeni tipli kodla bildirir (kota, anahtar, model, ağ...). Genel
      // mesaj yalnız tanınmayan hatalar için kalır; kullanıcı ne yapacağını bilir.
      const presented = presentAiError(error);
      const message = timedOut
        ? t('scan_timeout_error')
        : code === 'IMAGE_PROCESSING_TIMEOUT'
          ? t('scan_image_processing_timeout')
          : presented
            ? t(presented.messageKey, presented.params)
            : t('scan_failed_generic');
      setScanSessionError(message);
      setErrorMsg(message);
      setErrorAction(!timedOut && presented ? presented.action : 'retry');
      setState('error');
    } finally {
      clearTimeout(totalTimeout);
      for (const asset of assets) await removeReceiptCopy(asset.uri);
      receiptCopiesRef.current = [];
      if (isCurrent()) setImages([]);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [language, t]);

  async function pickImage(useCamera: boolean, append = false) {
    if (sourceBusyRef.current) return;
    const scanId = append ? scanIdRef.current : scanIdRef.current + 1;
    scanIdRef.current = scanId;
    sourceBusyRef.current = true;
    setSourceBusy(true);
    let pickedAssets: ImagePicker.ImagePickerAsset[] = [];
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
          late => { for (const image of late.assets ?? []) void removeReceiptCopy(image.uri); },
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
          allowsMultipleSelection: true,
          selectionLimit: Math.max(1, 4 - (append ? images.length : 0)),
        });
      }

      if (
        scanIdRef.current !== scanId
        || pickerResult.canceled
        || !pickerResult.assets?.[0]?.uri
      ) {
        for (const image of pickerResult.assets ?? []) void removeReceiptCopy(image.uri);
        return;
      }
      pickedAssets = pickerResult.assets.slice(0, Math.max(0, 4 - (append ? images.length : 0)));
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
      setErrorAction('retry');
      setState('error');
    } finally {
      if (scanIdRef.current === scanId) {
        sourceBusyRef.current = false;
        setSourceBusy(false);
      }
    }
    if (pickedAssets.length > 0 && scanIdRef.current === scanId) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      const next = (append ? [...images, ...pickedAssets] : pickedAssets).slice(0, 4);
      replaceReceiptCopies(next.map(asset => asset.uri));
      setImages(next);
      setState('collecting');
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
        if (!active || !mountedRef.current || !pending) {
          if (pending && 'assets' in pending) {
            for (const image of pending.assets ?? []) void removeReceiptCopy(image.uri);
          }
          return;
        }
        if ('code' in pending) {
          const message = t('camera_result_recovery_failed');
          setScanSessionError(message);
          setErrorMsg(message);
          setErrorAction('retry');
          setState('error');
          return;
        }
        if (pending.canceled || !pending.assets?.[0]?.uri) return;
        const scanId = scanIdRef.current + 1;
        scanIdRef.current = scanId;
        const recoveredAsset = pending.assets[0];
        replaceReceiptCopies([recoveredAsset.uri]);
        setImages([recoveredAsset]);
        setState('collecting');
      } catch {
        if (active && mountedRef.current) {
          const message = t('camera_result_recovery_failed');
          setScanSessionError(message);
          setErrorMsg(message);
          setErrorAction('retry');
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
  }, [t]);

  function removeCollectedImage(uri: string) {
    const next = images.filter(asset => asset.uri !== uri);
    replaceReceiptCopies(next.map(asset => asset.uri));
    setImages(next);
    if (next.length === 0) setState('idle');
  }

  async function analyzeCollectedImages() {
    if (images.length === 0 || sourceBusyRef.current) return;
    await processImages(images, scanIdRef.current);
  }

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
    replaceReceiptCopies([]);
    setImages([]);
  }

  async function handleSave() {
    if (!result || resultBusyRef.current) return;
    resultBusyRef.current = true;
    setResultBusy(true);
    const receiptToSave = result;
    try {
      if (receiptToSave.document_type === 'container_return_voucher' && receiptToSave.voucher_issued) {
        await ContainerDepositDao.createVoucher({
          amount: receiptToSave.voucher_issued.amount,
          currency: receiptToSave.currency,
          issuedDate: receiptToSave.date,
          expiresOn: receiptToSave.voucher_issued.expires_on,
          note: receiptToSave.vendor_name,
        });
      } else {
        await processReceipt(receiptToSave);
      }
      setScanSessionError(null);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      triggerRefresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      SparkToast.show(
        receiptToSave.document_type === 'container_return_voucher'
          ? t('deposit_voucher_saved')
          : t('receipt_parsed'),
        'success',
        receiptToSave.document_type === 'container_return_voucher'
          ? formatCurrency(receiptToSave.voucher_issued?.amount ?? 0, receiptToSave.currency, false)
          : `${receiptToSave.vendor_name} • ${receiptToSave.items?.length || 0}`,
      );
      setState('idle');
      setResult(null);
      replaceReceiptCopies([]);
      setImages([]);
    } catch (e) {
      SparkToast.show(t('error_saving_data'), 'error');
    } finally {
      resultBusyRef.current = false;
      setResultBusy(false);
    }
  }

  async function handleEditBeforeSave() {
    if (!result || resultBusyRef.current) return;
    if (result.document_type === 'container_return_voucher') {
      await handleSave();
      return;
    }
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
      replaceReceiptCopies([]);
      setImages([]);
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

        {state === 'collecting' && (
          <Animated.View entering={FadeIn.duration(250)} style={styles.collectingContent}>
            <Text style={styles.collectingTitle}>{t('receipt_pages_title')}</Text>
            <Text style={styles.collectingHint}>{t('receipt_pages_hint')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageStrip}>
              {images.map((asset, index) => (
                <View key={asset.uri} style={styles.pagePreviewWrap}>
                  <Image source={{ uri: asset.uri }} style={styles.pagePreview} resizeMode="cover" />
                  <View style={styles.pageNumber}><Text style={styles.pageNumberText}>{index + 1}</Text></View>
                  <Pressable
                    onPress={() => removeCollectedImage(asset.uri)}
                    style={styles.pageRemove}
                    accessibilityRole="button"
                    accessibilityLabel={t('remove')}
                  >
                    <Ionicons name="close" size={17} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            {images.length < 4 ? (
              <View style={styles.addPageRow}>
                <Pressable onPress={() => pickImage(true, true)} style={styles.addPageButton}>
                  <Ionicons name="camera-outline" size={19} color={theme.primary} />
                  <Text style={styles.addPageText}>{t('receipt_add_page_camera')}</Text>
                </Pressable>
                <Pressable onPress={() => pickImage(false, true)} style={styles.addPageButton}>
                  <Ionicons name="images-outline" size={19} color={theme.primary} />
                  <Text style={styles.addPageText}>{t('receipt_add_page_gallery')}</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              testID="scanner-analyze-action"
              onPress={() => void analyzeCollectedImages()}
              disabled={sourceBusy}
              style={({ pressed }) => [styles.analyzeButton, pressed && styles.analyzeButtonPressed]}
            >
              <Ionicons name="sparkles-outline" size={20} color={theme.onPrimary} />
              <Text style={styles.analyzeButtonText}>{t('receipt_analyze_pages', { count: images.length })}</Text>
            </Pressable>
          </Animated.View>
        )}

        {state === 'processing' && (
          <View style={styles.processingContent} accessibilityLiveRegion="polite">
            <ReceiptHolographicCarousel images={images} accessibilityLabel={t('receipt_pages_title')} />
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
                <Ionicons name="stop-circle-outline" size={20} color="#FFFFFF" style={styles.stopButtonIcon} />
                <Text style={styles.stopButtonText}>{t('stop_scan')}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {(state === 'error' || state === 'no_key') && (
          <ScanRecoveryCard
            message={errorMsg}
            settings={state === 'no_key' || errorAction === 'settings'}
            onPrimary={() => {
              const openSettings = state === 'no_key' || errorAction === 'settings';
              setState('idle');
              replaceReceiptCopies([]);
              setImages([]);
              if (openSettings) router.push('/settings-ai');
            }}
            onManual={() => { setState('idle'); replaceReceiptCopies([]); setImages([]); router.push('/add-expense'); }}
          />
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
              {result.document_type === 'container_return_voucher' && result.voucher_issued ? (
                <View style={styles.voucherResult}>
                  <MaterialCommunityIcons name="ticket-confirmation-outline" size={26} color={theme.primary} />
                  <View style={styles.voucherResultCopy}>
                    <Text style={styles.voucherResultTitle}>{t('deposit_voucher_detected')}</Text>
                    <Text style={styles.voucherResultMeta}>
                      {result.voucher_issued.expires_on
                        ? t('deposit_voucher_expires', { date: result.voucher_issued.expires_on })
                        : t('deposit_voucher_no_expiry')}
                    </Text>
                  </View>
                  <Text style={styles.voucherResultAmount}>
                    {formatCurrency(result.voucher_issued.amount, lineCurrency)}
                  </Text>
                </View>
              ) : null}
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

              {result.document_type !== 'container_return_voucher'
                && ((result.container_deposit_paid ?? 0) > 0 || (result.container_voucher_used ?? 0) > 0) ? (
                <View style={styles.depositResultPanel}>
                  {(result.container_deposit_paid ?? 0) > 0 ? (
                    <View style={styles.depositResultRow}>
                      <Text style={styles.depositResultLabel}>{t('deposit_paid')}</Text>
                      <Text style={styles.depositResultValue}>
                        {formatCurrency(result.container_deposit_paid!, lineCurrency)}
                      </Text>
                    </View>
                  ) : null}
                  {(result.container_voucher_used ?? 0) > 0 ? (
                    <View style={styles.depositResultRow}>
                      <Text style={styles.depositResultLabel}>{t('deposit_voucher_used')}</Text>
                      <Text style={[styles.depositResultValue, { color: theme.primary }]}>
                        −{formatCurrency(result.container_voucher_used!, lineCurrency)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Total */}
              {result.document_type !== 'container_return_voucher' ? <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('total').toUpperCase()}</Text>
                <Text style={styles.totalAmount}>
                  {formatCurrency(result.total, lineCurrency)}
                </Text>
              </View> : null}
              {result.document_type !== 'container_return_voucher' && (result.container_voucher_used ?? 0) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('deposit_cash_paid')}</Text>
                  <Text style={styles.totalAmount}>{formatCurrency(Math.max(0, subtractMoney(result.total, result.container_voucher_used ?? 0)), lineCurrency)}</Text>
                </View>
              ) : null}
            </AnimatedCard>

            <View style={styles.resultActionsCol}>
              {result.document_type !== 'container_return_voucher' ? <Pressable
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
                <View style={styles.resultActionInner}>
                  <View style={styles.resultActionIconSlot}>
                    <MaterialCommunityIcons name="check-bold" size={20} color={theme.onPrimary} />
                  </View>
                  <Text style={styles.savePillText}>{t('save')}</Text>
                </View>
              </Pressable> : null}
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
                <View style={styles.resultActionInner}>
                  <View style={styles.resultActionIconSlot}>
                    <MaterialCommunityIcons name="pencil" size={19} color={theme.primary} />
                  </View>
                  <Text style={styles.editPillText}>{t('edit')}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => { setState('idle'); setResult(null); replaceReceiptCopies([]); setImages([]); }}
                disabled={resultBusy}
                style={({ pressed }) => [
                  styles.cancelGhost,
                  resultBusy && styles.resultActionDisabled,
                  pressed && styles.cancelGhostPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                accessibilityState={{ disabled: resultBusy }}
              >
                <View style={styles.resultActionInner}>
                  <View style={styles.resultActionIconSlot}>
                    <MaterialCommunityIcons name="close-thick" size={17} color={theme.danger} />
                  </View>
                  <Text style={styles.cancelGhostText}>{t('cancel')}</Text>
                </View>
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

const getStyles = (theme: typeof DarkTheme, isDark: boolean, language: Language) => {
  const susevar = createSusevarStyles(theme);
  // Etiket genişlikleri dile göre değiştiği için ikon–metin optik boşluğu
  // ayrı ayarlanır. AZ düzeni mevcut kabul edilen ölçülerde korunur.
  const actionTextPadding = {
    tr: { save: 28, edit: 28, cancel: 12 },
    en: { save: 8, edit: 8, cancel: 8 },
    az: { save: 28, edit: 44, cancel: 28 },
    ru: { save: 40, edit: 32, cancel: 16 },
  }[language];
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ScreenPadding.horizontal,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.headlineLarge,
    fontFamily: FontFamily.extraBold,
    textAlign: 'center',
    color: theme.primary,
  },
  content: {
    paddingHorizontal: ScreenPadding.horizontal,
    flexGrow: 1,
  },
  // Idle
  idleContent: {
    alignItems: 'center',
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
    textAlign: 'center',
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
  collectingContent: {
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  collectingTitle: {
    ...Typography.headlineSmall,
    color: theme.textPrimary,
    textAlign: 'center',
  },
  collectingHint: {
    ...Typography.bodyMedium,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  pageStrip: { gap: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: 2 },
  pagePreviewWrap: { width: 132, height: 178, position: 'relative' },
  pagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  pageNumber: {
    position: 'absolute', left: 8, bottom: 8,
    minWidth: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)',
  },
  pageNumberText: { ...Typography.labelSmall, color: '#FFFFFF', fontFamily: FontFamily.bold },
  pageRemove: {
    position: 'absolute', right: 8, top: 8,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)',
  },
  addPageRow: { flexDirection: 'row', gap: Spacing.sm },
  addPageButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: BorderRadius.round,
    backgroundColor: theme.cardSurface,
    paddingHorizontal: Spacing.sm,
  },
  addPageText: { ...Typography.labelMedium, color: theme.textPrimary, flexShrink: 1 },
  analyzeButton: {
    ...susevar.button,
    marginTop: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  analyzeButtonPressed: susevarButtonPressed,
  analyzeButtonText: susevar.text,
  // Processing
  processingContent: {
    alignItems: 'center',
    paddingTop: 40,
    gap: Spacing.lg,
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
    minWidth: 180,
    minHeight: 56,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  stopButtonPressed: susevarButtonPressed,
  stopButtonRow: {
    ...susevarButtonRow,
    minHeight: 22,
    gap: 10,
  },
  stopButtonIcon: {
    marginTop: 0,
  },
  stopButtonText: {
    ...susevar.text,
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: 'center',
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
  voucherResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  voucherResultCopy: { flex: 1 },
  voucherResultTitle: { ...Typography.bodyMedium, color: theme.textPrimary, fontFamily: FontFamily.semiBold },
  voucherResultMeta: { ...Typography.labelSmall, color: theme.textSecondary, marginTop: 2 },
  voucherResultAmount: { ...Typography.headlineSmall, color: theme.primary, fontFamily: FontFamily.bold },
  depositResultPanel: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: theme.primaryGlow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
    marginBottom: Spacing.md,
  },
  depositResultRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  depositResultLabel: { ...Typography.bodySmall, color: theme.textSecondary, flex: 1 },
  depositResultValue: { ...Typography.labelLarge, color: theme.textPrimary, fontFamily: FontFamily.semiBold },
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
  /** Fiş sonucu — şüşevar (Kaydet) + Düzenle */
  resultActionsCol: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  savePill: {
    ...susevar.button,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: theme.cardSurface,
    borderRadius: BorderRadius.round,
    borderWidth: 1.5,
    borderColor: theme.primary,
  },
  pillPressed: {
    opacity: 0.9,
  },
  resultActionDisabled: {
    opacity: 0.5,
  },
  savePillText: {
    ...susevar.text,
    flex: 1,
    textAlign: 'center',
    paddingLeft: actionTextPadding.save,
    fontFamily: FontFamily.extraBold,
    fontSize: language === 'ru' ? 17 : 18,
    lineHeight: language === 'ru' ? 22 : 23,
    letterSpacing: 0.7,
  },
  editPillText: {
    ...susevar.text,
    flex: 1,
    textAlign: 'center',
    paddingLeft: actionTextPadding.edit,
    color: theme.primary,
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  cancelGhost: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.round,
    borderWidth: 1.5,
    borderColor: theme.danger,
    backgroundColor: theme.danger + '12',
  },
  resultActionInner: {
    width: 200,
    minHeight: 24,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultActionIconSlot: {
    position: 'absolute',
    left: 40,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cancelGhostPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  cancelGhostText: {
    ...susevar.text,
    flex: 1,
    textAlign: 'center',
    paddingLeft: actionTextPadding.cancel,
    color: theme.danger,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0.4,
  },
  });
};
