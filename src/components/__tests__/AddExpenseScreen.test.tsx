import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import AddExpenseScreen from '../../../app/add-expense';
import { ExpenseDao } from '../../db/expenseDao';
import { SparkToast } from '../SparkToast';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockTriggerRefresh = jest.fn();
let mockParams: { id?: string; voucherId?: string } = {};

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ back: mockBack, replace: mockReplace, push: mockPush }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getById: jest.fn(),
  },
}));
jest.mock('../../db/categoryDao', () => ({
  CategoryDao: { getAll: jest.fn(async () => []) },
}));
jest.mock('../../db/vendorDao', () => ({
  VendorDao: { findOrCreate: jest.fn(), findByName: jest.fn(async () => null) },
}));
jest.mock('../../db/containerDepositDao', () => ({
  ContainerDepositDao: { syncPurchaseRecovery: jest.fn(), getById: jest.fn() },
}));
jest.mock('../../db/database', () => ({
  getDatabase: jest.fn(async () => ({
    withTransactionAsync: async (work: () => Promise<void>) => work(),
  })),
}));
jest.mock('../../notifications/receiptNotifications', () => ({
  refreshReceiptSavedNotification: jest.fn(),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    tc: (value: string) => value,
  }),
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
  CURRENCY_META: { PLN: { symbol: 'zł' } },
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: mockTriggerRefresh }),
}));

jest.mock('../SparkToast', () => ({
  SparkToast: { show: jest.fn() },
}));

jest.mock('../CustomDatePicker', () => () => null);

jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return ({ visible, onDelete }: any) =>
    visible
      ? React.createElement(View, null,
        React.createElement(Pressable, { testID: 'confirm-expense-delete', onPress: onDelete }))
      : null;
});

const create = ExpenseDao.create as jest.Mock;
const remove = ExpenseDao.delete as jest.Mock;
const getById = ExpenseDao.getById as jest.Mock;
const toastShow = SparkToast.show as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Pressable'ın onPress'ini React yeniden çizmeden iki kez çağırır (gerçek çift dokunuş). */
function doubleTap(element: any) {
  let onPress: (() => unknown) | null = null;
  for (let node = element; node && !onPress; node = node.parent) {
    if (typeof node.props?.onPress === 'function') onPress = node.props.onPress;
  }
  for (let fiber = element.unstable_fiber; fiber && !onPress; fiber = fiber.return) {
    if (typeof fiber.memoizedProps?.onPress === 'function') onPress = fiber.memoizedProps.onPress;
  }
  if (!onPress) throw new Error('Press handler not found');
  return Promise.all([onPress(), onPress()]);
}

describe('AddExpenseScreen handlers (BUG-15)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockParams = {};
  });

  it('hızlı çift dokunuşta "Kaydet" yalnız bir harcama oluşturur', async () => {
    const pending = deferred<number>();
    create.mockImplementation(() => pending.promise);
    const screen = await render(<AddExpenseScreen />);
    await fireEvent.changeText(screen.getAllByPlaceholderText('0.00')[0], '25');

    let taps!: Promise<unknown>;
    await act(async () => {
      taps = doubleTap(screen.getByTestId('add-expense-save'));
      await Promise.resolve();
    });
    await act(async () => {
      pending.resolve(91);
      await taps;
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('başarılı kayıttan sonra ekran kapanmadan gelen dokunuş ikinci harcama oluşturmaz', async () => {
    create.mockResolvedValue(93);
    const screen = await render(<AddExpenseScreen />);
    await fireEvent.changeText(screen.getAllByPlaceholderText('0.00')[0], '25');

    await act(async () => {
      fireEvent.press(screen.getByTestId('add-expense-save'));
    });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-expense-save'));
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('kayıt başarısız olursa kilit açılır ve kullanıcı yeniden deneyebilir', async () => {
    create.mockRejectedValueOnce(new Error('locked')).mockResolvedValueOnce(94);
    const screen = await render(<AddExpenseScreen />);
    await fireEvent.changeText(screen.getAllByPlaceholderText('0.00')[0], '25');

    await act(async () => {
      fireEvent.press(screen.getByTestId('add-expense-save'));
    });
    await waitFor(() => expect(toastShow).toHaveBeenCalledWith('error_saving_data', 'error'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-expense-save'));
    });

    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  });

  it('hızlı çift dokunuşta "Ayrıntılı düzenle" yalnız bir taslak oluşturur', async () => {
    const pending = deferred<number>();
    create.mockImplementation(() => pending.promise);
    const screen = await render(<AddExpenseScreen />);
    await fireEvent.changeText(screen.getAllByPlaceholderText('0.00')[0], '25');

    let taps!: Promise<unknown>;
    await act(async () => {
      taps = doubleTap(screen.getByTestId('add-expense-detailed'));
      await Promise.resolve();
    });
    await act(async () => {
      pending.resolve(92);
      await taps;
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('silme başarısız olursa hata bildirir, ekranı kapatmaz ve reddi sızdırmaz', async () => {
    mockParams = { id: '7' };
    getById.mockResolvedValue({
      id: 7, total_amount: 10, currency: 'PLN', note: null, date: '2026-11-11',
      container_deposit_paid: 0, container_voucher_used: 0, items: [],
      vendor_name: null, category_id: null,
    });
    remove.mockRejectedValue(new Error('locked'));
    const screen = await render(<AddExpenseScreen />);

    await fireEvent.press(await screen.findByLabelText('delete'));
    await act(async () => {
      fireEvent.press(await screen.findByTestId('confirm-expense-delete'));
    });

    await waitFor(() => expect(toastShow).toHaveBeenCalledWith('delete_failed', 'error'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockTriggerRefresh).not.toHaveBeenCalled();
  });
});
