// S.P.A.R.K. — Kayan yazı (marquee)
// Metin kapsayıcıya SIĞMADIĞINDA sağdan sola döngüsel kayar; sığıyorsa statik kalır
// (gereksiz animasyon/pil tüketimi yok). Reanimated ile UI thread'de çalışır.
import React, { useEffect, useState } from 'react';
import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Kapsayıcı View stili (flex/minWidth burada verilir). overflow:hidden otomatik eklenir. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Kayma hızı (px/sn). Varsayılan sakin bir tempo. */
  speed?: number;
  /** İki kopya arasındaki boşluk (kesintisiz döngü için). */
  gap?: number;
  /** İlk kaymadan önceki bekleme (ms) — kullanıcı başlangıcı görebilsin. */
  startDelay?: number;
}

function MarqueeText({
  text,
  style,
  containerStyle,
  speed = 35,
  gap = 36,
  startDelay = 1200,
}: MarqueeTextProps) {
  const [containerW, setContainerW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useSharedValue(0);

  const overflow = containerW > 0 && textW > 0 && textW > containerW + 1;

  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (overflow) {
      const dist = textW + gap;
      const duration = (dist / speed) * 1000;
      x.value = withDelay(
        startDelay,
        withRepeat(withTiming(-dist, { duration, easing: Easing.linear }), -1, false),
      );
    }
    return () => cancelAnimation(x);
  }, [overflow, textW, gap, speed, startDelay, text, x]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[{ overflow: 'hidden' }, containerStyle]}
      accessible
      accessibilityLabel={text}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerW) > 0.5) setContainerW(w);
      }}
    >
      {/* Gizli ölçüm: 4000px sabit genişlikli kapsayıcı → metin asla kesilmez/sarmaz;
          alignSelf:'flex-start' ile metin kendi DOĞAL genişliğine oturur, onLayout o
          genişliği verir. (Genişlik kısıtsız kalınca bazı cihazlarda parent'a sıkışıp
          kesiliyor, taşma hep "yok" çıkıyordu.) */}
      <View
        style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: 4000 }}
        pointerEvents="none"
      >
        <Text
          style={[style, { alignSelf: 'flex-start' }]}
          numberOfLines={1}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - textW) > 0.5) setTextW(w);
          }}
        >
          {text}
        </Text>
      </View>

      {overflow ? (
        <Animated.View
          style={[{ flexDirection: 'row', alignSelf: 'flex-start' }, animStyle]}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={style} numberOfLines={1}>{text}</Text>
          <View style={{ width: gap }} />
          <Text style={style} numberOfLines={1}>{text}</Text>
        </Animated.View>
      ) : (
        <Text style={style} numberOfLines={1} importantForAccessibility="no-hide-descendants">
          {text}
        </Text>
      )}
    </View>
  );
}

export default React.memo(MarqueeText);
