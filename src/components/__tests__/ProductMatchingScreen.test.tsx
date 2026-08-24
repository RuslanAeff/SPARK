import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import ProductMatchingScreen from '../../../app/product-matching';
import {
  ProductIdentityDao,
  type CanonicalProductSummary,
  type ProductAliasSummary,
} from '../../db/productIdentityDao';
import { suggestProductMatch } from '../../services/geminiService';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../theme/themeStore', () => {
  const { resolveTheme } = jest.requireActual('../../theme/colors');
  return {
    useAppTheme: () => 'dark',
    useThemePalette: () => resolveTheme('dark', 'green'),
  };
});

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        key,
      );
    },
  }),
}));

jest.mock('../../db/productIdentityDao', () => ({
  ProductIdentityDao: {
    getProductSummaries: jest.fn(),
    getAliases: jest.fn(),
    mergeProducts: jest.fn(),
    splitAlias: jest.fn(),
    renameProduct: jest.fn(),
  },
}));

jest.mock('../../services/geminiService', () => ({
  suggestProductMatch: jest.fn(),
}));

jest.mock('../SparkToast', () => ({
  SparkToast: { show: jest.fn() },
}));

jest.mock('../ConfirmModal', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return ({ visible, title, message, confirmLabel, onConfirm }: any) => visible
    ? React.createElement(
        View,
        { testID: `modal-${title}` },
        React.createElement(Text, null, message),
        React.createElement(
          Pressable,
          { testID: `confirm-${confirmLabel}`, onPress: onConfirm },
          React.createElement(Text, null, confirmLabel),
        ),
      )
    : null;
});

jest.mock('../BottomSheetModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: any) => visible
    ? React.createElement(View, { testID: 'bottom-sheet' }, children)
    : null;
});

function summary(
  id: number,
  canonicalName: string,
  measurementUnit: CanonicalProductSummary['measurement_unit'],
  overrides: Partial<CanonicalProductSummary> = {},
): CanonicalProductSummary {
  return {
    id,
    uid: `product-${id}`,
    canonical_name: canonicalName,
    canonical_key: canonicalName.toLocaleLowerCase('tr-TR'),
    measurement_unit: measurementUnit,
    brand: null,
    variant: null,
    package_descriptor: null,
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z',
    alias_count: 1,
    observation_count: 1,
    latest_date: '2026-08-17',
    alias_search_text: null,
    raw_search_text: null,
    translated_search_text: null,
    user_label_search_text: null,
    ...overrides,
  };
}

const products: CanonicalProductSummary[] = [
  summary(1, 'Tavuk Baget', 'kg', {
    alias_count: 2,
    observation_count: 4,
    latest_date: '2026-08-20',
  }),
  summary(2, 'Tavuk Baget Kg', 'kg', {
    observation_count: 2,
    latest_date: '2026-08-18',
  }),
  summary(3, 'Yoğurt 500 g', 'piece'),
  summary(4, 'Geçmişsiz Ekmek', 'piece', { latest_date: null }),
];

const aliases: ProductAliasSummary[] = [
  {
    id: 11,
    canonical_product_id: 1,
    normalized_alias: 'tavuk baget kg',
    measurement_unit: 'kg',
    source: 'user',
    confidence: 1,
    created_at: '2026-08-20T12:00:00.000Z',
    observation_count: 2,
    example_name: 'Tavuk Baget Kg',
  },
];

