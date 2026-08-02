import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import LineChart, {
  formatLineChartAxisValue,
  getLineChartMarkerIndices,
  getLineChartXLabelIndices,
  type LinePoint,
} from '../LineChart';

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      chart_point_hint: 'Fiyat ayrıntısı için grafikte bir noktaya dokunun',
      chart_point_select_hint: 'Fiyat ayrıntısını gösterir',
      chart_point_hide_hint: 'Seçili fiyat ayrıntısını kapatır',
      chart_clear_selection: 'Grafik seçimini kapat',
      chart_accessibility_label: 'Fiyat geçmişi grafiği',
      chart_accessibility_hint: 'Gözlemler arasında ilerlemek için yukarı veya aşağı kaydırın',
      chart_previous_point: 'Önceki fiyat gözlemi',
      chart_next_point: 'Sonraki fiyat gözlemi',
      no_data_found: 'Veri bulunamadı.',
    } as Record<string, string>)[key] ?? key,
  }),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  getAppThemeSnapshot: () => 'light',
}));

const data: LinePoint[] = [
  { label: '13/06', value: 9.75, meta: 'Market A' },
  { label: '24/07', value: 6.5, meta: 'Market A' },
];

describe('LineChart price inspection', () => {
  it('shows precise details outside the plot and toggles the same point off', async () => {
    const screen = await render(<LineChart data={data} currency="PLN" />);

    expect(screen.getByTestId('line-chart-selection-hint')).toBeTruthy();
    expect(screen.queryByTestId('line-chart-selection')).toBeNull();

    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: 0 },
    });

    const selection = screen.getByTestId('line-chart-selection');
    expect(screen.getByText('9,75 zł')).toBeTruthy();
    expect(screen.getByText('Market A')).toBeTruthy();
    expect(StyleSheet.flatten(selection.props.style).position).not.toBe('absolute');

    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: 0 },
    });

    expect(screen.queryByTestId('line-chart-selection')).toBeNull();
  });

  it('moves one inspection state to another point and exposes its semantics', async () => {
    const screen = await render(<LineChart data={data} currency="PLN" />);

    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: 0 },
    });
    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: 260 },
    });

    expect(screen.queryByText('9,75 zł')).toBeNull();
    expect(screen.getByText('6,50 zł')).toBeTruthy();
    expect(screen.getByTestId('line-chart-plot').props.accessibilityValue.text).toContain('24/07');
    expect(screen.getByTestId('line-chart-plot').props.accessibilityValue.text).toContain('6,50 zł');
  });

  it('clears selection through the explicit action', async () => {
    const screen = await render(<LineChart data={data} currency="PLN" />);

    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: 0 },
    });
    await fireEvent.press(screen.getByTestId('line-chart-clear-selection'));

    expect(screen.queryByTestId('line-chart-selection')).toBeNull();
    expect(screen.queryByLabelText('Grafik seçimini kapat')).toBeNull();
    expect(screen.getByTestId('line-chart-selection-hint')).toBeTruthy();
  });

  it('does not carry an old selection into a new data set', async () => {
    const screen = await render(<LineChart data={data} currency="PLN" />);

    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: 0 },
    });
    expect(screen.getByTestId('line-chart-selection')).toBeTruthy();

    await screen.rerender(
      <LineChart
        data={[{ label: '01/08', value: 7.49, meta: 'Carrefour' }]}
        currency="PLN"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('line-chart-selection')).toBeNull();
    });
  });

  it('kaynak gözlem konumunu korur ve tek geniş yüzeyden en yakın noktayı seçer', async () => {
    const positionedData: LinePoint[] = [
      { label: '01/01', value: 5, position: 0 },
      { label: '02/01', value: 6, position: 1 },
      { label: '21/01', value: 9, position: 20 },
      { label: '20/03', value: 7, position: 79 },
    ];
    const screen = await render(<LineChart data={positionedData} currency="PLN" />);

    expect(screen.getByTestId('line-chart-marker-0').props.cx).toBe(44);
    expect(screen.getByTestId('line-chart-marker-1').props.cx).toBeCloseTo(44 + (1 / 79) * 260, 4);
    expect(screen.getByTestId('line-chart-marker-2').props.cx).toBeCloseTo(44 + (20 / 79) * 260, 4);
    expect(screen.getByTestId('line-chart-marker-3').props.cx).toBe(304);
    expect(screen.getAllByTestId('line-chart-plot')).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: (20 / 79) * 260 },
    });
    expect(screen.getByText('21/01')).toBeTruthy();
    expect(screen.getByText('9,00 zł')).toBeTruthy();
  });

  it('yakın tarih etiketlerini piksel aralığıyla ayıklar ve kenarları içe hizalar', async () => {
    expect(getLineChartXLabelIndices([44, 173.3, 174.6, 304], 56)).toEqual([0, 1, 3]);

    const screen = await render(
      <LineChart
        data={[
          { label: '01/01/25', value: 5, position: 0 },
          { label: '09/04/25', value: 6, position: 99 },
          { label: '10/04/25', value: 7, position: 100 },
          { label: '19/07/25', value: 8, position: 199 },
        ]}
        currency="PLN"
      />,
    );

    expect(screen.getByTestId('line-chart-x-label-0').props.font.textAnchor).toBe('start');
    expect(screen.getByTestId('line-chart-x-label-1')).toBeTruthy();
    expect(screen.queryByTestId('line-chart-x-label-2')).toBeNull();
    expect(screen.getByTestId('line-chart-x-label-3').props.font.textAnchor).toBe('end');
  });

  it('yoğun seride yalnız görsel işaretleri seyreltir, tüm gözlem hedeflerini korur', async () => {
    const denseData = Array.from({ length: 40 }, (_, index): LinePoint => ({
      label: `${String(index + 1).padStart(2, '0')}/07`,
      value: index === 17 ? 20 : 7 + (index % 3),
      meta: 'Market A',
    }));
    const markerIndexes = getLineChartMarkerIndices(denseData);
    const screen = await render(<LineChart data={denseData} currency="PLN" />);

    expect(markerIndexes).toHaveLength(12);
    expect(markerIndexes).toContain(0);
    expect(markerIndexes).toContain(17);
    expect(markerIndexes).toContain(39);
    expect(screen.getAllByTestId(/^line-chart-marker-/)).toHaveLength(12);
    const hiddenMarkerIndex = denseData.findIndex((_, index) => !markerIndexes.includes(index));
    await fireEvent.press(screen.getByTestId('line-chart-plot'), {
      nativeEvent: { locationX: (hiddenMarkerIndex / (denseData.length - 1)) * 260 },
    });
    expect(screen.getByTestId(`line-chart-marker-${hiddenMarkerIndex}`)).toBeTruthy();
  });

  it('ekran okuyucu ayarlanabilir eylemleriyle gözlemler arasında ilerler', async () => {
    const screen = await render(<LineChart data={data} currency="PLN" />);
    const plot = screen.getByTestId('line-chart-plot');

    await fireEvent(plot, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(screen.getByText('9,75 zł')).toBeTruthy();

    await fireEvent(plot, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(screen.getByText('6,50 zł')).toBeTruthy();
  });

  it('keeps useful axis precision for narrow and compact price ranges', () => {
    expect(formatLineChartAxisValue(100.2, 0.13, 'PLN')).toBe('100,20');
    expect(formatLineChartAxisValue(1250, 325, 'PLN')).toBe('1,3K');
  });
});
