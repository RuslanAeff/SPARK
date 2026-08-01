// S.P.A.R.K. — Alt sayfa modal'ı (eşzamanlı fade overlay + slide sheet)
//
// ANDROID NAV-BAR SORUNU (Samsung Galaxy S25 Ultra, Android 15 edge-to-edge):
// Android 15 / API 35+ uygulamaları edge-to-edge modda çalışır; Modal penceresi
// ekranın tamamını kaplar. Gezinme çubuğu (gesture veya button) sistem UI katmanı
// olarak içeriğin üzerine çizilir ve sheet'in alt bölümünü örter → gri şerit.
//
// Çözüm mimarisi:
//  1. `statusBarTranslucent` + `navigationBarTranslucent` — Modal penceresi tam
//     ekranda tutulur, sistem çubuğunun "arkasına" kadar uzanır.
//  2. Doğrudan Modal'ın altına `SafeAreaProvider` eklenir. Nested provider Modal
//     penceresini ölçerek `insets.bottom` = nav-bar/gesture-bar yüksekliğini
//     doğru döndürür. (Parent app'teki SafeAreaProvider modal penceresini değil
//     ana uygulama penceresini ölçer, bu yüzden kullanılmaz.)
//  3. `ModalContent` bu nested provider'dan inset okur; sheet'e `paddingBottom`
//     ekler → son satır gesture area'nın üstünde kalır.
//
// NOT: SafeAreaProvider Animated.View IÇINDE değil, Modal'ın doğrudan çocuğu
// olmalıdır — aksi hâlde ölçüm, transform'lu layout'ta hatalı olabilir.
import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  Animated,
  Pressable,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Easing,
  Dimensions,
  PanResponder,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { SparkToastContainer } from './SparkToast';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  /** Çıkış animasyonu ve native Modal kapanışı tamamen bittikten sonra. */
  onDismiss?: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
  slideDurationMs?: number;
  fadeDurationMs?: number;
  /** Üstte sürükle-kapat tutamağı göster (dokununca yatay genişler). */
  showHandle?: boolean;
}

const SCREEN_H = Dimensions.get('screen').height;

// Sürükle-kapat eşiği: tutamak bu kadar piksel aşağı çekilirse panel kapanır.
const DRAG_CLOSE_THRESHOLD = 90;
const DRAG_CLOSE_VELOCITY = 0.6;

// Beyaz yüzey, ekranın gerçek alt kenarından bu kadar AŞAĞI taşar. Böylece
// inset ölçümü (Samsung düğme/gesture modunda) ne dönerse dönsün altta boşluk
// veya backdrop'un gri perdesi görünmez; içerik yine `bottom` kadar yukarıda durur.
const SHEET_BOTTOM_OVERSHOOT = 48;

// ────────────────────────────────────────────────────────────
// ModalContent — Modal penceresinin içinde çalışır.
// useSafeAreaInsets() burada nested SafeAreaProvider'ı okur
// (parent app sağlayıcısını değil), dolayısıyla navigationBarTranslucent
// ile genişlemiş modal penceresinin gerçek bottom inset'ini alır.
// ────────────────────────────────────────────────────────────
interface ModalContentProps {
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  backdropColor: string;
  overlayOpacity: Animated.Value;
  translateY: Animated.Value;
  showHandle: boolean;
  interactive: boolean;
}

