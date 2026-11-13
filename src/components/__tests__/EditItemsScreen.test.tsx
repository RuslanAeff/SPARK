import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import EditItemsScreen from '../../../app/edit-items';
import { ExpenseDao } from '../../db/expenseDao';
import { SparkToast } from '../SparkToast';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '9' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    getById: jest.fn(),
    addItemAndSyncTotal: jest.fn(),
    updateItemAndSyncTotal: jest.fn(),
    deleteItemAndSyncTotal: jest.fn(),
  },
}));
jest.mock('../../theme/themeStore', () => ({ useThemeRevision: () => 0, useAppTheme: () => 'light' }));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key, tc: (v: string) => v }) }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'PLN' }) }));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../GlassDeleteModal', () => () => null);
jest.mock('../ConfirmModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return ({ visible, onConfirm, onCancel }: any) => (visible
    ? React.createElement(View, { testID: 'edit-items-total-confirm' },
      React.createElement(Pressable, { testID: 'edit-items-total-ok', onPress: onConfirm }),
      React.createElement(Pressable, { testID: 'edit-items-total-cancel', onPress: onCancel }))
    : null);
});

const addItem = ExpenseDao.addItemAndSyncTotal as jest.Mock;
const toastShow = SparkToast.show as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function pressHandler(element: any): () => unknown {
  for (let node = element; node; node = node.parent) {
    if (typeof node.props?.onPress === 'function') return node.props.onPress;
  }
  for (let fiber = element.unstable_fiber; fiber; fiber = fiber.return) {
    if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress;
  }
  throw new Error('Press handler not found');
}

async function fillForm(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(screen.getByPlaceholderText('product_name_placeholder'), 'Chleb');
  await fireEvent.changeText(screen.getByPlaceholderText(/^unit_price_placeholder/), '4');
}

describe('EditItemsScreen (BUG-29)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ExpenseDao.getById as jest.Mock).mockResolvedValue({ id: 9, currency: 'PLN', items: [] });
  });

  it('hızlı çift dokunuşta aynı kalemi bir kez ekler', async () => {
    const pending = deferred<number>();
    addItem.mockImplementation(() => pending.promise);
    const screen = await render(<EditItemsScreen />);
    await waitFor(() => expect(ExpenseDao.getById).toHaveBeenCalled());
    await fillForm(screen);

    const onPress = pressHandler(screen.getByTestId('edit-items-save'));
    let taps!: Promise<unknown>;
    await act(async () => {
      taps = Promise.all([onPress(), onPress()]);
      await Promise.resolve();
    });
    await act(async () => {
      pending.resolve(1);
      await taps;
    });

    expect(addItem).toHaveBeenCalledTimes(1);
  });

  it('kupon sınırı ihlalinde nedenini söyleyen mesajı gösterir', async () => {
    addItem.mockRejectedValue(new Error('INVALID_CONTAINER_RECOVERY'));
    const screen = await render(<EditItemsScreen />);
    await waitFor(() => expect(ExpenseDao.getById).toHaveBeenCalled());
    await fillForm(screen);

    await act(async () => {
      fireEvent.press(screen.getByTestId('edit-items-save'));
    });

    await waitFor(() => expect(toastShow).toHaveBeenCalledWith('item_voucher_exceeds_total', 'error'));
  });
});

describe('EditItemsScreen receipt total confirmation (BUG-03)', () => {
  const item = {
    id: 1, expense_id: 9, name: 'MLEKO', turkish_name: 'Süt', user_label: null,
    quantity: 2, measurement_unit: 'piece', unit_price: 15, total_price: 30,
    line_discount: 0, list_line_total_before_discount: null, financial_kind: 'product',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Basılı toplam 38.80, kalemler 30.00 (yapay zekâ bir satırı atladı).
    (ExpenseDao.getById as jest.Mock).mockResolvedValue({ id: 9, currency: 'PLN', total_amount: 38.8, items: [item] });
    (ExpenseDao as any).updateItemLabel = jest.fn();
  });

  it('shows the gap between printed total and item total', async () => {
    const screen = await render(<EditItemsScreen />);
    expect(await screen.findByTestId('edit-items-header-diff')).toBeTruthy();
  });

  it('a name-only fix writes just the label and never asks or changes the total', async () => {
    const screen = await render(<EditItemsScreen />);
    await act(async () => { fireEvent.press(await screen.findByText('pencil-outline')); });
    await fireEvent.changeText(screen.getByPlaceholderText('product_name_placeholder'), 'Mleko 3.2%');
    await act(async () => { fireEvent.press(screen.getByTestId('edit-items-save')); });

    expect((ExpenseDao as any).updateItemLabel).toHaveBeenCalledWith(9, 1, 'Mleko 3.2%');
    expect(ExpenseDao.updateItemAndSyncTotal).not.toHaveBeenCalled();
    expect(screen.queryByTestId('edit-items-total-confirm')).toBeNull();
  });

  it('asks before a price change that changes the printed total and saves nothing on cancel', async () => {
    const screen = await render(<EditItemsScreen />);
    await act(async () => { fireEvent.press(await screen.findByText('pencil-outline')); });
    await fireEvent.changeText(screen.getByPlaceholderText(/^unit_price_placeholder/), '16');
    await act(async () => { fireEvent.press(screen.getByTestId('edit-items-save')); });

    expect(await screen.findByTestId('edit-items-total-confirm')).toBeTruthy();
    expect(ExpenseDao.updateItemAndSyncTotal).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(screen.getByTestId('edit-items-total-cancel')); });
    expect(ExpenseDao.updateItemAndSyncTotal).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(screen.getByTestId('edit-items-save')); });
    await act(async () => { fireEvent.press(await screen.findByTestId('edit-items-total-ok')); });
    expect(ExpenseDao.updateItemAndSyncTotal).toHaveBeenCalledWith(9, 1, expect.objectContaining({ total_price: 32 }));
  });
});
