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
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  Animated,
  Pressable,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Easing,
  Platform,
  Dimensions,
  PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
  slideDurationMs?: number;
  fadeDurationMs?: number;
  statusBarStyle?: 'light' | 'dark' | 'auto' | 'inverted';
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
  statusBarStyle: 'light' | 'dark' | 'auto' | 'inverted';
  overlayOpacity: Animated.Value;
  translateY: Animated.Value;
  showHandle: boolean;
}

function ModalContent({
  onClose,
  children,
  sheetStyle,
  backdropColor,
  statusBarStyle,
  overlayOpacity,
  translateY,
  showHandle,
}: ModalContentProps) {
  const { bottom } = useSafeAreaInsets();

  // Tutamak: dokununca yatay genişlesin (scaleX), sürüklerken paneli aşağı taşı.
  const handleScaleX = useRef(new Animated.Value(1)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
          Animated.spring(handleScaleX, {
            toValue: 1.7,
            useNativeDriver: true,
            speed: 30,
            bounciness: 8,
          }).start();
        },
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
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
      {Platform.OS === 'android' && (
        <StatusBar style={statusBarStyle} backgroundColor="transparent" translucent />
      )}
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
  children,
  sheetStyle,
  backdropColor = 'rgba(0,0,0,0.55)',
  slideDurationMs = 280,
  fadeDurationMs = 180,
  statusBarStyle = 'light',
  showHandle = false,
}: BottomSheetModalProps) {
  const [mounted, setMounted] = useState(visible);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
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
      ]).start();
    } else if (mounted) {
      Animated.parallel([
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
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, overlayOpacity, translateY, fadeDurationMs, slideDurationMs]);

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
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
      <SafeAreaProvider>
        <ModalContent
          onClose={onClose}
          sheetStyle={sheetStyle}
          backdropColor={backdropColor}
          statusBarStyle={statusBarStyle}
          overlayOpacity={overlayOpacity}
          translateY={translateY}
          showHandle={showHandle}
        >
          {children}
        </ModalContent>
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