describe('ProductMatchingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ProductIdentityDao.getProductSummaries as jest.Mock).mockResolvedValue(products);
    (ProductIdentityDao.getAliases as jest.Mock).mockResolvedValue(aliases);
    (ProductIdentityDao.mergeProducts as jest.Mock).mockResolvedValue(undefined);
    (ProductIdentityDao.splitAlias as jest.Mock).mockResolvedValue(4);
    (ProductIdentityDao.renameProduct as jest.Mock).mockResolvedValue(undefined);
    (suggestProductMatch as jest.Mock).mockResolvedValue({
      sameProduct: true,
      confidence: 0.92,
      canonicalName: 'Tavuk Baget',
      reason: 'Aynı kesim ve ölçü birimi.',
    });
  });

  it('shows a small local review queue without calling AI automatically', async () => {
    const screen = await render(<ProductMatchingScreen />);
    await waitFor(() => expect(screen.getByTestId('product-review-pair-1-2')).toBeTruthy());

    const virtualizedList = screen.getByTestId('product-matching-list');
    expect(virtualizedList.props.initialNumToRender).toBe(8);
    expect(virtualizedList.props.maxToRenderPerBatch).toBe(8);
    expect(virtualizedList.props.windowSize).toBe(7);
    expect(screen.queryByTestId('product-select-3')).toBeNull();
    expect(suggestProductMatch).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('product-review-pair-1-2'));
    expect(screen.getByTestId('product-merge-button')).toBeTruthy();
  });

  it('hides incompatible units after the first selection and merges under the chosen name', async () => {
    const screen = await render(<ProductMatchingScreen />);
    await fireEvent.press(screen.getByTestId('product-view-all'));
    await waitFor(() => expect(screen.getByTestId('product-select-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('product-select-1'));
    expect(screen.getByTestId('product-selected-banner')).toBeTruthy();
    expect(screen.queryByTestId('product-select-3')).toBeNull();

    await fireEvent.press(screen.getByTestId('product-select-2'));
    expect(screen.getByTestId('product-merge-button')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('keep-product-2'));
    await fireEvent.press(screen.getByTestId('product-merge-button'));
    await fireEvent.press(screen.getByTestId('confirm-product_match_merge_confirm_cta'));

    await waitFor(() => expect(ProductIdentityDao.mergeProducts).toHaveBeenCalledWith(1, 2));
    expect(ProductIdentityDao.getProductSummaries).toHaveBeenCalledTimes(2);
  });

  it('expands learned aliases and separates one without deleting its observations', async () => {
    const screen = await render(<ProductMatchingScreen />);
    await fireEvent.press(screen.getByTestId('product-view-all'));
    await waitFor(() => expect(screen.getByTestId('toggle-aliases-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('toggle-aliases-1'));
    await waitFor(() => expect(screen.getByTestId('split-alias-11')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('split-alias-11'));
    await fireEvent.press(screen.getByTestId('confirm-product_match_split_confirm_cta'));

    await waitFor(() => expect(ProductIdentityDao.splitAlias).toHaveBeenCalledWith(11));
    expect(ProductIdentityDao.getAliases).toHaveBeenCalledWith(1);
  });

  it('renames only the preferred display name and keeps AI output advisory', async () => {
    const screen = await render(<ProductMatchingScreen />);
    await fireEvent.press(screen.getByTestId('product-view-all'));
    await waitFor(() => expect(screen.getByTestId('rename-product-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('rename-product-1'));
    await fireEvent.changeText(screen.getByTestId('product-rename-input'), 'Tavuk Baget Tercihim');
    await fireEvent.press(screen.getByTestId('product-rename-save'));
    await waitFor(() => expect(ProductIdentityDao.renameProduct)
      .toHaveBeenCalledWith(1, 'Tavuk Baget Tercihim'));

    await fireEvent.press(screen.getByTestId('product-view-review'));
    await fireEvent.press(screen.getByTestId('product-review-pair-1-2'));
    await fireEvent.press(screen.getByTestId('product-ai-button'));

    await waitFor(() => expect(suggestProductMatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tavuk Baget', measurementUnit: 'kg' }),
      expect.objectContaining({ name: 'Tavuk Baget Kg', measurementUnit: 'kg' }),
      expect.any(AbortSignal),
    ));
    expect(await screen.findByTestId('product-ai-result')).toBeTruthy();
    expect(ProductIdentityDao.mergeProducts).not.toHaveBeenCalled();
  });

  it('groups all products by activity and combines unit and history filters', async () => {
    const screen = await render(<ProductMatchingScreen />);
    await fireEvent.press(screen.getByTestId('product-view-all'));

    await waitFor(() => expect(screen.getByText('product_match_time_recent_30')).toBeTruthy());
    expect(screen.getByText('product_match_time_no_history')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('product-filter-button'));
    await fireEvent.press(screen.getByTestId('product-unit-filter-piece'));
    await fireEvent.press(screen.getByTestId('product-date-filter-none'));
    await fireEvent.press(screen.getByTestId('product-filter-close'));

    await waitFor(() => expect(screen.getByTestId('product-select-4')).toBeTruthy());
    expect(screen.queryByTestId('product-select-1')).toBeNull();
    expect(screen.queryByTestId('product-select-3')).toBeNull();

    await fireEvent.press(screen.getByTestId('product-clear-filters'));
    await waitFor(() => expect(screen.getByTestId('product-select-1')).toBeTruthy());
  });
});
