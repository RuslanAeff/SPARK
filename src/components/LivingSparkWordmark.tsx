// S.P.A.R.K. — Accent-aware, motion-conscious in-app living wordmark
import React, { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { FontFamily } from '../theme/typography';
import { useAppThemeSnapshot } from '../theme/themeStore';

const WORDMARK = 'S.P.A.R.K';
const WORDMARK_LETTERS = ['S', 'P', 'A', 'R', 'K'] as const;
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export type WordmarkSize = 'hero' | 'compact';
type WordmarkVariant = 'living' | 'classic';

type LivingSparkWordmarkProps = {
  size?: WordmarkSize;
  variant?: WordmarkVariant;
  active?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

const SIZE_PRESETS = {
  hero: {
    width: 144,
    height: 42,
    fontSize: 32,
    baseline: 32,
    letterCenters: [11, 41, 71, 101, 131],
    dotCenters: [25, 51.5, 86, 116],
    dotCenterY: 29.5,
    dotRadius: 2.55,
    classicFontSize: 24,
    classicLetterSpacing: 2,
  },
  compact: {
    width: 130,
    height: 38,
    fontSize: 29,
    baseline: 30,
    letterCenters: [10, 37, 64, 91, 118],
    dotCenters: [22.7, 46.8, 77.5, 104.5],
    dotCenterY: 27.5,
    dotRadius: 2.3,
    classicFontSize: 20,
    classicLetterSpacing: 3,
  },
} as const;

type WordmarkPreset = (typeof SIZE_PRESETS)[WordmarkSize];

export function resolveWordmarkLayout(size: WordmarkSize): WordmarkPreset {
  return SIZE_PRESETS[size];
}

/** İki hex rengi doğrusal karıştırır (t=0 → a, t=1 → b). Geçersiz girdide a döner. */
export function mixHexColors(a: string, b: string, t: number): string {
  const parse = (value: string): [number, number, number] | null => {
    const hex = value.trim().replace('#', '');
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const from = parse(a);
  const to = parse(b);
  if (!from || !to) return a;
  const ratio = Math.max(0, Math.min(1, t));
  const channel = (index: number) =>
    Math.round(from[index] + (to[index] - from[index]) * ratio)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * Hareketin okunabilirliği iki temada farklı fizik ister.
 *
 * Aydınlık temada harfler koyu, arkaplan beyazdır: içeriden geçen ışık zaten
 * belirgindir, geniş gezinme yeter.
 *
 * Karanlık temada ise harfler zaten parlak vurgu renginde. Aynı renk ailesinden
 * düşük opaklıklı bir parıltı, parlak yeşilin üstünde neredeyse kaybolur —
 * "yaşam belirtisi" görünmez olur. Bu yüzden karanlık temada üç şey birden
 * değişir: taban rengi bir miktar koyulaşır (dinamik aralık açılır), gezen
 * katmanların opaklığı yükselir ve parıltının çekirdeği vurgu renginin açığı
 * yerine beyaza çekilir. Sonuç: harflerin içinden geçen ışık okunur olur.
 */
export function resolveWordmarkMotionProfile(
  scheme: 'light' | 'dark',
  colors: { primary: string; primaryDark: string; primaryLight?: string },
  width: number,
) {
  const isLightScheme = scheme === 'light';
  return {
    baseEdgeColor: isLightScheme ? colors.primary : colors.primaryDark,
    // Karanlık temada taban kısılır ki üstünden geçen ışık fark edilsin. Bu
    // kısma OPAKLIKLA değil RENKLE yapılır: yarı saydam dolgu, harf konturunun
    // içeriye düşen yarısını görünür kılıp K/A/R gibi çok parçalı harflerde
    // "üst üste yapıştırılmış" izlenimi veren iç dikişler yaratıyordu.
    baseCenterColor: isLightScheme
      ? colors.primary
      : mixHexColors(colors.primary, '#000000', 0.26),
    ambientOpacityMultiplier: isLightScheme ? 1.18 : 1.5,
    // Parıltının çekirdeği vurgu renginin AÇIK TONUNDA kalır; beyaza çekilmez.
    // Beyaza yaklaşan çekirdek harfin üstünde "el feneri" gibi okunuyordu ve
    // sentetik kalınlaştırmanın dar açılı birleşimlerde bıraktığı iç binişmeyi
    // ton farkıyla açığa çıkarıyordu. Işık harfle aynı renk ailesinde kalınca
    // o birleşimler tek parça görünür; hareket ise parlaklık yerine konum ve
    // yoğunluk değişimiyle okunur.
    highlightColor: isLightScheme
      ? (colors.primaryLight ?? colors.primary)
      : mixHexColors(colors.primaryLight ?? colors.primary, '#FFFFFF', 0.18),
    mistPrimaryTravel: width * (isLightScheme ? 0.28 : 0.34),
    mistSecondaryTravel: width * (isLightScheme ? 0.29 : 0.36),
  };
}

function WordmarkGlyphs({
  preset,
  fill,
  testIDPrefix,
}: {
  preset: WordmarkPreset;
  fill: string;
  testIDPrefix?: string;
}) {
  return (
    <>
      {WORDMARK_LETTERS.map((letter, index) => (
        <SvgText
          key={`${letter}-${index}`}
          x={preset.letterCenters[index]}
          y={preset.baseline}
          textAnchor="middle"
          fill={fill}
          fontFamily={FontFamily.extraBold}
          fontSize={preset.fontSize}
          // Ağırlık 900'de kalır: imzanın tokluğu kimliğin parçası. Sentetik
          // kalınlaştırmanın dar açılı birleşimlerde bıraktığı iz, ağırlığı
          // düşürerek değil, üstünden geçen ışığın tonu bastırılarak
          // gizlenir (bkz. resolveWordmarkMotionProfile).
          fontWeight="900"
          testID={testIDPrefix ? `${testIDPrefix}-letter-${index}` : undefined}
        >
          {letter}
        </SvgText>
      ))}
      {preset.dotCenters.map((cx, index) => (
        <Circle
          key={`dot-${index}`}
          cx={cx}
          cy={preset.dotCenterY}
          r={preset.dotRadius}
          fill={fill}
          testID={testIDPrefix ? `${testIDPrefix}-dot-${index}` : undefined}
        />
      ))}
    </>
  );
}

export default function LivingSparkWordmark({
  size = 'hero',
  variant = 'living',
  active = true,
  accessibilityHint,
  testID = 'living-spark-wordmark',
}: LivingSparkWordmarkProps) {
  const { palette, scheme } = useAppThemeSnapshot();
  const preset = resolveWordmarkLayout(size);
  const reduceMotion = useReducedMotion();
  // React Native açılışta currentState'i kısa süreli null döndürebilir. Odaktaki
  // ekran görünürken bu bilinmeyen ilk kareyi önplan kabul eder; gerçek
  // background/inactive olayı geldiği anda hareket kapatılır.
  const [appState, setAppState] = useState<AppStateStatus | null>(AppState.currentState);
  const sweep = useSharedValue(0);
  const centerWave = useSharedValue(0);
  const mist = useSharedValue(0);
  const reaction = useSharedValue(0);
  const reactId = React.useId();
  const svgId = useMemo(() => reactId.replace(/[^a-zA-Z0-9_-]/g, ''), [reactId]);
  const ids = useMemo(() => ({
    base: `spark-base-${svgId}`,
    energy: `spark-energy-${svgId}`,
    centerWave: `spark-center-wave-${svgId}`,
    mist: `spark-mist-${svgId}`,
    mistDeep: `spark-mist-deep-${svgId}`,
    reaction: `spark-reaction-${svgId}`,
    clip: `spark-clip-${svgId}`,
  }), [svgId]);

  const shouldAnimate = variant === 'living'
    && active
    && (appState == null || appState === 'active' || appState === 'unknown')
    && !reduceMotion;
  const {
    baseEdgeColor,
    baseCenterColor,
    ambientOpacityMultiplier,
    highlightColor,
    mistPrimaryTravel,
    mistSecondaryTravel,
  } = resolveWordmarkMotionProfile(scheme, palette, preset.width);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(sweep);
    cancelAnimation(centerWave);
    cancelAnimation(mist);
    cancelAnimation(reaction);
    sweep.value = 0;
    centerWave.value = 0;
    mist.value = 0;
    reaction.value = 0;

    if (!shouldAnimate) return;

    sweep.value = withRepeat(
      withTiming(1, { duration: 6200, easing: Easing.linear }),
      -1,
      false,
    );
    centerWave.value = withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.linear }),
      -1,
      false,
    );
    mist.value = withRepeat(
      withTiming(1, { duration: 5400, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(sweep);
      cancelAnimation(centerWave);
      cancelAnimation(mist);
      cancelAnimation(reaction);
    };
  }, [centerWave, mist, reaction, shouldAnimate, sweep]);

  const handlePress = React.useCallback(() => {
    if (!shouldAnimate) return;

    cancelAnimation(reaction);
    reaction.value = 0;
    reaction.value = withTiming(1, { duration: 980, easing: Easing.linear });
  }, [reaction, shouldAnimate]);

  const sweepProps = useAnimatedProps(() => {
    'worklet';
    const glowRadius = preset.width * 0.17;
    const travel = preset.width + glowRadius * 2;
    const phase = sweep.value * Math.PI * 2;
    return {
      cx: -glowRadius + travel * sweep.value,
      cy: preset.height * 0.49 + Math.sin(phase) * (preset.height * 0.08),
      rx: glowRadius * (0.88 + ((Math.sin(phase) + 1) / 2) * 0.2),
      ry: preset.height * (0.32 + ((Math.cos(phase) + 1) / 2) * 0.09),
      opacity: (0.2 + ((Math.sin(phase) + 1) / 2) * 0.22)
        * ambientOpacityMultiplier,
    };
  }, [ambientOpacityMultiplier, preset.height, preset.width]);

  const sweepSecondaryProps = useAnimatedProps(() => {
    'worklet';
    const glowRadius = preset.width * 0.16;
    const travel = preset.width + glowRadius * 2;
    const phase = sweep.value * Math.PI * 2;
    return {
      cx: preset.width + glowRadius - travel * sweep.value,
      cy: preset.height * 0.55 - Math.sin(phase) * (preset.height * 0.09),
      rx: glowRadius * (0.86 + ((Math.cos(phase) + 1) / 2) * 0.22),
      ry: preset.height * (0.3 + ((Math.sin(phase) + 1) / 2) * 0.1),
      opacity: (0.18 + ((Math.cos(phase) + 1) / 2) * 0.2)
        * ambientOpacityMultiplier,
    };
  }, [ambientOpacityMultiplier, preset.height, preset.width]);

  const centerWaveProps = useAnimatedProps(() => {
    'worklet';
    const pulse = Math.sin(centerWave.value * Math.PI);
    return {
      cx: preset.letterCenters[2],
      cy: preset.height * 0.52,
      rx: 6 + centerWave.value * (preset.width * 0.44),
      ry: 5 + pulse * (preset.height * 0.24),
      opacity: pulse * 0.46 * ambientOpacityMultiplier,
    };
  }, [ambientOpacityMultiplier, preset.height, preset.width]);

  const centerWaveSecondaryProps = useAnimatedProps(() => {
    'worklet';
    const progress = (centerWave.value + 0.5) % 1;
    const pulse = Math.sin(progress * Math.PI);
    return {
      cx: preset.letterCenters[2],
      cy: preset.height * 0.5,
      rx: 5 + progress * (preset.width * 0.4),
      ry: 4 + pulse * (preset.height * 0.2),
      opacity: pulse * 0.34 * ambientOpacityMultiplier,
    };
  }, [ambientOpacityMultiplier, preset.height, preset.width]);

  const mistPrimaryProps = useAnimatedProps(() => {
    'worklet';
    const phase = mist.value * Math.PI * 2;
    return {
      cx: preset.letterCenters[2] + Math.sin(phase) * mistPrimaryTravel,
      cy: preset.height * 0.52 + Math.cos(phase) * 2.4,
      rx: 19 + Math.cos(phase) * 5,
      ry: 9 + Math.sin(phase) * 2.8,
      opacity: (0.24 + ((Math.cos(phase) + 1) / 2) * 0.2) * ambientOpacityMultiplier,
    };
  }, [ambientOpacityMultiplier, mistPrimaryTravel, preset.height]);

  const mistSecondaryProps = useAnimatedProps(() => {
    'worklet';
    const phase = mist.value * Math.PI * 2;
    return {
      cx: preset.letterCenters[2] - Math.sin(phase) * mistSecondaryTravel,
      cy: preset.height * 0.5 - Math.cos(phase) * 2,
      rx: 15 - Math.sin(phase) * 4,
      ry: 8 + Math.cos(phase) * 2.2,
      opacity: (0.18 + ((Math.sin(phase) + 1) / 2) * 0.16) * ambientOpacityMultiplier,
    };
  }, [ambientOpacityMultiplier, mistSecondaryTravel, preset.height]);

  const reactionLeftProps = useAnimatedProps(() => {
    'worklet';
    const progress = reaction.value;
    const eased = 1 - ((1 - progress) ** 3);
    const pulse = Math.sin(progress * Math.PI);
    return {
      cx: preset.letterCenters[2] - eased * (preset.width * 0.39),
      cy: preset.height * 0.52 - pulse * 1.5,
      rx: 7 + pulse * 15,
      ry: 5 + pulse * 7,
      opacity: pulse * 0.94,
    };
  }, [preset.height, preset.width]);

  const reactionRightProps = useAnimatedProps(() => {
    'worklet';
    const progress = reaction.value;
    const eased = 1 - ((1 - progress) ** 3);
    const pulse = Math.sin(progress * Math.PI);
    return {
      cx: preset.letterCenters[2] + eased * (preset.width * 0.39),
      cy: preset.height * 0.52 + pulse * 1.5,
      rx: 7 + pulse * 15,
      ry: 5 + pulse * 7,
      opacity: pulse * 0.94,
    };
  }, [preset.height, preset.width]);

  const reactionCoreProps = useAnimatedProps(() => {
    'worklet';
    const progress = reaction.value;
    const eased = 1 - ((1 - progress) ** 3);
    return {
      cx: preset.letterCenters[2],
      cy: preset.height * 0.52,
      rx: 8 + eased * (preset.width * 0.22),
      ry: 5 + Math.sin(progress * Math.PI) * 8,
      opacity: Math.sin(progress * Math.PI) * 0.92,
    };
  }, [preset.height, preset.width]);

  const classicStyle = useMemo(() => [
    styles.classicText,
    {
      color: palette.primary,
      fontSize: preset.classicFontSize,
      lineHeight: preset.height,
      letterSpacing: preset.classicLetterSpacing,
    },
  ], [palette.primary, preset]);

  if (variant === 'classic') {
    return (
      <View
        accessible
        accessibilityLabel={WORDMARK}
        accessibilityRole="image"
        style={{ height: preset.height, justifyContent: 'center' }}
        testID={testID}
      >
        <Text style={classicStyle}>{WORDMARK}</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessible
      accessibilityLabel={WORDMARK}
      accessibilityHint={shouldAnimate ? accessibilityHint : undefined}
      accessibilityRole={shouldAnimate ? 'button' : 'image'}
      disabled={!shouldAnimate}
      hitSlop={6}
      onPress={handlePress}
      style={{ width: preset.width, height: preset.height }}
      testID={testID}
    >
      <Svg
        width={preset.width}
        height={preset.height}
        viewBox={`0 0 ${preset.width} ${preset.height}`}
        accessible={false}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient
            id={ids.base}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={preset.width}
            y2="0"
          >
            <Stop offset="0" stopColor={baseEdgeColor} />
            <Stop offset="0.3" stopColor={baseCenterColor} />
            <Stop offset="0.7" stopColor={baseCenterColor} />
            <Stop offset="1" stopColor={baseEdgeColor} />
          </LinearGradient>
          <RadialGradient id={ids.energy} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor={highlightColor} stopOpacity="0.95" />
            <Stop offset="0.42" stopColor={palette.primary} stopOpacity="0.68" />
            <Stop offset="0.78" stopColor={palette.primaryDark} stopOpacity="0.26" />
            <Stop offset="1" stopColor={palette.primaryDark} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={ids.centerWave} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor={highlightColor} stopOpacity="0.8" />
            <Stop offset="0.38" stopColor={palette.primary} stopOpacity="0.66" />
            <Stop offset="0.76" stopColor={palette.primaryDark} stopOpacity="0.28" />
            <Stop offset="1" stopColor={palette.primaryDark} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={ids.mist} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor={highlightColor} stopOpacity="0.86" />
            <Stop offset="0.46" stopColor={palette.primary} stopOpacity="0.58" />
            <Stop offset="1" stopColor={palette.primaryDark} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={ids.mistDeep} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor={palette.primary} stopOpacity="0.8" />
            <Stop offset="0.5" stopColor={palette.primaryDark} stopOpacity="0.58" />
            <Stop offset="1" stopColor={palette.primaryDark} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={ids.reaction} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor={highlightColor} stopOpacity="1" />
            <Stop offset="0.38" stopColor={palette.primary} stopOpacity="0.82" />
            <Stop offset="0.74" stopColor={palette.primaryDark} stopOpacity="0.42" />
            <Stop offset="1" stopColor={palette.primaryDark} stopOpacity="0" />
          </RadialGradient>
          <ClipPath id={ids.clip}>
            <WordmarkGlyphs preset={preset} fill="#000000" />
          </ClipPath>
        </Defs>

        {/*
          Kontur YOK. SVG konturu yolun ortasına çizilir: yarısı harfin içine
          düşer ve K (üç parça), A, R, P gibi harflerin iç birleşim yerlerinde
          ikinci bir çizgi olarak görünür — harf "parçalardan yapıştırılmış"
          gibi durur, içeriden ışık geçerken bu dikişler daha da belirir.
          Keskinliği kontur değil, tam opak degrade dolgu taşır.
        */}
        <WordmarkGlyphs
          preset={preset}
          fill={`url(#${ids.base})`}
          testIDPrefix={testID}
        />

        {/*
          TEK kırpma grubu. Her ışık katmanı ayrı ayrı harflere kırpılırsa,
          harf sınırı her katman için yeniden rasterlenir; kenar örtüşmeleri
          üst üste binerek harfin içinde ince dikişler ve koyu izler bırakır.
          Katmanlar önce kendi aralarında birleşir, sınır bir kez uygulanır.
        */}
        <G clipPath={`url(#${ids.clip})`}>
          <AnimatedEllipse
            animatedProps={mistPrimaryProps}
            fill={`url(#${ids.mist})`}
            testID={`${testID}-core`}
          />
          <AnimatedEllipse
            animatedProps={mistSecondaryProps}
            fill={`url(#${ids.mistDeep})`}
            testID={`${testID}-mist-secondary`}
          />
          <AnimatedEllipse
            animatedProps={centerWaveProps}
            fill={`url(#${ids.centerWave})`}
            testID={`${testID}-center-wave`}
          />
          <AnimatedEllipse
            animatedProps={centerWaveSecondaryProps}
            fill={`url(#${ids.mistDeep})`}
            testID={`${testID}-center-wave-secondary`}
          />
          <AnimatedEllipse
            animatedProps={sweepProps}
            fill={`url(#${ids.energy})`}
            testID={`${testID}-energy`}
          />
          <AnimatedEllipse
            animatedProps={sweepSecondaryProps}
            fill={`url(#${ids.mistDeep})`}
            testID={`${testID}-energy-secondary`}
          />
          <AnimatedEllipse
            animatedProps={reactionCoreProps}
            fill={`url(#${ids.reaction})`}
            testID={`${testID}-reaction-core`}
          />
          <AnimatedEllipse
            animatedProps={reactionLeftProps}
            fill={`url(#${ids.reaction})`}
            testID={`${testID}-reaction-wave`}
          />
          <AnimatedEllipse
            animatedProps={reactionRightProps}
            fill={`url(#${ids.reaction})`}
            testID={`${testID}-reaction-wave-secondary`}
          />
        </G>

      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  classicText: {
    fontFamily: FontFamily.extraBold,
    fontWeight: '900',
  },
});
