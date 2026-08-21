// S.P.A.R.K. — Kompakt, sabit merkezli vurgu paleti seçicisi
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

import {
  resolveTheme,
  ThemeAccents,
  type AppColorScheme,
  type ThemeAccent,
  type ThemePalette,
} from '../theme/colors';
import { useThemePalette } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';

// Daha geniş yuva, aynı parmak hareketinde birden fazla rengin hızla atlanmasını
// engeller ve Samsung saat çarkına daha yakın kontrollü bir kademe verir.
const DEFAULT_ITEM_STRIDE = 96;
const MIN_ITEM_STRIDE = 88;
const MAX_ITEM_STRIDE = 104;
const VISIBLE_DETENT_COUNT = 3.5;
const CENTER_RING_SIZE = 64;
const DRAG_SETTLE_DELAY_MS = 96;
// Samsung saat çarkına yakın, ayrı ayrı algılanan mekanik kademe ritmi.
// 30 ms hızlı savurmada tek bir uğultu gibi birleşiyordu.
const DETENT_FEEDBACK_GAP_MS = 100;
const MAX_QUEUED_DETENTS = 8;
const DETENT_SOUND_VOLUME = 0.54;
const DETENT_SOUND = require('../../assets/audio/palette-detent.wav');

export type AccentCarouselMetrics = {
  itemStride: number;
  horizontalInset: number;
  snapOffsets: number[];
};

export function getAccentCarouselMetrics(viewportWidth: number): AccentCarouselMetrics {
  const rawStride = viewportWidth > 0
    ? Math.round(viewportWidth / VISIBLE_DETENT_COUNT)
    : DEFAULT_ITEM_STRIDE;
  const itemStride = Math.max(MIN_ITEM_STRIDE, Math.min(MAX_ITEM_STRIDE, rawStride));
  return {
    itemStride,
    horizontalInset: Math.max(0, (viewportWidth - itemStride) / 2),
    snapOffsets: ThemeAccents.map((_, index) => index * itemStride),
  };
}

type Props = {
  scheme: AppColorScheme;
  selectedAccent: ThemeAccent;
  disabled?: boolean;
  labelFor: (accent: ThemeAccent) => string;
  optionHintFor: (accent: ThemeAccent) => string;
  swipeHint: string;
  onSelect: (accent: ThemeAccent) => Promise<boolean>;
};

function clampIndex(index: number): number {
  return Math.max(0, Math.min(ThemeAccents.length - 1, index));
}

