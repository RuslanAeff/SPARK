import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import CategoryPill from '../CategoryPill';

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
}));

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      ReactLocal.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

describe('CategoryPill', () => {
  it('ikonun altında kategori adını ve yüzdesini gösterir', async () => {
    const screen = await render(
      <CategoryPill
        name="Yeme-İçme"
        icon="food"
        color="#00FF66"
        percentage={24}
      />,
    );

    expect(screen.getByText('Yeme-İçme')).toBeTruthy();
    expect(screen.getByText('24%')).toBeTruthy();
    expect(screen.getByLabelText('Yeme-İçme, 24%')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('Yeme-İçme').props.style).minHeight).toBeUndefined();
  });

  it('uzun kategori adını iki satırla sınırlar ve tam adı erişilebilir etikette korur', async () => {
    const screen = await render(
      <CategoryPill
        name="Diğer Uzun Harcamalar"
        icon="shape"
        color="#A0A0B0"
        percentage={7}
      />,
    );

    expect(screen.getByText('Diğer Uzun Harcamalar').props.numberOfLines).toBe(2);
    expect(screen.getByLabelText('Diğer Uzun Harcamalar, 7%')).toBeTruthy();
  });

  it('etkileşim verildiğinde erişilebilir düğme olarak çalışır', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <CategoryPill
        name="Faturalar"
        icon="receipt"
        color="#FFCC00"
        percentage={50}
        onPress={onPress}
      />,
    );

    const pill = screen.getByRole('button', { name: 'Faturalar, 50%' });
    fireEvent.press(pill);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
