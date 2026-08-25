import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync } from 'expo-audio';

import AccentPaletteCarousel, { getAccentCarouselMetrics } from '../AccentPaletteCarousel';
import type { ThemeAccent } from '../../theme/colors';

const mockDetentPlayer = {
  currentStatus: {
    isLoaded: true,
    currentTime: 0,
    playing: false,
  },
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  volume: 1,
};

const mockPalette = {
  background: '#050505',
  surface: '#161618',
  surfaceLight: '#1E1E22',
  surfaceElevated: '#26262C',
  primary: '#2EE88C',
  primaryLight: '#62F2AA',
  primaryDark: '#00A85A',
  primaryAction: '#007A3D',
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(46, 232, 140, 0.13)',
  primaryGlow: 'rgba(46, 232, 140, 0.16)',
  secondary: '#CCFF00',
  secondaryLight: '#D4FF33',
  secondaryDark: '#A3CC00',
  success: '#2EE88C',
  successDark: '#00A344',
  danger: '#FF453A',
  dangerDark: '#CC0000',
  warning: '#FFCC00',
  info: '#33CCFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#666677',
  textInverse: '#000000',
  chartPurple: '#9D00FF',
  chartBlue: '#00FFFF',
  chartOrange: '#FF6600',
  chartGreen: '#00FF66',
  chartPink: '#FF00AA',
  chartYellow: '#CCFF00',
  chartCyan: '#00CCFF',
  chartRed: '#FF3333',
  border: '#2A2A2A',
  borderLight: '#3D3D3D',
  divider: 'rgba(255, 255, 255, 0.08)',
  cardBorder: '#505060',
  cardSurface: '#1C1C1E',
  inputBackground: '#252528',
  inputBorder: '#3D3D3D',
  glass: 'rgba(10, 10, 10, 0.90)',
  glassBorder: 'rgba(46, 232, 140, 0.30)',
  shadowColor: '#2EE88C',
  tabActive: '#2EE88C',
  tabInactive: '#666677',
  tabBackground: '#050505',
};

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  AndroidHaptics: { Context_Click: 'context-click' },
  ImpactFeedbackStyle: { Rigid: 'rigid' },
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: () => mockDetentPlayer,
}));

jest.mock('../../theme/themeStore', () => ({
  useThemePalette: () => mockPalette,
}));

const labels = {
  green: 'SPARK Yeşili',
  blue: 'Okyanus Mavisi',
  orange: 'Kehribar Turuncusu',
  purple: 'Menekşe Moru',
  red: 'Yakut Kırmızısı',
} as const;

function createOnSelect(saved = true): jest.Mock<Promise<boolean>, [ThemeAccent]> {
  return jest.fn<Promise<boolean>, [ThemeAccent]>().mockResolvedValue(saved);
}

async function renderCarousel({
  onSelect = createOnSelect(),
  selectedAccent = 'green',
  disabled = false,
}: {
  onSelect?: jest.Mock<Promise<boolean>, [ThemeAccent]>;
  selectedAccent?: ThemeAccent;
  disabled?: boolean;
} = {}) {
  return {
    onSelect,
    screen: await render(
      <AccentPaletteCarousel
        scheme="dark"
        selectedAccent={selectedAccent}
        disabled={disabled}
        labelFor={(accent) => labels[accent]}
        optionHintFor={(accent) => `${labels[accent]} seç`}
        swipeHint="Renkler arasında kaydır"
        onSelect={onSelect}
      />,
    ),
  };
}

