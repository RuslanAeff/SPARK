// S.P.A.R.K. — Alt sayfa modal'ı (eşzamanlı fade overlay + slide sheet)
//
// Sorun: Yerleşik `<Modal animationType="slide" transparent>` kullanıldığında
// yarı-saydam overlay de sheet ile birlikte alttan yukarı kayıyor. Bu
// yüzden sheet yarıya geldiğinde üst yarı hâlâ ışık modunda beyaz / eski
// ekranı gösteriyor → gri katman sonradan "sıçrayarak" oturuyor.
//
// Çözüm: Modal'ın kendi animasyonunu kapatıp (`animationType="none"`)
// overlay'i `Animated.Value` ile opacity üzerinden 180 ms'de anında
// karartıyor, sheet'i ise `translateY` ile 280 ms slide up yapıyoruz.
// Kapanırken ters sıra uygulanır ve animasyon bitince `onClose`
// tetiklenir.
//
// NOT: Android'de modal içinde `react-native-reanimated` kullanımı bazı
// cihazlarda donmaya yol açtığı için projenin genel kuralına uyup
// yalnızca yerleşik `Animated` API'sini kullanıyoruz.
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Easing,
  Platform,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Sheet'in stil'i (arkaplan, radius, maxHeight vb.). */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Overlay (backdrop) rengi. Varsayılan: rgba(0,0,0,0.55) */
  backdropColor?: string;
  /** Sheet slide süresi (ms). */
  slideDurationMs?: number;
  /** Overlay fade süresi (ms). */
  fadeDurationMs?: number;
  /**
   * Modal açıkken Android status bar ikon rengi. Overlay koyu olduğundan
   * varsayılan 'light' kalır. Özel durumlarda override edilebilir.
   */
  statusBarStyle?: 'light' | 'dark' | 'auto' | 'inverted';
}

const SCREEN_H = Dimensions.get('window').height;

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
  // Modal'ı gerçekten DOM/hiyerarşiden çıkarmak için ayrı bir `mounted`
  // bayrağı tutuyoruz. Böylece kapanış animasyonu bitmeden modal kaldırılmıyor.
  const [mounted, setMounted] = useState(visible);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Açılışta önce overlay koyulaşmaya başlar, sheet onun üstüne gelir.
      // İkisi paralel başlar; overlay daha kısa sürdüğü için bitmiş olur.
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

  const overlayStyle = useMemo(
    () => [styles.overlay, { backgroundColor: backdropColor, opacity: overlayOpacity }],
    [backdropColor, overlayOpacity]
  );

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      // Kendi fade/slide animasyonumuzu çalıştırdığımız için Modal'ın
      // yerleşik animasyonunu kapatıyoruz. Aksi halde overlay de sheet
      // ile birlikte kaymaya devam ederdi.
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {Platform.OS === 'android' && (
        <StatusBar style={statusBarStyle} backgroundColor="transparent" translucent />
      )}
      <Animated.View style={overlayStyle}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.sheetWrapper, { transform: [{ translateY }] }]}
      >
        <Pressable onPress={(e) => e.stopPropagation()} style={sheetStyle}>
          {children}
        </Pressable>
      </Animated.View>
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
