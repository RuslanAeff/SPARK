import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import DepositWalletScreen from '../../../app/deposit-wallet';
import { ContainerDepositDao } from '../../db/containerDepositDao';
import { SparkToast } from '../SparkToast';

const mockTriggerRefresh = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View: ({ children, ...props }: any) => React.createElement(View, props, children) },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    interpolate: (_v: number, _i: number[], out: number[]) => out[out.length - 1],
    Easing: { bezier: () => undefined, out: () => undefined, cubic: undefined },
    ReduceMotion: { System: 'system' },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock('../../db/containerDepositDao', () => ({
  ContainerDepositDao: {
    getSummary: jest.fn(async () => ({ depositPaid: 0, recovered: 0, availableVoucher: 0 })),
    getAll: jest.fn(),
    createVoucher: jest.fn(),
    deleteVoucher: jest.fn(),
  },
}));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'PLN' }) }));
jest.mock('../../context/RefreshContext', () => ({ useRefreshActions: () => ({ triggerRefresh: mockTriggerRefresh }) }));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'light', useThemeRevision: () => 0 }));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../CustomDatePicker', () => () => null);
jest.mock('../BudgetDisclosure', () => ({ children }: any) => children ?? null);
jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return ({ visible, onDelete }: any) => (visible
    ? React.createElement(View, null, React.createElement(Pressable, { testID: 'confirm-voucher-delete', onPress: onDelete }))
    : null);
});

const voucher = (id: number, status: string, redemption: number | null = null) => ({
  id, uid: `u${id}`, amount: 2, currency: 'PLN', issued_date: '2026-11-01', expires_on: null,
  status, redeemed_date: status === 'redeemed' ? '2026-11-05' : null, redemption_expense_id: redemption,
  note: null, created_at: 'x',
});

describe('DepositWalletScreen voucher deletion (BUG-28)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ContainerDepositDao.getAll as jest.Mock).mockResolvedValue([
      voucher(1, 'available'), voucher(2, 'expired'), voucher(3, 'redeemed', 7),
    ]);
  });

  it('offers delete only for unused vouchers and deletes after confirmation', async () => {
    const screen = await render(<DepositWalletScreen />);
    await waitFor(() => expect(screen.getAllByTestId(/^voucher-delete-/)).toHaveLength(2));
    expect(screen.queryByTestId('voucher-delete-3')).toBeNull();

    await act(async () => { fireEvent.press(screen.getByTestId('voucher-delete-2')); });
    expect(ContainerDepositDao.deleteVoucher).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(await screen.findByTestId('confirm-voucher-delete')); });

    expect(ContainerDepositDao.deleteVoucher).toHaveBeenCalledWith(2);
    await waitFor(() => expect(SparkToast.show).toHaveBeenCalledWith('deposit_voucher_deleted', 'success'));
    expect(mockTriggerRefresh).toHaveBeenCalled();
  });
});