export default function AccentPaletteCarousel({
  scheme,
  selectedAccent,
  disabled = false,
  labelFor,
  optionHintFor,
  swipeHint,
  onSelect,
}: Props) {
  const colors = useThemePalette();
  const styles = useMemo(() => getStyles(colors), [colors]);
  // Dört küçük player, tek bir hızlı sürüklemede geçilebilecek dört
  // renk eşiğini birbirinin sesini kesmeden oynatır. Kaynak yalnızca 4 KB'tır.
  const detentPlayerA = useAudioPlayer(DETENT_SOUND, {
    downloadFirst: true,
    keepAudioSessionActive: false,
  });
  const detentPlayerB = useAudioPlayer(DETENT_SOUND, {
    downloadFirst: true,
    keepAudioSessionActive: false,
  });
  const detentPlayerC = useAudioPlayer(DETENT_SOUND, {
    downloadFirst: true,
    keepAudioSessionActive: false,
  });
  const detentPlayerD = useAudioPlayer(DETENT_SOUND, {
    downloadFirst: true,
    keepAudioSessionActive: false,
  });
  const detentPlayers = useMemo(
    () => [detentPlayerA, detentPlayerB, detentPlayerC, detentPlayerD],
    [detentPlayerA, detentPlayerB, detentPlayerC, detentPlayerD],
  );
  const scrollRef = useRef<ScrollView>(null);
  const selectedRef = useRef(selectedAccent);
  const commitInFlight = useRef(false);
  const queuedCommitIndex = useRef<number | null>(null);
  const dragSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedFeedbackSteps = useRef(0);
  const feedbackPlayerIndex = useRef(0);
  const gestureFeedbackArmed = useRef(false);
  const userGestureActive = useRef(false);
  const contentReady = useRef(false);
  const pendingAlignmentIndex = useRef(ThemeAccents.indexOf(selectedAccent));
  const alignmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDetentIndex = useRef(ThemeAccents.indexOf(selectedAccent));
  const audioModeReady = useRef(false);
  const mountedRef = useRef(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [centeredAccent, setCenteredAccent] = useState<ThemeAccent>(selectedAccent);

  const centeredIndex = ThemeAccents.indexOf(centeredAccent);
  const centeredPreview = resolveTheme(scheme, centeredAccent);
  const metrics = useMemo(() => getAccentCarouselMetrics(viewportWidth), [viewportWidth]);
  const canonicalContentOffset = useMemo(
    () => ({
      x: ThemeAccents.indexOf(selectedAccent) * metrics.itemStride,
      y: 0,
    }),
    [selectedAccent, metrics.itemStride],
  );

  useEffect(() => {
    let mounted = true;
    detentPlayers.forEach((player) => {
      try {
        player.volume = DETENT_SOUND_VOLUME;
      } catch {
        // Ses geri bildirimi seçim davranışı için kritik değildir.
      }
    });
    void setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    }).then(() => {
      if (mounted) audioModeReady.current = true;
    }).catch(() => {
      audioModeReady.current = false;
    });
    return () => {
      mounted = false;
      audioModeReady.current = false;
    };
  }, [detentPlayers]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (alignmentTimer.current) clearTimeout(alignmentTimer.current);
    };
  }, []);

  function scrollToIndex(index: number, animated: boolean) {
    scrollRef.current?.scrollTo({ x: index * metrics.itemStride, y: 0, animated });
  }

  function alignToCanonicalIndex(index: number, animated = false) {
    pendingAlignmentIndex.current = clampIndex(index);
    if (viewportWidth <= 0 || !contentReady.current || userGestureActive.current) return;
    if (alignmentTimer.current) clearTimeout(alignmentTimer.current);
    alignmentTimer.current = setTimeout(() => {
      alignmentTimer.current = null;
      if (!mountedRef.current || userGestureActive.current) return;
      scrollToIndex(pendingAlignmentIndex.current, animated);
    }, 0);
  }

  function emitDetentFeedback() {
    const haptic = Platform.OS === 'android'
      // CLOCK_TICK hedef Samsung cihazında fazla hafif kaldı. CONTEXT_CLICK,
      // iki titreşimi üst üste bindirmeden daha tok tek kademe vuruşu verir.
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    void Promise.resolve(haptic).catch(() => {});

    const player = detentPlayers[feedbackPlayerIndex.current % detentPlayers.length];
    feedbackPlayerIndex.current += 1;
    if (!audioModeReady.current || !player.currentStatus.isLoaded) return;

    try {
      const status = player.currentStatus;
      if (!status.playing && status.currentTime <= 0.001) {
        player.play();
        return;
      }

      // Bir player tekrar kullanıldığında seek tamamlanmadan play çağrısı
      // yapma; aksi halde kısa klip sonda kalıp bazı "tak"ları yutabilir.
      player.pause();
      void player.seekTo(0).then(() => {
        if (mountedRef.current && audioModeReady.current && player.currentStatus.isLoaded) {
          player.play();
        }
      }).catch(() => {});
    } catch {
      // Cihaz sessiz modda olabilir veya player henüz hazır olmayabilir.
    }
  }

  function drainDetentFeedbackQueue() {
    if (queuedFeedbackSteps.current <= 0) {
      feedbackTimer.current = null;
      return;
    }

    queuedFeedbackSteps.current -= 1;
    emitDetentFeedback();
    if (queuedFeedbackSteps.current > 0) {
      feedbackTimer.current = setTimeout(drainDetentFeedbackQueue, DETENT_FEEDBACK_GAP_MS);
    } else {
      feedbackTimer.current = null;
    }
  }

  function enqueueDetentFeedback(stepCount: number) {
    if (disabled || stepCount <= 0) return;
    queuedFeedbackSteps.current = Math.min(
      MAX_QUEUED_DETENTS,
      queuedFeedbackSteps.current + stepCount,
    );
    if (!feedbackTimer.current) drainDetentFeedbackQueue();
  }

  function clearPendingDetentFeedback() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
    queuedFeedbackSteps.current = 0;
  }

  function previewIndex(
    rawIndex: number,
    withFeedback: boolean,
    feedbackMode: 'crossed' | 'single' = 'crossed',
  ) {
    const index = clampIndex(rawIndex);
    const previousIndex = lastDetentIndex.current;
    if (index === previousIndex) return index;

    lastDetentIndex.current = index;
    setCenteredAccent(ThemeAccents[index]);
    if (withFeedback && gestureFeedbackArmed.current) {
      enqueueDetentFeedback(
        feedbackMode === 'single' ? 1 : Math.max(1, Math.abs(index - previousIndex)),
      );
    }
    return index;
  }

  useEffect(() => {
    gestureFeedbackArmed.current = false;
    selectedRef.current = selectedAccent;
    const selectedIndex = ThemeAccents.indexOf(selectedAccent);
    pendingAlignmentIndex.current = selectedIndex;
    if (commitInFlight.current || queuedCommitIndex.current !== null) return;
    lastDetentIndex.current = selectedIndex;
    setCenteredAccent(selectedAccent);
    alignToCanonicalIndex(selectedIndex);
  }, [selectedAccent, viewportWidth, metrics.itemStride]);

  async function drainCommitQueue() {
    if (commitInFlight.current) return;
    commitInFlight.current = true;

    try {
      while (queuedCommitIndex.current !== null) {
        const index = queuedCommitIndex.current;
        queuedCommitIndex.current = null;
        const accent = ThemeAccents[index];
        if (accent === selectedRef.current) continue;

        let saved = false;
        try {
          saved = await onSelect(accent);
        } catch {
          saved = false;
        }
        if (!mountedRef.current) return;
        if (saved) {
          selectedRef.current = accent;
        } else if (queuedCommitIndex.current === null) {
          const selectedIndex = ThemeAccents.indexOf(selectedRef.current);
          lastDetentIndex.current = selectedIndex;
          setCenteredAccent(selectedRef.current);
          scrollToIndex(selectedIndex, true);
        }
      }
    } finally {
      commitInFlight.current = false;
      if (mountedRef.current && queuedCommitIndex.current === null) {
        const selectedIndex = ThemeAccents.indexOf(selectedRef.current);
        lastDetentIndex.current = selectedIndex;
        setCenteredAccent(selectedRef.current);
        alignToCanonicalIndex(selectedIndex);
      }
    }
  }

  function commitIndex(rawIndex: number, animated: boolean) {
    const index = clampIndex(rawIndex);
    const accent = ThemeAccents[index];
    lastDetentIndex.current = index;
    setCenteredAccent(accent);
    scrollToIndex(index, animated);

    if (disabled) return;
    if (
      !commitInFlight.current
      && accent === selectedRef.current
      && queuedCommitIndex.current === null
    ) return;

    // Kayıt sürerken gelen yeni snap'i yutmak yerine yalnızca en son kullanıcı
    // niyetini sakla. İlk yazı biter bitmez ikinci seçim seri olarak uygulanır.
    queuedCommitIndex.current = index;
    void drainCommitQueue();
  }

  function settleFromEvent(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / metrics.itemStride);
    previewIndex(index, true);
    gestureFeedbackArmed.current = false;
    commitIndex(index, true);
  }

  function handleScrollBeginDrag() {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = null;
    // Önceki jestin kuyruğunu yeni yöndeki fiziksel kademe hissine taşıma.
    clearPendingDetentFeedback();
    userGestureActive.current = true;
    gestureFeedbackArmed.current = !disabled;
    lastDetentIndex.current = centeredIndex;
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!gestureFeedbackArmed.current || disabled) return;
    previewIndex(
      Math.round(event.nativeEvent.contentOffset.x / metrics.itemStride),
      true,
    );
  }

  function handleScrollEndDrag(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = previewIndex(
      Math.round(event.nativeEvent.contentOffset.x / metrics.itemStride),
      true,
    );
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
    // Savurma başlayacaksa momentum callback'i son snap offsetini verir ve bu
    // yedeği iptal eder. Momentum oluşmayan yavaş sürüklemede seçim kaybolmaz.
    dragSettleTimer.current = setTimeout(() => {
      dragSettleTimer.current = null;
      gestureFeedbackArmed.current = false;
      userGestureActive.current = false;
      commitIndex(index, true);
    }, DRAG_SETTLE_DELAY_MS);
  }

  function handleMomentumScrollBegin() {
    if (!dragSettleTimer.current) return;
    clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = null;
  }

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    handleMomentumScrollBegin();
    userGestureActive.current = false;
    settleFromEvent(event);
  }

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== viewportWidth) setViewportWidth(width);
  }

  function handleContentSizeChange() {
    contentReady.current = true;
    if (!userGestureActive.current) {
      alignToCanonicalIndex(pendingAlignmentIndex.current);
    }
  }

  function handlePress(index: number) {
    if (disabled) return;
    clearPendingDetentFeedback();
    gestureFeedbackArmed.current = true;
    previewIndex(index, true, 'single');
    gestureFeedbackArmed.current = false;
    commitIndex(index, true);
  }

  function handleAccessibilityAction(actionName: string) {
    if (disabled) return;
    if (actionName === 'increment') {
      commitIndex(centeredIndex + 1, true);
    } else if (actionName === 'decrement') {
      commitIndex(centeredIndex - 1, true);
    }
  }

  return (
    <View>
      <View
        testID="theme-accent-carousel"
        style={styles.viewport}
      >
        <ScrollView
          testID="theme-accent-scroll"
          ref={scrollRef}
          style={styles.scrollViewport}
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          scrollEnabled={!disabled}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSizeChange}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          // Platform string'i olan "fast" Samsung'da hâlâ fazla uzun savruluyor.
          // Düşük katsayı tekeri daha çabuk frenleyip her yuvayı belirginleştirir.
          decelerationRate={Platform.OS === 'android' ? 0.62 : 0.96}
          snapToOffsets={metrics.snapOffsets}
          contentOffset={canonicalContentOffset}
          disableIntervalMomentum
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.track,
            { paddingHorizontal: metrics.horizontalInset },
          ]}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollBegin={handleMomentumScrollBegin}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={labelFor(centeredAccent)}
          accessibilityHint={swipeHint}
          accessibilityState={{ disabled }}
          accessibilityValue={{
            min: 0,
            max: ThemeAccents.length - 1,
            now: centeredIndex,
            text: labelFor(centeredAccent),
          }}
          accessibilityActions={[
            { name: 'increment', label: swipeHint },
            { name: 'decrement', label: swipeHint },
          ]}
          onAccessibilityAction={(event) =>
            handleAccessibilityAction(event.nativeEvent.actionName)
          }
        >
          {ThemeAccents.map((accent, index) => {
            const preview = resolveTheme(scheme, accent);
            const centered = accent === centeredAccent;
            const outsideVisibleRail = Math.abs(index - centeredIndex) > 1;
            return (
              <Pressable
                key={accent}
                testID={`theme-accent-${accent}`}
                onPress={() => handlePress(ThemeAccents.indexOf(accent))}
                disabled={disabled}
                android_disableSound
                accessible={false}
                importantForAccessibility="no"
                style={({ pressed }) => [
                  styles.item,
                  { width: metrics.itemStride },
                  outsideVisibleRail && styles.itemOutsideVisibleRail,
                  pressed && !disabled && styles.itemPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={labelFor(accent)}
                accessibilityHint={optionHintFor(accent)}
                accessibilityState={{ selected: centered, disabled }}
              >
                <View
                  style={[
                    styles.swatchHalo,
                    centered && styles.swatchHaloCentered,
                    { backgroundColor: preview.primarySoft },
                  ]}
                >
                  <View
                    testID={`theme-accent-${accent}-swatch`}
                    style={[
                      styles.swatch,
                      centered && styles.swatchCentered,
                      !centered && styles.swatchSide,
                      { backgroundColor: preview.primary },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View
          testID="theme-accent-center-ring"
          pointerEvents="none"
          style={styles.centerGuide}
        >
          <View
            style={[
              styles.centerRing,
              {
                borderColor: centeredPreview.primary,
                shadowColor: centeredPreview.shadowColor,
              },
            ]}
          >
            <View style={[styles.centerRingInner, { borderColor: centeredPreview.primarySoft }]} />
            <View style={[styles.detentNotch, styles.detentNotchTop, { backgroundColor: centeredPreview.primary }]} />
            <View style={[styles.detentNotch, styles.detentNotchBottom, { backgroundColor: centeredPreview.primary }]} />
          </View>
        </View>
      </View>

      <Text
        testID="theme-accent-centered-label"
        style={styles.selectedLabel}
      >
        {labelFor(centeredAccent)}
      </Text>
      <Text style={styles.swipeHint}>{swipeHint}</Text>
    </View>
  );
}

const getStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    viewport: {
      height: 82,
      overflow: 'hidden',
      justifyContent: 'center',
      borderRadius: BorderRadius.round,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surfaceLight,
    },
    scrollViewport: {
      width: '100%',
      height: '100%',
    },
    itemOutsideVisibleRail: {
      opacity: 0,
    },
    track: {
      alignItems: 'center',
    },
    item: {
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemPressed: { opacity: 0.68 },
    swatchHalo: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchHaloCentered: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    swatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    swatchCentered: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    swatchSide: {
      opacity: 0.78,
      transform: [{ scale: 0.94 }],
    },
    centerGuide: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerRing: {
      width: CENTER_RING_SIZE,
      height: CENTER_RING_SIZE,
      borderRadius: CENTER_RING_SIZE / 2,
      borderWidth: 3,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.24,
      shadowRadius: 4,
      elevation: 2,
    },
    centerRingInner: {
      position: 'absolute',
      top: 4,
      right: 4,
      bottom: 4,
      left: 4,
      borderRadius: (CENTER_RING_SIZE - 8) / 2,
      borderWidth: 1,
    },
    detentNotch: {
      position: 'absolute',
      width: 14,
      height: 3,
      borderRadius: 2,
    },
    detentNotchTop: {
      top: -6,
    },
    detentNotchBottom: {
      bottom: -6,
    },
    selectedLabel: {
      ...Typography.bodyLarge,
      marginTop: Spacing.md,
      color: colors.textPrimary,
      fontFamily: FontFamily.semiBold,
      textAlign: 'center',
    },
    swipeHint: {
      ...Typography.bodySmall,
      marginTop: Spacing.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
