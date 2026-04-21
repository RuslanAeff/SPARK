// S.P.A.R.K. — Animated Donut Chart (Leobank Style)
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Pressable, GestureResponderEvent } from 'react-native';
import { Colors } from '../theme/colors';
import { ChartColorArray } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  innerContent?: React.ReactNode;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}

export default function DonutChart({
  segments,
  size = 240,
  strokeWidth = 28,
  innerContent,
  selectedIndex = null,
  onSelect,
}: DonutChartProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  // Kaydırma (Clipping) ve kesilme hatasını çözmek için:
  // Seçilen dilim 12 birim dışa doğru kalınlaşacağı için, çemberin asıl yarıçapını
  // o genişliğin sığabileceği maksimun "Güvenli Bölge (Safe Zone)"ye göre hesaplıyoruz.
  const maxStrokeWidth = strokeWidth + 12; 
  const radius = (size - maxStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = useMemo(() => segments.reduce((sum, s) => sum + s.value, 0), [segments]);

  // Compute segment angles
  const segmentData = useMemo(() => {
    let accumulated = 0;
    return segments.map((seg, i) => {
      const ratio = total > 0 ? seg.value / total : 0;
      const length = ratio * circumference;
      const gap = segments.length > 1 ? 4 : 0; // gap between segments
      const offset = accumulated;
      accumulated += length + gap;
      return {
        ...seg,
        dashArray: `${Math.max(0, length - gap)} ${circumference}`,
        dashOffset: -offset,
        color: seg.color || ChartColorArray[i % ChartColorArray.length],
      };
    });
  }, [segments, total, circumference]);

  const handlePress = (e: GestureResponderEvent) => {
    if (!onSelect) return;
    const { locationX, locationY } = e.nativeEvent;
    
    // SVG merkezine göre tıklanılan noktanın koordinatları
    const dx = locationX - center;
    const dy = locationY - center;
    
    // Merkeze olan uzaklık (Pisagor)
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Tıklanabilir alan (Kalınlığın ortası radius olduğu için +- tolerans ekliyoruz)
    const innerRadius = radius - (strokeWidth / 2) - 10;
    const outerRadius = radius + (strokeWidth / 2) + 10;
    
    if (distance >= innerRadius && distance <= outerRadius) {
      // SVG -90 derece döndürülmüş başladığı için tepe noktası (0) olacak şekilde açıyı hesaplıyoruz.
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI; // 0 - 360 derece (Radyan) aralığı
      
      const ratio = angle / (2 * Math.PI); // Çemberin neresine dokunuldu (0.0 - 1.0)
      
      let accumulated = 0;
      for (let i = 0; i < segments.length; i++) {
        const segRatio = total > 0 ? segments[i].value / total : 0;
        // Dokunulan oran, bu segmentin başlangıç ve bitiş oranları arasında mı?
        if (ratio >= accumulated && ratio <= accumulated + segRatio) {
          onSelect(i);
          return;
        }
        accumulated += segRatio;
      }
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Pressable onPress={handlePress} style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
          {/* Performans Dostu 3D Cam Boru (Glass Tube) Efekti - Tüm SVG koordinatlarına sabitlendi */}
          <LinearGradient id="glassTube" x1="0" y1="0" x2="0" y2={size} gradientUnits="userSpaceOnUse">
            {/* Üst kısımdaki sert cam parlaması */}
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <Stop offset="8%" stopColor="#FFFFFF" stopOpacity="0.1" />
            {/* Ortalar temiz, rengin canını sıkmadan aynen bırakır */}
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
            {/* Alt kısımdaki gölgeleme, 3D yuvarlaklık hissini tamamlar */}
            <Stop offset="90%" stopColor="#000000" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </LinearGradient>
        </Defs>

        {/* Background ring (Şeffaf cam oluğu) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={Colors.surfaceLight}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.3}
        />
        <G rotation="-90" origin={`${center}, ${center}`}>
          {segmentData.map((seg, i) => (
            <AnimatedSegment
              key={`${seg.label}-${i}`}
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
              color={seg.color}
              dashArray={seg.dashArray}
              dashOffset={seg.dashOffset}
              index={i}
              selectedIndex={selectedIndex}
            />
          ))}
        </G>
      </Svg>
      </Pressable>
      {/* Inner content (icon / amount) */}
      {innerContent && (
        <View style={styles.innerContent}>
          {innerContent}
        </View>
      )}
    </View>
  );
}

function AnimatedSegment({
  cx, cy, r, strokeWidth, color, dashArray, dashOffset, index, selectedIndex
}: {
  cx: number; cy: number; r: number; strokeWidth: number;
  color: string; dashArray: string; dashOffset: number; index: number;
  selectedIndex: number | null;
}) {
  const isSelected = selectedIndex === index;
  const isActive = selectedIndex === null || isSelected; // Hiçbiri seçili değilse hepsi aktif
  
  const progress = useSharedValue(0);
  const activeProgress = useSharedValue(isActive ? 1 : 0);
  const bumpProgress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 800 + index * 150,
      easing: Easing.out(Easing.cubic),
    });
  }, [dashArray, dashOffset]);

  // Karartma/Aydınlatma animasyonu (Transparan veya tam renkli olma durumu)
  useEffect(() => {
    activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 300, easing: Easing.out(Easing.ease) });
  }, [isActive]);

  // "Hafif Dürtülmüş Animasyonumsu Hareket" - Dürtme (Bump) Efekti
  // Kullanıcı bunu seçtiğinde veya seçimi kaldırdığında (hepsi resetlendiğinde) zıplar
  useEffect(() => {
    if (isSelected || selectedIndex === null) {
      bumpProgress.value = withSequence(
        withTiming(1, { duration: 80 }), // Çizgi üzerinde hızlıca kay
        withSpring(0, { damping: 12, stiffness: 220 }) // Yaylanarak yörüngeye (orijinal yerine) geri otur
      );
    }
  }, [isSelected, selectedIndex]);

  const animatedProps = useAnimatedProps(() => {
    return {
      r: r, // Kalınlık, boyut ve yarıçap tamamen SABİT, dışa taşma/şişme yok
      opacity: progress.value * (0.2 + 0.8 * activeProgress.value), // Cama dönüşme karanlığı (%20 opaklık)
      // Çember üzerinde ileri-geri kaydırma (vektörel slide)
      strokeDashoffset: (dashOffset * progress.value) + (bumpProgress.value * 18),
    };
  });

  return (
    <G>
      {/* Ana renkli hat (Orijinal Canlı Renk) */}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        stroke={color} 
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        fill="none"
        animatedProps={animatedProps}
      />
      {/* Yansıma hattı (Cam Katmanı) - Asıl renkli katmanla milimetrik SENKRONİZE büyür! */}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        stroke="url(#glassTube)" 
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        fill="none"
        pointerEvents="none" // Dokunuşları global Pressable'a bırakır
        animatedProps={animatedProps}
      />
    </G>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  innerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
