import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CategoriesCard from '../CategoriesCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import type { CategorySpending } from '../../../db/schema';

jest.mock('react-native-reanimated', () => {
  const { View, Easing } = require('react-native');
  const { useRef } = require('react');
  return {
    __esModule: true,
    default: { View },
    Easing,
    ReduceMotion: { System: 'system' },
    useSharedValue: (value: unknown) => useRef({ value }).current,
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withTiming: (value: unknown) => value,
  };
});

jest.mock('../../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));
jest.mock('../../AnimatedCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children }: any) => React.createElement(View, null, children);
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: any) => React.createElement(Text, null, name) };
});

const food: CategorySpending = {
  category_id: 1, category_name: 'Food', category_icon: 'food', category_color: '#22AA88', total: 120, percentage: 60,
};
const travel: CategorySpending = {
  ...food, category_id: 2, category_name: 'Travel', total: 80, percentage: 40,
};
const groceries: CategorySpending = { ...food, category_id: 11, category_name: 'Groceries', percentage: 100 };
const bus: CategorySpending = { ...travel, category_id: 21, category_name: 'Bus', percentage: 100 };
const base = {
  styles: getAnalyticsStyles(), t: (key: string) => key, tc: (key: string) => key, currency: 'PLN' as const,
  categories: [food, travel],
};

function InteractiveCard() {
  const [selected, setSelected] = useState<number | null>(null);
  return <CategoriesCard {...base} selectedCategory={selected} setSelectedCategory={setSelected}
    subcats={selected === 1 ? [groceries] : selected === 2 ? [bus] : []} />;
}

describe('CategoriesCard disclosure', () => {
  it('opens, switches directly and collapses; hidden rows are excluded from accessibility', async () => {
    const screen = await render(<InteractiveCard />);
    expect(screen.queryByText('subcategories')).toBeNull();
    await fireEvent.press(screen.getByTestId('category-option-1'));
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByTestId('category-option-1').props.accessibilityState).toEqual({ selected: true, expanded: true });

    await fireEvent.press(screen.getByTestId('category-option-2'));
    expect(screen.getByText('Bus')).toBeTruthy();
    expect(screen.queryByText('Groceries')).toBeNull();
    expect(screen.getByTestId('category-option-1').props.accessibilityState.expanded).toBe(false);

    await fireEvent.press(screen.getByTestId('category-option-2'));
    expect(screen.queryByText('Bus')).toBeNull();
    // Retained visually for the closing fade, but immediately hidden from assistive technology.
    expect(screen.getByText('Bus', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('category-breakdown', { includeHiddenElements: true }).props.pointerEvents).toBe('none');
    await fireEvent.press(screen.getByTestId('category-option-1'));
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.queryByText('Bus')).toBeNull();
  });

  it('updates late query results and preserves the empty state without losing selection', async () => {
    const onSelect = jest.fn();
    const screen = await render(<CategoriesCard {...base} selectedCategory={1} setSelectedCategory={onSelect} subcats={[]} />);
    expect(screen.getByText('no_sub_categories')).toBeTruthy();
    await screen.rerender(<CategoriesCard {...base} selectedCategory={1} setSelectedCategory={onSelect} subcats={[groceries]} />);
    expect(screen.queryByText('no_sub_categories')).toBeNull();
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
