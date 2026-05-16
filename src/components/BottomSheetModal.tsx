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
}

const SCREEN_H = Dimensions.get('screen').height;

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
}

function ModalContent({
  onClose,
  children,
  sheetStyle,
  backdropColor,
  statusBarStyle,
  overlayOpacity,
  translateY,
}: ModalContentProps) {
  const { bottom } = useSafeAreaInsets();

  const overlayAnimStyle = useMemo(
    () => [styles.overlay, { backgroundColor: backdropColor, opacity: overlayOpacity }],
    [backdropColor, overlayOpacity],
  );

  const adjustedSheetStyle = useMemo(() => {
    const flat = (StyleSheet.flatten(sheetStyle) ?? {}) as ViewStyle;
    const basePB = typeof flat.paddingBottom === 'number' ? flat.paddingBottom : 0;
    return { ...flat, paddingBottom: basePB + bottom };
  }, [sheetStyle, bottom]);

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
        style={[styles.sheetWrapper, { transform: [{ translateY }] }]}
      >
        {/*
          Pressable SARMALAMA YOK: Android'de Pressable dikey pan'ı yakalar
          ve ScrollView'a iletmez; ALIM GEÇMİŞİ gibi listeleri kilitler.
          Overlay ve sheet ayrı kardeş katmanlar — sheet önde olduğu için
          backdrop tap'i doğal olarak engellenir.
        */}
        <View style={adjustedSheetStyle}>
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
});
