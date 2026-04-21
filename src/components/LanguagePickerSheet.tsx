import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppTheme } from '../theme/themeStore';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LightTheme, DarkTheme } from '../theme/colors';
import { FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import type { Language } from '../i18n/translations';
import { LANGUAGE_OPTIONS } from '../i18n/languageOptions';

const OPEN_EASING = Easing.out(Easing.cubic);
const CLOSE_EASING = Easing.in(Easing.cubic);
const DISMISS_THRESHOLD_PX = 96;
const DISMISS_VELOCITY = 520;
const SPRING_CFG = { damping: 26, stiffness: 280, mass: 0.85 };

type Props = {
  visible: boolean;
  onClose: () => void;
  current: Language;
  onSelect: (lang: Language) => void;
  title: string;
  hostBottomInset?: number;
};

export default function LanguagePickerSheet({
  visible,
  onClose,
  current,
  onSelect,
  title,
  hostBottomInset = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const windowDims = useWindowDimensions();
  const rnScheme = useAppTheme();
  const isLight = rnScheme === 'light';
  const theme = isLight ? LightTheme : DarkTheme;

  const screen = Dimensions.get('screen');
  const rootWidth = Math.max(screen.width, windowDims.width);
  const rootHeight = Math.max(screen.height, windowDims.height);

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const androidWindowGap =
    Platform.OS === 'android'
      ? Math.max(0, Math.min(100, screen.height - windowDims.height - statusBarH))
      : 0;

  const bottomInsetResolved = Math.max(insets.bottom, hostBottomInset, 0);
  const bottomFillHeight =
    Math.max(bottomInsetResolved, Spacing.md) + Spacing.lg + androidWindowGap;

  const openSlideDistance = useMemo(
    () => Math.min(rootHeight * 0.45, 520),
    [rootHeight]
  );
  /** İlk karede panel tam açık görünmesin */
  const translateY = useSharedValue(openSlideDistance);
  const panStartY = useSharedValue(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          width: rootWidth,
          height: rootHeight,
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isLight ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.58)',
        },
        sheetWrap: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
        /** Tek sürekli yüzey: kart + alt güvenli alan aynı View — ara çizgi yok */
        sheetShell: {
          backgroundColor: theme.surfaceElevated,
          borderTopLeftRadius: BorderRadius.xl,
          borderTopRightRadius: BorderRadius.xl,
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.sm,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: theme.cardBorder,
          ...Platform.select({
            android: { elevation: 12 },
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: isLight ? 0.12 : 0.25,
              shadowRadius: 12,
            },
          }),
        },
        handleGestureZone: {
          alignItems: 'center',
          paddingTop: Spacing.sm,
          paddingBottom: Spacing.md,
          marginHorizontal: -Spacing.lg,
          paddingHorizontal: Spacing.lg,
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.textMuted,
          opacity: 0.45,
        },
        sheetTitle: {
          fontFamily: FontFamily.extraBold,
          fontSize: 20,
          color: theme.textPrimary,
          marginBottom: Spacing.md,
        },
        list: {
          gap: 0,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: Spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.divider,
        },
        rowLast: {
          borderBottomWidth: 0,
        },
        rowPressed: {
          opacity: 0.88,
        },
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
        radioOuterOn: {
          borderColor: theme.primary,
        },
        radioInner: {
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: theme.primary,
        },
      }),
    [isLight, rootWidth, rootHeight]
  );

  const closeWithAnimation = useCallback(() => {
    translateY.value = withTiming(
      rootHeight,
      { duration: 320, easing: CLOSE_EASING },
      (finished) => {
        if (finished) runOnJS(onClose)();
      }
    );
  }, [onClose, rootHeight]);

  useLayoutEffect(() => {
    if (visible) {
      translateY.value = openSlideDistance;
      translateY.value = withTiming(0, { duration: 300, easing: OPEN_EASING });
    } else {
      translateY.value = openSlideDistance;
    }
  }, [visible, openSlideDistance]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetX([-28, 28])
        .onStart(() => {
          panStartY.value = translateY.value;
        })
        .onUpdate((e) => {
          const next = panStartY.value + e.translationY;
          translateY.value = Math.max(0, next);
        })
        .onEnd((e) => {
          const y = translateY.value;
          const shouldClose = y > DISMISS_THRESHOLD_PX || e.velocityY > DISMISS_VELOCITY;
          if (shouldClose) {
            translateY.value = withTiming(
              rootHeight,
              { duration: 300, easing: CLOSE_EASING },
              (finished) => {
                if (finished) runOnJS(onClose)();
              }
            );
          } else {
            translateY.value = withSpring(0, SPRING_CFG);
          }
        }),
    [onClose, rootHeight]
  );

  function pick(code: Language) {
    if (code !== current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(code);
    }
    closeWithAnimation();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeWithAnimation}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeWithAnimation}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          />
        </View>
        <Animated.View style={[styles.sheetWrap, sheetAnimatedStyle]}>
          <View style={styles.sheetShell}>
            <GestureDetector gesture={pan}>
              <View style={styles.handleGestureZone} collapsable={false}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
            <Text style={styles.sheetTitle}>{title}</Text>
            <View style={styles.list}>
              {LANGUAGE_OPTIONS.map(({ code, nativeLabel }, index) => {
                const selected = current === code;
                const isLast = index === LANGUAGE_OPTIONS.length - 1;
                return (
                  <Pressable
                    key={code}
                    onPress={() => pick(code)}
                    style={({ pressed }) => [
                      styles.row,
                      isLast && styles.rowLast,
                      pressed && styles.rowPressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.rowLabel}>{nativeLabel}</Text>
                    <View style={[styles.radioOuter, selected && styles.radioOuterOn]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ height: bottomFillHeight }} pointerEvents="none" />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