describe('AccentPaletteCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetentPlayer.currentStatus.isLoaded = true;
    mockDetentPlayer.currentStatus.currentTime = 0;
    mockDetentPlayer.currentStatus.playing = false;
    mockDetentPlayer.seekTo.mockResolvedValue(undefined);
    (setAudioModeAsync as jest.MockedFunction<typeof setAudioModeAsync>)
      .mockResolvedValue(undefined);
  });

  it('gerçek viewport genişliğinde tüm renk merkezlerini aynı sabit eksene hizalar', () => {
    const viewportWidth = 340;
    const metrics = getAccentCarouselMetrics(viewportWidth);

    expect(metrics.itemStride).toBe(97);
    expect(metrics.snapOffsets).toEqual([0, 97, 194, 291, 388]);
    metrics.snapOffsets.forEach((offset, index) => {
      const itemCenter = metrics.horizontalInset
        + (metrics.itemStride / 2)
        + (index * metrics.itemStride)
        - offset;
      expect(itemCenter).toBe(viewportWidth / 2);
    });
  });

  it('dar ve geniş viewportlarda adımı sınırlar ve ilk/son snap merkezini korur', () => {
    expect(getAccentCarouselMetrics(220).itemStride).toBe(88);
    expect(getAccentCarouselMetrics(500).itemStride).toBe(104);

    [220, 500].forEach((viewportWidth) => {
      const metrics = getAccentCarouselMetrics(viewportWidth);
      [0, 4].forEach((selectedIndex) => {
        const selectedCenter = metrics.horizontalInset
          + (metrics.itemStride / 2)
          + (selectedIndex * metrics.itemStride)
          - metrics.snapOffsets[selectedIndex];
        expect(selectedCenter).toBe(viewportWidth / 2);
      });
    });
  });

  it('başlangıçtaki kanonik seçimi gösterir ve onSelect çağırmaz', async () => {
    const onSelect = createOnSelect();
    const { screen } = await renderCarousel({ onSelect, selectedAccent: 'purple' });

    expect(screen.getByTestId('theme-accent-centered-label').props.children)
      .toBe('Menekşe Moru');
    expect(screen.getByTestId('theme-accent-purple').props.accessibilityState.selected)
      .toBe(true);

    await waitFor(() => expect(onSelect).not.toHaveBeenCalled());
  });

  it('şeffaf merkez halkasında Android iç gölge artefaktı üreten yükseltiyi kullanmaz', async () => {
    const { screen } = await renderCarousel({ selectedAccent: 'blue' });
    const ringStyle = StyleSheet.flatten(
      screen.getByTestId('theme-accent-center-ring-outline').props.style,
    );

    expect(ringStyle).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: '#5AC8FA',
    });
    expect(ringStyle.elevation).toBeUndefined();
    expect(ringStyle.shadowColor).toBeUndefined();
    expect(ringStyle.shadowOpacity).toBeUndefined();
    expect(ringStyle.shadowRadius).toBeUndefined();
  });

  it('yeniden açılışta rayı kanonik seçimin fiziksel offsetinden başlatır', async () => {
    const { screen } = await renderCarousel({ selectedAccent: 'purple' });
    const scroll = screen.getByTestId('theme-accent-scroll');

    expect(scroll.props.contentOffset).toEqual({ x: 288, y: 0 });
    await fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { width: 340, height: 82, x: 0, y: 0 } },
    });
    expect(screen.getByTestId('theme-accent-scroll').props.contentOffset)
      .toEqual({ x: 291, y: 0 });
    expect(screen.getByTestId('theme-accent-centered-label').props.children)
      .toBe('Menekşe Moru');
  });

  it('renk örneğine dokununca doğru vurguyu yalnız bir kez seçer', async () => {
    const onSelect = createOnSelect();
    const { screen } = await renderCarousel({ onSelect });

    await fireEvent.press(screen.getByTestId('theme-accent-blue'));

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenCalledWith('blue');
    expect(screen.getByTestId('theme-accent-blue').props.accessibilityState.selected)
      .toBe(true);
  });

  it('drag ara konumunu değil momentum sonundaki snap rengini yalnız bir kez kaydeder', async () => {
    jest.useFakeTimers();
    try {
      let finishSelect!: (saved: boolean) => void;
      const onSelect = jest.fn<Promise<boolean>, [ThemeAccent]>(
        (_accent: ThemeAccent) => new Promise<boolean>((resolve) => { finishSelect = resolve; }),
      );
      const { screen } = await renderCarousel({ onSelect });
      const scroll = screen.getByTestId('theme-accent-scroll');
      const dragEvent = {
        nativeEvent: {
          contentOffset: { x: 192, y: 0 },
          contentSize: { width: 360, height: 82 },
          layoutMeasurement: { width: 340, height: 82 },
        },
      };
      const momentumEvent = {
        ...dragEvent,
        nativeEvent: {
          ...dragEvent.nativeEvent,
          contentOffset: { x: 288, y: 0 },
        },
      };

      await fireEvent(scroll, 'scrollEndDrag', dragEvent);
      await fireEvent(scroll, 'momentumScrollBegin', momentumEvent);
      await fireEvent(scroll, 'momentumScrollEnd', momentumEvent);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('purple');
      await act(async () => {
        finishSelect(true);
        await Promise.resolve();
      });
      expect(screen.getByTestId('theme-accent-purple').props.accessibilityState.selected)
        .toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ilk kayıt sürerken gelen son snap niyetini kaybetmeden seri uygular', async () => {
    let finishFirst!: (saved: boolean) => void;
    const first = new Promise<boolean>((resolve) => { finishFirst = resolve; });
    const onSelect = jest
      .fn<Promise<boolean>, [ThemeAccent]>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(true);
    const { screen } = await renderCarousel({ onSelect });

    await fireEvent.press(screen.getByTestId('theme-accent-blue'));
    await fireEvent.press(screen.getByTestId('theme-accent-red'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenNthCalledWith(1, 'blue');

    await act(async () => {
      finishFirst(true);
      await Promise.resolve();
    });

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
    expect(onSelect).toHaveBeenNthCalledWith(2, 'red');
    expect(screen.getByTestId('theme-accent-centered-label').props.children)
      .toBe('Yakut Kırmızısı');
  });

  it('ilk kayıt sürerken başlangıç rengine dönüş niyetini de seri uygular', async () => {
    let finishFirst!: (saved: boolean) => void;
    const first = new Promise<boolean>((resolve) => { finishFirst = resolve; });
    const onSelect = jest
      .fn<Promise<boolean>, [ThemeAccent]>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(true);
    const { screen } = await renderCarousel({ onSelect, selectedAccent: 'green' });

    await fireEvent.press(screen.getByTestId('theme-accent-blue'));
    await fireEvent.press(screen.getByTestId('theme-accent-green'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenNthCalledWith(1, 'blue');

    await act(async () => {
      finishFirst(true);
      await Promise.resolve();
    });

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
    expect(onSelect).toHaveBeenNthCalledWith(2, 'green');
    expect(screen.getByTestId('theme-accent-centered-label').props.children)
      .toBe('SPARK Yeşili');
  });

  it('yavaş sürükleme fallbacki başladıktan sonra gelen momentumun son niyetini korur', async () => {
    jest.useFakeTimers();
    try {
      let finishFirst!: (saved: boolean) => void;
      const onSelect = jest
        .fn<Promise<boolean>, [ThemeAccent]>()
        .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
        .mockResolvedValueOnce(true);
      const { screen } = await renderCarousel({ onSelect });
      const scroll = screen.getByTestId('theme-accent-scroll');

      await fireEvent(scroll, 'scrollEndDrag', {
        nativeEvent: { contentOffset: { x: 96, y: 0 } },
      });
      await act(async () => {
        jest.advanceTimersByTime(96);
        await Promise.resolve();
      });
      expect(onSelect).toHaveBeenCalledWith('blue');

      await fireEvent(scroll, 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: 288, y: 0 } },
      });
      await act(async () => {
        finishFirst(true);
        await Promise.resolve();
      });

      await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
      expect(onSelect).toHaveBeenLastCalledWith('purple');
    } finally {
      jest.useRealTimers();
    }
  });

  it('momentum oluşmayan yavaş sürüklemeyi kısa gecikmeden sonra kaydeder', async () => {
    jest.useFakeTimers();
    try {
      const onSelect = createOnSelect();
      const { screen } = await renderCarousel({ onSelect });
      const scroll = screen.getByTestId('theme-accent-scroll');

      await fireEvent(scroll, 'scrollEndDrag', {
        nativeEvent: {
          contentOffset: { x: 96, y: 0 },
          contentSize: { width: 360, height: 82 },
          layoutMeasurement: { width: 340, height: 82 },
        },
      });
      expect(onSelect).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(96);
        await Promise.resolve();
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('blue');
    } finally {
      jest.useRealTimers();
    }
  });

  it('kalıcı kayıt başarısızsa kanonik seçime geri döner', async () => {
    const onSelect = createOnSelect(false);
    const { screen } = await renderCarousel({ onSelect, selectedAccent: 'green' });

    await fireEvent.press(screen.getByTestId('theme-accent-red'));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('red'));
    await waitFor(() => {
      expect(screen.getByTestId('theme-accent-centered-label').props.children)
        .toBe('SPARK Yeşili');
      expect(screen.getByTestId('theme-accent-green').props.accessibilityState.selected)
        .toBe(true);
      expect(screen.getByTestId('theme-accent-red').props.accessibilityState.selected)
        .toBe(false);
    });
  });

  it('seçili ve devre dışı durumlarını erişilebilirlik API üzerinden bildirir', async () => {
    const onSelect = createOnSelect();
    const { screen } = await renderCarousel({
      onSelect,
      selectedAccent: 'orange',
      disabled: true,
    });

    expect(screen.getByTestId('theme-accent-orange').props.accessibilityState)
      .toEqual({ selected: true, disabled: true });
    expect(screen.getByTestId('theme-accent-green').props.accessibilityState)
      .toEqual({ selected: false, disabled: true });

    await fireEvent.press(screen.getByTestId('theme-accent-red'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('theme-accent-scroll').props.accessibilityState)
      .toEqual({ disabled: true });
  });

  it('ekran okuyucu artır/azalt eylemlerini sınırlarda taşırmadan kaydeder', async () => {
    const onSelect = createOnSelect();
    const { screen } = await renderCarousel({ onSelect, selectedAccent: 'green' });
    const scroll = screen.getByTestId('theme-accent-scroll');

    await fireEvent(scroll, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onSelect).not.toHaveBeenCalled();

    await fireEvent(scroll, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('blue'));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(mockDetentPlayer.play).not.toHaveBeenCalled();
  });

  it('kullanıcı her yeni renk kademesini geçtiğinde tek ve senkron detent geri bildirimi üretir', async () => {
    jest.useFakeTimers();
    try {
      const onSelect = createOnSelect();
      const { screen } = await renderCarousel({ onSelect });
      await act(async () => {
        await Promise.resolve();
      });
      expect(setAudioModeAsync).toHaveBeenCalled();
      const scroll = screen.getByTestId('theme-accent-scroll');

      await fireEvent(scroll, 'scrollBeginDrag', {
        nativeEvent: { contentOffset: { x: 0, y: 0 } },
      });
      const blue = { nativeEvent: { contentOffset: { x: 96, y: 0 } } };
      const orange = { nativeEvent: { contentOffset: { x: 192, y: 0 } } };
      await fireEvent.scroll(scroll, blue);
      await fireEvent.scroll(scroll, blue);
      await fireEvent.scroll(scroll, orange);
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
      expect(Haptics.impactAsync).toHaveBeenCalledWith('rigid');
      expect(mockDetentPlayer.play).toHaveBeenCalledTimes(2);
      expect(onSelect).not.toHaveBeenCalled();
      expect((Haptics.impactAsync as jest.Mock).mock.invocationCallOrder[0])
        .toBeLessThan(mockDetentPlayer.play.mock.invocationCallOrder[0]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('tek scroll karesinde üç yuva geçilirse üç kontrollü tak üretir', async () => {
    jest.useFakeTimers();
    try {
      const { screen } = await renderCarousel();
      await act(async () => { await Promise.resolve(); });
      const scroll = screen.getByTestId('theme-accent-scroll');
      await fireEvent(scroll, 'scrollBeginDrag', {
        nativeEvent: { contentOffset: { x: 0, y: 0 } },
      });
      await fireEvent.scroll(scroll, {
        nativeEvent: { contentOffset: { x: 288, y: 0 } },
      });
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
      expect(mockDetentPlayer.play).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Android dalında tok native context click ve güçlü fren kullanır', async () => {
    const ReactNative = require('react-native');
    const originalOs = ReactNative.Platform.OS;
    Object.defineProperty(ReactNative.Platform, 'OS', { value: 'android', configurable: true });
    try {
      const { screen } = await renderCarousel();
      await act(async () => { await Promise.resolve(); });
      await fireEvent.press(screen.getByTestId('theme-accent-blue'));
      expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith('context-click');
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
      expect(screen.getByTestId('theme-accent-scroll').props.decelerationRate).toBe(0.62);
    } finally {
      Object.defineProperty(ReactNative.Platform, 'OS', {
        value: originalOs,
        configurable: true,
      });
    }
  });

  it('tekrar kullanılan player seek tamamlanmadan sesi oynatmaz', async () => {
    let finishSeek!: () => void;
    mockDetentPlayer.currentStatus.currentTime = 0.045;
    mockDetentPlayer.seekTo.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishSeek = resolve; }),
    );
    const { screen } = await renderCarousel();
    await act(async () => { await Promise.resolve(); });

    await fireEvent.press(screen.getByTestId('theme-accent-blue'));
    expect(mockDetentPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockDetentPlayer.play).not.toHaveBeenCalled();

    await act(async () => {
      finishSeek();
      await Promise.resolve();
    });
    expect(mockDetentPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('ilk hizalama ve devre dışı seçim geri bildirim üretmez', async () => {
    const onSelect = createOnSelect();
    const { screen } = await renderCarousel({ onSelect, selectedAccent: 'orange', disabled: true });
    await waitFor(() => expect(setAudioModeAsync).toHaveBeenCalled());

    await fireEvent(screen.getByTestId('theme-accent-scroll'), 'scrollBeginDrag', {
      nativeEvent: { contentOffset: { x: 192, y: 0 } },
    });
    await fireEvent.scroll(screen.getByTestId('theme-accent-scroll'), {
      nativeEvent: { contentOffset: { x: 288, y: 0 } },
    });
    await fireEvent.press(screen.getByTestId('theme-accent-red'));

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(mockDetentPlayer.play).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