function ModalContent({
  onClose,
  children,
  sheetStyle,
  backdropColor,
  overlayOpacity,
  translateY,
  showHandle,
  interactive,
}: ModalContentProps) {
  const { bottom } = useSafeAreaInsets();
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  // Tutamak: dokununca yatay genişlesin (scaleX), sürüklerken paneli aşağı taşı.
  const handleScaleX = useRef(new Animated.Value(1)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactiveRef.current,
        onMoveShouldSetPanResponder: (_e, g) =>
          interactiveRef.current && Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
          if (!interactiveRef.current) return;
          Animated.spring(handleScaleX, {
            toValue: 1.7,
            useNativeDriver: true,
            speed: 30,
            bounciness: 8,
          }).start();
        },
        onPanResponderMove: (_e, g) => {
          if (!interactiveRef.current) return;
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (!interactiveRef.current) return;
          Animated.spring(handleScaleX, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 6,
          }).start();
          const shouldClose = g.dy > DRAG_CLOSE_THRESHOLD || g.vy > DRAG_CLOSE_VELOCITY;
          if (shouldClose) {
            onClose();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 18,
              bounciness: 4,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (!interactiveRef.current) return;
          Animated.spring(handleScaleX, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
        },
      }),
    [handleScaleX, translateY, onClose],
  );

  const overlayAnimStyle = useMemo(
    () => [styles.overlay, { backgroundColor: backdropColor, opacity: overlayOpacity }],
    [backdropColor, overlayOpacity],
  );

  const adjustedSheetStyle = useMemo(() => {
    const flat = (StyleSheet.flatten(sheetStyle) ?? {}) as ViewStyle;
    const basePB = typeof flat.paddingBottom === 'number' ? flat.paddingBottom : 0;
    // İçerik padding'i = inset (son satır gesture/nav çubuğunun üstünde kalsın).
    return { ...flat, paddingBottom: basePB + bottom };
  }, [sheetStyle, bottom]);

  // Beyaz yüzeyin rengini sheet stilinden çıkar ve sarmalayıcıya ver.
  // Sarmalayıcı ekranın en dibine kadar (overshoot ile altına da taşarak) dolar;
  // böylece inset ölçümü ne olursa olsun altta boşluk/gri perde görünmez.
  const sheetBg = useMemo(() => {
    const flat = (StyleSheet.flatten(sheetStyle) ?? {}) as ViewStyle;
    return {
      backgroundColor: flat.backgroundColor,
      borderTopLeftRadius: flat.borderTopLeftRadius,
      borderTopRightRadius: flat.borderTopRightRadius,
    };
  }, [sheetStyle]);

  return (
    <>
      {/* Karartma katmanı */}
      <Animated.View style={overlayAnimStyle}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      {/* Sheet */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.sheetWrapper,
          sheetBg,
          { marginBottom: -SHEET_BOTTOM_OVERSHOOT, paddingBottom: SHEET_BOTTOM_OVERSHOOT },
          { transform: [{ translateY }] },
        ]}
      >
        {/*
          Beyaz arka plan sarmalayıcıda: ekranın en dibine kadar (overshoot ile
          altına da taşarak) dolar. Pressable SARMALAMA YOK: Android'de Pressable
          dikey pan'ı yakalar ve ScrollView'a iletmez (ALIM GEÇMİŞİ kilitlenir).
        */}
        <View style={adjustedSheetStyle}>
          {showHandle && (
            <View style={styles.handleZone} {...panResponder.panHandlers}>
              <Animated.View
                style={[styles.handleBar, { transform: [{ scaleX: handleScaleX }] }]}
              />
            </View>
          )}
          {children}
        </View>
      </Animated.View>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// BottomSheetModal — animasyon state'i burada yönetilir;
// tüm içerik SafeAreaProvider içinde render edilir.
// ────────────────────────────────────────────────────────────
export default function BottomSheetModal({
  visible,
  onClose,
  onDismiss,
  children,
  sheetStyle,
  backdropColor = 'rgba(0,0,0,0.55)',
  slideDurationMs = 280,
  fadeDurationMs = 180,
  showHandle = false,
}: BottomSheetModalProps) {
  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(visible);
  const visibleRef = useRef(visible);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const transitionRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;

  useLayoutEffect(() => {
    const transition = ++transitionRef.current;
    visibleRef.current = visible;

    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    animationRef.current?.stop();
    animationRef.current = null;

    if (visible) {
      // Modal ilk kez mount edilmeden önce değerleri görünmez konumda kur.
      // Böylece önceki açılıştan kalan "tam görünür" tek kare çizilmez.
      if (!mountedRef.current) {
        overlayOpacity.setValue(0);
        translateY.setValue(SCREEN_H);
        mountedRef.current = true;
        setMounted(true);
      }

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (transitionRef.current !== transition || !visibleRef.current) return;
        const animation = Animated.parallel([
          Animated.timing(overlayOpacity, {
            toValue: 1,
            duration: fadeDurationMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: slideDurationMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]);
        animationRef.current = animation;
        animation.start();
      });
    } else if (mountedRef.current) {
      const animation = Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: fadeDurationMs,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          duration: slideDurationMs,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      animationRef.current = animation;
      animation.start(({ finished }) => {
        if (
          finished &&
          transitionRef.current === transition &&
          !visibleRef.current
        ) {
          mountedRef.current = false;
          setMounted(false);
          onDismissRef.current?.();
        }
      });
    }
  }, [
    visible,
    overlayOpacity,
    translateY,
    fadeDurationMs,
    slideDurationMs,
  ]);

  useEffect(
    () => () => {
      transitionRef.current += 1;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      animationRef.current?.stop();
    },
    [],
  );

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      hardwareAccelerated
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/*
        SafeAreaProvider Modal'ın doğrudan çocuğu olarak tanımlandı.
        Bu pozisyonda Modal penceresini ölçer; navigationBarTranslucent
        ile genişlemiş pencerede `insets.bottom` = gesture/nav-bar yüksekliği.
        ModalContent bu değerle sheet'e paddingBottom ekler.
      */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ModalContent
          onClose={onClose}
          sheetStyle={sheetStyle}
          backdropColor={backdropColor}
          overlayOpacity={overlayOpacity}
          translateY={translateY}
          showHandle={showHandle}
          interactive={visible}
        >
          {children}
        </ModalContent>
        <SparkToastContainer />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Tutamak dokunma alanı — geniş tutuldu ki kolay yakalansın.
  handleZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    marginTop: -4,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(140,140,140,0.55)',
  },
});
