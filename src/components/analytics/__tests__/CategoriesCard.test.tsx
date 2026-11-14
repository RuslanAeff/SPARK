import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
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
    subcats={selected === 1 ? [groceries] : selected === 2 ? [bus] : []} subcatsParentId={selected} />;
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

  it('stays closed until the selected category result arrives, then shows rows or the empty state', async () => {
    const onSelect = jest.fn();
    const props = { ...base, selectedCategory: 1, setSelectedCategory: onSelect };
    const screen = await render(<CategoriesCard {...props} subcats={[]} subcatsParentId={null} />);
    // Query pending: no premature empty panel that would later grow a second time.
    expect(screen.queryByText('no_sub_categories')).toBeNull();
    expect(screen.getByTestId('category-breakdown', { includeHiddenElements: true }).props.pointerEvents).toBe('none');

    await screen.rerender(<CategoriesCard {...props} subcats={[groceries]} subcatsParentId={1} />);
    expect(screen.getByText('Groceries')).toBeTruthy();

    await screen.rerender(<CategoriesCard {...props} subcats={[]} subcatsParentId={1} />);
    expect(screen.queryByText('Groceries')).toBeNull();
    expect(screen.getByText('no_sub_categories')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the previous rows open while switching until the new result arrives', async () => {
    const props = { ...base, setSelectedCategory: jest.fn() };
    const screen = await render(<CategoriesCard {...props} selectedCategory={1} subcats={[groceries]} subcatsParentId={1} />);
    await screen.rerender(<CategoriesCard {...props} selectedCategory={2} subcats={[groceries]} subcatsParentId={1} />);
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByTestId('category-breakdown').props.pointerEvents).toBe('auto');

    await screen.rerender(<CategoriesCard {...props} selectedCategory={2} subcats={[bus]} subcatsParentId={2} />);
    expect(screen.getByText('Bus')).toBeTruthy();
    expect(screen.queryByText('Groceries')).toBeNull();
  });

  it('animates height only towards the measurement of the current content', async () => {
    const one = [groceries];
    const both = [groceries, { ...groceries, category_id: 12, category_name: 'Snacks' }];
    // A fresh `t` defeats React.memo so the test reads the style after the effect ran.
    const card = (rows: CategorySpending[]) => (
      <CategoriesCard {...base} t={(key: string) => key} setSelectedCategory={jest.fn()}
        selectedCategory={1} subcats={rows} subcatsParentId={1} />
    );
    const screen = await render(card(one));
    const viewportHeight = () =>
      StyleSheet.flatten(screen.getByTestId('category-breakdown', { includeHiddenElements: true }).props.style).height;
    const layout = (height: number) => fireEvent(
      screen.getByTestId('category-breakdown-content', { includeHiddenElements: true }),
      'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } },
    );
    await screen.rerender(card(one));
    // Not measured yet: no animation towards a guessed or stale height.
    expect(viewportHeight()).toBe(0);

    await layout(120);
    await screen.rerender(card(one));
    expect(viewportHeight()).toBe(120);

    // New content keeps the current height until it reports its own size.
    await screen.rerender(card(both));
    await screen.rerender(card(both));
    expect(viewportHeight()).toBe(120);
    await layout(200);
    await screen.rerender(card(both));
    expect(viewportHeight()).toBe(200);
  });
});
