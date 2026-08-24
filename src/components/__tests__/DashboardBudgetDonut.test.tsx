import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import DashboardBudgetDonut from '../DashboardBudgetDonut';

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

const labels: Record<string, string> = {
  donut_center_clear: 'Kategori seçimini kapat',
  donut_budget_used: 'kullanıldı',
  donut_open_categories: 'Kategori dağılımını genişlet',
  donut_close_categories: 'Bütçe görünümüne dön',
  donut_select_first_category: 'İlk kategoriyi seç',
  donut_previous_category: 'Önceki kategori',
  donut_next_category: 'Sonraki kategori',
  donut_spending_share: 'Harcamaların {spending}%’si',
  donut_spending_budget_share: 'Harcamaların {spending}%’si · bütçenin {budget}%’si',
};

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    tc: (value: string) => value,
    t: (key: string, params?: Record<string, string | number>) => {
      let value = labels[key] ?? key;
      Object.entries(params ?? {}).forEach(([name, replacement]) => {
        value = value.replace(`{${name}}`, String(replacement));
      });
      return value;
    },
  }),
}));

jest.mock('../DonutChart', () => {
  const ReactLocal = require('react');
  const { Pressable: PressableLocal, View: ViewLocal } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => ReactLocal.createElement(
      ViewLocal,
      {
        testID: 'mock-donut',
        totalValue: props.totalValue,
        showTrackGlassEdge: props.showTrackGlassEdge,
        segmentValues: props.segments.map((segment: any) => segment.value),
      },
      props.innerContent,
      props.segments.map((_: unknown, index: number) => ReactLocal.createElement(
        PressableLocal,
        {
          key: index,
          testID: `mock-donut-segment-${index}`,
          onPress: () => props.onSelect?.(index),
        },
      )),
    ),
  };
});

const categories = [
  {
    category_id: 1,
    category_name: 'Faturalar',
    category_icon: 'receipt',
    category_color: '#ffcc00',
    total: 180,
    percentage: 92,
  },
  {
    category_id: 2,
    category_name: 'Yeme-İçme',
    category_icon: 'food',
    category_color: '#00ccff',
    total: 12,
    percentage: 6,
  },
  {
    category_id: 3,
    category_name: 'Eğlence',
    category_icon: 'gamepad',
    category_color: '#9d00ff',
    total: 4.49,
    percentage: 2,
  },
];

describe('DashboardBudgetDonut', () => {
  it('bütçeyi tam halka paydası yapar ve merkezde gerçek kullanım oranını gösterir', async () => {
    const screen = await render(
      <DashboardBudgetDonut
        categories={categories}
        totalSpent={196.49}
        effectiveBudget={3260}
        currency="PLN"
        periodKey="2026-08-22:2026-09-21"
      />,
    );

    expect(screen.getByTestId('mock-donut').props.totalValue).toBe(3260);
    expect(screen.getByTestId('mock-donut').props.showTrackGlassEdge).toBe(true);
    expect(screen.getByText('%6')).toBeTruthy();
    expect(screen.getByText('kullanıldı')).toBeTruthy();
    expect(screen.getByTestId(
      'dashboard-donut-expand-affordance',
      { includeHiddenElements: true },
    )).toBeTruthy();
    expect(screen.getByLabelText('Kategori dağılımını genişlet')).toBeTruthy();
  });

  it('merkezden kategori odağına geçince eski 360 derece dağılımı geri getirir', async () => {
    const screen = await render(
      <DashboardBudgetDonut
        categories={categories}
        totalSpent={196.49}
        effectiveBudget={3260}
        currency="PLN"
        periodKey="2026-08-22:2026-09-21"
      />,
    );

    await fireEvent.press(screen.getByTestId('dashboard-donut-center'));

    expect(screen.getByTestId('mock-donut').props.totalValue).toBeUndefined();
    expect(screen.getByLabelText('Bütçe görünümüne dön')).toBeTruthy();
    expect(screen.queryByTestId(
      'dashboard-donut-expand-affordance',
      { includeHiddenElements: true },
    )).toBeNull();
  });

  it('çok küçük kategoriye doğrudan ve önceki/sonraki kontrolleriyle eriştirir', async () => {
    const screen = await render(
      <DashboardBudgetDonut
        categories={categories}
        totalSpent={196.49}
        effectiveBudget={3260}
        currency="PLN"
        periodKey="2026-08-22:2026-09-21"
      />,
    );

    await fireEvent.press(screen.getByTestId('mock-donut-segment-2'));

    expect(screen.getByText('Eğlence')).toBeTruthy();
    expect(screen.getByText('4,49 zł')).toBeTruthy();
    expect(screen.getByText('Harcamaların 2%’si · bütçenin 0,1%’si')).toBeTruthy();
    expect(screen.getByTestId('mock-donut').props.totalValue).toBeUndefined();

    await fireEvent.press(screen.getByTestId('dashboard-donut-next'));
    expect(screen.getByText('Faturalar')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-donut-previous'));
    expect(screen.getByText('Eğlence')).toBeTruthy();
  });

  it('bütçe aşıldığında renkli dilimleri kesmeden gerçek aşım yüzdesini gösterir', async () => {
    const screen = await render(
      <DashboardBudgetDonut
        categories={[{ ...categories[0], total: 120 }]}
        totalSpent={120}
        effectiveBudget={100}
        currency="PLN"
        periodKey="2026-08-22:2026-09-21"
      />,
    );

    expect(screen.getByTestId('mock-donut').props.totalValue).toBe(100);
    expect(screen.getByText('%120')).toBeTruthy();
  });

  it('bütçe yoksa mevcut kategori dağılımı davranışını korur', async () => {
    const screen = await render(
      <DashboardBudgetDonut
        categories={categories}
        totalSpent={196.49}
        effectiveBudget={0}
        currency="PLN"
        periodKey="2026-08-22:2026-09-21"
      />,
    );

    expect(screen.getByTestId('mock-donut').props.totalValue).toBeUndefined();
    await fireEvent.press(screen.getByTestId('dashboard-donut-center'));
    expect(screen.getByText('Faturalar')).toBeTruthy();
    expect(screen.getByText('Harcamaların 92%’si')).toBeTruthy();
  });

  it('harcama kategorisi yoksa bütçe rayını boş ve merkezi salt bilgi olarak bırakır', async () => {
    const screen = await render(
      <DashboardBudgetDonut
        categories={[]}
        totalSpent={0}
        effectiveBudget={3260}
        currency="PLN"
        periodKey="2026-08-22:2026-09-21"
      />,
    );

    expect(screen.getByTestId('mock-donut').props.totalValue).toBe(3260);
    expect(screen.getByText('%0')).toBeTruthy();
    expect(screen.getByLabelText('%0 kullanıldı').props.accessibilityRole).toBe('text');
  });
});
